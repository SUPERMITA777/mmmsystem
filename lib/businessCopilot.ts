/**
 * businessCopilot.ts
 *
 * Motor del Asistente Copiloto IA para administradores y dueños en MMM System:
 *   - 7 herramientas de lectura y análisis BI (ventas, menú BCG, stock, caja, clientes, catálogo, config)
 *   - 8 herramientas `propose_*` (siempre requieren confirmación obligatoria del usuario)
 *   - Ejecución segura por `sucursal_id` + auditoría y rollback en `ai_command_log`
 */

import Groq from "groq-sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
    getArgentinaDate,
    getStartOfDayArgentina,
    getEndOfDayArgentina,
    ARGENTINA_ZONE,
} from "@/lib/dateUtils";
import { getProductDiscount, isValidDiscountTime, type Descuento } from "@/lib/discountUtils";
import {
    callGeminiGenerateContent,
    callOpenAIChatCompletion,
    estimateCostUsd,
    getAvailableProviders,
    getMonthlyTokenUsage,
    GROQ_CHAT_MODELS,
    logTokenUsage,
    type GeminiContent,
    type GeminiPart,
    type TokenUsageRecord,
} from "@/lib/aiProviders";
import { buildCopilotSystemPrompt } from "@/lib/assistantSkills";
import { getAgentConfig, updateAgentConfig } from "@/lib/aiAgentService";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

export type CopilotActionType =
    | "create_product"
    | "update_product"
    | "bulk_update_prices"
    | "toggle_by_ingredient"
    | "set_product_promo"
    | "create_discount"
    | "toggle_discount"
    | "toggle_store_temp_closed"
    | "add_whatsapp_snippet";

export interface ProposalPreviewRow {
    label: string;
    before?: string;
    after: string;
    detail?: string;
}

export interface PendingActionProposal {
    id: string;
    actionType: CopilotActionType;
    title: string;
    summary: string;
    riskLevel: "low" | "medium" | "high";
    previewRows: ProposalPreviewRow[];
    payload: Record<string, any>;
}

export interface CopilotMessage {
    role: "user" | "assistant";
    content: string;
}

export interface CopilotChatResult {
    reply: string;
    proposals: PendingActionProposal[];
    toolsUsed: string[];
    usage?: TokenUsageRecord;
    provider?: string;
    model?: string;
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function normalizeText(value: string): string {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function fmtARS(amount: number): string {
    return `$${new Intl.NumberFormat("es-AR").format(Math.round(Number(amount || 0)))}`;
}

function shiftArgentinaDate(dateStr: string, deltaDays: number): string {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + deltaDays);
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: ARGENTINA_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
}

function daysBetweenInclusive(fromDate: string, toDate: string): number {
    const a = new Date(`${fromDate}T12:00:00`).getTime();
    const b = new Date(`${toDate}T12:00:00`).getTime();
    return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1);
}

function getArgentinaDayAndBand(isoStr: string): { dayLabel: string; bandLabel: string } {
    const d = new Date(isoStr);
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: ARGENTINA_ZONE,
        weekday: "short",
        hour: "2-digit",
        hour12: false,
    }).formatToParts(d);

    const wd = parts.find((p) => p.type === "weekday")?.value || "Mon";
    const hr = Number(parts.find((p) => p.type === "hour")?.value || 0);

    const dayMap: Record<string, string> = {
        Mon: "Lunes",
        Tue: "Martes",
        Wed: "Miércoles",
        Thu: "Jueves",
        Fri: "Viernes",
        Sat: "Sábado",
        Sun: "Domingo",
    };

    let bandLabel = "Noche (19-24hs)";
    if (hr >= 0 && hr < 6) bandLabel = "Madrugada (00-06hs)";
    else if (hr >= 6 && hr < 11) bandLabel = "Mañana (06-11hs)";
    else if (hr >= 11 && hr < 16) bandLabel = "Mediodía (11-16hs)";
    else if (hr >= 16 && hr < 19) bandLabel = "Tarde (16-19hs)";

    return { dayLabel: dayMap[wd] || wd, bandLabel };
}

function roundPrice(raw: number, roundTo: number = 0): number {
    const positive = Math.max(0, raw);
    if (!roundTo || roundTo <= 1) return Math.round(positive);
    return Math.max(0, Math.round(positive / roundTo) * roundTo);
}

function calcPctChange(curr: number, prev: number): number | null {
    if (prev <= 0) return null;
    return Number((((curr - prev) / prev) * 100).toFixed(1));
}

async function fetchPedidoItemsInChunks(pedidoIds: string[]) {
    const allItems: any[] = [];
    const chunkSize = 150;
    for (let i = 0; i < pedidoIds.length; i += chunkSize) {
        const chunk = pedidoIds.slice(i, i + chunkSize);
        const { data } = await supabaseAdmin
            .from("pedido_items")
            .select("pedido_id, producto_id, nombre_producto, cantidad, precio_unitario, descuento, subtotal, adicionales")
            .in("pedido_id", chunk);
        if (data) allItems.push(...data);
    }
    return allItems;
}

async function findProductsByIngredientForSucursal(sucursalId: string, ingredientName: string) {
    const { data: matchingIngredients } = await supabaseAdmin
        .from("ingredientes")
        .select("id, nombre")
        .eq("sucursal_id", sucursalId)
        .ilike("nombre", `%${ingredientName}%`);

    if (!matchingIngredients || matchingIngredients.length === 0) {
        return { products: [], ingredientNames: [] };
    }

    const ingredientIds = matchingIngredients.map((i: any) => i.id);
    const ingredientNames = matchingIngredients.map((i: any) => i.nombre);
    const productIdSet = new Set<string>();

    const [{ data: recetas }, { data: fichaItems }] = await Promise.all([
        supabaseAdmin
            .from("recetas")
            .select("producto_id")
            .eq("sucursal_id", sucursalId)
            .in("ingrediente_id", ingredientIds),
        supabaseAdmin
            .from("ficha_tecnica_items")
            .select("ficha_tecnica_id")
            .eq("sucursal_id", sucursalId)
            .eq("tipo", "ingrediente")
            .in("ingrediente_id", ingredientIds),
    ]);

    for (const r of recetas || []) {
        if (r.producto_id) productIdSet.add(r.producto_id);
    }

    const fichaIds = Array.from(new Set((fichaItems || []).map((f: any) => f.ficha_tecnica_id).filter(Boolean)));
    if (fichaIds.length > 0) {
        const [{ data: prods1 }, { data: subItems }] = await Promise.all([
            supabaseAdmin
                .from("productos")
                .select("id")
                .eq("sucursal_id", sucursalId)
                .in("ficha_tecnica_id", fichaIds),
            supabaseAdmin
                .from("ficha_tecnica_items")
                .select("ficha_tecnica_id")
                .eq("sucursal_id", sucursalId)
                .eq("tipo", "sub_receta")
                .in("sub_ficha_id", fichaIds),
        ]);

        for (const p of prods1 || []) productIdSet.add(p.id);

        const parentFichaIds = Array.from(
            new Set((subItems || []).map((s: any) => s.ficha_tecnica_id).filter(Boolean))
        );
        if (parentFichaIds.length > 0) {
            const { data: prods2 } = await supabaseAdmin
                .from("productos")
                .select("id")
                .eq("sucursal_id", sucursalId)
                .in("ficha_tecnica_id", parentFichaIds);
            for (const p of prods2 || []) productIdSet.add(p.id);
        }
    }

    if (productIdSet.size === 0) {
        return { products: [], ingredientNames };
    }

    const { data: products } = await supabaseAdmin
        .from("productos")
        .select("id, nombre, precio, activo")
        .eq("sucursal_id", sucursalId)
        .in("id", Array.from(productIdSet));

    return { products: products || [], ingredientNames };
}

// ═══════════════════════════════════════════
// COPILOT TOOLS SCHEMA (Gemini + OpenAI compatible)
// ═══════════════════════════════════════════

const COPILOT_TOOLS: any[] = [
    {
        functionDeclarations: [
            // ── READ / BI TOOLS ──
            {
                name: "get_sales_summary",
                description:
                    "Obtener métricas de ventas, pedidos entregados, ticket promedio, cancelaciones y desglose por canal, origen, medio de pago, día de la semana y franja horaria. Opcionalmente compara contra el período anterior.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        from_date: {
                            type: "STRING",
                            description: "Fecha inicio YYYY-MM-DD en hora Argentina (default: hace 6 días)",
                        },
                        to_date: {
                            type: "STRING",
                            description: "Fecha fin YYYY-MM-DD en hora Argentina (default: hoy)",
                        },
                        compare_previous: {
                            type: "BOOLEAN",
                            description: "Si es true, compara contra el período anterior de igual duración",
                        },
                    },
                },
            },
            {
                name: "get_menu_engineering",
                description:
                    "Realizar ingeniería de menú (Matriz BCG: Estrellas, Caballos de batalla, Incógnitas y Perros) cruzando ventas reales del período con costos de fichas técnicas o costo_fijo.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        from_date: {
                            type: "STRING",
                            description: "Fecha inicio YYYY-MM-DD (default: hace 29 días)",
                        },
                        to_date: {
                            type: "STRING",
                            description: "Fecha fin YYYY-MM-DD (default: hoy)",
                        },
                        category: {
                            type: "STRING",
                            description: "Filtrar por categoría (opcional)",
                        },
                    },
                },
            },
            {
                name: "get_stock_alerts",
                description:
                    "Consultar ingredientes debajo o cerca del stock mínimo, productos con control de stock bajo/agotado y qué platos del menú dependen de insumos críticos.",
            },
            {
                name: "get_finance_cashflow",
                description:
                    "Obtener flujo financiero de cajas, movimientos manuales (ingresos/egresos por concepto), diferencias de arqueo por cajero y mix de medios de pago.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        from_date: {
                            type: "STRING",
                            description: "Fecha inicio YYYY-MM-DD (default: hace 6 días)",
                        },
                        to_date: {
                            type: "STRING",
                            description: "Fecha fin YYYY-MM-DD (default: hoy)",
                        },
                    },
                },
            },
            {
                name: "get_customers_insights",
                description:
                    "Analizar top clientes por gasto/frecuencia, clientes habituales inactivos hace más de N días y zonas de envío con más demanda.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        days_inactive: {
                            type: "NUMBER",
                            description: "Días sin pedir para considerar inactivo a un cliente recurrente (default: 30)",
                        },
                    },
                },
            },
            {
                name: "get_catalog_and_promos",
                description:
                    "Consultar categorías, productos (con precios, promociones temporales activas, costos y estado) y reglas de descuentos vigentes.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        category: { type: "STRING", description: "Filtrar por categoría (opcional)" },
                        search: { type: "STRING", description: "Buscar producto por nombre (opcional)" },
                        include_inactive: { type: "BOOLEAN", description: "Incluir inactivos/ocultos (default true)" },
                    },
                },
            },
            {
                name: "get_store_overview",
                description:
                    "Consultar configuración general del local: nombre, horarios semanales, zonas de entrega, medios de pago, estado cerrado temporalmente y consumo del bot WhatsApp.",
            },

            // ── PROPOSAL (CONFIRMATION-REQUIRED) WRITE TOOLS ──
            {
                name: "propose_create_product",
                description:
                    "Prepara una propuesta de creación de un producto nuevo en el menú (siempre requiere confirmación del usuario).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        nombre: { type: "STRING", description: "Nombre del nuevo producto" },
                        category_name: { type: "STRING", description: "Nombre de la categoría donde ubicarlo" },
                        precio: { type: "NUMBER", description: "Precio de venta en ARS" },
                        descripcion: { type: "STRING", description: "Descripción para la carta" },
                        costo_fijo: { type: "NUMBER", description: "Costo estimado unitario opcional" },
                        visible_en_menu: { type: "BOOLEAN", description: "Visible en la carta web (default true)" },
                        producto_sugerido: { type: "BOOLEAN", description: "Marcar como sugerido/destacado (default false)" },
                    },
                    required: ["nombre", "category_name", "precio"],
                },
            },
            {
                name: "propose_update_product",
                description:
                    "Prepara una propuesta para modificar un producto existente (nombre, precio, descripción, costo_fijo, activo, visible_en_menu, producto_sugerido).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        product_name: { type: "STRING", description: "Nombre del producto actual a editar" },
                        new_name: { type: "STRING", description: "Nuevo nombre (opcional)" },
                        precio: { type: "NUMBER", description: "Nuevo precio de venta (opcional)" },
                        descripcion: { type: "STRING", description: "Nueva descripción (opcional)" },
                        costo_fijo: { type: "NUMBER", description: "Nuevo costo fijo (opcional)" },
                        activo: { type: "BOOLEAN", description: "Activar o desactivar producto (opcional)" },
                        visible_en_menu: { type: "BOOLEAN", description: "Mostrar/ocultar en menú web (opcional)" },
                        producto_sugerido: { type: "BOOLEAN", description: "Destacar como producto sugerido (opcional)" },
                    },
                    required: ["product_name"],
                },
            },
            {
                name: "propose_bulk_update_prices",
                description:
                    "Prepara una propuesta de aumento o rebaja masiva de precios sobre toda la carta, una categoría o una lista específica de productos, con redondeo psicológico argentino.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        scope: {
                            type: "STRING",
                            description: "'all' (toda la carta), 'category' (una categoría) o 'products' (lista puntual)",
                        },
                        category_name: { type: "STRING", description: "Categoría si scope='category'" },
                        product_names: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Lista de nombres si scope='products'",
                        },
                        mode: { type: "STRING", description: "'percent' (porcentaje) o 'fixed' (monto fijo ARS)" },
                        value: {
                            type: "NUMBER",
                            description: "Valor positivo para subir o negativo para bajar (ej: 10 para +10%, -15 para -15%)",
                        },
                        round_to: {
                            type: "NUMBER",
                            description: "Redondear resultado al múltiplo más cercano: 0, 50, 100, 500 o 1000 (recomendado 100 o 500)",
                        },
                    },
                    required: ["scope", "mode", "value"],
                },
            },
            {
                name: "propose_toggle_by_ingredient",
                description:
                    "Prepara una propuesta para activar o desactivar todos los productos que contengan un ingrediente en su receta o ficha técnica.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        ingredient_name: { type: "STRING", description: "Nombre del ingrediente" },
                        active: { type: "BOOLEAN", description: "false para pausar productos, true para reactivarlos" },
                    },
                    required: ["ingredient_name", "active"],
                },
            },
            {
                name: "propose_set_product_promo",
                description:
                    "Prepara una propuesta para configurar o quitar precio promocional temporal en uno o varios productos (ideal para promos en días flojos Lun–Mié o happy hour).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        product_names: {
                            type: "ARRAY",
                            items: { type: "STRING" },
                            description: "Nombres de los productos a incluir en la promo",
                        },
                        active: { type: "BOOLEAN", description: "true para activar promo, false para desactivarla" },
                        precio_promocional: {
                            type: "NUMBER",
                            description: "Precio promocional exacto (si todos llevan el mismo precio)",
                        },
                        discount_percent: {
                            type: "NUMBER",
                            description: "Porcentaje de descuento sobre precio regular (alternativa a precio_promocional)",
                        },
                        round_to: { type: "NUMBER", description: "Redondeo al calcular discount_percent (ej: 100)" },
                        promo_desde: { type: "STRING", description: "Fecha inicio YYYY-MM-DD (opcional)" },
                        promo_hasta: { type: "STRING", description: "Fecha fin YYYY-MM-DD (opcional)" },
                        promo_hora_desde: { type: "STRING", description: "Hora inicio HH:mm (opcional)" },
                        promo_hora_hasta: { type: "STRING", description: "Hora fin HH:mm (opcional)" },
                        promo_dias: {
                            type: "ARRAY",
                            items: { type: "NUMBER" },
                            description: "Días activos: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb",
                        },
                    },
                    required: ["product_names", "active"],
                },
            },
            {
                name: "propose_create_discount",
                description:
                    "Prepara una propuesta para crear una regla de descuento o cupón (ej: 10% OFF en efectivo, cupón de reactivación o descuento por categoría).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        nombre: { type: "STRING", description: "Nombre visible del descuento" },
                        tipo: { type: "STRING", description: "'porcentaje' o 'fijo'" },
                        valor: { type: "NUMBER", description: "Porcentaje (ej: 10) o monto fijo en ARS" },
                        codigo: { type: "STRING", description: "Código de cupón opcional (ej: MARTES15)" },
                        aplicar_a: { type: "STRING", description: "'general', 'categoria' o 'producto'" },
                        category_names: { type: "ARRAY", items: { type: "STRING" } },
                        product_names: { type: "ARRAY", items: { type: "STRING" } },
                        payment_method_name: {
                            type: "STRING",
                            description: "Medio de pago asociado (ej: 'Efectivo' o 'Transferencia')",
                        },
                        auto_aplicar: { type: "BOOLEAN", description: "Si se aplica automáticamente sin código" },
                        minimo_compra: { type: "NUMBER" },
                        uso_limite: { type: "NUMBER" },
                        no_acumulable: { type: "BOOLEAN" },
                        fecha_desde: { type: "STRING", description: "YYYY-MM-DD" },
                        fecha_hasta: { type: "STRING", description: "YYYY-MM-DD" },
                        hora_desde: { type: "STRING", description: "HH:mm" },
                        hora_hasta: { type: "STRING", description: "HH:mm" },
                    },
                    required: ["nombre", "tipo", "valor"],
                },
            },
            {
                name: "propose_toggle_discount",
                description: "Prepara una propuesta para activar o desactivar un descuento existente.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        discount_name: { type: "STRING", description: "Nombre o código del descuento" },
                        active: { type: "BOOLEAN", description: "true para activar, false para desactivar" },
                    },
                    required: ["discount_name", "active"],
                },
            },
            {
                name: "propose_store_or_bot_action",
                description:
                    "Prepara una propuesta para cerrar/abrir temporalmente el local o agregar una información/promo nueva al entrenamiento del Agente IA de WhatsApp.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        action: {
                            type: "STRING",
                            description: "'toggle_temp_closed' o 'add_whatsapp_snippet'",
                        },
                        closed: { type: "BOOLEAN", description: "true para cerrar temporalmente, false para reabrir" },
                        closed_message: { type: "STRING", description: "Mensaje para mostrar cuando está cerrado" },
                        snippet_title: { type: "STRING", description: "Título del conocimiento para el bot WhatsApp" },
                        snippet_content: { type: "STRING", description: "Contenido para el bot WhatsApp" },
                    },
                    required: ["action"],
                },
            },
        ],
    },
];

// ═══════════════════════════════════════════
// READ TOOLS EXECUTION
// ═══════════════════════════════════════════

async function executeReadTool(
    toolName: string,
    args: Record<string, any>,
    sucursalId: string
): Promise<string> {
    const today = getArgentinaDate();

    switch (toolName) {
        case "get_sales_summary": {
            const toDate = args.to_date || today;
            const fromDate = args.from_date || shiftArgentinaDate(toDate, -6);
            const comparePrev = args.compare_previous !== false;

            const fetchPeriod = async (from: string, to: string) => {
                const { data } = await supabaseAdmin
                    .from("pedidos")
                    .select(
                        "id, total, subtotal, descuento, costo_envio, tipo, estado, origen, metodo_pago_nombre, created_at"
                    )
                    .eq("sucursal_id", sucursalId)
                    .gte("created_at", getStartOfDayArgentina(from))
                    .lte("created_at", getEndOfDayArgentina(to));

                const all = data || [];
                const delivered = all.filter((p: any) => p.estado === "entregado");
                const cancelled = all.filter((p: any) => p.estado === "cancelado");
                const inProgress = all.filter(
                    (p: any) => p.estado !== "entregado" && p.estado !== "cancelado"
                );

                const revenue = delivered.reduce((s: number, p: any) => s + Number(p.total || 0), 0);
                const discounts = delivered.reduce((s: number, p: any) => s + Number(p.descuento || 0), 0);
                const deliveryFees = delivered.reduce((s: number, p: any) => s + Number(p.costo_envio || 0), 0);
                const avgTicket = delivered.length > 0 ? Math.round(revenue / delivered.length) : 0;

                const byChannel: Record<string, { count: number; total: number }> = {};
                const byOrigin: Record<string, { count: number; total: number }> = {};
                const byPayment: Record<string, { count: number; total: number }> = {};
                const byWeekday: Record<string, { count: number; total: number }> = {};
                const byTimeBand: Record<string, { count: number; total: number }> = {};

                for (const p of delivered) {
                    const tot = Number(p.total || 0);
                    const ch = p.tipo || "otro";
                    if (!byChannel[ch]) byChannel[ch] = { count: 0, total: 0 };
                    byChannel[ch].count++;
                    byChannel[ch].total += tot;

                    const orig = p.origen || "pos";
                    if (!byOrigin[orig]) byOrigin[orig] = { count: 0, total: 0 };
                    byOrigin[orig].count++;
                    byOrigin[orig].total += tot;

                    const pm = p.metodo_pago_nombre || "Sin especificar";
                    if (!byPayment[pm]) byPayment[pm] = { count: 0, total: 0 };
                    byPayment[pm].count++;
                    byPayment[pm].total += tot;

                    const { dayLabel, bandLabel } = getArgentinaDayAndBand(p.created_at);
                    if (!byWeekday[dayLabel]) byWeekday[dayLabel] = { count: 0, total: 0 };
                    byWeekday[dayLabel].count++;
                    byWeekday[dayLabel].total += tot;

                    if (!byTimeBand[bandLabel]) byTimeBand[bandLabel] = { count: 0, total: 0 };
                    byTimeBand[bandLabel].count++;
                    byTimeBand[bandLabel].total += tot;
                }

                return {
                    from,
                    to,
                    delivered_orders: delivered.length,
                    cancelled_orders: cancelled.length,
                    in_progress_orders: inProgress.length,
                    cancellation_rate_pct:
                        all.length > 0 ? Number(((cancelled.length / all.length) * 100).toFixed(1)) : 0,
                    revenue,
                    avg_ticket: avgTicket,
                    total_discounts: discounts,
                    total_delivery_fees: deliveryFees,
                    by_channel: byChannel,
                    by_origin: byOrigin,
                    by_payment_method: byPayment,
                    by_weekday: byWeekday,
                    by_time_band: byTimeBand,
                };
            };

            const current = await fetchPeriod(fromDate, toDate);
            let comparison: any = null;

            if (comparePrev) {
                const span = daysBetweenInclusive(fromDate, toDate);
                const prevTo = shiftArgentinaDate(fromDate, -1);
                const prevFrom = shiftArgentinaDate(prevTo, -(span - 1));
                const previous = await fetchPeriod(prevFrom, prevTo);
                comparison = {
                    previous_period: `${prevFrom} a ${prevTo}`,
                    previous_revenue: previous.revenue,
                    previous_orders: previous.delivered_orders,
                    previous_avg_ticket: previous.avg_ticket,
                    revenue_change_pct: calcPctChange(current.revenue, previous.revenue),
                    orders_change_pct: calcPctChange(current.delivered_orders, previous.delivered_orders),
                    avg_ticket_change_pct: calcPctChange(current.avg_ticket, previous.avg_ticket),
                };
            }

            return JSON.stringify({ current, comparison });
        }

        case "get_menu_engineering": {
            const toDate = args.to_date || today;
            const fromDate = args.from_date || shiftArgentinaDate(toDate, -29);

            const [{ data: pedidos }, { data: prods }] = await Promise.all([
                supabaseAdmin
                    .from("pedidos")
                    .select("id")
                    .eq("sucursal_id", sucursalId)
                    .eq("estado", "entregado")
                    .gte("created_at", getStartOfDayArgentina(fromDate))
                    .lte("created_at", getEndOfDayArgentina(toDate)),
                supabaseAdmin
                    .from("productos")
                    .select("id, nombre, precio, costo_fijo, ficha_tecnica_id, activo, categoria_id, categorias(nombre), fichas_tecnicas(costo_total)")
                    .eq("sucursal_id", sucursalId),
            ]);

            const pedidoIds = (pedidos || []).map((p: any) => p.id);
            const orderItems = pedidoIds.length > 0 ? await fetchPedidoItemsInChunks(pedidoIds) : [];

            const prodMap = new Map<string, any>();
            for (const p of prods || []) {
                const catName = Array.isArray(p.categorias)
                    ? p.categorias[0]?.nombre || "Sin categoría"
                    : (p.categorias as any)?.nombre || "Sin categoría";
                if (args.category && !normalizeText(catName).includes(normalizeText(args.category))) {
                    continue;
                }
                const fichaCost = Array.isArray(p.fichas_tecnicas)
                    ? Number(p.fichas_tecnicas[0]?.costo_total || 0)
                    : Number((p.fichas_tecnicas as any)?.costo_total || 0);
                const unitCost = fichaCost > 0 ? fichaCost : Number(p.costo_fijo || 0);

                prodMap.set(p.id, {
                    id: p.id,
                    nombre: p.nombre,
                    categoria: catName,
                    precio_actual: Number(p.precio || 0),
                    costo_unitario: unitCost,
                    has_cost: unitCost > 0,
                    activo: Boolean(p.activo),
                    unidades: 0,
                    ingresos: 0,
                    costo_total: 0,
                });
            }

            for (const it of orderItems) {
                if (!it.producto_id) continue;
                const entry = prodMap.get(it.producto_id);
                if (!entry) continue;
                const qty = Number(it.cantidad || 1);
                const extrasUnit = Array.isArray(it.adicionales)
                    ? it.adicionales.reduce((s: number, a: any) => s + Number(a?.precio || 0), 0)
                    : 0;
                const lineRevenue =
                    it.subtotal != null
                        ? Number(it.subtotal) + extrasUnit * qty
                        : (Number(it.precio_unitario || 0) + extrasUnit) * qty - Number(it.descuento || 0);
                entry.unidades += qty;
                entry.ingresos += Math.max(0, lineRevenue);
                entry.costo_total += entry.costo_unitario * qty;
            }

            const rows = Array.from(prodMap.values());
            const soldWithCost = rows.filter((r) => r.unidades > 0 && r.has_cost);
            const avgUnits =
                soldWithCost.length > 0
                    ? soldWithCost.reduce((s, r) => s + r.unidades, 0) / soldWithCost.length
                    : 0;
            const avgMarginUnit =
                soldWithCost.length > 0
                    ? soldWithCost.reduce(
                          (s, r) => s + (r.ingresos / r.unidades - r.costo_unitario),
                          0
                      ) / soldWithCost.length
                    : 0;

            const analyzed = rows
                .filter((r) => r.unidades > 0)
                .map((r) => {
                    const avgPriceSold = r.ingresos / r.unidades;
                    const marginUnit = r.has_cost ? avgPriceSold - r.costo_unitario : null;
                    const foodCostPct =
                        r.has_cost && r.ingresos > 0
                            ? Number(((r.costo_total / r.ingresos) * 100).toFixed(1))
                            : null;
                    const totalMargin = r.has_cost ? Math.round(r.ingresos - r.costo_total) : null;

                    let bcg = "Sin costo cargado";
                    if (r.has_cost && marginUnit !== null) {
                        const highPop = r.unidades >= avgUnits;
                        const highMargin = marginUnit >= avgMarginUnit;
                        if (highPop && highMargin) bcg = "Estrella";
                        else if (highPop && !highMargin) bcg = "Caballo de batalla";
                        else if (!highPop && highMargin) bcg = "Incógnita";
                        else bcg = "Perro";
                    }

                    return {
                        nombre: r.nombre,
                        categoria: r.categoria,
                        unidades: r.unidades,
                        ingresos: Math.round(r.ingresos),
                        precio_actual: r.precio_actual,
                        costo_unitario: r.has_cost ? r.costo_unitario : null,
                        food_cost_pct: foodCostPct,
                        margen_total: totalMargin,
                        clasificacion_bcg: bcg,
                    };
                })
                .sort((a, b) => b.unidades - a.unidades);

            const allZeroSalesActive = rows.filter((r) => r.unidades === 0 && r.activo);
            const zeroSalesActive = allZeroSalesActive
                .map((r) => ({ nombre: r.nombre, categoria: r.categoria, precio_actual: r.precio_actual }))
                .slice(0, 8);

            const missingCostCount = rows.filter((r) => !r.has_cost && r.activo).length;
            const highFoodCost = analyzed.filter((a) => a.food_cost_pct !== null && a.food_cost_pct > 38);

            return JSON.stringify({
                period: `${fromDate} a ${toDate}`,
                total_products_evaluated: rows.length,
                evaluated_sold_count: analyzed.length,
                products_without_cost_count: missingCostCount,
                high_food_cost_count: highFoodCost.length,
                high_food_cost_alerts: highFoodCost.slice(0, 8),
                top_products: analyzed.slice(0, 15),
                zero_sales_active_count: allZeroSalesActive.length,
                zero_sales_active_products: zeroSalesActive,
            });
        }

        case "get_stock_alerts": {
            const [{ data: ingredientes }, { data: stockProds }] = await Promise.all([
                supabaseAdmin
                    .from("ingredientes")
                    .select("id, nombre, unidad, stock_actual, stock_minimo, costo_unitario, proveedor, categoria")
                    .eq("sucursal_id", sucursalId)
                    .eq("activo", true)
                    .order("nombre", { ascending: true }),
                supabaseAdmin
                    .from("productos")
                    .select("id, nombre, stock_actual, stock_minimo, control_stock, activo")
                    .eq("sucursal_id", sucursalId)
                    .eq("control_stock", true)
                    .eq("activo", true),
            ]);

            const criticalIngredients = (ingredientes || [])
                .filter((i: any) => Number(i.stock_actual || 0) <= Number(i.stock_minimo || 0))
                .sort(
                    (a: any, b: any) =>
                        Number(b.stock_minimo || 0) -
                        Number(b.stock_actual || 0) -
                        (Number(a.stock_minimo || 0) - Number(a.stock_actual || 0))
                );
            const warningIngredients = (ingredientes || []).filter((i: any) => {
                const act = Number(i.stock_actual || 0);
                const min = Number(i.stock_minimo || 0);
                return min > 0 && act > min && act <= min * 1.25;
            });

            const criticalProducts = (stockProds || []).filter(
                (p: any) => Number(p.stock_actual || 0) <= Number(p.stock_minimo || 0)
            );

            const affectedByCritical: Array<{
                ingrediente: string;
                total_afectados: number;
                productos_afectados: string[];
            }> = [];
            for (const ing of criticalIngredients.slice(0, 6)) {
                const res = await findProductsByIngredientForSucursal(sucursalId, ing.nombre);
                if (res.products.length > 0) {
                    affectedByCritical.push({
                        ingrediente: ing.nombre,
                        total_afectados: res.products.length,
                        productos_afectados: res.products.slice(0, 8).map((p: any) => p.nombre),
                    });
                }
            }

            return JSON.stringify({
                total_active_ingredients: (ingredientes || []).length,
                critical_ingredients_count: criticalIngredients.length,
                critical_ingredients: criticalIngredients.slice(0, 15).map((i: any) => ({
                    nombre: i.nombre,
                    stock_actual: Number(i.stock_actual || 0),
                    stock_minimo: Number(i.stock_minimo || 0),
                    unidad: i.unidad,
                    proveedor: i.proveedor || null,
                })),
                warning_ingredients: warningIngredients.slice(0, 8).map((i: any) => ({
                    nombre: i.nombre,
                    stock_actual: Number(i.stock_actual || 0),
                    stock_minimo: Number(i.stock_minimo || 0),
                    unidad: i.unidad,
                })),
                critical_direct_stock_products: criticalProducts.slice(0, 10).map((p: any) => ({
                    nombre: p.nombre,
                    stock_actual: Number(p.stock_actual || 0),
                    stock_minimo: Number(p.stock_minimo || 0),
                })),
                affected_menu_products: affectedByCritical,
            });
        }

        case "get_finance_cashflow": {
            const toDate = args.to_date || today;
            const fromDate = args.from_date || shiftArgentinaDate(toDate, -6);

            const [{ data: cajas }, { data: pedidos }] = await Promise.all([
                supabaseAdmin
                    .from("cajas")
                    .select(
                        "id, cajero_nombre, fecha_apertura, fecha_cierre, monto_apertura, monto_cierre, monto_esperado, diferencia, estado, transacciones_caja(id, tipo, monto, concepto, created_at, metodos_pago(nombre))"
                    )
                    .eq("sucursal_id", sucursalId)
                    .gte("fecha_apertura", getStartOfDayArgentina(fromDate))
                    .lte("fecha_apertura", getEndOfDayArgentina(toDate))
                    .order("fecha_apertura", { ascending: false }),
                supabaseAdmin
                    .from("pedidos")
                    .select("total, metodo_pago_nombre, estado")
                    .eq("sucursal_id", sucursalId)
                    .eq("estado", "entregado")
                    .gte("created_at", getStartOfDayArgentina(fromDate))
                    .lte("created_at", getEndOfDayArgentina(toDate)),
            ]);

            const salesByMethod: Record<string, number> = {};
            let totalSales = 0;
            for (const p of pedidos || []) {
                const m = p.metodo_pago_nombre || "Sin especificar";
                const t = Number(p.total || 0);
                salesByMethod[m] = (salesByMethod[m] || 0) + t;
                totalSales += t;
            }

            let manualIngresos = 0;
            let manualEgresos = 0;
            const egresosByConcept: Record<string, number> = {};
            let totalDiferencia = 0;
            const cajasWithDiff: any[] = [];

            for (const c of cajas || []) {
                if (c.estado === "cerrada" && c.diferencia != null) {
                    const diff = Number(c.diferencia || 0);
                    totalDiferencia += diff;
                    if (Math.abs(diff) >= 1) {
                        cajasWithDiff.push({
                            cajero: c.cajero_nombre || "Sin nombre",
                            fecha_apertura: c.fecha_apertura,
                            diferencia: diff,
                            monto_esperado: Number(c.monto_esperado || 0),
                            monto_cierre: Number(c.monto_cierre || 0),
                        });
                    }
                }
                for (const tx of c.transacciones_caja || []) {
                    const m = Number(tx.monto || 0);
                    if (tx.tipo === "ingreso") {
                        manualIngresos += m;
                    } else if (tx.tipo === "egreso") {
                        manualEgresos += m;
                        const concept = tx.concepto || "Varios";
                        egresosByConcept[concept] = (egresosByConcept[concept] || 0) + m;
                    }
                }
            }

            return JSON.stringify({
                period: `${fromDate} a ${toDate}`,
                total_sales_delivered: totalSales,
                sales_by_payment_method: salesByMethod,
                cajas_count: (cajas || []).length,
                manual_ingresos: manualIngresos,
                manual_egresos: manualEgresos,
                egresos_by_concept: egresosByConcept,
                net_after_manual_egresos: totalSales + manualIngresos - manualEgresos,
                total_arqueo_diferencia: totalDiferencia,
                shifts_with_differences: cajasWithDiff.slice(0, 10),
            });
        }

        case "get_customers_insights": {
            const daysInactive = Math.max(7, Number(args.days_inactive || 30));
            const cutoffDate = shiftArgentinaDate(today, -daysInactive);

            const [{ data: clientes }, { data: recentOrders }, { data: zonas }] = await Promise.all([
                supabaseAdmin
                    .from("clientes")
                    .select("id, nombre, telefono, direccion, total_pedidos, total_gastado, updated_at")
                    .eq("sucursal_id", sucursalId)
                    .order("total_gastado", { ascending: false })
                    .limit(100),
                supabaseAdmin
                    .from("pedidos")
                    .select("cliente_id, cliente_nombre, cliente_telefono, total, zona_entrega_id, created_at")
                    .eq("sucursal_id", sucursalId)
                    .eq("estado", "entregado")
                    .order("created_at", { ascending: false })
                    .limit(600),
                supabaseAdmin
                    .from("zonas_entrega")
                    .select("id, nombre, costo_envio")
                    .eq("sucursal_id", sucursalId)
                    .eq("activo", true),
            ]);

            const lastOrderByPhone = new Map<string, string>();
            const zoneCounts: Record<string, { count: number; total: number }> = {};
            const zoneNameMap = new Map((zonas || []).map((z: any) => [z.id, z.nombre]));

            for (const o of recentOrders || []) {
                const phone = (o.cliente_telefono || "").replace(/\D/g, "").slice(-10);
                if (phone && !lastOrderByPhone.has(phone)) {
                    lastOrderByPhone.set(phone, o.created_at);
                }
                if (o.zona_entrega_id) {
                    const zn = zoneNameMap.get(o.zona_entrega_id) || "Otra zona";
                    if (!zoneCounts[zn]) zoneCounts[zn] = { count: 0, total: 0 };
                    zoneCounts[zn].count++;
                    zoneCounts[zn].total += Number(o.total || 0);
                }
            }

            const inactiveRepeatAll = (clientes || [])
                .filter((c: any) => Number(c.total_pedidos || 0) >= 2)
                .filter((c: any) => {
                    const phone = (c.telefono || "").replace(/\D/g, "").slice(-10);
                    const lastAt = (phone && lastOrderByPhone.get(phone)) || c.updated_at;
                    return lastAt && lastAt < getStartOfDayArgentina(cutoffDate);
                });

            const inactiveRepeat = inactiveRepeatAll
                .slice(0, 8)
                .map((c: any) => ({
                    nombre: c.nombre,
                    total_pedidos: c.total_pedidos,
                    total_gastado: Number(c.total_gastado || 0),
                }));

            return JSON.stringify({
                total_clientes_top_sample: (clientes || []).length,
                top_10_customers: (clientes || []).slice(0, 8).map((c: any) => ({
                    nombre: c.nombre,
                    total_pedidos: c.total_pedidos,
                    total_gastado: Number(c.total_gastado || 0),
                })),
                inactive_repeat_customers_threshold_days: daysInactive,
                inactive_repeat_customers_count: inactiveRepeatAll.length,
                inactive_repeat_sample: inactiveRepeat,
                delivery_zones_performance: zoneCounts,
            });
        }

        case "get_catalog_and_promos": {
            const includeInactive = args.include_inactive !== false;
            const [{ data: cats }, { data: prods }, { data: descs }] = await Promise.all([
                supabaseAdmin
                    .from("categorias")
                    .select("id, nombre, activo")
                    .eq("sucursal_id", sucursalId)
                    .order("orden", { ascending: true }),
                supabaseAdmin
                    .from("productos")
                    .select(
                        "id, nombre, precio, precio_promocional, promo_activo, promo_desde, promo_hasta, promo_hora_desde, promo_hora_hasta, promo_dias, costo_fijo, ficha_tecnica_id, activo, visible_en_menu, producto_oculto, producto_sugerido, categoria_id, categorias(nombre), fichas_tecnicas(costo_total)"
                    )
                    .eq("sucursal_id", sucursalId)
                    .order("nombre", { ascending: true }),
                supabaseAdmin
                    .from("descuentos")
                    .select("*")
                    .eq("sucursal_id", sucursalId)
                    .order("created_at", { ascending: false }),
            ]);

            const activeDescs = ((descs || []) as Descuento[]).filter(isValidDiscountTime);

            const filteredProds = (prods || [])
                .filter((p: any) => (includeInactive ? true : p.activo))
                .filter((p: any) => {
                    if (args.category) {
                        const catName = Array.isArray(p.categorias)
                            ? p.categorias[0]?.nombre || ""
                            : (p.categorias as any)?.nombre || "";
                        if (!normalizeText(catName).includes(normalizeText(args.category))) return false;
                    }
                    if (args.search) {
                        if (!normalizeText(p.nombre).includes(normalizeText(args.search))) return false;
                    }
                    return true;
                })
                .map((p: any) => {
                    const catName = Array.isArray(p.categorias)
                        ? p.categorias[0]?.nombre || ""
                        : (p.categorias as any)?.nombre || "";
                    const fichaCost = Array.isArray(p.fichas_tecnicas)
                        ? Number(p.fichas_tecnicas[0]?.costo_total || 0)
                        : Number((p.fichas_tecnicas as any)?.costo_total || 0);
                    const cost = fichaCost > 0 ? fichaCost : Number(p.costo_fijo || 0);
                    const disc = getProductDiscount(p.id, p.categoria_id || "", activeDescs, p);

                    return {
                        id: p.id,
                        nombre: p.nombre,
                        categoria: catName,
                        precio: Number(p.precio || 0),
                        precio_efectivo_actual: disc ? disc.precioFinal(Number(p.precio || 0)) : Number(p.precio || 0),
                        promo_activo: Boolean(p.promo_activo),
                        precio_promocional: p.precio_promocional ? Number(p.precio_promocional) : null,
                        promo_dias: p.promo_dias,
                        promo_horario: p.promo_hora_desde ? `${p.promo_hora_desde}-${p.promo_hora_hasta}` : null,
                        costo_unitario: cost > 0 ? cost : null,
                        activo: Boolean(p.activo),
                        visible_en_menu: Boolean(p.visible_en_menu),
                        producto_sugerido: Boolean(p.producto_sugerido),
                    };
                });

            return JSON.stringify({
                categories: cats || [],
                products_count: filteredProds.length,
                products_truncated: filteredProds.length > 40,
                products: filteredProds.slice(0, 40),
                discounts: (descs || []).slice(0, 20).map((d: any) => ({
                    id: d.id,
                    nombre: d.nombre,
                    codigo: d.codigo,
                    tipo: d.tipo,
                    valor: d.valor,
                    aplicar_a: d.aplicar_a,
                    activo: d.activo,
                    auto_aplicar: d.auto_aplicar,
                    metodo_pago_id: d.metodo_pago_id,
                    vigente_ahora: isValidDiscountTime(d),
                })),
            });
        }

        case "get_store_overview": {
            const [{ data: suc }, { data: cfg }, { data: horarios }, { data: zonas }, { data: mps }, usage] =
                await Promise.all([
                    supabaseAdmin
                        .from("sucursales")
                        .select("nombre, direccion, telefono, whatsapp_numero, slug")
                        .eq("id", sucursalId)
                        .maybeSingle(),
                    supabaseAdmin
                        .from("config_sucursal")
                        .select(
                            "enable_delivery, enable_takeaway, enable_salon, aceptar_pedidos, cerrado_temporalmente, mensaje_cerrado, tiempo_preparacion_default, localidades, ai_agent_config"
                        )
                        .eq("sucursal_id", sucursalId)
                        .maybeSingle(),
                    supabaseAdmin
                        .from("horarios_sucursal")
                        .select("dia, cerrado, apertura1, cierre1, apertura2, cierre2")
                        .eq("sucursal_id", sucursalId)
                        .order("dia", { ascending: true }),
                    supabaseAdmin
                        .from("zonas_entrega")
                        .select("nombre, costo_envio, minimo_compra, envio_gratis_desde, tipo_precio, precio_por_km, activo")
                        .eq("sucursal_id", sucursalId),
                    supabaseAdmin
                        .from("metodos_pago")
                        .select("nombre, codigo, activo")
                        .eq("sucursal_id", sucursalId),
                    getMonthlyTokenUsage(sucursalId),
                ]);

            const aiCfg = cfg?.ai_agent_config || {};
            return JSON.stringify({
                sucursal: suc || null,
                config: cfg
                    ? {
                          enable_delivery: cfg.enable_delivery,
                          enable_takeaway: cfg.enable_takeaway,
                          enable_salon: cfg.enable_salon,
                          cerrado_temporalmente: cfg.cerrado_temporalmente,
                          mensaje_cerrado: cfg.mensaje_cerrado,
                          tiempo_preparacion_default: cfg.tiempo_preparacion_default,
                          localidades: cfg.localidades,
                      }
                    : null,
                horarios: horarios || [],
                zonas_entrega: zonas || [],
                metodos_pago: mps || [],
                whatsapp_ai_agent: {
                    enabled: Boolean(aiCfg.enabled),
                    whatsapp_enabled: Boolean(aiCfg.whatsapp_enabled),
                    whatsapp_status: aiCfg.whatsapp_status || "disconnected",
                    snippets_count: Array.isArray(aiCfg.training_snippets) ? aiCfg.training_snippets.length : 0,
                    few_shot_examples_count: Array.isArray(aiCfg.few_shot_examples)
                        ? aiCfg.few_shot_examples.length
                        : 0,
                },
                ai_monthly_usage: usage,
            });
        }

        default:
            return JSON.stringify({ error: "Herramienta de lectura desconocida." });
    }
}

// ═══════════════════════════════════════════
// PROPOSAL TOOLS (ALWAYS REQUIRE USER CONFIRMATION)
// ═══════════════════════════════════════════

async function executeProposalTool(
    toolName: string,
    args: Record<string, any>,
    sucursalId: string,
    proposals: PendingActionProposal[]
): Promise<string> {
    const makeId = () => `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    switch (toolName) {
        case "propose_create_product": {
            const nombre = String(args.nombre || "").trim();
            const catName = String(args.category_name || "").trim();
            const precio = Number(args.precio || 0);
            if (!nombre || !catName || precio <= 0) {
                return JSON.stringify({ error: "Se requiere nombre, categoría y precio mayor a 0." });
            }

            const { data: cats } = await supabaseAdmin
                .from("categorias")
                .select("id, nombre")
                .eq("sucursal_id", sucursalId)
                .ilike("nombre", `%${catName}%`)
                .limit(1);

            const matchedCat = cats?.[0] || null;
            const proposal: PendingActionProposal = {
                id: makeId(),
                actionType: "create_product",
                title: `Crear producto "${nombre}"`,
                summary: matchedCat
                    ? `Se creará en la categoría existente "${matchedCat.nombre}" a ${fmtARS(precio)}.`
                    : `Se creará la categoría "${catName}" y el nuevo producto a ${fmtARS(precio)}.`,
                riskLevel: "low",
                previewRows: [
                    { label: "Producto", after: nombre },
                    { label: "Categoría", after: matchedCat ? matchedCat.nombre : `${catName} (nueva)` },
                    { label: "Precio", after: fmtARS(precio) },
                    ...(args.costo_fijo ? [{ label: "Costo fijo", after: fmtARS(Number(args.costo_fijo)) }] : []),
                    ...(args.descripcion ? [{ label: "Descripción", after: String(args.descripcion) }] : []),
                ],
                payload: {
                    nombre,
                    categoria_id: matchedCat?.id || null,
                    category_name: matchedCat?.nombre || catName,
                    precio,
                    descripcion: args.descripcion ? String(args.descripcion).trim() : "",
                    costo_fijo: args.costo_fijo ? Number(args.costo_fijo) : 0,
                    visible_en_menu: args.visible_en_menu !== false,
                    producto_sugerido: Boolean(args.producto_sugerido),
                },
            };

            proposals.push(proposal);
            return JSON.stringify({
                status: "pending_confirmation",
                proposal_id: proposal.id,
                message: "Propuesta generada. Pedile al usuario que revise y confirme en la tarjeta.",
            });
        }

        case "propose_update_product": {
            const search = String(args.product_name || "").trim();
            const { data: prods } = await supabaseAdmin
                .from("productos")
                .select("id, nombre, precio, descripcion, costo_fijo, activo, visible_en_menu, producto_sugerido")
                .eq("sucursal_id", sucursalId)
                .ilike("nombre", `%${search}%`)
                .limit(5);

            if (!prods || prods.length === 0) {
                return JSON.stringify({ error: `No encontré ningún producto que coincida con "${search}".` });
            }

            const exact = prods.find((p: any) => normalizeText(p.nombre) === normalizeText(search));
            const target: Record<string, any> = exact || prods[0];

            const beforeObj: Record<string, any> = {};
            const afterObj: Record<string, any> = {};
            const rows: ProposalPreviewRow[] = [];

            const mapField = (argKey: string, dbKey: string, label: string, fmt?: (v: any) => string) => {
                if (args[argKey] !== undefined) {
                    beforeObj[dbKey] = target[dbKey];
                    afterObj[dbKey] = args[argKey];
                    rows.push({
                        label,
                        before: fmt ? fmt(target[dbKey]) : String(target[dbKey] ?? "—"),
                        after: fmt ? fmt(args[argKey]) : String(args[argKey]),
                    });
                }
            };

            mapField("new_name", "nombre", "Nombre");
            mapField("precio", "precio", "Precio", (v) => fmtARS(Number(v || 0)));
            mapField("descripcion", "descripcion", "Descripción");
            mapField("costo_fijo", "costo_fijo", "Costo fijo", (v) => fmtARS(Number(v || 0)));
            mapField("activo", "activo", "Activo", (v) => (v ? "Sí" : "No"));
            mapField("visible_en_menu", "visible_en_menu", "Visible en carta", (v) => (v ? "Sí" : "No"));
            mapField("producto_sugerido", "producto_sugerido", "Sugerido", (v) => (v ? "Sí" : "No"));

            if (rows.length === 0) {
                return JSON.stringify({ error: "No indicaste ningún campo para modificar." });
            }

            const proposal: PendingActionProposal = {
                id: makeId(),
                actionType: "update_product",
                title: `Editar "${target.nombre}"`,
                summary: `Se modificarán ${rows.length} campo(s) de "${target.nombre}".`,
                riskLevel: "low",
                previewRows: rows,
                payload: {
                    product_id: target.id,
                    product_name: target.nombre,
                    before: beforeObj,
                    after: afterObj,
                },
            };

            proposals.push(proposal);
            return JSON.stringify({
                status: "pending_confirmation",
                proposal_id: proposal.id,
                preview_rows: rows,
            });
        }

        case "propose_bulk_update_prices": {
            const scope = args.scope || "all";
            const mode = args.mode || "percent";
            const value = Number(args.value || 0);
            const roundTo = Number(args.round_to || 0);

            if (value === 0) {
                return JSON.stringify({ error: "El valor de aumento/rebaja no puede ser 0." });
            }

            let query = supabaseAdmin
                .from("productos")
                .select("id, nombre, precio, categoria_id")
                .eq("sucursal_id", sucursalId)
                .eq("activo", true);

            let scopeDesc = "toda la carta activa";
            if (scope === "category" && args.category_name) {
                const { data: cats } = await supabaseAdmin
                    .from("categorias")
                    .select("id, nombre")
                    .eq("sucursal_id", sucursalId)
                    .ilike("nombre", `%${args.category_name}%`);
                if (!cats || cats.length === 0) {
                    return JSON.stringify({ error: `No encontré la categoría "${args.category_name}".` });
                }
                query = query.in("categoria_id", cats.map((c: any) => c.id));
                scopeDesc = `categoría "${cats.map((c: any) => c.nombre).join(", ")}"`;
            }

            const { data: prods } = await query.order("nombre", { ascending: true });
            let targets = prods || [];

            if (scope === "products" && Array.isArray(args.product_names) && args.product_names.length > 0) {
                const needles = args.product_names.map((n: string) => normalizeText(n));
                targets = targets.filter((p: any) =>
                    needles.some((nw: string) => normalizeText(p.nombre).includes(nw))
                );
                scopeDesc = `${targets.length} producto(s) seleccionados`;
            }

            if (targets.length === 0) {
                return JSON.stringify({ error: "No encontré productos activos que coincidan con el alcance." });
            }

            const changes = targets.map((p: any) => {
                const oldPrice = Number(p.precio || 0);
                const rawNew =
                    mode === "percent" ? oldPrice * (1 + value / 100) : oldPrice + value;
                const newPrice = roundPrice(rawNew, roundTo);
                return {
                    id: p.id,
                    nombre: p.nombre,
                    oldPrice,
                    newPrice,
                };
            });

            const previewRows: ProposalPreviewRow[] = changes.slice(0, 20).map((c) => ({
                label: c.nombre,
                before: fmtARS(c.oldPrice),
                after: fmtARS(c.newPrice),
            }));
            if (changes.length > 20) {
                previewRows.push({
                    label: `... y ${changes.length - 20} productos más`,
                    after: `Total: ${changes.length} productos`,
                });
            }

            const opLabel =
                mode === "percent"
                    ? `${value > 0 ? "+" : ""}${value}%`
                    : `${value > 0 ? "+" : ""}${fmtARS(value)}`;

            const proposal: PendingActionProposal = {
                id: makeId(),
                actionType: "bulk_update_prices",
                title: `Actualizar precios (${opLabel}) en ${scopeDesc}`,
                summary: `Se actualizarán ${changes.length} producto(s)${
                    roundTo > 0 ? ` con redondeo a $${roundTo}` : ""
                }.`,
                riskLevel: changes.length > 10 || Math.abs(value) > 25 ? "high" : "medium",
                previewRows,
                payload: { changes },
            };

            proposals.push(proposal);
            return JSON.stringify({
                status: "pending_confirmation",
                proposal_id: proposal.id,
                affected_count: changes.length,
            });
        }

        case "propose_toggle_by_ingredient": {
            const ing = String(args.ingredient_name || "").trim();
            const active = Boolean(args.active);
            const { products, ingredientNames } = await findProductsByIngredientForSucursal(sucursalId, ing);

            if (ingredientNames.length === 0) {
                return JSON.stringify({ error: `No encontré el ingrediente "${ing}".` });
            }
            if (products.length === 0) {
                return JSON.stringify({
                    error: `Encontré "${ingredientNames.join(", ")}" pero ningún producto tiene ese ingrediente en su receta/ficha.`,
                });
            }

            const proposal: PendingActionProposal = {
                id: makeId(),
                actionType: "toggle_by_ingredient",
                title: `${active ? "Reactivar" : "Pausar"} productos con "${ingredientNames.join(", ")}"`,
                summary: `Se ${active ? "activarán" : "desactivarán"} ${products.length} producto(s) vinculados al ingrediente.`,
                riskLevel: products.length > 5 ? "medium" : "low",
                previewRows: products.slice(0, 20).map((p: any) => ({
                    label: p.nombre,
                    before: p.activo ? "Activo" : "Pausado",
                    after: active ? "Activo" : "Pausado",
                })),
                payload: {
                    active,
                    products: products.map((p: any) => ({ id: p.id, nombre: p.nombre, oldActive: Boolean(p.activo) })),
                },
            };

            proposals.push(proposal);
            return JSON.stringify({
                status: "pending_confirmation",
                proposal_id: proposal.id,
                affected_count: products.length,
            });
        }

        case "propose_set_product_promo": {
            const names = Array.isArray(args.product_names) ? args.product_names : [];
            const active = Boolean(args.active);
            if (names.length === 0) {
                return JSON.stringify({ error: "Indicá al menos un producto." });
            }

            const { data: allProds } = await supabaseAdmin
                .from("productos")
                .select(
                    "id, nombre, precio, precio_promocional, promo_activo, promo_desde, promo_hasta, promo_hora_desde, promo_hora_hasta, promo_dias"
                )
                .eq("sucursal_id", sucursalId);

            const needles = names.map((n: string) => normalizeText(n));
            const targets = (allProds || []).filter((p: any) =>
                needles.some((nw: string) => normalizeText(p.nombre).includes(nw))
            );

            if (targets.length === 0) {
                return JSON.stringify({ error: "No encontré ninguno de esos productos." });
            }

            const roundTo = Number(args.round_to || 100);
            const updates = targets.map((p: any) => {
                const regular = Number(p.precio || 0);
                let nextPromoPrice = p.precio_promocional ? Number(p.precio_promocional) : null;
                if (active) {
                    if (args.precio_promocional && Number(args.precio_promocional) > 0) {
                        nextPromoPrice = Number(args.precio_promocional);
                    } else if (args.discount_percent && Number(args.discount_percent) > 0) {
                        nextPromoPrice = roundPrice(regular * (1 - Number(args.discount_percent) / 100), roundTo);
                    }
                }

                const beforeState = {
                    promo_activo: Boolean(p.promo_activo),
                    precio_promocional: p.precio_promocional ?? null,
                    promo_desde: p.promo_desde ?? null,
                    promo_hasta: p.promo_hasta ?? null,
                    promo_hora_desde: p.promo_hora_desde ?? null,
                    promo_hora_hasta: p.promo_hora_hasta ?? null,
                    promo_dias: p.promo_dias ?? [0, 1, 2, 3, 4, 5, 6],
                };

                const afterState = active
                    ? {
                          promo_activo: true,
                          precio_promocional: nextPromoPrice,
                          promo_desde: args.promo_desde || null,
                          promo_hasta: args.promo_hasta || null,
                          promo_hora_desde: args.promo_hora_desde ? `${args.promo_hora_desde}:00`.slice(0, 8) : null,
                          promo_hora_hasta: args.promo_hora_hasta ? `${args.promo_hora_hasta}:00`.slice(0, 8) : null,
                          promo_dias:
                              Array.isArray(args.promo_dias) && args.promo_dias.length > 0
                                  ? args.promo_dias
                                  : [0, 1, 2, 3, 4, 5, 6],
                      }
                    : {
                          ...beforeState,
                          promo_activo: false,
                      };

                return {
                    id: p.id,
                    nombre: p.nombre,
                    regular,
                    before: beforeState,
                    after: afterState,
                };
            });

            if (active && updates.some((u) => !u.after.precio_promocional || u.after.precio_promocional >= u.regular)) {
                return JSON.stringify({
                    error: "El precio promocional debe ser mayor a 0 y menor al precio regular del producto.",
                });
            }

            const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
            const scheduleInfo =
                active && updates[0].after.promo_dias
                    ? `Días: ${updates[0].after.promo_dias.map((d: number) => dayLabels[d] || d).join(", ")}${
                          args.promo_hora_desde ? ` (${args.promo_hora_desde}–${args.promo_hora_hasta || "23:59"})` : ""
                      }`
                    : "";

            const proposal: PendingActionProposal = {
                id: makeId(),
                actionType: "set_product_promo",
                title: active
                    ? `Activar precio promocional en ${updates.length} producto(s)`
                    : `Desactivar promoción en ${updates.length} producto(s)`,
                summary: scheduleInfo || `Afecta a ${updates.map((u) => u.nombre).join(", ")}.`,
                riskLevel: "medium",
                previewRows: updates.map((u) => ({
                    label: u.nombre,
                    before: u.before.promo_activo && u.before.precio_promocional ? fmtARS(u.before.precio_promocional) : fmtARS(u.regular),
                    after: active && u.after.precio_promocional ? `${fmtARS(u.after.precio_promocional)} (Promo)` : `${fmtARS(u.regular)} (Sin promo)`,
                    detail: scheduleInfo,
                })),
                payload: { updates },
            };

            proposals.push(proposal);
            return JSON.stringify({ status: "pending_confirmation", proposal_id: proposal.id });
        }

        case "propose_create_discount": {
            const nombre = String(args.nombre || "").trim();
            const tipo = args.tipo === "fijo" ? "fijo" : "porcentaje";
            const valor = Number(args.valor || 0);
            if (!nombre || valor <= 0) {
                return JSON.stringify({ error: "El descuento requiere nombre y valor > 0." });
            }

            let metodoPagoId: string | null = null;
            let metodoPagoNombre: string | null = null;
            if (args.payment_method_name) {
                const { data: mp } = await supabaseAdmin
                    .from("metodos_pago")
                    .select("id, nombre")
                    .eq("sucursal_id", sucursalId)
                    .ilike("nombre", `%${args.payment_method_name}%`)
                    .limit(1)
                    .maybeSingle();
                if (mp) {
                    metodoPagoId = mp.id;
                    metodoPagoNombre = mp.nombre;
                }
            }

            let productosIds: string[] | null = null;
            let categoriasIds: string[] | null = null;
            const aplicarA = args.aplicar_a || "general";

            if (aplicarA === "producto" && Array.isArray(args.product_names) && args.product_names.length > 0) {
                const { data: prods } = await supabaseAdmin
                    .from("productos")
                    .select("id, nombre")
                    .eq("sucursal_id", sucursalId);
                const needles = args.product_names.map((n: string) => normalizeText(n));
                const matched = (prods || []).filter((p: any) =>
                    needles.some((nw: string) => normalizeText(p.nombre).includes(nw))
                );
                if (matched.length > 0) productosIds = matched.map((m: any) => m.id);
            }

            if (aplicarA === "categoria" && Array.isArray(args.category_names) && args.category_names.length > 0) {
                const { data: cats } = await supabaseAdmin
                    .from("categorias")
                    .select("id, nombre")
                    .eq("sucursal_id", sucursalId);
                const needles = args.category_names.map((n: string) => normalizeText(n));
                const matched = (cats || []).filter((c: any) =>
                    needles.some((nw: string) => normalizeText(c.nombre).includes(nw))
                );
                if (matched.length > 0) categoriasIds = matched.map((m: any) => m.id);
            }

            const insertRow = {
                sucursal_id: sucursalId,
                nombre,
                codigo: args.codigo ? String(args.codigo).trim().toUpperCase() : null,
                tipo,
                valor,
                minimo_compra: args.minimo_compra ? Number(args.minimo_compra) : null,
                uso_limite: args.uso_limite ? Number(args.uso_limite) : null,
                aplicar_a: aplicarA,
                productos_ids: productosIds,
                categorias_ids: categoriasIds,
                metodo_pago_id: metodoPagoId,
                auto_aplicar: Boolean(args.auto_aplicar || (metodoPagoId && !args.codigo)),
                no_acumulable: Boolean(args.no_acumulable),
                fecha_desde: args.fecha_desde || null,
                fecha_hasta: args.fecha_hasta || null,
                hora_desde: args.hora_desde ? `${args.hora_desde}:00`.slice(0, 8) : null,
                hora_hasta: args.hora_hasta ? `${args.hora_hasta}:00`.slice(0, 8) : null,
                activo: true,
                producto_id: null,
                categoria_id: null,
            };

            const proposal: PendingActionProposal = {
                id: makeId(),
                actionType: "create_discount",
                title: `Crear descuento "${nombre}"`,
                summary: `${tipo === "porcentaje" ? `${valor}% OFF` : `${fmtARS(valor)} OFF`} (${aplicarA}${
                    metodoPagoNombre ? ` · ${metodoPagoNombre}` : ""
                }).`,
                riskLevel: "medium",
                previewRows: [
                    { label: "Nombre", after: nombre },
                    { label: "Beneficio", after: tipo === "porcentaje" ? `${valor}% OFF` : `${fmtARS(valor)} OFF` },
                    { label: "Código", after: insertRow.codigo || "Sin código (automático)" },
                    ...(metodoPagoNombre ? [{ label: "Medio de pago", after: metodoPagoNombre }] : []),
                ],
                payload: { insertRow },
            };

            proposals.push(proposal);
            return JSON.stringify({ status: "pending_confirmation", proposal_id: proposal.id });
        }

        case "propose_toggle_discount": {
            const search = String(args.discount_name || "").trim();
            const active = Boolean(args.active);
            const { data: descs } = await supabaseAdmin
                .from("descuentos")
                .select("id, nombre, codigo, activo")
                .eq("sucursal_id", sucursalId)
                .or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%`)
                .limit(3);

            if (!descs || descs.length === 0) {
                return JSON.stringify({ error: `No encontré ningún descuento llamado "${search}".` });
            }

            const target = descs[0];
            const proposal: PendingActionProposal = {
                id: makeId(),
                actionType: "toggle_discount",
                title: `${active ? "Activar" : "Desactivar"} descuento "${target.nombre}"`,
                summary: `Cambiará el estado del descuento "${target.nombre}".`,
                riskLevel: "low",
                previewRows: [
                    {
                        label: target.nombre,
                        before: target.activo ? "Activo" : "Inactivo",
                        after: active ? "Activo" : "Inactivo",
                    },
                ],
                payload: {
                    discount_id: target.id,
                    discount_name: target.nombre,
                    oldActive: Boolean(target.activo),
                    newActive: active,
                },
            };

            proposals.push(proposal);
            return JSON.stringify({ status: "pending_confirmation", proposal_id: proposal.id });
        }

        case "propose_store_or_bot_action": {
            const action = args.action;
            const { data: cfg } = await supabaseAdmin
                .from("config_sucursal")
                .select("id, cerrado_temporalmente, mensaje_cerrado")
                .eq("sucursal_id", sucursalId)
                .maybeSingle();

            if (!cfg) {
                return JSON.stringify({ error: "No encontré la configuración de esta sucursal." });
            }

            if (action === "toggle_temp_closed") {
                const closed = Boolean(args.closed);
                const msg = args.closed_message ? String(args.closed_message).trim() : cfg.mensaje_cerrado || "";
                const proposal: PendingActionProposal = {
                    id: makeId(),
                    actionType: "toggle_store_temp_closed",
                    title: closed ? "Cerrar local temporalmente" : "Reabrir local",
                    summary: closed
                        ? "La tienda web y el bot informarán que el local está cerrado temporalmente."
                        : "El local volverá a aceptar pedidos según su horario configurado.",
                    riskLevel: "high",
                    previewRows: [
                        {
                            label: "Cerrado temporalmente",
                            before: cfg.cerrado_temporalmente ? "Sí" : "No",
                            after: closed ? "Sí" : "No",
                        },
                        ...(msg ? [{ label: "Mensaje", before: cfg.mensaje_cerrado || "—", after: msg }] : []),
                    ],
                    payload: {
                        config_id: cfg.id,
                        before: {
                            cerrado_temporalmente: Boolean(cfg.cerrado_temporalmente),
                            mensaje_cerrado: cfg.mensaje_cerrado || null,
                        },
                        after: {
                            cerrado_temporalmente: closed,
                            mensaje_cerrado: msg || null,
                        },
                    },
                };
                proposals.push(proposal);
                return JSON.stringify({ status: "pending_confirmation", proposal_id: proposal.id });
            }

            if (action === "add_whatsapp_snippet") {
                const title = String(args.snippet_title || "").trim();
                const content = String(args.snippet_content || "").trim();
                if (!title || !content) {
                    return JSON.stringify({ error: "Indicá título y contenido del snippet para WhatsApp." });
                }

                const proposal: PendingActionProposal = {
                    id: makeId(),
                    actionType: "add_whatsapp_snippet",
                    title: `Agregar info al Bot WhatsApp: "${title}"`,
                    summary: "Se sumará a la Base de Conocimiento del Agente IA de WhatsApp.",
                    riskLevel: "low",
                    previewRows: [
                        { label: "Título", after: title },
                        { label: "Contenido", after: content },
                    ],
                    payload: {
                        config_id: cfg.id,
                        snippet: {
                            id: `copilot-${Date.now()}`,
                            title,
                            content,
                        },
                    },
                };
                proposals.push(proposal);
                return JSON.stringify({ status: "pending_confirmation", proposal_id: proposal.id });
            }

            return JSON.stringify({ error: "Acción no soportada." });
        }

        default:
            return JSON.stringify({ error: "Herramienta de propuesta desconocida." });
    }
}

// ═══════════════════════════════════════════
// CONFIRMED EXECUTION & ROLLBACK
// ═══════════════════════════════════════════

async function insertAuditLog(params: {
    sucursalId: string;
    comandoOriginal: string;
    comandoInterpretado: string;
    tablaAfectada: string;
    registroId: string;
    registroNombre: string;
    campoModificado: string;
    valorAnterior: string | null;
    valorNuevo: string | null;
}): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from("ai_command_log")
        .insert({
            sucursal_id: params.sucursalId,
            comando_original: params.comandoOriginal || "Copiloto IA",
            comando_interpretado: params.comandoInterpretado,
            tabla_afectada: params.tablaAfectada,
            registro_id: params.registroId,
            registro_nombre: params.registroNombre,
            campo_modificado: params.campoModificado,
            valor_anterior: params.valorAnterior,
            valor_nuevo: params.valorNuevo,
            estado: "ejecutado",
        })
        .select("id")
        .maybeSingle();

    return data?.id || null;
}

export async function executeCopilotProposal(
    sucursalId: string,
    proposal: PendingActionProposal,
    originalCommand: string = ""
): Promise<{ success: boolean; message: string; affectedCount: number; logIds: string[] }> {
    const logIds: string[] = [];
    const cmd = originalCommand || proposal.title;

    switch (proposal.actionType) {
        case "create_product": {
            const p = proposal.payload;
            let categoriaId = p.categoria_id;

            if (!categoriaId) {
                const { data: newCat, error: catErr } = await supabaseAdmin
                    .from("categorias")
                    .insert({
                        sucursal_id: sucursalId,
                        nombre: p.category_name,
                        activo: true,
                    })
                    .select("id")
                    .single();
                if (catErr || !newCat) {
                    return {
                        success: false,
                        message: `Error creando categoría: ${catErr?.message || "desconocido"}`,
                        affectedCount: 0,
                        logIds,
                    };
                }
                categoriaId = newCat.id;
            }

            const { data: prod, error: prodErr } = await supabaseAdmin
                .from("productos")
                .insert({
                    sucursal_id: sucursalId,
                    categoria_id: categoriaId,
                    nombre: p.nombre,
                    precio: p.precio,
                    descripcion: p.descripcion || null,
                    costo_fijo: p.costo_fijo || 0,
                    visible_en_menu: p.visible_en_menu !== false,
                    producto_sugerido: Boolean(p.producto_sugerido),
                    activo: true,
                })
                .select("id, nombre")
                .single();

            if (prodErr || !prod) {
                return {
                    success: false,
                    message: `Error creando producto: ${prodErr?.message || "desconocido"}`,
                    affectedCount: 0,
                    logIds,
                };
            }

            const lid = await insertAuditLog({
                sucursalId,
                comandoOriginal: cmd,
                comandoInterpretado: proposal.title,
                tablaAfectada: "productos",
                registroId: prod.id,
                registroNombre: prod.nombre,
                campoModificado: "__created__",
                valorAnterior: null,
                valorNuevo: prod.nombre,
            });
            if (lid) logIds.push(lid);

            return {
                success: true,
                message: `Producto "${prod.nombre}" creado por ${fmtARS(p.precio)}.`,
                affectedCount: 1,
                logIds,
            };
        }

        case "update_product": {
            const { product_id, product_name, before, after } = proposal.payload;
            const { error } = await supabaseAdmin
                .from("productos")
                .update(after)
                .eq("id", product_id)
                .eq("sucursal_id", sucursalId);

            if (error) {
                return { success: false, message: error.message, affectedCount: 0, logIds };
            }

            const keys = Object.keys(after);
            const lid = await insertAuditLog({
                sucursalId,
                comandoOriginal: cmd,
                comandoInterpretado: proposal.title,
                tablaAfectada: "productos",
                registroId: product_id,
                registroNombre: product_name,
                campoModificado: keys.length === 1 ? keys[0] : "__json_snapshot__",
                valorAnterior: keys.length === 1 ? String(before[keys[0]]) : JSON.stringify(before),
                valorNuevo: keys.length === 1 ? String(after[keys[0]]) : JSON.stringify(after),
            });
            if (lid) logIds.push(lid);

            return {
                success: true,
                message: `Producto "${product_name}" actualizado.`,
                affectedCount: 1,
                logIds,
            };
        }

        case "bulk_update_prices": {
            const changes: Array<{ id: string; nombre: string; oldPrice: number; newPrice: number }> =
                proposal.payload.changes || [];
            let count = 0;

            for (const ch of changes) {
                const { error } = await supabaseAdmin
                    .from("productos")
                    .update({ precio: ch.newPrice })
                    .eq("id", ch.id)
                    .eq("sucursal_id", sucursalId);

                if (!error) {
                    count++;
                    const lid = await insertAuditLog({
                        sucursalId,
                        comandoOriginal: cmd,
                        comandoInterpretado: proposal.title,
                        tablaAfectada: "productos",
                        registroId: ch.id,
                        registroNombre: ch.nombre,
                        campoModificado: "precio",
                        valorAnterior: String(ch.oldPrice),
                        valorNuevo: String(ch.newPrice),
                    });
                    if (lid) logIds.push(lid);
                }
            }

            return {
                success: count > 0,
                message: `Se actualizaron precios en ${count} producto(s).`,
                affectedCount: count,
                logIds,
            };
        }

        case "toggle_by_ingredient": {
            const { active, products } = proposal.payload;
            let count = 0;

            for (const p of products || []) {
                const { error } = await supabaseAdmin
                    .from("productos")
                    .update({ activo: Boolean(active) })
                    .eq("id", p.id)
                    .eq("sucursal_id", sucursalId);

                if (!error) {
                    count++;
                    const lid = await insertAuditLog({
                        sucursalId,
                        comandoOriginal: cmd,
                        comandoInterpretado: proposal.title,
                        tablaAfectada: "productos",
                        registroId: p.id,
                        registroNombre: p.nombre,
                        campoModificado: "activo",
                        valorAnterior: String(p.oldActive),
                        valorNuevo: String(Boolean(active)),
                    });
                    if (lid) logIds.push(lid);
                }
            }

            return {
                success: count > 0,
                message: `Se ${active ? "activaron" : "desactivaron"} ${count} producto(s).`,
                affectedCount: count,
                logIds,
            };
        }

        case "set_product_promo": {
            const updates = proposal.payload.updates || [];
            let count = 0;

            for (const u of updates) {
                const { error } = await supabaseAdmin
                    .from("productos")
                    .update(u.after)
                    .eq("id", u.id)
                    .eq("sucursal_id", sucursalId);

                if (!error) {
                    count++;
                    const lid = await insertAuditLog({
                        sucursalId,
                        comandoOriginal: cmd,
                        comandoInterpretado: proposal.title,
                        tablaAfectada: "productos",
                        registroId: u.id,
                        registroNombre: u.nombre,
                        campoModificado: "__json_snapshot__",
                        valorAnterior: JSON.stringify(u.before),
                        valorNuevo: JSON.stringify(u.after),
                    });
                    if (lid) logIds.push(lid);
                }
            }

            return {
                success: count > 0,
                message: `Promoción actualizada en ${count} producto(s).`,
                affectedCount: count,
                logIds,
            };
        }

        case "create_discount": {
            const row = { ...proposal.payload.insertRow, sucursal_id: sucursalId };
            const { data: created, error } = await supabaseAdmin
                .from("descuentos")
                .insert(row)
                .select("id, nombre")
                .single();

            if (error || !created) {
                return {
                    success: false,
                    message: `Error creando descuento: ${error?.message || "desconocido"}`,
                    affectedCount: 0,
                    logIds,
                };
            }

            const lid = await insertAuditLog({
                sucursalId,
                comandoOriginal: cmd,
                comandoInterpretado: proposal.title,
                tablaAfectada: "descuentos",
                registroId: created.id,
                registroNombre: created.nombre,
                campoModificado: "__created__",
                valorAnterior: null,
                valorNuevo: created.nombre,
            });
            if (lid) logIds.push(lid);

            return {
                success: true,
                message: `Descuento "${created.nombre}" creado y activado.`,
                affectedCount: 1,
                logIds,
            };
        }

        case "toggle_discount": {
            const { discount_id, discount_name, oldActive, newActive } = proposal.payload;
            const { error } = await supabaseAdmin
                .from("descuentos")
                .update({ activo: Boolean(newActive) })
                .eq("id", discount_id)
                .eq("sucursal_id", sucursalId);

            if (error) {
                return { success: false, message: error.message, affectedCount: 0, logIds };
            }

            const lid = await insertAuditLog({
                sucursalId,
                comandoOriginal: cmd,
                comandoInterpretado: proposal.title,
                tablaAfectada: "descuentos",
                registroId: discount_id,
                registroNombre: discount_name,
                campoModificado: "activo",
                valorAnterior: String(oldActive),
                valorNuevo: String(Boolean(newActive)),
            });
            if (lid) logIds.push(lid);

            return {
                success: true,
                message: `Descuento "${discount_name}" ${newActive ? "activado" : "desactivado"}.`,
                affectedCount: 1,
                logIds,
            };
        }

        case "toggle_store_temp_closed": {
            const { config_id, before, after } = proposal.payload;
            const { error } = await supabaseAdmin
                .from("config_sucursal")
                .update(after)
                .eq("id", config_id)
                .eq("sucursal_id", sucursalId);

            if (error) {
                return { success: false, message: error.message, affectedCount: 0, logIds };
            }

            const lid = await insertAuditLog({
                sucursalId,
                comandoOriginal: cmd,
                comandoInterpretado: proposal.title,
                tablaAfectada: "config_sucursal",
                registroId: config_id,
                registroNombre: "Estado del local",
                campoModificado: "__json_snapshot__",
                valorAnterior: JSON.stringify(before),
                valorNuevo: JSON.stringify(after),
            });
            if (lid) logIds.push(lid);

            return {
                success: true,
                message: after.cerrado_temporalmente
                    ? "Local marcado como cerrado temporalmente."
                    : "Local reabierto.",
                affectedCount: 1,
                logIds,
            };
        }

        case "add_whatsapp_snippet": {
            const { config_id, snippet } = proposal.payload;
            const current = await getAgentConfig(sucursalId);
            const updatedSnippets = [...(current.training_snippets || []), snippet];
            const ok = await updateAgentConfig(sucursalId, { training_snippets: updatedSnippets });

            if (!ok) {
                return {
                    success: false,
                    message: "No se pudo actualizar el entrenamiento del bot WhatsApp.",
                    affectedCount: 0,
                    logIds,
                };
            }

            const lid = await insertAuditLog({
                sucursalId,
                comandoOriginal: cmd,
                comandoInterpretado: proposal.title,
                tablaAfectada: "config_sucursal",
                registroId: config_id,
                registroNombre: `Snippet WhatsApp: ${snippet.title}`,
                campoModificado: "__wa_snippet_added__",
                valorAnterior: null,
                valorNuevo: JSON.stringify(snippet),
            });
            if (lid) logIds.push(lid);

            return {
                success: true,
                message: `Conocimiento "${snippet.title}" agregado al bot de WhatsApp.`,
                affectedCount: 1,
                logIds,
            };
        }

        default:
            return { success: false, message: "Tipo de acción no soportado.", affectedCount: 0, logIds };
    }
}

export async function undoCopilotLogEntry(
    sucursalId: string,
    logId: string
): Promise<{ success: boolean; message: string }> {
    const { data: log, error } = await supabaseAdmin
        .from("ai_command_log")
        .select("*")
        .eq("id", logId)
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

    if (error || !log) {
        return { success: false, message: "No se encontró el registro para esta sucursal." };
    }

    if (log.estado === "revertido") {
        return { success: false, message: "Este cambio ya fue revertido anteriormente." };
    }

    const field = log.campo_modificado;

    if (field === "__created__") {
        const { error: delErr } = await supabaseAdmin
            .from(log.tabla_afectada)
            .delete()
            .eq("id", log.registro_id)
            .eq("sucursal_id", sucursalId);

        if (delErr) {
            if (log.tabla_afectada === "productos" || log.tabla_afectada === "descuentos") {
                await supabaseAdmin
                    .from(log.tabla_afectada)
                    .update({ activo: false })
                    .eq("id", log.registro_id)
                    .eq("sucursal_id", sucursalId);
            } else {
                return { success: false, message: `No se pudo revertir: ${delErr.message}` };
            }
        }
    } else if (field === "__wa_snippet_added__") {
        const added = JSON.parse(log.valor_nuevo || "{}");
        const current = await getAgentConfig(sucursalId);
        const filtered = (current.training_snippets || []).filter((s) => s.id !== added.id);
        await updateAgentConfig(sucursalId, { training_snippets: filtered });
    } else if (field === "__json_snapshot__") {
        const restoreObj = JSON.parse(log.valor_anterior || "{}");
        const { error: updErr } = await supabaseAdmin
            .from(log.tabla_afectada)
            .update(restoreObj)
            .eq("id", log.registro_id)
            .eq("sucursal_id", sucursalId);
        if (updErr) {
            return { success: false, message: `Error al revertir: ${updErr.message}` };
        }
    } else {
        let restoreValue: unknown = log.valor_anterior;
        if (restoreValue === "true") restoreValue = true;
        else if (restoreValue === "false") restoreValue = false;
        else if (restoreValue !== null && restoreValue !== "" && !isNaN(Number(restoreValue))) {
            restoreValue = Number(restoreValue);
        }

        const { error: updErr } = await supabaseAdmin
            .from(log.tabla_afectada)
            .update({ [field]: restoreValue })
            .eq("id", log.registro_id)
            .eq("sucursal_id", sucursalId);

        if (updErr) {
            return { success: false, message: `Error al revertir: ${updErr.message}` };
        }
    }

    await supabaseAdmin
        .from("ai_command_log")
        .update({ estado: "revertido" })
        .eq("id", logId)
        .eq("sucursal_id", sucursalId);

    return {
        success: true,
        message: `Cambio revertido: "${log.registro_nombre || log.tabla_afectada}".`,
    };
}

// ═══════════════════════════════════════════
// LLM TOOL NORMALIZATION & LOOP
// ═══════════════════════════════════════════

let geminiBillingBlockedUntil = 0;

function compactDescription(desc: string | undefined, maxLen = 110): string {
    if (!desc) return "";
    const firstSentence = desc.split(/\.\s+/)[0].trim();
    const base = firstSentence.length > 0 ? firstSentence : desc;
    return base.length > maxLen ? `${base.slice(0, maxLen - 1)}…` : base;
}

function normalizeSchemaForOpenAI(schema: any, allowNull = false, compact = false, isProp = false): any {
    if (!schema || typeof schema !== "object") return schema;
    if (Array.isArray(schema)) return schema.map((x) => normalizeSchemaForOpenAI(x, false, compact, false));
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(schema)) {
        if (k === "type" && typeof v === "string") {
            const lower = v.toLowerCase();
            out.type = allowNull ? [lower, "null"] : lower;
        } else if (k === "description" && compact && isProp && typeof v === "string") {
            if (v.includes("'") || v.includes("=")) {
                out.description = compactDescription(v, 42);
            }
        } else if (k === "properties" && v && typeof v === "object") {
            const reqSet = new Set(Array.isArray((schema as any).required) ? (schema as any).required : []);
            const props: Record<string, any> = {};
            for (const [pk, pv] of Object.entries(v as Record<string, any>)) {
                props[pk] = normalizeSchemaForOpenAI(pv, !reqSet.has(pk), compact, true);
            }
            out.properties = props;
        } else if (k === "items" && v && typeof v === "object") {
            out.items = normalizeSchemaForOpenAI(v, false, compact, false);
        } else {
            out[k] = v;
        }
    }
    return out;
}

function getOpenAICopilotTools(compact = false) {
    const declarations = COPILOT_TOOLS[0].functionDeclarations || [];
    return declarations.map((fd: any) => {
        const normalized = normalizeSchemaForOpenAI(
            fd.parameters || { type: "object", properties: {} },
            false,
            compact,
            false
        );
        return {
            type: "function",
            function: {
                name: fd.name,
                description: compact ? compactDescription(fd.description, 110) : fd.description,
                parameters: {
                    type: "object",
                    properties: normalized?.properties || {},
                    required: Array.isArray(normalized?.required) ? normalized.required : [],
                },
            },
        };
    });
}

const WRITE_INTENT_RE =
    /(propon|propone|crea|crear|edit|modific|cambi|sub[ie]|aument|baj[ae]|rebaj|activ|paus|ocult|promo|descuento|cupon|precio|cerr|abri|agreg|suma|snippet|bot|dale|hacelo|aplic|confirm|^si\b|^ok\b)/;

function hasWriteIntent(message: string, history: CopilotMessage[]): boolean {
    if (WRITE_INTENT_RE.test(normalizeText(message))) return true;
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    return Boolean(lastAssistant && /propuesta|propon/i.test(lastAssistant.content) && message.trim().length < 60);
}

function parseRetryAfterSeconds(errMsg: string): number | null {
    const m = errMsg.match(/try again in ([\d.]+)(ms|s)/i);
    if (!m) return null;
    const value = Number(m[1]);
    return m[2].toLowerCase() === "ms" ? value / 1000 : value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function truncateToolOutput(raw: string, maxChars = 3600): string {
    if (!raw || raw.length <= maxChars) return raw;
    return JSON.stringify({
        truncated: true,
        note: "Datos resumidos por límite de contexto.",
        preview: raw.slice(0, maxChars - 140),
    });
}

function cleanToolArgs(args: Record<string, any> | null | undefined): Record<string, any> {
    if (!args || typeof args !== "object") return {};
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(args)) {
        if (v !== null && v !== undefined) {
            cleaned[k] = v;
        }
    }
    return cleaned;
}

async function dispatchTool(
    toolName: string,
    args: Record<string, any>,
    sucursalId: string,
    proposals: PendingActionProposal[]
): Promise<string> {
    try {
        const safeArgs = cleanToolArgs(args);
        if (toolName.startsWith("propose_")) {
            return await executeProposalTool(toolName, safeArgs, sucursalId, proposals);
        }
        return await executeReadTool(toolName, safeArgs, sucursalId);
    } catch (err: any) {
        console.error(`[Copilot Tool ${toolName}] Error:`, err?.message || err);
        return JSON.stringify({ error: err?.message || "Error consultando datos." });
    }
}

function aggregateUsage(
    provider: "gemini" | "openai" | "groq",
    model: string,
    records: TokenUsageRecord[]
): TokenUsageRecord {
    let promptTokens = 0;
    let cachedTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    for (const r of records) {
        promptTokens += r.promptTokens;
        cachedTokens += r.cachedTokens;
        outputTokens += r.outputTokens;
        totalTokens += r.totalTokens;
    }
    return {
        provider,
        model,
        promptTokens,
        cachedTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: estimateCostUsd(model, promptTokens, cachedTokens, outputTokens),
    };
}

export async function runBusinessCopilot(params: {
    sucursalId: string;
    message: string;
    history?: CopilotMessage[];
    userName?: string | null;
    userRole: string;
    activePage?: string;
}): Promise<CopilotChatResult> {
    const { sucursalId, message, history = [], userName, userRole, activePage } = params;

    const { data: suc } = await supabaseAdmin
        .from("sucursales")
        .select("nombre")
        .eq("id", sucursalId)
        .maybeSingle();

    const sucursalName = suc?.nombre || "Tu Negocio";
    const todayArgentina = getArgentinaDate();
    const systemPrompt = buildCopilotSystemPrompt({
        sucursalName,
        todayArgentina,
        userName,
        userRole,
        activePage,
    });

    const cleanHistory = history
        .filter((m) => m && m.content?.trim())
        .slice(-16);
    while (cleanHistory.length > 0 && cleanHistory[0].role === "assistant") {
        cleanHistory.shift();
    }

    const providers = getAvailableProviders();
    const providerErrors: string[] = [];
    const geminiInCooldown = Date.now() < geminiBillingBlockedUntil;

    // 1. Try Gemini 2.5 Flash (con thinking moderado para análisis BI)
    if (providers.gemini && !geminiInCooldown) {
        for (const thinkingBudget of [1024, 0]) {
            try {
                const proposals: PendingActionProposal[] = [];
                const toolsUsed = new Set<string>();
                const usages: TokenUsageRecord[] = [];
                const contents: GeminiContent[] = [
                    ...cleanHistory.map((m) => ({
                        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
                        parts: [{ text: m.content }],
                    })),
                    { role: "user", parts: [{ text: message }] },
                ];

                let maxIter = 8;
                let lastFingerprint = "";

                while (maxIter > 0) {
                    maxIter--;
                    const res = await callGeminiGenerateContent({
                        model: "gemini-2.5-flash",
                        systemInstruction: systemPrompt,
                        contents,
                        tools: COPILOT_TOOLS,
                        maxOutputTokens: 2048,
                        temperature: 0.25,
                        thinkingBudget,
                    });
                    usages.push(res.usage);

                    if (res.functionCalls.length === 0) {
                        const totalUsage = aggregateUsage("gemini", "gemini-2.5-flash", usages);
                        await logTokenUsage(sucursalId, "copilot", totalUsage);
                        return {
                            reply: res.text || "Listo.",
                            proposals,
                            toolsUsed: Array.from(toolsUsed),
                            usage: totalUsage,
                            provider: "gemini",
                            model: "gemini-2.5-flash",
                        };
                    }

                    contents.push({ role: "model", parts: res.parts });
                    const responseParts: GeminiPart[] = [];

                    for (const fc of res.functionCalls) {
                        const fp = `${fc.name}:${JSON.stringify(fc.args || {})}`;
                        if (fp === lastFingerprint) {
                            const totalUsage = aggregateUsage("gemini", "gemini-2.5-flash", usages);
                            await logTokenUsage(sucursalId, "copilot", totalUsage);
                            return {
                                reply:
                                    res.text ||
                                    (proposals.length > 0
                                        ? "Preparé la propuesta de cambio abajo para que la revises y confirmes."
                                        : "Análisis completado."),
                                proposals,
                                toolsUsed: Array.from(toolsUsed),
                                usage: totalUsage,
                                provider: "gemini",
                                model: "gemini-2.5-flash",
                            };
                        }
                        lastFingerprint = fp;
                        toolsUsed.add(fc.name);

                        const toolResult = await dispatchTool(
                            fc.name,
                            fc.args || {},
                            sucursalId,
                            proposals
                        );
                        let parsed: any;
                        try {
                            parsed = JSON.parse(toolResult);
                        } catch {
                            parsed = { text: toolResult };
                        }

                        responseParts.push({
                            functionResponse: {
                                name: fc.name,
                                response: { result: parsed },
                            },
                        });
                    }

                    contents.push({ role: "user", parts: responseParts });
                }

                const totalUsage = aggregateUsage("gemini", "gemini-2.5-flash", usages);
                await logTokenUsage(sucursalId, "copilot", totalUsage);
                return {
                    reply: "Completé la consulta. Si quedó alguna propuesta pendiente, podés revisarla abajo.",
                    proposals,
                    toolsUsed: Array.from(toolsUsed),
                    usage: totalUsage,
                    provider: "gemini",
                    model: "gemini-2.5-flash",
                };
            } catch (err: any) {
                const errMsg = err?.message || String(err);
                console.warn(`[Copilot Gemini thinking=${thinkingBudget}] Error:`, errMsg);
                providerErrors.push(`Gemini (thinking=${thinkingBudget}): ${errMsg}`);
                if (Number(err?.status) === 402) {
                    geminiBillingBlockedUntil = Date.now() + 5 * 60 * 1000;
                }
                if ([401, 402, 403, 429].includes(Number(err?.status))) {
                    break;
                }
            }
        }
    } else if (providers.gemini && geminiInCooldown) {
        providerErrors.push("Gemini: créditos prepagos agotados (en espera de recarga).");
    }

    // 2. Fallback OpenAI (if configured)
    if (providers.openai) {
        try {
            const proposals: PendingActionProposal[] = [];
            const toolsUsed = new Set<string>();
            const usages: TokenUsageRecord[] = [];
            const openAITools = getOpenAICopilotTools();
            const messages: any[] = [
                { role: "system", content: systemPrompt },
                ...cleanHistory.map((m) => ({ role: m.role, content: m.content })),
                { role: "user", content: message },
            ];

            let maxIter = 8;
            let lastFingerprint = "";
            while (maxIter > 0) {
                maxIter--;
                const res = await callOpenAIChatCompletion({
                    model: "gpt-4.1-mini",
                    messages,
                    tools: openAITools,
                    maxTokens: 2048,
                    temperature: 0.25,
                });
                usages.push(res.usage);

                const msg = res.message;
                messages.push({
                    role: "assistant",
                    content: msg.content ?? null,
                    ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
                });

                if (!msg.tool_calls || msg.tool_calls.length === 0) {
                    const totalUsage = aggregateUsage("openai", "gpt-4.1-mini", usages);
                    await logTokenUsage(sucursalId, "copilot", totalUsage);
                    return {
                        reply:
                            msg.content ||
                            (proposals.length > 0
                                ? "Preparé la propuesta de cambio abajo para que la revises y confirmes."
                                : "Listo."),
                        proposals,
                        toolsUsed: Array.from(toolsUsed),
                        usage: totalUsage,
                        provider: "openai",
                        model: "gpt-4.1-mini",
                    };
                }

                const turnFingerprint = JSON.stringify(
                    msg.tool_calls.map((tc: any) => ({
                        name: tc.function.name,
                        args: tc.function.arguments || "",
                    }))
                );
                if (turnFingerprint === lastFingerprint) {
                    const totalUsage = aggregateUsage("openai", "gpt-4.1-mini", usages);
                    await logTokenUsage(sucursalId, "copilot", totalUsage);
                    return {
                        reply:
                            msg.content ||
                            (proposals.length > 0
                                ? "Preparé la propuesta de cambio abajo para que la revises y confirmes."
                                : "Análisis completado."),
                        proposals,
                        toolsUsed: Array.from(toolsUsed),
                        usage: totalUsage,
                        provider: "openai",
                        model: "gpt-4.1-mini",
                    };
                }
                lastFingerprint = turnFingerprint;

                for (const tc of msg.tool_calls) {
                    let args: Record<string, any> = {};
                    try {
                        args = JSON.parse(tc.function.arguments || "{}");
                    } catch {
                        args = {};
                    }
                    toolsUsed.add(tc.function.name);
                    const result = await dispatchTool(tc.function.name, args, sucursalId, proposals);
                    messages.push({
                        tool_call_id: tc.id,
                        role: "tool",
                        name: tc.function.name,
                        content: result,
                    });
                }
            }

            const totalUsage = aggregateUsage("openai", "gpt-4.1-mini", usages);
            await logTokenUsage(sucursalId, "copilot", totalUsage);
            return {
                reply:
                    proposals.length > 0
                        ? "Preparé la propuesta de cambio abajo para que la revises y confirmes."
                        : "Completé la consulta. Si quedó alguna propuesta pendiente, podés revisarla abajo.",
                proposals,
                toolsUsed: Array.from(toolsUsed),
                usage: totalUsage,
                provider: "openai",
                model: "gpt-4.1-mini",
            };
        } catch (err: any) {
            const errMsg = err?.message || String(err);
            console.warn("[Copilot OpenAI] Error:", errMsg);
            providerErrors.push(`OpenAI: ${errMsg}`);
        }
    }

    // 3. Fallback Groq (prompt, tools e historial compactos para respetar límite TPM free-tier)
    if (providers.groq) {
        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY || "",
            maxRetries: 0,
            timeout: 20_000,
        });
        const includeProposals = hasWriteIntent(message, cleanHistory);
        const groqTools = getOpenAICopilotTools(true).filter(
            (t: any) => includeProposals || !t.function.name.startsWith("propose_")
        );
        const groqStartedAt = Date.now();
        const callGroqWithRetry = async (payload: any) => {
            try {
                return await groq.chat.completions.create(payload);
            } catch (err: any) {
                const errMsg = err?.message || String(err);
                const waitS = Number(err?.status) === 429 ? parseRetryAfterSeconds(errMsg) : null;
                // Reintento único si el límite por minuto se libera en pocos segundos y hay margen de tiempo
                if (waitS !== null && waitS <= 12 && Date.now() - groqStartedAt + waitS * 1000 < 40_000) {
                    await sleep(Math.ceil(waitS * 1000) + 300);
                    return await groq.chat.completions.create(payload);
                }
                throw err;
            }
        };
        const groqSystemPrompt = buildCopilotSystemPrompt({
            sucursalName,
            todayArgentina,
            userName,
            userRole,
            activePage,
            compact: true,
        });
        const groqHistory = cleanHistory.slice(-4).map((m) => ({
            role: m.role,
            content: m.content.length > 500 ? `${m.content.slice(0, 500)}…` : m.content,
        }));
        while (groqHistory.length > 0 && groqHistory[0].role === "assistant") {
            groqHistory.shift();
        }

        for (const modelId of GROQ_CHAT_MODELS) {
            try {
                const proposals: PendingActionProposal[] = [];
                const toolsUsed = new Set<string>();
                const usages: TokenUsageRecord[] = [];
                const messages: any[] = [
                    { role: "system", content: groqSystemPrompt },
                    ...groqHistory,
                    { role: "user", content: message },
                ];

                let maxIter = 5;
                let lastFingerprint = "";
                while (maxIter > 0) {
                    maxIter--;
                    const response: any = await callGroqWithRetry({
                        model: modelId,
                        messages,
                        tools: groqTools,
                        tool_choice: "auto",
                        max_completion_tokens: 1300,
                    });

                    const u: any = response.usage || {};
                    const pt = Number(u.prompt_tokens || 0);
                    const ot = Number(u.completion_tokens || 0);
                    usages.push({
                        provider: "groq",
                        model: modelId,
                        promptTokens: pt,
                        cachedTokens: 0,
                        outputTokens: ot,
                        totalTokens: Number(u.total_tokens || pt + ot),
                        estimatedCostUsd: estimateCostUsd(modelId, pt, 0, ot),
                    });

                    const msg: any = response.choices?.[0]?.message || {};
                    messages.push({
                        role: "assistant",
                        content: msg.content ?? null,
                        ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}),
                    });

                    if (!msg.tool_calls || msg.tool_calls.length === 0) {
                        const totalUsage = aggregateUsage("groq", modelId, usages);
                        await logTokenUsage(sucursalId, "copilot", totalUsage);
                        return {
                            reply:
                                msg.content ||
                                (proposals.length > 0
                                    ? "Preparé la propuesta de cambio abajo para que la revises y confirmes."
                                    : "Listo."),
                            proposals,
                            toolsUsed: Array.from(toolsUsed),
                            usage: totalUsage,
                            provider: "groq",
                            model: modelId,
                        };
                    }

                    const turnFingerprint = JSON.stringify(
                        msg.tool_calls.map((tc: any) => ({
                            name: tc.function.name,
                            args: tc.function.arguments || "",
                        }))
                    );
                    if (turnFingerprint === lastFingerprint) {
                        const totalUsage = aggregateUsage("groq", modelId, usages);
                        await logTokenUsage(sucursalId, "copilot", totalUsage);
                        return {
                            reply:
                                msg.content ||
                                (proposals.length > 0
                                    ? "Preparé la propuesta de cambio abajo para que la revises y confirmes."
                                    : "Análisis completado."),
                            proposals,
                            toolsUsed: Array.from(toolsUsed),
                            usage: totalUsage,
                            provider: "groq",
                            model: modelId,
                        };
                    }
                    lastFingerprint = turnFingerprint;

                    for (const tc of msg.tool_calls) {
                        let args: Record<string, any> = {};
                        try {
                            args = JSON.parse(tc.function.arguments || "{}");
                        } catch {
                            args = {};
                        }
                        toolsUsed.add(tc.function.name);
                        const result = await dispatchTool(tc.function.name, args, sucursalId, proposals);
                        messages.push({
                            tool_call_id: tc.id,
                            role: "tool",
                            name: tc.function.name,
                            content: truncateToolOutput(result, 3000),
                        });
                    }
                }

                const totalUsage = aggregateUsage("groq", modelId, usages);
                await logTokenUsage(sucursalId, "copilot", totalUsage);
                return {
                    reply:
                        proposals.length > 0
                            ? "Preparé la propuesta de cambio abajo para que la revises y confirmes."
                            : "Completé la consulta. Si quedó alguna propuesta pendiente, podés revisarla abajo.",
                    proposals,
                    toolsUsed: Array.from(toolsUsed),
                    usage: totalUsage,
                    provider: "groq",
                    model: modelId,
                };
            } catch (err: any) {
                const errMsg = err?.message || String(err);
                console.warn(`[Copilot Groq ${modelId}] Error:`, errMsg);
                providerErrors.push(`Groq (${modelId}): ${errMsg}`);
            }
        }
    }

    console.error("[Copilot] All providers failed:", providerErrors);
    const geminiDepleted = providerErrors.some(
        (e) =>
            e.includes("credits are depleted") ||
            e.includes("402") ||
            e.includes("créditos prepagos agotados")
    );
    if (geminiDepleted && !providers.groq && !providers.openai) {
        throw new Error(
            "Créditos de Gemini agotados y no hay respaldo configurado en el servidor (verificá GROQ_API_KEY u OPENAI_API_KEY en el entorno)."
        );
    }
    if (geminiDepleted) {
        throw new Error(
            `Créditos de Gemini agotados y fallaron los respaldos (${providerErrors[providerErrors.length - 1] || "sin respuesta"}).`
        );
    }
    throw new Error(
        providerErrors.length > 0
            ? `No se pudo obtener respuesta de la IA: ${providerErrors[providerErrors.length - 1]}`
            : "No hay proveedores IA configurados en el servidor (GEMINI_API_KEY, OPENAI_API_KEY o GROQ_API_KEY)."
    );
}
