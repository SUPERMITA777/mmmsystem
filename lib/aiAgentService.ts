import Groq from "groq-sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { pointInPolygon, getDistance, LatLng } from "@/lib/geoutils";
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
import type { FewShotExample } from "@/lib/whatsappTrainer";

export type { FewShotExample };

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

export interface PersonalityMode {
    id: string;
    name: string;
    emoji: string;
    description: string;
    tone: string;
}

export interface TrainingSnippet {
    id: string;
    title: string;
    content: string;
}

export interface AgentConfig {
    enabled: boolean;
    whatsapp_enabled: boolean;
    system_prompt: string;
    training_snippets: TrainingSnippet[];
    allowed_operations: string[];
    auto_reply: boolean;
    business_hours_only: boolean;
    max_tokens: number;
    agent_name: string;
    personality_modes: PersonalityMode[];
    active_personality: string;
    handoff_triggers: string[];
    resume_triggers: string[];
    handoff_timeout_seconds: number;
    // v2 config
    ai_provider: "gemini" | "openai";
    ai_model: string;
    show_bot_prefix: boolean;
    human_pause_minutes: number;
    out_of_hours_message: string;
    monthly_token_limit: number;
    style_guide: string;
    few_shot_examples: FewShotExample[];
    // Status fields for web sync
    whatsapp_status?: "disconnected" | "connecting" | "qr" | "connected";
    whatsapp_qr?: string | null;
    whatsapp_phone?: string | null;
}

export interface AgentResponse {
    reply: string;
    action?: {
        type: string;
        details: Record<string, any>;
        result: string;
    };
    handoff?: boolean;
    cart?: any;
    usage?: TokenUsageRecord;
}

export interface ProcessMessageOptions {
    fromMe?: boolean;
    dryRun?: boolean;
    audioBase64?: string;
    audioMimeType?: string;
    imageBase64?: string;
    imageMimeType?: string;
    location?: { lat: number; lng: number; address?: string };
    senderName?: string;
    simulatorHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    simulatorCart?: any;
}

export interface StoreHoursStatus {
    isOpen: boolean;
    statusText: string;
    todayScheduleText: string;
    allScheduleText: string;
    nextOpenText?: string;
}

export interface ChatTurn {
    role: "user" | "assistant";
    text: string;
}

interface CartItemInput {
    product_id?: string;
    product_name: string;
    quantity?: number;
    adicionales?: string[];
    notes?: string;
}

interface RuntimeContext {
    dryRun: boolean;
    cart: any;
    lastOrderId?: string | null;
}

const DEFAULT_PERSONALITIES: PersonalityMode[] = [
    {
        id: "friendly",
        name: "Amigable",
        emoji: "😊",
        description: "Cálido, cercano y con humor. Ideal para negocios informales.",
        tone: "Respondé de forma cálida, cercana y amigable. Usá voseo argentino natural, algún emoji sin exagerar y hablá como una persona real atendiendo por WhatsApp.",
    },
    {
        id: "professional",
        name: "Profesional",
        emoji: "💼",
        description: "Formal, eficiente y directo. Ideal para empresas serias.",
        tone: "Respondé de forma profesional, eficiente y cortés. Sé directo y claro. Usá un tono respetuoso sin ser frío. Minimizá el uso de emojis y priorizá la información precisa.",
    },
    {
        id: "enthusiastic",
        name: "Entusiasta",
        emoji: "🚀",
        description: "Energético, positivo y motivador. Ideal para marcas jóvenes.",
        tone: "Respondé con energía y buena onda, usá emojis con criterio, celebrá las elecciones del cliente y sugerí acompañamientos con naturalidad.",
    },
];

const DEFAULT_CONFIG: AgentConfig = {
    enabled: false,
    whatsapp_enabled: false,
    system_prompt: "",
    training_snippets: [],
    allowed_operations: ["view_products", "view_orders", "create_orders"],
    auto_reply: true,
    business_hours_only: false,
    max_tokens: 900,
    agent_name: "Asistente",
    personality_modes: DEFAULT_PERSONALITIES,
    active_personality: "friendly",
    handoff_triggers: ["hablar con un humano", "hablar con una persona", "quiero hablar con", "operador", "agente humano"],
    resume_triggers: ["volver al bot", "hablar con el bot", "hablar con el agente", "volver al asistente"],
    handoff_timeout_seconds: 300,
    ai_provider: "gemini",
    ai_model: "gemini-2.5-flash",
    show_bot_prefix: false,
    human_pause_minutes: 15,
    out_of_hours_message: "",
    monthly_token_limit: 0,
    style_guide: "",
    few_shot_examples: [],
};

const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";

// ═══════════════════════════════════════════
// STRING, PHONE & HISTORY HELPERS
// ═══════════════════════════════════════════

function normalizeText(value: string): string {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

export function cleanPhoneNumber(raw: string): string {
    return (raw || "")
        .replace(/@s\.whatsapp\.net$/i, "")
        .replace(/@lid$/i, "")
        .replace(/@c\.us$/i, "")
        .replace(/\D/g, "");
}

function phoneTailDigits(raw: string, length: number = 10): string {
    const digits = cleanPhoneNumber(raw);
    if (digits.length <= length) return digits;
    return digits.slice(-length);
}

export function stripLegacyPrefix(text: string): string {
    return (text || "").replace(/^(?:🤖|⚡)\s+/u, "").trim();
}

/**
 * Convierte filas de `whatsapp_messages` (YA ordenadas cronológicamente: oldest -> newest)
 * en turnos alternados `user` / `assistant`.
 * Soporta tanto filas nuevas (2 filas: `from_me=false` y `from_me=true`)
 * como filas legacy (1 fila con `message_text` y `reply_text`).
 */
export function expandMessagesToTurns(
    rows: Array<{
        message_text?: string | null;
        reply_text?: string | null;
        from_me?: boolean | null;
    }>
): ChatTurn[] {
    const turns: ChatTurn[] = [];

    const pushTurn = (role: "user" | "assistant", rawText: string) => {
        const text = (rawText || "").trim();
        if (!text) return;
        const last = turns[turns.length - 1];
        if (last && last.role === role) {
            last.text = `${last.text}\n${text}`;
        } else {
            turns.push({ role, text });
        }
    };

    for (const row of rows) {
        const msgText = (row.message_text || "").trim();
        const repText = stripLegacyPrefix(row.reply_text || "");

        if (row.from_me) {
            const assistantText = repText || stripLegacyPrefix(msgText);
            if (assistantText) pushTurn("assistant", assistantText);
        } else {
            if (msgText) pushTurn("user", msgText);
            if (repText) pushTurn("assistant", repText);
        }
    }

    // Gemini requiere que el historial empiece en turno 'user'
    while (turns.length > 0 && turns[0].role === "assistant") {
        turns.shift();
    }

    return turns;
}

// ═══════════════════════════════════════════
// TOOLS SCHEMA (Gemini + OpenAI compatible)
// ═══════════════════════════════════════════

const AGENT_TOOLS: any[] = [
    {
        functionDeclarations: [
            {
                name: "get_products",
                description:
                    "Obtener productos disponibles del menú con su precio actual (incluye promociones vigentes, si tiene stock y si tiene adicionales/variantes). Puede filtrarse por categoría.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        category: {
                            type: "STRING",
                            description: "Nombre de la categoría para filtrar (opcional)",
                        },
                        active_only: {
                            type: "BOOLEAN",
                            description: "Si es true, solo muestra productos activos y con stock",
                        },
                    },
                },
            },
            {
                name: "get_product_details",
                description:
                    "Obtener detalles completos de un producto, incluyendo sus grupos de adicionales, gustos, tamaños u opciones obligatorias y precios extras.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        product_id: {
                            type: "STRING",
                            description: "ID UUID del producto (opcional si pasás product_name)",
                        },
                        product_name: {
                            type: "STRING",
                            description: "Nombre del producto a consultar",
                        },
                    },
                },
            },
            {
                name: "get_product_price",
                description: "Buscar productos específicos por nombre y obtener su precio actual y descripción.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        product_name: {
                            type: "STRING",
                            description: "Nombre del producto a buscar",
                        },
                    },
                    required: ["product_name"],
                },
            },
            {
                name: "get_categories",
                description: "Obtener la lista de categorías activas del menú.",
                parameters: {
                    type: "OBJECT",
                    properties: {},
                },
            },
            {
                name: "get_payment_methods",
                description: "Obtener los medios de pago activos del local (efectivo, transferencia, Mercado Pago, etc.) y descuentos por medio de pago.",
                parameters: {
                    type: "OBJECT",
                    properties: {},
                },
            },
            {
                name: "get_my_orders",
                description: "Consultar el estado de los pedidos recientes del cliente que está escribiendo por WhatsApp.",
                parameters: {
                    type: "OBJECT",
                    properties: {},
                },
            },
            {
                name: "get_active_orders",
                description: "Obtener todos los pedidos activos/pendientes del local (solo uso del personal).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        status: {
                            type: "STRING",
                            description: "Filtrar por estado: pendiente, confirmado, preparando, listo, en_camino, entregado",
                        },
                    },
                },
            },
            {
                name: "toggle_product_availability",
                description: "Activar o desactivar un producto (solo personal autorizado).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        product_name: {
                            type: "STRING",
                            description: "Nombre del producto",
                        },
                        active: {
                            type: "BOOLEAN",
                            description: "true para activar, false para desactivar",
                        },
                    },
                    required: ["product_name", "active"],
                },
            },
            {
                name: "update_product_price",
                description: "Cambiar el precio de un producto (solo personal autorizado).",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        product_name: {
                            type: "STRING",
                            description: "Nombre del producto",
                        },
                        new_price: {
                            type: "NUMBER",
                            description: "Nuevo precio del producto",
                        },
                    },
                    required: ["product_name", "new_price"],
                },
            },
            {
                name: "get_mesa_by_number",
                description: "Buscar una mesa por su número para verificar si existe y ver su estado.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        mesa_numero: {
                            type: "NUMBER",
                            description: "Número de la mesa a buscar (ej: 3)",
                        },
                    },
                    required: ["mesa_numero"],
                },
            },
            {
                name: "preview_cart",
                description:
                    "Previsualizar y validar el pedido completo (productos, adicionales/gustos obligatorios, stock, zona de entrega, costo de envío, medio de pago y total exacto) antes de confirmarlo.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        customer_name: {
                            type: "STRING",
                            description: "Nombre del cliente (obligatorio)",
                        },
                        items: {
                            type: "ARRAY",
                            description: "Lista estructurada de productos pedidos",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    product_id: {
                                        type: "STRING",
                                        description: "ID del producto si se conoce (opcional)",
                                    },
                                    product_name: {
                                        type: "STRING",
                                        description: "Nombre del producto del menú",
                                    },
                                    quantity: {
                                        type: "NUMBER",
                                        description: "Cantidad pedida (default 1)",
                                    },
                                    adicionales: {
                                        type: "ARRAY",
                                        description: "Lista de adicionales, gustos, tamaños o extras elegidos para este ítem",
                                        items: { type: "STRING" },
                                    },
                                    notes: {
                                        type: "STRING",
                                        description: "Aclaraciones del ítem (ej: 'sin cebolla', 'bien cocido')",
                                    },
                                },
                                required: ["product_name", "quantity"],
                            },
                        },
                        delivery_type: {
                            type: "STRING",
                            description: "Modalidad: 'delivery', 'takeaway' (retiro en local) o 'salon' (mesa)",
                        },
                        delivery_address: {
                            type: "STRING",
                            description: "Dirección completa (calle y altura) si es delivery",
                        },
                        client_lat: {
                            type: "NUMBER",
                            description: "Latitud GPS si el cliente envió su ubicación por WhatsApp",
                        },
                        client_lng: {
                            type: "NUMBER",
                            description: "Longitud GPS si el cliente envió su ubicación por WhatsApp",
                        },
                        mesa_numero: {
                            type: "NUMBER",
                            description: "Número de mesa si es salón",
                        },
                        payment_method: {
                            type: "STRING",
                            description: "Medio de pago elegido (ej: 'Efectivo', 'Transferencia', 'Mercado Pago')",
                        },
                        pay_with_amount: {
                            type: "NUMBER",
                            description: "Con cuánto dinero abona si paga en efectivo (opcional)",
                        },
                        notes: {
                            type: "STRING",
                            description: "Notas generales del pedido (ej: 'timbre no anda')",
                        },
                    },
                    required: ["customer_name", "items", "delivery_type"],
                },
            },
            {
                name: "submit_order",
                description:
                    "Confirmar definitivamente el pedido ya previsualizado en preview_cart y enviarlo a la cocina / panel de pedidos.",
                parameters: {
                    type: "OBJECT",
                    properties: {},
                },
            },
            {
                name: "add_to_existing_order",
                description:
                    "Agregar productos adicionales a un pedido que ya fue enviado a cocina en esta sesión.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        items: {
                            type: "ARRAY",
                            description: "Productos adicionales a sumar al pedido activo",
                            items: {
                                type: "OBJECT",
                                properties: {
                                    product_id: { type: "STRING" },
                                    product_name: { type: "STRING" },
                                    quantity: { type: "NUMBER" },
                                    adicionales: {
                                        type: "ARRAY",
                                        items: { type: "STRING" },
                                    },
                                    notes: { type: "STRING" },
                                },
                                required: ["product_name", "quantity"],
                            },
                        },
                    },
                    required: ["items"],
                },
            },
        ],
    },
];

// ═══════════════════════════════════════════
// CONFIG MANAGEMENT
// ═══════════════════════════════════════════

export async function getAgentConfig(sucursalId: string): Promise<AgentConfig> {
    const { data } = await supabaseAdmin
        .from("config_sucursal")
        .select("ai_agent_config")
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

    if (data?.ai_agent_config) {
        return { ...DEFAULT_CONFIG, ...data.ai_agent_config };
    }
    return DEFAULT_CONFIG;
}

export async function updateAgentConfig(
    sucursalId: string,
    config: Partial<AgentConfig>
): Promise<boolean> {
    const current = await getAgentConfig(sucursalId);
    const updated = { ...current, ...config };

    const { error } = await supabaseAdmin
        .from("config_sucursal")
        .update({ ai_agent_config: updated })
        .eq("sucursal_id", sucursalId);

    if (error) {
        const { error: upsertError } = await supabaseAdmin
            .from("config_sucursal")
            .upsert(
                {
                    sucursal_id: sucursalId,
                    ai_agent_config: updated,
                },
                { onConflict: "sucursal_id" }
            );
        return !upsertError;
    }
    return true;
}

// ═══════════════════════════════════════════
// STORE HOURS (Argentina Timezone)
// ═══════════════════════════════════════════

const WEEKDAY_NAMES_ES = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
];

function getArgentinaClock(now: Date = new Date()): { sysDow: number; currentHHMM: string } {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: ARGENTINA_TZ,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(now);

    const weekdayStr = parts.find((p) => p.type === "weekday")?.value || "Mon";
    const hourStr = parts.find((p) => p.type === "hour")?.value || "00";
    const minStr = parts.find((p) => p.type === "minute")?.value || "00";

    const mapDow: Record<string, number> = {
        Mon: 0,
        Tue: 1,
        Wed: 2,
        Thu: 3,
        Fri: 4,
        Sat: 5,
        Sun: 6,
    };

    const sysDow = mapDow[weekdayStr] ?? 0;
    const hh = hourStr === "24" ? "00" : hourStr.padStart(2, "0");
    const mm = minStr.padStart(2, "0");
    return { sysDow, currentHHMM: `${hh}:${mm}` };
}

function hhmmToMinutes(hhmm: string): number {
    const [h, m] = (hhmm || "00:00").slice(0, 5).split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
}

function isTimeInShift(
    apertura: string | null | undefined,
    cierre: string | null | undefined,
    currentMinutes: number
): boolean {
    if (!apertura || !cierre) return false;
    const start = hhmmToMinutes(apertura);
    const end = hhmmToMinutes(cierre);
    if (start <= end) {
        return currentMinutes >= start && currentMinutes <= end;
    }
    // Turno que cruza medianoche (ej: 20:00 a 02:00)
    return currentMinutes >= start;
}

function isOvernightFromYesterday(
    apertura: string | null | undefined,
    cierre: string | null | undefined,
    currentMinutes: number
): boolean {
    if (!apertura || !cierre) return false;
    const start = hhmmToMinutes(apertura);
    const end = hhmmToMinutes(cierre);
    return start > end && currentMinutes <= end;
}

function formatDaySchedule(h: any): string {
    if (!h || h.cerrado) return "Cerrado";
    const ranges: string[] = [];
    if (h.apertura1 && h.cierre1) {
        ranges.push(`${String(h.apertura1).slice(0, 5)} a ${String(h.cierre1).slice(0, 5)}`);
    }
    if (h.apertura2 && h.cierre2) {
        ranges.push(`${String(h.apertura2).slice(0, 5)} a ${String(h.cierre2).slice(0, 5)}`);
    }
    return ranges.length > 0 ? ranges.join(" y ") : "Horario no especificado";
}

export async function getStoreHoursStatus(
    sucursalId: string,
    now: Date = new Date()
): Promise<StoreHoursStatus> {
    try {
        const [{ data: cfg }, { data: horarios }] = await Promise.all([
            supabaseAdmin
                .from("config_sucursal")
                .select("cerrado_temporalmente, mensaje_cerrado")
                .eq("sucursal_id", sucursalId)
                .maybeSingle(),
            supabaseAdmin
                .from("horarios_sucursal")
                .select("dia, cerrado, apertura1, cierre1, apertura2, cierre2")
                .eq("sucursal_id", sucursalId)
                .order("dia", { ascending: true }),
        ]);

        const allScheduleText =
            horarios && horarios.length > 0
                ? horarios
                      .map((h) => `${WEEKDAY_NAMES_ES[h.dia] || `Día ${h.dia}`}: ${formatDaySchedule(h)}`)
                      .join(" | ")
                : "Sin horarios cargados";

        if (cfg?.cerrado_temporalmente) {
            return {
                isOpen: false,
                statusText: cfg.mensaje_cerrado || "Cerrado temporalmente",
                todayScheduleText: "Cerrado temporalmente",
                allScheduleText,
            };
        }

        if (!horarios || horarios.length === 0) {
            return {
                isOpen: true,
                statusText: "Abierto (sin restricción de horarios configurada)",
                todayScheduleText: "Sin horarios configurados",
                allScheduleText,
            };
        }

        const { sysDow, currentHHMM } = getArgentinaClock(now);
        const currentMinutes = hhmmToMinutes(currentHHMM);
        const today = horarios.find((h) => h.dia === sysDow);
        const yesterdayDow = (sysDow + 6) % 7;
        const yesterday = horarios.find((h) => h.dia === yesterdayDow);

        const openFromYesterday =
            yesterday &&
            !yesterday.cerrado &&
            (isOvernightFromYesterday(yesterday.apertura1, yesterday.cierre1, currentMinutes) ||
                isOvernightFromYesterday(yesterday.apertura2, yesterday.cierre2, currentMinutes));

        const openToday =
            today &&
            !today.cerrado &&
            (isTimeInShift(today.apertura1, today.cierre1, currentMinutes) ||
                isTimeInShift(today.apertura2, today.cierre2, currentMinutes));

        const isOpen = Boolean(openFromYesterday || openToday);
        const todayScheduleText = formatDaySchedule(today);

        if (isOpen) {
            return {
                isOpen: true,
                statusText: `Abierto ahora (${currentHHMM} hs)`,
                todayScheduleText,
                allScheduleText,
            };
        }

        let nextOpenText = "";
        if (today && !today.cerrado) {
            if (today.apertura1 && currentMinutes < hhmmToMinutes(today.apertura1)) {
                nextOpenText = `Hoy abrimos a las ${String(today.apertura1).slice(0, 5)} hs`;
            } else if (today.apertura2 && currentMinutes < hhmmToMinutes(today.apertura2)) {
                nextOpenText = `Hoy abrimos a las ${String(today.apertura2).slice(0, 5)} hs`;
            }
        }

        return {
            isOpen: false,
            statusText: nextOpenText ? `Cerrado en este momento (${nextOpenText})` : "Cerrado en este momento",
            todayScheduleText,
            allScheduleText,
            nextOpenText: nextOpenText || undefined,
        };
    } catch {
        return {
            isOpen: true,
            statusText: "Abierto",
            todayScheduleText: "",
            allScheduleText: "",
        };
    }
}

// ═══════════════════════════════════════════
// CONVERSATION HISTORY & HANDOFF MANAGEMENT
// ═══════════════════════════════════════════

export async function getOrCreateConversation(
    sucursalId: string,
    senderPhone: string,
    senderName?: string
) {
    if (senderPhone === "simulador-admin") {
        return {
            id: "simulator-id",
            sucursal_id: sucursalId,
            sender_phone: senderPhone,
            status: "active",
            metadata: {},
            last_message_at: new Date().toISOString(),
        };
    }

    const { data: existing } = await supabaseAdmin
        .from("whatsapp_conversations")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .eq("sender_phone", senderPhone)
        .in("status", ["active", "handed_off"])
        .maybeSingle();

    if (existing) {
        const updatePayload: Record<string, any> = {
            last_message_at: new Date().toISOString(),
        };
        if (senderName && !existing.sender_name) {
            updatePayload.sender_name = senderName;
        }
        await supabaseAdmin
            .from("whatsapp_conversations")
            .update(updatePayload)
            .eq("id", existing.id);
        return existing;
    }

    const { data: newConv } = await supabaseAdmin
        .from("whatsapp_conversations")
        .insert({
            sucursal_id: sucursalId,
            sender_phone: senderPhone,
            sender_name: senderName || null,
            status: "active",
        })
        .select()
        .single();

    return newConv;
}

function matchesTrigger(text: string, triggers: string[]): boolean {
    const normalized = text.toLowerCase().trim();
    return triggers.some((trigger) => normalized.includes(trigger.toLowerCase()));
}

async function handOffConversation(
    conversationId: string,
    existingMeta: Record<string, any>,
    handedTo: string,
    reason: string,
    pauseSeconds?: number
) {
    await supabaseAdmin
        .from("whatsapp_conversations")
        .update({
            status: "handed_off",
            metadata: {
                ...existingMeta,
                handed_off_at: new Date().toISOString(),
                handed_off_to: handedTo,
                handed_off_reason: reason,
                ...(typeof pauseSeconds === "number" ? { pause_seconds: pauseSeconds } : {}),
            },
        })
        .eq("id", conversationId);
}

async function resumeConversation(conversationId: string, existingMeta: Record<string, any> = {}) {
    const cleanMeta = { ...existingMeta };
    delete cleanMeta.handed_off_at;
    delete cleanMeta.handed_off_to;
    delete cleanMeta.handed_off_reason;
    delete cleanMeta.pause_seconds;

    await supabaseAdmin
        .from("whatsapp_conversations")
        .update({
            status: "active",
            metadata: cleanMeta,
        })
        .eq("id", conversationId);
}

function isHandoffTimedOut(conversation: any, defaultTimeoutSeconds: number): boolean {
    if (conversation.status !== "handed_off") return false;
    const effectiveTimeout =
        typeof conversation.metadata?.pause_seconds === "number"
            ? conversation.metadata.pause_seconds
            : defaultTimeoutSeconds;
    if (effectiveTimeout <= 0) return false;
    const handedOffAt = conversation.metadata?.handed_off_at;
    if (!handedOffAt) return false;
    const elapsed = (Date.now() - new Date(handedOffAt).getTime()) / 1000;
    return elapsed >= effectiveTimeout;
}

async function saveMessage(
    conversationId: string,
    sucursalId: string,
    senderPhone: string,
    messageText: string,
    replyText: string | null,
    fromMe: boolean
) {
    await supabaseAdmin.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        sucursal_id: sucursalId,
        sender_phone: senderPhone,
        message_text: messageText,
        reply_text: replyText,
        from_me: fromMe,
        processed: true,
    });
}

async function saveMessagePair(
    conversationId: string,
    sucursalId: string,
    senderPhone: string,
    userText: string,
    replyText: string
) {
    const now = Date.now();
    await supabaseAdmin.from("whatsapp_messages").insert([
        {
            conversation_id: conversationId,
            sucursal_id: sucursalId,
            sender_phone: senderPhone,
            message_text: userText,
            reply_text: null,
            from_me: false,
            processed: true,
            created_at: new Date(now).toISOString(),
        },
        {
            conversation_id: conversationId,
            sucursal_id: sucursalId,
            sender_phone: senderPhone,
            message_text: "",
            reply_text: replyText,
            from_me: true,
            processed: true,
            created_at: new Date(now + 10).toISOString(),
        },
    ]);
}

async function getRecentMessages(
    sucursalId: string,
    senderPhone: string,
    limit: number = 24
) {
    const { data } = await supabaseAdmin
        .from("whatsapp_messages")
        .select("message_text, reply_text, from_me, created_at")
        .eq("sucursal_id", sucursalId)
        .eq("sender_phone", senderPhone)
        .order("created_at", { ascending: false })
        .limit(limit);

    // Devuelve en orden cronológico (oldest -> newest)
    return (data || []).reverse();
}

/**
 * Se llama cuando un humano del negocio responde manualmente desde WhatsApp Web/celular.
 * Guarda la respuesta humana y pausa automáticamente al bot por `human_pause_minutes`.
 */
export async function handleHumanTakeover(
    sucursalId: string,
    senderPhone: string,
    text: string,
    senderName?: string
): Promise<{ pausedMinutes: number }> {
    const config = await getAgentConfig(sucursalId);
    const conversation = await getOrCreateConversation(sucursalId, senderPhone, senderName);
    const pauseMinutes = Math.max(1, Number(config.human_pause_minutes ?? 15));

    if (conversation) {
        if (text && text.trim()) {
            await saveMessage(conversation.id, sucursalId, senderPhone, "", text.trim(), true);
        }
        await handOffConversation(
            conversation.id,
            conversation.metadata || {},
            "humano",
            "human_reply",
            pauseMinutes * 60
        );
    }

    return { pausedMinutes: pauseMinutes };
}

// ═══════════════════════════════════════════
// CATALOG, DISCOUNTS & ADICIONALES HELPERS
// ═══════════════════════════════════════════

async function loadActiveDiscounts(sucursalId: string): Promise<Descuento[]> {
    const { data } = await supabaseAdmin
        .from("descuentos")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .eq("activo", true);
    return ((data || []) as Descuento[]).filter(isValidDiscountTime);
}

interface LoadedAdditionGroup {
    id: string;
    titulo: string;
    seleccion_obligatoria: boolean;
    seleccion_minima: number;
    seleccion_maxima: number;
    adicionales: Array<{
        id: string;
        nombre: string;
        precio_venta: number;
        seleccion_maxima: number;
        impresora?: string;
    }>;
}

async function loadProductAdditionGroups(
    productIds: string[]
): Promise<Map<string, LoadedAdditionGroup[]>> {
    const result = new Map<string, LoadedAdditionGroup[]>();
    if (productIds.length === 0) return result;

    const { data: links } = await supabaseAdmin
        .from("producto_grupos_adicionales")
        .select("producto_id, grupo_id")
        .in("producto_id", productIds);

    if (!links || links.length === 0) return result;

    const grupoIds = Array.from(new Set(links.map((l: any) => l.grupo_id).filter(Boolean)));
    if (grupoIds.length === 0) return result;

    const [{ data: grupos }, { data: adicionales }] = await Promise.all([
        supabaseAdmin
            .from("grupos_adicionales")
            .select("id, titulo, seleccion_obligatoria, seleccion_minima, seleccion_maxima, visible")
            .in("id", grupoIds),
        supabaseAdmin
            .from("adicionales")
            .select("id, grupo_id, nombre, precio_venta, seleccion_maxima, visible, stock, vender_sin_stock, impresora")
            .in("grupo_id", grupoIds)
            .order("nombre", { ascending: true }),
    ]);

    const grupoMap = new Map<string, LoadedAdditionGroup>();
    for (const g of grupos || []) {
        if (g.visible === false) continue;
        grupoMap.set(g.id, {
            id: g.id,
            titulo: g.titulo || "Opciones",
            seleccion_obligatoria: Boolean(g.seleccion_obligatoria),
            seleccion_minima: Number(g.seleccion_minima || 0),
            seleccion_maxima: Number(g.seleccion_maxima || 99),
            adicionales: [],
        });
    }

    for (const ad of adicionales || []) {
        if (ad.visible === false) continue;
        if (ad.stock === false && !ad.vender_sin_stock) continue;
        const g = grupoMap.get(ad.grupo_id);
        if (!g) continue;
        g.adicionales.push({
            id: ad.id,
            nombre: ad.nombre,
            precio_venta: Number(ad.precio_venta || 0),
            seleccion_maxima: Number(ad.seleccion_maxima || 1),
            impresora: ad.impresora || undefined,
        });
    }

    for (const link of links) {
        const g = grupoMap.get(link.grupo_id);
        if (!g || g.adicionales.length === 0) continue;
        if (!result.has(link.producto_id)) result.set(link.producto_id, []);
        result.get(link.producto_id)!.push(g);
    }

    return result;
}

function findBestProductMatch(products: any[], item: CartItemInput): any | null {
    if (item.product_id) {
        const byId = products.find((p) => p.id === item.product_id);
        if (byId) return byId;
    }

    const needle = normalizeText(item.product_name);
    if (!needle) return null;

    // 1. Exacto
    const exact = products.find((p) => normalizeText(p.nombre) === needle);
    if (exact) return exact;

    // 2. Inclusión directa
    const contains = products.find(
        (p) => normalizeText(p.nombre).includes(needle) || needle.includes(normalizeText(p.nombre))
    );
    if (contains) return contains;

    // 3. Coincidencia por palabras clave (sin plurales simples)
    const stripPlural = (w: string) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);
    const needleWords = needle.split(/\s+/).filter((w) => w.length > 2).map(stripPlural);
    if (needleWords.length === 0) return null;

    let bestProd: any = null;
    let bestScore = 0;

    for (const p of products) {
        const pWords = normalizeText(p.nombre).split(/\s+/).map(stripPlural);
        let hits = 0;
        for (const nw of needleWords) {
            if (pWords.some((pw) => pw.includes(nw) || nw.includes(pw))) {
                hits++;
            }
        }
        const score = hits / Math.max(needleWords.length, 1);
        if (hits > 0 && score > bestScore && score >= 0.5) {
            bestScore = score;
            bestProd = p;
        }
    }

    return bestProd;
}

function parseLooseItemsInput(rawItems: any): CartItemInput[] {
    if (Array.isArray(rawItems)) {
        return rawItems
            .filter((it) => it && (it.product_name || it.nombre || it.product_id))
            .map((it) => ({
                product_id: it.product_id ? String(it.product_id) : undefined,
                product_name: String(it.product_name || it.nombre || "").trim(),
                quantity: Math.max(1, Number(it.quantity ?? it.cantidad ?? 1) || 1),
                adicionales: Array.isArray(it.adicionales)
                    ? it.adicionales.map((a: any) => String(a).trim()).filter(Boolean)
                    : [],
                notes: it.notes ? String(it.notes).trim() : undefined,
            }));
    }

    if (typeof rawItems === "string") {
        const trimmed = rawItems.trim();
        if (trimmed.startsWith("[")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parseLooseItemsInput(parsed);
            } catch {
                // fallback a string plano
            }
        }
        return trimmed
            .split(/[,;\n]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((raw) => {
                const m = raw.match(/^(\d+|un|una|uno)\s+(.+)$/i);
                let qty = 1;
                let pName = raw;
                if (m) {
                    const q = m[1].toLowerCase();
                    qty = q === "un" || q === "una" || q === "uno" ? 1 : Math.max(1, parseInt(q, 10) || 1);
                    pName = m[2].trim();
                }
                return { product_name: pName, quantity: qty, adicionales: [] };
            });
    }

    return [];
}

// ═══════════════════════════════════════════
// TOOL EXECUTION
// ═══════════════════════════════════════════

async function executeTool(
    toolName: string,
    args: Record<string, any>,
    sucursalId: string,
    config: AgentConfig,
    senderPhone: string,
    userRole: string,
    runtime: RuntimeContext
): Promise<string> {
    try {
        switch (toolName) {
            case "get_products": {
                if (!config.allowed_operations.includes("view_products")) {
                    return JSON.stringify({ error: "Operación no permitida por el administrador." });
                }

                let query = supabaseAdmin
                    .from("productos")
                    .select(
                        "id, nombre, precio, precio_promocional, promo_activo, promo_desde, promo_hasta, promo_hora_desde, promo_hora_hasta, promo_dias, descripcion, categoria_id, control_stock, stock_actual, producto_sugerido, categorias(nombre)"
                    )
                    .eq("sucursal_id", sucursalId)
                    .eq("activo", true)
                    .eq("visible_en_menu", true)
                    .eq("producto_oculto", false)
                    .order("orden", { ascending: true });

                if (args.category) {
                    const { data: cats } = await supabaseAdmin
                        .from("categorias")
                        .select("id")
                        .eq("sucursal_id", sucursalId)
                        .eq("activo", true)
                        .ilike("nombre", `%${args.category}%`);
                    if (cats && cats.length > 0) {
                        query = query.in(
                            "categoria_id",
                            cats.map((c) => c.id)
                        );
                    }
                }

                const [{ data: products }, descuentos] = await Promise.all([
                    query.limit(80),
                    loadActiveDiscounts(sucursalId),
                ]);

                const availableProducts = (products || []).filter(
                    (p: any) => !(p.control_stock && Number(p.stock_actual || 0) <= 0)
                );

                const prodIds = availableProducts.map((p: any) => p.id);
                const { data: links } =
                    prodIds.length > 0
                        ? await supabaseAdmin
                              .from("producto_grupos_adicionales")
                              .select("producto_id")
                              .in("producto_id", prodIds)
                        : { data: [] };

                const hasExtrasSet = new Set((links || []).map((l: any) => l.producto_id));

                const formatted = availableProducts.map((p: any) => {
                    const disc = getProductDiscount(p.id, p.categoria_id || "", descuentos, p);
                    const precioRegular = Number(p.precio || 0);
                    const precioFinal = disc ? disc.precioFinal(precioRegular) : precioRegular;
                    const catNombre = Array.isArray(p.categorias)
                        ? p.categorias[0]?.nombre || ""
                        : p.categorias?.nombre || "";

                    return {
                        id: p.id,
                        nombre: p.nombre,
                        categoria: catNombre,
                        precio: precioFinal,
                        ...(precioFinal < precioRegular
                            ? { precio_regular: precioRegular, promo: disc?.nombre || "Promoción" }
                            : {}),
                        ...(p.descripcion ? { descripcion: p.descripcion } : {}),
                        ...(p.producto_sugerido ? { destacado: true } : {}),
                        tiene_adicionales: hasExtrasSet.has(p.id),
                    };
                });

                return JSON.stringify(formatted);
            }

            case "get_product_details": {
                if (!config.allowed_operations.includes("view_products")) {
                    return JSON.stringify({ error: "Operación no permitida." });
                }

                let prodQuery = supabaseAdmin
                    .from("productos")
                    .select(
                        "id, nombre, precio, precio_promocional, promo_activo, promo_desde, promo_hasta, promo_hora_desde, promo_hora_hasta, promo_dias, descripcion, categoria_id, control_stock, stock_actual"
                    )
                    .eq("sucursal_id", sucursalId)
                    .eq("activo", true)
                    .eq("visible_en_menu", true)
                    .eq("producto_oculto", false);

                if (args.product_id) {
                    prodQuery = prodQuery.eq("id", args.product_id);
                } else if (args.product_name) {
                    prodQuery = prodQuery.ilike("nombre", `%${args.product_name}%`);
                } else {
                    return JSON.stringify({ error: "Indicá product_id o product_name." });
                }

                const [{ data: prods }, descuentos] = await Promise.all([
                    prodQuery.limit(5),
                    loadActiveDiscounts(sucursalId),
                ]);

                if (!prods || prods.length === 0) {
                    return JSON.stringify({ error: "No encontré ese producto en el menú." });
                }

                const groupsByProd = await loadProductAdditionGroups(prods.map((p: any) => p.id));

                const details = prods.map((p: any) => {
                    const disc = getProductDiscount(p.id, p.categoria_id || "", descuentos, p);
                    const precioRegular = Number(p.precio || 0);
                    const precioFinal = disc ? disc.precioFinal(precioRegular) : precioRegular;
                    const groups = groupsByProd.get(p.id) || [];

                    return {
                        id: p.id,
                        nombre: p.nombre,
                        descripcion: p.descripcion || "",
                        precio: precioFinal,
                        ...(precioFinal < precioRegular ? { precio_regular: precioRegular } : {}),
                        sin_stock: Boolean(p.control_stock && Number(p.stock_actual || 0) <= 0),
                        grupos_adicionales: groups.map((g) => ({
                            titulo: g.titulo,
                            obligatorio: g.seleccion_obligatoria,
                            minimo: g.seleccion_minima,
                            maximo: g.seleccion_maxima,
                            opciones: g.adicionales.map((a) => ({
                                nombre: a.nombre,
                                precio_extra: a.precio_venta,
                            })),
                        })),
                    };
                });

                return JSON.stringify(details);
            }

            case "get_product_price": {
                if (!config.allowed_operations.includes("view_products")) {
                    return JSON.stringify({ error: "Operación no permitida." });
                }
                const [{ data }, descuentos] = await Promise.all([
                    supabaseAdmin
                        .from("productos")
                        .select(
                            "id, nombre, precio, precio_promocional, promo_activo, promo_desde, promo_hasta, promo_hora_desde, promo_hora_hasta, promo_dias, descripcion, categoria_id, control_stock, stock_actual"
                        )
                        .eq("sucursal_id", sucursalId)
                        .eq("activo", true)
                        .eq("visible_en_menu", true)
                        .eq("producto_oculto", false)
                        .ilike("nombre", `%${args.product_name}%`)
                        .limit(6),
                    loadActiveDiscounts(sucursalId),
                ]);

                const formatted = (data || [])
                    .filter((p: any) => !(p.control_stock && Number(p.stock_actual || 0) <= 0))
                    .map((p: any) => {
                        const disc = getProductDiscount(p.id, p.categoria_id || "", descuentos, p);
                        const precioRegular = Number(p.precio || 0);
                        const precioFinal = disc ? disc.precioFinal(precioRegular) : precioRegular;
                        return {
                            id: p.id,
                            nombre: p.nombre,
                            precio: precioFinal,
                            ...(precioFinal < precioRegular ? { precio_regular: precioRegular } : {}),
                            descripcion: p.descripcion || "",
                        };
                    });

                return JSON.stringify(formatted);
            }

            case "get_categories": {
                if (!config.allowed_operations.includes("view_products")) {
                    return JSON.stringify({ error: "Operación no permitida." });
                }
                const { data } = await supabaseAdmin
                    .from("categorias")
                    .select("nombre, descripcion")
                    .eq("sucursal_id", sucursalId)
                    .eq("activo", true)
                    .order("orden", { ascending: true });
                return JSON.stringify(data || []);
            }

            case "get_payment_methods": {
                const [{ data: mps }, descuentos] = await Promise.all([
                    supabaseAdmin
                        .from("metodos_pago")
                        .select("id, nombre, codigo, detalles")
                        .eq("sucursal_id", sucursalId)
                        .eq("activo", true)
                        .order("orden", { ascending: true }),
                    loadActiveDiscounts(sucursalId),
                ]);

                const list = (mps || []).map((mp: any) => {
                    const desc = descuentos.find(
                        (d: any) => d.metodo_pago_id === mp.id && d.auto_aplicar
                    );
                    return {
                        id: mp.id,
                        nombre: mp.nombre,
                        codigo: mp.codigo,
                        detalles: mp.detalles || {},
                        ...(desc
                            ? {
                                  descuento_automatico:
                                      desc.tipo === "porcentaje"
                                          ? `${desc.valor}% OFF`
                                          : `$${desc.valor} OFF`,
                              }
                            : {}),
                    };
                });

                return JSON.stringify(list);
            }

            case "get_my_orders": {
                if (!config.allowed_operations.includes("view_orders")) {
                    return JSON.stringify({ error: "Operación no permitida." });
                }
                const tail = phoneTailDigits(senderPhone, 10);
                if (!tail) {
                    return JSON.stringify([]);
                }

                const { data } = await supabaseAdmin
                    .from("pedidos")
                    .select("numero_pedido, estado, tipo, total, cliente_nombre, created_at, tiempo_preparacion_minutos")
                    .eq("sucursal_id", sucursalId)
                    .ilike("cliente_telefono", `%${tail}%`)
                    .order("created_at", { ascending: false })
                    .limit(5);

                return JSON.stringify(data || []);
            }

            case "get_active_orders": {
                if (userRole === "cliente") {
                    return JSON.stringify({ error: "No autorizado para ver pedidos de otros clientes." });
                }
                if (!config.allowed_operations.includes("view_orders")) {
                    return JSON.stringify({ error: "Operación no permitida." });
                }
                let query = supabaseAdmin
                    .from("pedidos")
                    .select("numero_pedido, estado, tipo, total, cliente_nombre, mesa_numero, created_at")
                    .eq("sucursal_id", sucursalId)
                    .order("created_at", { ascending: false })
                    .limit(20);
                if (args.status) {
                    query = query.eq("estado", args.status);
                } else {
                    query = query.in("estado", ["pendiente", "confirmado", "preparando", "listo"]);
                }
                const { data } = await query;
                return JSON.stringify(data || []);
            }

            case "toggle_product_availability": {
                if (userRole === "cliente" || !config.allowed_operations.includes("modify_products")) {
                    return JSON.stringify({ error: "No tenés permisos para modificar productos." });
                }
                const { data: products } = await supabaseAdmin
                    .from("productos")
                    .select("id, nombre, activo")
                    .eq("sucursal_id", sucursalId)
                    .ilike("nombre", `%${args.product_name}%`);

                if (!products || products.length === 0) {
                    return JSON.stringify({ error: `No encontré ningún producto con el nombre "${args.product_name}".` });
                }

                await supabaseAdmin
                    .from("productos")
                    .update({ activo: args.active })
                    .in(
                        "id",
                        products.map((p) => p.id)
                    );

                await logAgentAction(
                    sucursalId,
                    "toggle_product",
                    { products: products.map((p) => p.nombre), active: args.active },
                    "whatsapp",
                    senderPhone
                );

                return JSON.stringify({
                    success: true,
                    message: `${args.active ? "Activé" : "Desactivé"} ${products.length} producto(s): ${products.map((p) => p.nombre).join(", ")}`,
                });
            }

            case "update_product_price": {
                if (userRole === "cliente" || !config.allowed_operations.includes("modify_products")) {
                    return JSON.stringify({ error: "No tenés permisos para modificar precios." });
                }
                const { data: products } = await supabaseAdmin
                    .from("productos")
                    .select("id, nombre, precio")
                    .eq("sucursal_id", sucursalId)
                    .ilike("nombre", `%${args.product_name}%`);

                if (!products || products.length === 0) {
                    return JSON.stringify({ error: `No encontré "${args.product_name}".` });
                }

                const oldPrices = products.map((p) => ({ nombre: p.nombre, precio_anterior: p.precio }));
                await supabaseAdmin
                    .from("productos")
                    .update({ precio: args.new_price })
                    .in(
                        "id",
                        products.map((p) => p.id)
                    );

                await logAgentAction(
                    sucursalId,
                    "update_price",
                    { products: oldPrices, new_price: args.new_price },
                    "whatsapp",
                    senderPhone
                );

                return JSON.stringify({
                    success: true,
                    message: `Actualicé el precio de ${products.length} producto(s): ${products.map((p) => `${p.nombre} a $${args.new_price}`).join(", ")}`,
                });
            }

            case "get_mesa_by_number": {
                const { data: mesa } = await supabaseAdmin
                    .from("mesas")
                    .select("id, numero, nombre, estado, activa")
                    .eq("sucursal_id", sucursalId)
                    .eq("numero", args.mesa_numero)
                    .eq("activa", true)
                    .maybeSingle();

                if (!mesa) {
                    return JSON.stringify({ exists: false, error: `La mesa ${args.mesa_numero} no existe o no está activa.` });
                }
                return JSON.stringify({ exists: true, mesa });
            }

            case "preview_cart": {
                if (!config.allowed_operations.includes("create_orders")) {
                    return JSON.stringify({ error: "No tenés permisos para crear pedidos." });
                }

                const requestedItems = parseLooseItemsInput(args.items);
                if (requestedItems.length === 0) {
                    return JSON.stringify({ error: "No especificaste productos en el pedido." });
                }

                const [{ data: products }, descuentos, { data: mps }] = await Promise.all([
                    supabaseAdmin
                        .from("productos")
                        .select(
                            "id, nombre, precio, precio_promocional, promo_activo, promo_desde, promo_hasta, promo_hora_desde, promo_hora_hasta, promo_dias, categoria_id, control_stock, stock_actual, activo, visible_en_menu, producto_oculto"
                        )
                        .eq("sucursal_id", sucursalId)
                        .eq("activo", true)
                        .eq("visible_en_menu", true)
                        .eq("producto_oculto", false),
                    loadActiveDiscounts(sucursalId),
                    supabaseAdmin
                        .from("metodos_pago")
                        .select("id, nombre, codigo, detalles")
                        .eq("sucursal_id", sucursalId)
                        .eq("activo", true),
                ]);

                const matchedRaw: Array<{ product: any; input: CartItemInput }> = [];
                const unmatched: string[] = [];

                for (const item of requestedItems) {
                    const match = findBestProductMatch(products || [], item);
                    if (match) {
                        matchedRaw.push({ product: match, input: item });
                    } else {
                        unmatched.push(item.product_name);
                    }
                }

                if (matchedRaw.length === 0) {
                    return JSON.stringify({
                        error: "No pude reconocer ninguno de los productos pedidos en nuestra carta actual.",
                        unmatched,
                    });
                }

                // Verificar stock
                const outOfStock: string[] = [];
                for (const { product, input } of matchedRaw) {
                    const qty = Math.max(1, input.quantity || 1);
                    if (product.control_stock && Number(product.stock_actual || 0) < qty) {
                        outOfStock.push(
                            `${product.nombre} (disponible: ${Math.max(0, Number(product.stock_actual || 0))})`
                        );
                    }
                }
                if (outOfStock.length > 0) {
                    return JSON.stringify({
                        error: `No tenemos stock suficiente para: ${outOfStock.join(", ")}.`,
                    });
                }

                // Cargar grupos de adicionales
                const groupsByProd = await loadProductAdditionGroups(
                    matchedRaw.map((m) => m.product.id)
                );

                const missingOptions: Array<{
                    producto: string;
                    grupo: string;
                    minimo: number;
                    opciones: Array<{ nombre: string; precio_extra: number }>;
                }> = [];

                const cartItems: any[] = [];
                let itemsSubtotal = 0;

                for (const { product, input } of matchedRaw) {
                    const qty = Math.max(1, input.quantity || 1);
                    const groups = groupsByProd.get(product.id) || [];
                    const selectedAds: Array<{
                        nombre: string;
                        precio: number;
                        grupo: string;
                        impresora?: string;
                    }> = [];

                    const groupSelectionCount = new Map<string, number>();
                    const requestedAds = input.adicionales || [];

                    for (const reqAd of requestedAds) {
                        const reqNorm = normalizeText(reqAd);
                        if (!reqNorm) continue;

                        let foundGroup: LoadedAdditionGroup | null = null;
                        let foundOpt: LoadedAdditionGroup["adicionales"][number] | null = null;

                        for (const g of groups) {
                            const exact = g.adicionales.find((o) => normalizeText(o.nombre) === reqNorm);
                            const partial =
                                exact ||
                                g.adicionales.find(
                                    (o) =>
                                        normalizeText(o.nombre).includes(reqNorm) ||
                                        reqNorm.includes(normalizeText(o.nombre))
                                );
                            if (partial) {
                                foundGroup = g;
                                foundOpt = partial;
                                break;
                            }
                        }

                        if (foundGroup && foundOpt) {
                            selectedAds.push({
                                nombre: foundOpt.nombre,
                                precio: foundOpt.precio_venta,
                                grupo: foundGroup.titulo,
                                ...(foundOpt.impresora ? { impresora: foundOpt.impresora } : {}),
                            });
                            groupSelectionCount.set(
                                foundGroup.id,
                                (groupSelectionCount.get(foundGroup.id) || 0) + 1
                            );
                        }
                    }

                    // Validar grupos obligatorios
                    for (const g of groups) {
                        const minRequired = g.seleccion_obligatoria
                            ? Math.max(1, g.seleccion_minima || 0)
                            : g.seleccion_minima || 0;
                        const count = groupSelectionCount.get(g.id) || 0;
                        if (minRequired > 0 && count < minRequired) {
                            missingOptions.push({
                                producto: product.nombre,
                                grupo: g.titulo,
                                minimo: minRequired,
                                opciones: g.adicionales.map((a) => ({
                                    nombre: a.nombre,
                                    precio_extra: a.precio_venta,
                                })),
                            });
                        }
                    }

                    const disc = getProductDiscount(
                        product.id,
                        product.categoria_id || "",
                        descuentos,
                        product
                    );
                    const regularPrice = Number(product.precio || 0);
                    const basePrice = disc ? disc.precioFinal(regularPrice) : regularPrice;
                    const extrasUnitPrice = selectedAds.reduce((sum, a) => sum + a.precio, 0);
                    const lineSubtotal = (basePrice + extrasUnitPrice) * qty;
                    itemsSubtotal += lineSubtotal;

                    cartItems.push({
                        producto_id: product.id,
                        nombre: product.nombre,
                        precio_unitario: basePrice,
                        cantidad: qty,
                        adicionales: selectedAds,
                        notas: input.notes || null,
                        subtotal: lineSubtotal,
                    });
                }

                if (missingOptions.length > 0) {
                    return JSON.stringify({
                        success: false,
                        needs_clarification: true,
                        missing_options: missingOptions,
                        message:
                            "Falta que el cliente elija opciones obligatorias antes de calcular el pedido.",
                    });
                }

                const deliveryType = args.delivery_type || "takeaway";
                const isDelivery = deliveryType === "delivery";

                // Validar envío / coordenadas GPS
                let deliveryCost = 0;
                let zoneName = "";
                let validatedAddress = args.delivery_address || "";
                let clientLat: number | null =
                    typeof args.client_lat === "number" ? args.client_lat : null;
                let clientLng: number | null =
                    typeof args.client_lng === "number" ? args.client_lng : null;

                if (isDelivery) {
                    let coords: LatLng | null =
                        clientLat !== null && clientLng !== null
                            ? { lat: clientLat, lng: clientLng }
                            : null;

                    if (!coords) {
                        if (!validatedAddress) {
                            return JSON.stringify({
                                error: "Para envíos a domicilio necesito la dirección de entrega (calle y altura) o tu ubicación de WhatsApp.",
                            });
                        }
                        const geo = await geocodeAddress(validatedAddress, sucursalId);
                        if (!geo) {
                            return JSON.stringify({
                                error: `No pude encontrar la ubicación para "${validatedAddress}". ¿Podés pasarme calle, altura y localidad o enviarme la ubicación por WhatsApp?`,
                            });
                        }
                        coords = geo.coords;
                        clientLat = geo.coords.lat;
                        clientLng = geo.coords.lng;
                        if (geo.formattedAddress && !validatedAddress.includes(",")) {
                            validatedAddress = `${validatedAddress} (${geo.formattedAddress.split(",")[0]})`;
                        }
                    } else if (!validatedAddress) {
                        validatedAddress = "Ubicación GPS de WhatsApp";
                    }

                    const validation = await validateAddressInZones(sucursalId, coords, itemsSubtotal);
                    if (!validation.valid) {
                        return JSON.stringify({ error: validation.error });
                    }
                    deliveryCost = validation.costoEnvio || 0;
                    zoneName = validation.zonaName || "";
                }

                // Validar mesa si es salón
                let mesaId: string | null = null;
                if (deliveryType === "salon") {
                    if (!args.mesa_numero) {
                        return JSON.stringify({
                            error: "Para pedidos de salón necesito el número de mesa.",
                        });
                    }
                    const { data: mesa } = await supabaseAdmin
                        .from("mesas")
                        .select("id, numero")
                        .eq("sucursal_id", sucursalId)
                        .eq("numero", args.mesa_numero)
                        .eq("activa", true)
                        .maybeSingle();
                    if (!mesa) {
                        return JSON.stringify({
                            error: `La mesa número ${args.mesa_numero} no existe o no está activa.`,
                        });
                    }
                    mesaId = mesa.id;
                }

                // Método de pago y descuento automático asociado
                let metodoPagoId: string | null = null;
                let metodoPagoNombre: string | null = null;
                let metodoPagoDetalles: Record<string, any> | null = null;
                let paymentDiscountAmount = 0;

                if (args.payment_method && mps && mps.length > 0) {
                    const mpNorm = normalizeText(args.payment_method);
                    const matchedMp = mps.find(
                        (m: any) =>
                            normalizeText(m.nombre).includes(mpNorm) ||
                            mpNorm.includes(normalizeText(m.nombre)) ||
                            normalizeText(m.codigo).includes(mpNorm)
                    );
                    if (matchedMp) {
                        metodoPagoId = matchedMp.id;
                        metodoPagoNombre = matchedMp.nombre;
                        metodoPagoDetalles = matchedMp.detalles || null;

                        const mpDiscount = descuentos.find(
                            (d: any) => d.metodo_pago_id === matchedMp.id && d.auto_aplicar
                        );
                        if (mpDiscount) {
                            paymentDiscountAmount =
                                mpDiscount.tipo === "porcentaje"
                                    ? Math.round(itemsSubtotal * (Number(mpDiscount.valor) / 100))
                                    : Math.min(itemsSubtotal, Number(mpDiscount.valor));
                        }
                    } else {
                        metodoPagoNombre = String(args.payment_method);
                    }
                }

                const total = Math.max(0, itemsSubtotal - paymentDiscountAmount + deliveryCost);
                const payWithAmount =
                    typeof args.pay_with_amount === "number" && args.pay_with_amount > 0
                        ? args.pay_with_amount
                        : null;

                const cartData = {
                    customer_name: args.customer_name,
                    items: cartItems,
                    delivery_type: deliveryType,
                    delivery_address: validatedAddress,
                    client_lat: clientLat,
                    client_lng: clientLng,
                    delivery_cost: deliveryCost,
                    zona_name: zoneName,
                    mesa_numero: args.mesa_numero || null,
                    mesa_id: mesaId,
                    payment_method_id: metodoPagoId,
                    payment_method_name: metodoPagoNombre,
                    payment_method_details: metodoPagoDetalles,
                    pay_with_amount: payWithAmount,
                    discount_amount: paymentDiscountAmount,
                    notes: args.notes || "",
                    subtotal: itemsSubtotal,
                    total,
                };

                runtime.cart = cartData;

                if (!runtime.dryRun) {
                    const conversation = await getOrCreateConversation(sucursalId, senderPhone);
                    if (conversation) {
                        const currentMeta = conversation.metadata || {};
                        await supabaseAdmin
                            .from("whatsapp_conversations")
                            .update({ metadata: { ...currentMeta, cart: cartData } })
                            .eq("id", conversation.id);
                    }
                }

                return JSON.stringify({
                    success: true,
                    message: "Carrito previsualizado correctamente.",
                    unmatched,
                    cart: cartData,
                });
            }

            case "submit_order": {
                let cart = runtime.cart;
                let conversation: any = null;

                if (!runtime.dryRun) {
                    conversation = await getOrCreateConversation(sucursalId, senderPhone);
                    cart = conversation?.metadata?.cart || cart;
                }

                if (!cart || !cart.items || cart.items.length === 0) {
                    return JSON.stringify({
                        error: "No hay ningún pedido preparado todavía. Armemos el carrito primero con preview_cart.",
                    });
                }

                // En simulador (dryRun) no insertamos pedidos reales en la DB
                if (runtime.dryRun) {
                    runtime.cart = null;
                    return JSON.stringify({
                        success: true,
                        dry_run: true,
                        numero_pedido: "SIM-001",
                        message:
                            "¡Simulación exitosa! En producción el pedido quedaría ingresado en cocina como #SIM-001.",
                        summary: cart,
                    });
                }

                const cleanPhone = cleanPhoneNumber(senderPhone);
                const tail = phoneTailDigits(senderPhone, 10);

                // Buscar usuario staff si aplica
                const { data: systemUser } = tail
                    ? await supabaseAdmin
                          .from("usuarios")
                          .select("id")
                          .ilike("telefono", `%${tail}%`)
                          .eq("activo", true)
                          .maybeSingle()
                    : { data: null };

                // Buscar o crear cliente si no es salón anónimo
                let resolvedClienteId: string | null = null;
                if (cleanPhone && cart.delivery_type !== "salon") {
                    const { data: existingClient } = await supabaseAdmin
                        .from("clientes")
                        .select("id")
                        .eq("sucursal_id", sucursalId)
                        .eq("telefono", cleanPhone)
                        .maybeSingle();

                    if (existingClient) {
                        resolvedClienteId = existingClient.id;
                        await supabaseAdmin
                            .from("clientes")
                            .update({
                                nombre: cart.customer_name,
                                ...(cart.delivery_type === "delivery" && cart.delivery_address
                                    ? { direccion: cart.delivery_address }
                                    : {}),
                            })
                            .eq("id", resolvedClienteId);
                    } else {
                        const { data: newClient } = await supabaseAdmin
                            .from("clientes")
                            .insert({
                                sucursal_id: sucursalId,
                                telefono: cleanPhone,
                                nombre: cart.customer_name,
                                direccion: cart.delivery_type === "delivery" ? cart.delivery_address : null,
                            })
                            .select("id")
                            .maybeSingle();
                        if (newClient) resolvedClienteId = newClient.id;
                    }
                }

                // Generar numero_pedido atómico igual que CartModal.tsx
                let generatedNumeroPedido: string | undefined;
                try {
                    const todayStr = new Intl.DateTimeFormat("en-CA", {
                        timeZone: ARGENTINA_TZ,
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                    }).format(new Date());
                    const datePart = todayStr.replace(/-/g, "");
                    const tipoPrefix =
                        cart.delivery_type === "delivery"
                            ? "DELIVERY"
                            : cart.delivery_type === "takeaway"
                            ? "TAKE AWAY"
                            : "SALON";
                    const { data: nextSeq } = await supabaseAdmin.rpc("get_next_order_number", {
                        p_sucursal_id: sucursalId,
                        p_date_part: datePart,
                    });
                    if (typeof nextSeq === "number") {
                        generatedNumeroPedido = `${tipoPrefix}-${datePart}-${String(nextSeq).padStart(4, "0")}`;
                    }
                } catch {
                    // Fallback al trigger de base de datos
                }

                const noteParts: string[] = ["[IA WhatsApp]"];
                if (cart.pay_with_amount) noteParts.push(`Abona con: $${cart.pay_with_amount}`);
                if (cart.notes) noteParts.push(cart.notes);
                const fullNotes = noteParts.join(" ").trim();

                const { data: order, error: orderError } = await supabaseAdmin
                    .from("pedidos")
                    .insert({
                        sucursal_id: sucursalId,
                        ...(generatedNumeroPedido ? { numero_pedido: generatedNumeroPedido } : {}),
                        cliente_id: resolvedClienteId,
                        cliente_nombre: cart.customer_name,
                        cliente_telefono: cleanPhone || senderPhone,
                        cliente_direccion: cart.delivery_address || null,
                        cliente_lat: cart.client_lat ?? null,
                        cliente_lng: cart.client_lng ?? null,
                        costo_envio: cart.delivery_cost || 0,
                        subtotal: cart.subtotal,
                        descuento: cart.discount_amount || 0,
                        total: cart.total,
                        estado: "pendiente",
                        tipo: cart.delivery_type,
                        mesa_id: cart.mesa_id || null,
                        mesa_numero: cart.mesa_numero || null,
                        metodo_pago_id: cart.payment_method_id || null,
                        metodo_pago_nombre: cart.payment_method_name || null,
                        origen: "whatsapp",
                        notas: fullNotes,
                        created_by: systemUser?.id || null,
                    })
                    .select("id, numero_pedido")
                    .single();

                if (orderError || !order) {
                    return JSON.stringify({
                        error: "Error al registrar el pedido: " + orderError?.message,
                    });
                }

                const itemInserts = cart.items.map((it: any) => ({
                    pedido_id: order.id,
                    producto_id: it.producto_id,
                    nombre_producto: it.nombre,
                    cantidad: it.cantidad,
                    precio_unitario: it.precio_unitario,
                    adicionales: it.adicionales ?? [],
                    notas: it.notas || null,
                    estado: "pendiente",
                }));

                let itemsError: any = null;
                const { error: err1 } = await supabaseAdmin.from("pedido_items").insert(itemInserts);
                if (err1) {
                    if (err1.code === "PGRST204") {
                        const fallbackItems = itemInserts.map(({ adicionales: _, ...rest }: any) => rest);
                        const { error: err2 } = await supabaseAdmin
                            .from("pedido_items")
                            .insert(fallbackItems);
                        itemsError = err2;
                    } else {
                        itemsError = err1;
                    }
                }

                if (itemsError) {
                    await supabaseAdmin.from("pedidos").delete().eq("id", order.id);
                    return JSON.stringify({
                        error: "Error al registrar los productos del pedido: " + itemsError.message,
                    });
                }

                if (cart.delivery_type === "salon" && cart.mesa_id) {
                    await supabaseAdmin
                        .from("mesas")
                        .update({ estado: "ocupada" })
                        .eq("id", cart.mesa_id);
                }

                runtime.cart = null;
                runtime.lastOrderId = order.id;

                if (conversation) {
                    const currentMeta = { ...(conversation.metadata || {}) };
                    delete currentMeta.cart;
                    await supabaseAdmin
                        .from("whatsapp_conversations")
                        .update({
                            metadata: { ...currentMeta, last_order_id: order.id },
                        })
                        .eq("id", conversation.id);
                }

                await logAgentAction(
                    sucursalId,
                    "create_order",
                    {
                        order_id: order.id,
                        numero_pedido: order.numero_pedido,
                        customer: cart.customer_name,
                        total: cart.total,
                        payment_method: cart.payment_method_name,
                    },
                    "whatsapp",
                    senderPhone
                );

                return JSON.stringify({
                    success: true,
                    message: `¡Pedido ingresado al sistema con éxito! El número de pedido es #${order.numero_pedido}.`,
                    numero_pedido: order.numero_pedido,
                    payment_details: cart.payment_method_details || null,
                });
            }

            case "add_to_existing_order": {
                if (runtime.dryRun) {
                    return JSON.stringify({
                        success: true,
                        dry_run: true,
                        message: "Simulación: productos agregados al pedido activo.",
                    });
                }

                const conversation = await getOrCreateConversation(sucursalId, senderPhone);
                let orderId = conversation?.metadata?.last_order_id || runtime.lastOrderId;

                if (!orderId) {
                    const tail = phoneTailDigits(senderPhone, 10);
                    const { data: lastOrder } = tail
                        ? await supabaseAdmin
                              .from("pedidos")
                              .select("id")
                              .eq("sucursal_id", sucursalId)
                              .ilike("cliente_telefono", `%${tail}%`)
                              .in("estado", ["pendiente", "confirmado", "preparando"])
                              .order("created_at", { ascending: false })
                              .limit(1)
                              .maybeSingle()
                        : { data: null };
                    if (lastOrder) orderId = lastOrder.id;
                }

                if (!orderId) {
                    return JSON.stringify({
                        error: "No encontré ningún pedido activo tuyo para agregarle productos.",
                    });
                }

                const { data: order } = await supabaseAdmin
                    .from("pedidos")
                    .select("id, subtotal, descuento, total, costo_envio, numero_pedido")
                    .eq("id", orderId)
                    .single();

                if (!order) {
                    return JSON.stringify({
                        error: "El pedido original no pudo ser encontrado en el sistema.",
                    });
                }

                const requestedItems = parseLooseItemsInput(args.items);
                const [{ data: products }, descuentos] = await Promise.all([
                    supabaseAdmin
                        .from("productos")
                        .select(
                            "id, nombre, precio, precio_promocional, promo_activo, promo_desde, promo_hasta, promo_hora_desde, promo_hora_hasta, promo_dias, categoria_id, control_stock, stock_actual"
                        )
                        .eq("sucursal_id", sucursalId)
                        .eq("activo", true)
                        .eq("visible_en_menu", true)
                        .eq("producto_oculto", false),
                    loadActiveDiscounts(sucursalId),
                ]);

                const matchedRaw: Array<{ product: any; input: CartItemInput }> = [];
                for (const it of requestedItems) {
                    const m = findBestProductMatch(products || [], it);
                    if (m) matchedRaw.push({ product: m, input: it });
                }

                if (matchedRaw.length === 0) {
                    return JSON.stringify({
                        error: "No pude reconocer ninguno de los productos que querés agregar.",
                    });
                }

                const groupsByProd = await loadProductAdditionGroups(
                    matchedRaw.map((m) => m.product.id)
                );

                const itemInserts: any[] = [];
                let addedSubtotal = 0;

                for (const { product, input } of matchedRaw) {
                    const qty = Math.max(1, input.quantity || 1);
                    const groups = groupsByProd.get(product.id) || [];
                    const selectedAds: any[] = [];

                    for (const reqAd of input.adicionales || []) {
                        const reqNorm = normalizeText(reqAd);
                        for (const g of groups) {
                            const opt = g.adicionales.find(
                                (o) =>
                                    normalizeText(o.nombre) === reqNorm ||
                                    normalizeText(o.nombre).includes(reqNorm)
                            );
                            if (opt) {
                                selectedAds.push({
                                    nombre: opt.nombre,
                                    precio: opt.precio_venta,
                                    grupo: g.titulo,
                                    ...(opt.impresora ? { impresora: opt.impresora } : {}),
                                });
                                break;
                            }
                        }
                    }

                    const disc = getProductDiscount(
                        product.id,
                        product.categoria_id || "",
                        descuentos,
                        product
                    );
                    const regularPrice = Number(product.precio || 0);
                    const basePrice = disc ? disc.precioFinal(regularPrice) : regularPrice;
                    const extrasUnit = selectedAds.reduce((s, a) => s + a.precio, 0);
                    addedSubtotal += (basePrice + extrasUnit) * qty;

                    itemInserts.push({
                        pedido_id: order.id,
                        producto_id: product.id,
                        nombre_producto: product.nombre,
                        cantidad: qty,
                        precio_unitario: basePrice,
                        adicionales: selectedAds,
                        notas: input.notes || null,
                        estado: "pendiente",
                    });
                }

                const { error: itemsError } = await supabaseAdmin
                    .from("pedido_items")
                    .insert(itemInserts);

                if (itemsError) {
                    return JSON.stringify({
                        error: "Error al agregar productos al pedido: " + itemsError.message,
                    });
                }

                const newSubtotal = Number(order.subtotal) + addedSubtotal;
                const newTotal = Math.max(
                    0,
                    newSubtotal - Number(order.descuento || 0) + Number(order.costo_envio || 0)
                );

                await supabaseAdmin
                    .from("pedidos")
                    .update({ subtotal: newSubtotal, total: newTotal })
                    .eq("id", order.id);

                await logAgentAction(
                    sucursalId,
                    "add_to_order",
                    { order_id: order.id, added: itemInserts },
                    "whatsapp",
                    senderPhone
                );

                return JSON.stringify({
                    success: true,
                    message: `¡Productos agregados con éxito al pedido #${order.numero_pedido}!`,
                    new_total: newTotal,
                });
            }

            default:
                return JSON.stringify({ error: "Función no reconocida." });
        }
    } catch (err: any) {
        console.error(`[Agent Tool Error] ${toolName}:`, err.message);
        return JSON.stringify({ error: "Error interno procesando la solicitud." });
    }
}

// ═══════════════════════════════════════════
// ACTION LOG
// ═══════════════════════════════════════════

async function logAgentAction(
    sucursalId: string,
    actionType: string,
    details: Record<string, any>,
    source: string,
    senderPhone?: string
) {
    await supabaseAdmin.from("ai_agent_actions").insert({
        sucursal_id: sucursalId,
        action_type: actionType,
        action_details: details,
        source,
        sender_phone: senderPhone,
        status: "executed",
    });
}

// ═══════════════════════════════════════════
// GEOLOCATION HELPERS
// ═══════════════════════════════════════════

const GOOGLE_MAPS_API_KEY =
    process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function geocodeAddress(
    address: string,
    sucursalId: string
): Promise<{ coords: LatLng; formattedAddress?: string } | null> {
    if (!GOOGLE_MAPS_API_KEY) {
        console.error("[Geocode] Missing API Key");
        return null;
    }

    const { data: cfg } = await supabaseAdmin
        .from("config_sucursal")
        .select("localidades, local_lat, local_lng")
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

    const localidades: Array<{ nombre?: string }> = Array.isArray(cfg?.localidades)
        ? cfg.localidades
        : [];
    const primaryLocality = localidades[0]?.nombre?.trim() || "";

    const lowerAddr = address.toLowerCase();
    let fullQuery = address;
    if (
        primaryLocality &&
        !lowerAddr.includes(primaryLocality.toLowerCase()) &&
        !lowerAddr.includes("argentina")
    ) {
        fullQuery = `${address}, ${primaryLocality}, Argentina`;
    } else if (!lowerAddr.includes("argentina")) {
        fullQuery = `${address}, Argentina`;
    }

    let boundsParam = "";
    if (cfg?.local_lat && cfg?.local_lng) {
        const lat = Number(cfg.local_lat);
        const lng = Number(cfg.local_lng);
        const delta = 0.18;
        boundsParam = `&bounds=${lat - delta},${lng - delta}|${lat + delta},${lng + delta}`;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        fullQuery
    )}&key=${GOOGLE_MAPS_API_KEY}&language=es&region=ar${boundsParam}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status === "OK" && data.results.length > 0) {
            const loc = data.results[0].geometry.location;
            return {
                coords: { lat: loc.lat, lng: loc.lng },
                formattedAddress: data.results[0].formatted_address,
            };
        }
        return null;
    } catch (err) {
        console.error("[Geocode] Error:", err);
        return null;
    }
}

interface ValidationResult {
    valid: boolean;
    zonaName?: string;
    costoEnvio?: number;
    error?: string;
}

async function validateAddressInZones(
    sucursalId: string,
    clientePt: LatLng,
    currentTotal: number = 0
): Promise<ValidationResult> {
    const { data: zonas } = await supabaseAdmin
        .from("zonas_entrega")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .eq("activo", true);

    if (!zonas || zonas.length === 0) {
        return { valid: true, zonaName: "Sin zonas configuradas (Abierto)", costoEnvio: 0 };
    }

    const { data: cfg } = await supabaseAdmin
        .from("config_sucursal")
        .select("local_lat, local_lng")
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

    const localPt: LatLng | null =
        cfg?.local_lat && cfg?.local_lng
            ? { lat: cfg.local_lat, lng: cfg.local_lng }
            : null;

    const zonasConPoligono = zonas.filter(
        (z) => z.polygon_coords && Array.isArray(z.polygon_coords) && z.polygon_coords.length >= 3
    );

    if (zonasConPoligono.length === 0) {
        const firstZona = zonas[0];
        return {
            valid: true,
            zonaName: firstZona.nombre,
            costoEnvio: Number(firstZona.costo_envio || 0),
        };
    }

    let zonaEncontrada: any = null;
    for (const zona of zonasConPoligono) {
        if (pointInPolygon(clientePt, zona.polygon_coords as LatLng[])) {
            zonaEncontrada = zona;
            break;
        }
    }

    if (!zonaEncontrada) {
        return {
            valid: false,
            error: "Esa dirección parece estar fuera de nuestras zonas de reparto. Si querés, pasame otra dirección o podés pasar a retirar por el local.",
        };
    }

    let costoFinal = Number(zonaEncontrada.costo_envio || 0);
    if (zonaEncontrada.tipo_precio === "por_km" && localPt) {
        const distKm = getDistance(localPt, clientePt);
        const rate = zonaEncontrada.precio_por_km > 0 ? zonaEncontrada.precio_por_km : 850;
        costoFinal = Math.round(distKm * rate);
    }

    if (zonaEncontrada.envio_gratis_desde && currentTotal >= zonaEncontrada.envio_gratis_desde) {
        costoFinal = 0;
    }

    if (
        zonaEncontrada.minimo_compra > 0 &&
        currentTotal > 0 &&
        currentTotal < zonaEncontrada.minimo_compra
    ) {
        return {
            valid: false,
            error: `El pedido mínimo para tu zona (${zonaEncontrada.nombre}) es de $${new Intl.NumberFormat(
                "es-AR"
            ).format(zonaEncontrada.minimo_compra)}.`,
        };
    }

    return {
        valid: true,
        zonaName: zonaEncontrada.nombre,
        costoEnvio: costoFinal,
    };
}

// ═══════════════════════════════════════════
// SYSTEM PROMPT BUILDER
// ═══════════════════════════════════════════

function buildSystemPrompt(
    config: AgentConfig,
    sucursalName: string,
    hours: StoreHoursStatus,
    customerName?: string,
    userRole: string = "cliente"
): string {
    const operationDescriptions: Record<string, string> = {
        view_products: "consultar productos, precios, promos y adicionales del menú",
        view_orders: "consultar estado de pedidos",
        modify_products: "activar/desactivar productos y cambiar precios",
        create_orders: "crear nuevos pedidos para clientes o mesas de salón",
        manage_discounts: "gestionar descuentos y promociones",
    };

    const allowedOps = config.allowed_operations
        .map((op) => operationDescriptions[op] || op)
        .join(", ");

    const personality =
        config.personality_modes.find((p) => p.id === config.active_personality) ||
        config.personality_modes[0];

    const agentName = config.agent_name || "Asistente";

    let prompt = `Sos "${agentName}", asistente de "${sucursalName}" atendiendo por WhatsApp.\n`;
    prompt += `ESTADO ACTUAL DEL LOCAL: ${hours.statusText}. Horario de hoy: ${hours.todayScheduleText}. Horarios semanales: ${hours.allScheduleText}.\n`;

    if (userRole === "administrador" || userRole === "camarero" || userRole === "cajero") {
        prompt += `
ESTÁS HABLANDO CON UN MIEMBRO DEL PERSONAL DEL LOCAL: ${customerName || "Staff"} (Rol: ${userRole.toUpperCase()}).
Tu función es procesar comandas de salón ágilmente y responder sobre stock, precios y pedidos activos.
Sé extremadamente conciso, directo y rápido en español argentino ("vos").

PROTOCOLO COMANDAS DE SALÓN:
1. Para pedir en una mesa: validá con 'get_mesa_by_number', armá vista previa con 'preview_cart' (delivery_type="salon", mesa_numero), mostrá resumen breve para confirmar y, apenas confirme, ejecutá 'submit_order'.
2. Para sumar ítems a un pedido activo: usá 'add_to_existing_order'. Está prohibido quitar productos ya comandados.
3. Para consultar pedidos activos: usá 'get_active_orders'. Para disponibilidad/precios: 'toggle_product_availability' / 'update_product_price'.
`;
    } else {
        prompt += `
Atendés a clientes por WhatsApp de forma natural, humana y resolutiva.
${
    customerName
        ? `CLIENTE ACTUAL: ${customerName}. Podés saludarlo por su nombre naturalmente.`
        : "Todavía no sabés el nombre del cliente; pedíselo cuando vaya a armar el pedido."
}

TONO BASE:
${personality.tone}
`;

        if (config.style_guide?.trim()) {
            prompt += `
ESTILO REAL DE COMUNICACIÓN DEL NEGOCIO (PRIORIDAD MÁXIMA — IMITÁ EXACTAMENTE ESTA FORMA DE HABLAR):
${config.style_guide.trim()}
`;
        }

        if (Array.isArray(config.few_shot_examples) && config.few_shot_examples.length > 0) {
            prompt += `
EJEMPLOS REALES DE CÓMO RESPONDE ESTE NEGOCIO (USALOS SOLO COMO REFERENCIA DE ESTILO Y CALIDEZ — NUNCA COPIES PRECIOS, HORARIOS NI DISPONIBILIDAD DE ESTOS EJEMPLOS):
`;
            for (const ex of config.few_shot_examples.slice(0, 10)) {
                prompt += `- [${ex.situation || "Chat"}]\n  Cliente: "${ex.customer}"\n  Respuesta del negocio: "${ex.reply}"\n`;
            }
        }

        prompt += `
REGLAS FUNDAMENTALES:
1. Respondé siempre en español argentino ("vos"), con mensajes cortos y naturales de WhatsApp (evitá textos largos o robóticos; si te piden la carta, resumí categorías o principales opciones sin mandar paredes interminables de texto salvo que te pidan todo).
2. NUNCA inventes nombres de productos, adicionales, precios, promociones ni tiempos que no hayan salido de tus herramientas o instrucciones del negocio.
3. Si saludan o preguntan qué tienen / precios / promos, llamá primero a 'get_products' y/o 'get_categories'. Si un producto tiene 'tiene_adicionales: true' o el cliente pregunta sabores/tamaños/agregados, llamá a 'get_product_details'.
4. Cuando te pregunten medios de pago o alias/datos para transferir, llamá a 'get_payment_methods'.
5. Si el cliente pregunta por su pedido, usá 'get_my_orders'.
6. Si el cliente envía una imagen (por ejemplo un comprobante de transferencia o captura de un producto), analizala y respondele con claridad; si es un comprobante, confirmale qué monto y destinatario se ve y avisale que el equipo lo verifica al confirmar el pedido.
7. Si envía ubicación GPS de WhatsApp, pasá 'client_lat' y 'client_lng' directamente a 'preview_cart'.
8. Si pide hablar con una persona, despedite amablemente indicando que ya lo atendemos.

OPERACIONES PERMITIDAS: ${allowedOps}.

PROTOCOLO DE PEDIDOS (OBLIGATORIO):
1. RECOPILACIÓN NATURAL: Necesitás productos (y sus gustos/adicionales obligatorios si tiene), si es Delivery o Retiro en el local, dirección exacta si es Delivery, nombre del cliente y medio de pago (efectivo/transferencia/etc.). No hagas 6 preguntas juntas si ya dio algunos datos; preguntá solo lo que falta.
2. UPSELLING SUTIL (UNA SOLA VEZ): Si el cliente ya eligió comida pero no pidió bebida ni acompañamiento, sugerile amablemente 1 opción real del menú (por ejemplo una bebida) antes de cerrar, sin insistir si dice que no.
3. VISTA PREVIA OBLIGATORIA ('preview_cart'): Nunca calcules subtotales ni envíos de memoria. Llamá siempre a 'preview_cart'. Si devuelve 'needs_clarification: true', preguntale al cliente las opciones obligatorias faltantes usando los nombres reales devueltos.
4. RESUMEN Y CONFIRMACIÓN: Mostrá el resumen exacto devuelto por 'preview_cart' (ítems, adicionales, envío si aplica, descuento si aplica y TOTAL) y pedí confirmación ("¿Confirmamos para mandarlo a cocina?").
5. ENVÍO OBLIGATORIO ('submit_order'): Apenas el cliente confirme ("sí", "dale", "confirmá", "mandalo", etc.), ejecutá 'submit_order' en ese instante. Jamás digas que el pedido fue enviado sin haber llamado a 'submit_order'.
6. POST-ENVÍO: Si quiere agregar algo más al pedido ya enviado, usá 'add_to_existing_order'. No se pueden quitar productos ya comandados a cocina.
7. Nunca pidas el número de teléfono, ya lo tomamos de WhatsApp.
`;
    }

    if (config.system_prompt?.trim()) {
        prompt += `\nINSTRUCCIONES ESPECIALES DEL NEGOCIO:\n${config.system_prompt.trim()}\n`;
    }

    if (config.training_snippets?.length > 0) {
        prompt += `\nINFORMACIÓN IMPORTANTE DEL NEGOCIO:\n`;
        for (const snippet of config.training_snippets) {
            prompt += `\n--- ${snippet.title} ---\n${snippet.content}\n`;
        }
    }

    return prompt;
}

// ═══════════════════════════════════════════
// TOOL FILTERING & FORMAT CONVERTERS
// ═══════════════════════════════════════════

function filterToolsByPermissions(allowedOps: string[], userRole: string) {
    const isStaff =
        userRole === "administrador" ||
        userRole === "camarero" ||
        userRole === "cajero" ||
        userRole === "empleado";

    const readTools = [
        "get_products",
        "get_product_details",
        "get_product_price",
        "get_categories",
        "get_payment_methods",
    ];
    if (isStaff) {
        readTools.push("get_mesa_by_number");
    }

    const orderReadTools = isStaff ? ["get_active_orders"] : ["get_my_orders"];
    const writeTools = isStaff ? ["toggle_product_availability", "update_product_price"] : [];
    const orderWriteTools = ["preview_cart", "submit_order", "add_to_existing_order"];

    const allowed: string[] = [];
    if (allowedOps.includes("view_products")) allowed.push(...readTools);
    if (allowedOps.includes("view_orders")) allowed.push(...orderReadTools);
    if (allowedOps.includes("modify_products")) allowed.push(...writeTools);
    if (allowedOps.includes("create_orders")) allowed.push(...orderWriteTools);

    if (allowed.length === 0) return [];

    return [
        {
            functionDeclarations: AGENT_TOOLS[0].functionDeclarations.filter((fd: any) =>
                allowed.includes(fd.name)
            ),
        },
    ];
}

function normalizeSchemaForOpenAI(schema: any, allowNull = false): any {
    if (!schema || typeof schema !== "object") return schema;
    if (Array.isArray(schema)) return schema.map((x) => normalizeSchemaForOpenAI(x, false));
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(schema)) {
        if (k === "type" && typeof v === "string") {
            const lower = v.toLowerCase();
            out.type = allowNull ? [lower, "null"] : lower;
        } else if (k === "properties" && v && typeof v === "object") {
            const reqSet = new Set(Array.isArray((schema as any).required) ? (schema as any).required : []);
            const props: Record<string, any> = {};
            for (const [pk, pv] of Object.entries(v as Record<string, any>)) {
                props[pk] = normalizeSchemaForOpenAI(pv, !reqSet.has(pk));
            }
            out.properties = props;
        } else if (k === "items" && v && typeof v === "object") {
            out.items = normalizeSchemaForOpenAI(v, false);
        } else {
            out[k] = v;
        }
    }
    return out;
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

function convertToolsToOpenAIFormat(geminiTools: any[]) {
    if (!geminiTools || geminiTools.length === 0) return undefined;
    const declarations = geminiTools[0].functionDeclarations || [];
    const tools = declarations.map((fd: any) => {
        const normalized = normalizeSchemaForOpenAI(
            fd.parameters || { type: "object", properties: {} },
            false
        );
        return {
            type: "function",
            function: {
                name: fd.name,
                description: fd.description,
                parameters: {
                    type: "object",
                    properties: normalized?.properties || {},
                    required: Array.isArray(normalized?.required) ? normalized.required : [],
                },
            },
        };
    });
    return tools.length > 0 ? tools : undefined;
}

// ═══════════════════════════════════════════
// MAIN: PROCESS WHATSAPP MESSAGE
// ═══════════════════════════════════════════

export async function processWhatsAppMessage(
    sucursalId: string,
    senderPhone: string,
    text: string,
    fromMeOrOptions: boolean | ProcessMessageOptions = false,
    dryRunArg: boolean = false,
    audioBase64Arg?: string,
    audioMimeTypeArg?: string
): Promise<AgentResponse> {
    const opts: ProcessMessageOptions =
        typeof fromMeOrOptions === "object" && fromMeOrOptions !== null
            ? fromMeOrOptions
            : {
                  fromMe: fromMeOrOptions,
                  dryRun: dryRunArg,
                  audioBase64: audioBase64Arg,
                  audioMimeType: audioMimeTypeArg,
              };

    const fromMe = Boolean(opts.fromMe);
    const dryRun = Boolean(opts.dryRun);
    const audioBase64 = opts.audioBase64;
    const audioMimeType = opts.audioMimeType;
    const imageBase64 = opts.imageBase64;
    const imageMimeType = opts.imageMimeType;

    // 1. Load agent config
    const config = await getAgentConfig(sucursalId);

    if (!dryRun && (!config.enabled || !config.whatsapp_enabled)) {
        return { reply: "" };
    }

    if (fromMe) {
        return { reply: "" };
    }

    // 2. Audio transcription with Groq Whisper Turbo (if key exists); otherwise Gemini handles raw audio natively
    let audioNeedsNativeFallback = false;
    let userText = (text || "").trim();

    if (audioBase64) {
        let transcribed = false;
        if (process.env.GROQ_API_KEY?.trim()) {
            try {
                const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                const buffer = Buffer.from(audioBase64, "base64");
                const ext = audioMimeType?.includes("mp3") ? "mp3" : "ogg";
                const file = new File([buffer], `audio.${ext}`, {
                    type: audioMimeType || "audio/ogg; codecs=opus",
                });

                const transcription = await groq.audio.transcriptions.create({
                    file,
                    model: "whisper-large-v3-turbo",
                    language: "es",
                });

                if (transcription.text?.trim()) {
                    userText = transcription.text.trim();
                    transcribed = true;
                }
            } catch (err: any) {
                console.warn("[Audio Transcribe] Groq failed, falling back to Gemini native audio:", err.message || err);
            }
        }

        if (!transcribed) {
            audioNeedsNativeFallback = true;
            if (!userText || userText === "[Nota de voz]") {
                userText = "Escuchá esta nota de voz del cliente y respondé lo que pide.";
            }
        }
    }

    if (opts.location && typeof opts.location.lat === "number" && typeof opts.location.lng === "number") {
        const locNote = `[Ubicación GPS recibida por WhatsApp: lat=${opts.location.lat}, lng=${opts.location.lng}${
            opts.location.address ? `, referencia="${opts.location.address}"` : ""
        }]`;
        userText = userText && userText !== "[Ubicación]" ? `${userText}\n${locNote}` : locNote;
    }

    if (imageBase64 && (!userText || userText === "[Imagen]")) {
        userText = "El cliente envió esta imagen (puede ser un comprobante de transferencia o consulta de un producto). Analizala y respondé.";
    }

    if (!userText) {
        return { reply: "" };
    }

    // 3. Get/create conversation (skipped DB writes in dryRun)
    const conversation = dryRun
        ? {
              id: "simulator-id",
              sucursal_id: sucursalId,
              sender_phone: senderPhone,
              status: "active",
              metadata: { cart: opts.simulatorCart || null },
          }
        : await getOrCreateConversation(sucursalId, senderPhone, opts.senderName);

    if (!conversation) {
        return { reply: "⚠️ Error interno. Por favor intentá de nuevo." };
    }

    const agentName = config.agent_name || "Asistente";

    // 4. Handoff logic (live WhatsApp only)
    if (!dryRun && conversation.status === "handed_off") {
        if (matchesTrigger(userText, config.resume_triggers || [])) {
            await resumeConversation(conversation.id, conversation.metadata || {});
            await saveMessage(conversation.id, sucursalId, senderPhone, userText, null, false);
            return {
                reply: `¡Hola de nuevo! Soy ${agentName}. ¿En qué te puedo ayudar?`,
            };
        }
        if (isHandoffTimedOut(conversation, config.handoff_timeout_seconds)) {
            await resumeConversation(conversation.id, conversation.metadata || {});
        } else {
            await saveMessage(conversation.id, sucursalId, senderPhone, userText, null, false);
            return { reply: "" };
        }
    }

    if (!dryRun && matchesTrigger(userText, config.handoff_triggers || [])) {
        const handedTo =
            userText.replace(/quiero\s+hablar\s+con\s*/i, "").trim() || "un operador";
        await handOffConversation(
            conversation.id,
            conversation.metadata || {},
            handedTo,
            "trigger_phrase",
            config.handoff_timeout_seconds > 0 ? config.handoff_timeout_seconds : undefined
        );
        await saveMessage(conversation.id, sucursalId, senderPhone, userText, null, false);

        let timeoutMsg = "";
        if (config.handoff_timeout_seconds > 0) {
            const secs = config.handoff_timeout_seconds;
            const timeStr = secs < 60 ? `${secs} segundos` : `${Math.round(secs / 60)} minutos`;
            timeoutMsg = ` Si no te responden en ${timeStr}, vuelvo automáticamente.`;
        }

        return {
            reply: `Dale, te paso con ${handedTo}. 🙌${timeoutMsg}\n\nSi querés volver a hablar conmigo, escribí "hablar con el bot".`,
            handoff: true,
        };
    }

    // 5. Role & customer lookup
    const tail = phoneTailDigits(senderPhone, 10);
    const { data: sucursal } = await supabaseAdmin
        .from("sucursales")
        .select("nombre")
        .eq("id", sucursalId)
        .maybeSingle();

    const sucursalName = sucursal?.nombre || "Nuestro Negocio";

    const { data: systemUser } =
        !dryRun && tail
            ? await supabaseAdmin
                  .from("usuarios")
                  .select("id, nombre, rol")
                  .ilike("telefono", `%${tail}%`)
                  .eq("activo", true)
                  .maybeSingle()
            : { data: null };

    let userRole = "cliente";
    let displayName = opts.senderName || "";

    if (systemUser) {
        userRole = systemUser.rol || "empleado";
        displayName = systemUser.nombre;
    } else if (!dryRun && tail) {
        const { data: customer } = await supabaseAdmin
            .from("clientes")
            .select("nombre")
            .eq("sucursal_id", sucursalId)
            .ilike("telefono", `%${tail}%`)
            .maybeSingle();
        if (customer?.nombre) displayName = customer.nombre;
    }

    // 6. Store hours check
    const hours = await getStoreHoursStatus(sucursalId);
    if (!dryRun && userRole === "cliente" && config.business_hours_only && !hours.isOpen) {
        const closedMsg =
            config.out_of_hours_message?.trim() ||
            `¡Hola! En este momento estamos cerrados (${hours.statusText}). Nuestro horario de hoy es ${hours.todayScheduleText}. Apenas abramos te respondemos 🙌`;
        await saveMessagePair(conversation.id, sucursalId, senderPhone, userText, closedMsg);
        return { reply: closedMsg };
    }

    // 7. Monthly token limit guard
    if (!dryRun && config.monthly_token_limit > 0) {
        const usageSummary = await getMonthlyTokenUsage(sucursalId);
        if (usageSummary.tableReady && usageSummary.totalTokens >= config.monthly_token_limit) {
            console.warn(`[Agent] Monthly token limit reached for sucursal ${sucursalId}`);
            return { reply: "" };
        }
    }

    // 8. Conversation history (fixed chronological order!)
    const cleanText = userText.toLowerCase().replace(/[¡!.,?¿]/g, "");
    const greetings = ["hola", "buenas noches", "buenos dias", "buen dia", "buenas tardes", "buenas"];
    const isGreetingOnly = greetings.some((g) => cleanText === g);

    if (isGreetingOnly && !dryRun && conversation.metadata?.cart) {
        const updatedMeta = { ...conversation.metadata };
        delete updatedMeta.cart;
        await supabaseAdmin
            .from("whatsapp_conversations")
            .update({ metadata: updatedMeta })
            .eq("id", conversation.id);
        conversation.metadata = updatedMeta;
    }

    let turns: ChatTurn[] = [];
    if (dryRun && Array.isArray(opts.simulatorHistory)) {
        turns = opts.simulatorHistory
            .filter((m) => m && m.content?.trim())
            .map((m) => ({
                role: m.role,
                text: stripLegacyPrefix(m.content),
            }));
        while (turns.length > 0 && turns[0].role === "assistant") {
            turns.shift();
        }
    } else if (!isGreetingOnly) {
        const recentRows = await getRecentMessages(sucursalId, senderPhone, 24);
        turns = expandMessagesToTurns(recentRows);
    }

    const runtime: RuntimeContext = {
        dryRun,
        cart: dryRun ? opts.simulatorCart ?? null : conversation.metadata?.cart ?? null,
        lastOrderId: conversation.metadata?.last_order_id ?? null,
    };

    const systemPrompt = buildSystemPrompt(config, sucursalName, hours, displayName, userRole);
    const allowedTools = filterToolsByPermissions(config.allowed_operations, userRole);

    const formatFinalReply = (rawReply: string) => {
        const clean = stripLegacyPrefix(rawReply) || "No pude procesar tu mensaje. ¿Me lo repetís?";
        return config.show_bot_prefix ? `🤖 ${clean}` : clean;
    };

    const usageSource = dryRun ? "simulator" : "whatsapp";
    const providers = getAvailableProviders();

    const providerOrder: Array<{ provider: "gemini" | "openai"; models: string[] }> = [];
    if (config.ai_provider === "openai" && providers.openai) {
        const primaryOpenAI = config.ai_model?.startsWith("gpt-")
            ? config.ai_model
            : "gpt-4.1-mini";
        providerOrder.push({ provider: "openai", models: [primaryOpenAI] });
        if (providers.gemini) {
            providerOrder.push({ provider: "gemini", models: ["gemini-2.5-flash"] });
        }
    } else {
        if (providers.gemini) {
            const primaryGemini = config.ai_model?.startsWith("gemini-")
                ? config.ai_model
                : "gemini-2.5-flash";
            const geminiList =
                primaryGemini === "gemini-2.5-flash"
                    ? ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
                    : [primaryGemini, "gemini-2.5-flash"];
            providerOrder.push({ provider: "gemini", models: geminiList });
        }
        if (providers.openai) {
            providerOrder.push({ provider: "openai", models: ["gpt-4.1-mini"] });
        }
    }

    let lastError: any = null;

    // A. Try configured primary & secondary cloud providers (Gemini / OpenAI)
    for (const group of providerOrder) {
        for (const modelId of group.models) {
            try {
                if (group.provider === "gemini") {
                    const out = await runGeminiLoop({
                        modelId,
                        systemPrompt,
                        turns,
                        userText,
                        allowedTools,
                        sucursalId,
                        config,
                        senderPhone,
                        userRole,
                        runtime,
                        audioBase64: audioNeedsNativeFallback ? audioBase64 : undefined,
                        audioMimeType: audioNeedsNativeFallback ? audioMimeType : undefined,
                        imageBase64,
                        imageMimeType,
                    });
                    const reply = formatFinalReply(out.replyText);
                    await logTokenUsage(sucursalId, usageSource, out.totalUsage);
                    if (!dryRun) {
                        await saveMessagePair(
                            conversation.id,
                            sucursalId,
                            senderPhone,
                            userText,
                            reply
                        );
                    }
                    return {
                        reply,
                        action: out.actionPerformed,
                        cart: runtime.cart,
                        usage: out.totalUsage,
                    };
                } else {
                    const out = await runOpenAILoop({
                        modelId,
                        systemPrompt,
                        turns,
                        userText,
                        allowedTools,
                        sucursalId,
                        config,
                        senderPhone,
                        userRole,
                        runtime,
                        imageBase64,
                        imageMimeType,
                    });
                    const reply = formatFinalReply(out.replyText);
                    await logTokenUsage(sucursalId, usageSource, out.totalUsage);
                    if (!dryRun) {
                        await saveMessagePair(
                            conversation.id,
                            sucursalId,
                            senderPhone,
                            userText,
                            reply
                        );
                    }
                    return {
                        reply,
                        action: out.actionPerformed,
                        cart: runtime.cart,
                        usage: out.totalUsage,
                    };
                }
            } catch (err: any) {
                lastError = err;
                console.warn(`[Agent ${group.provider}] Model ${modelId} failed:`, err.message || err);
            }
        }
    }

    // B. Fallback to Groq if available
    if (providers.groq) {
        const groqCandidates = [...GROQ_CHAT_MODELS];
        for (const modelId of groqCandidates) {
            try {
                const out = await runGroqLoop({
                    modelId,
                    systemPrompt,
                    turns,
                    userText,
                    allowedTools,
                    sucursalId,
                    config,
                    senderPhone,
                    userRole,
                    runtime,
                });
                const reply = formatFinalReply(out.replyText);
                await logTokenUsage(sucursalId, usageSource, out.totalUsage);
                if (!dryRun) {
                    await saveMessagePair(
                        conversation.id,
                        sucursalId,
                        senderPhone,
                        userText,
                        reply
                    );
                }
                return {
                    reply,
                    action: out.actionPerformed,
                    cart: runtime.cart,
                    usage: out.totalUsage,
                };
            } catch (err: any) {
                lastError = err;
                console.error(`[Agent Groq] Model ${modelId} failed:`, err.message || err);
            }
        }
    }

    console.error("[Agent AI Error FINAL]:", lastError?.message || lastError);
    return {
        reply: "Perdón, tuve un problemita técnico recién. ¿Me repetís qué necesitabas?",
        cart: runtime.cart,
    };
}

// ═══════════════════════════════════════════
// PROVIDER TOOL LOOPS (Gemini, OpenAI, Groq)
// ═══════════════════════════════════════════

interface LoopInput {
    modelId: string;
    systemPrompt: string;
    turns: ChatTurn[];
    userText: string;
    allowedTools: any[];
    sucursalId: string;
    config: AgentConfig;
    senderPhone: string;
    userRole: string;
    runtime: RuntimeContext;
    audioBase64?: string;
    audioMimeType?: string;
    imageBase64?: string;
    imageMimeType?: string;
}

const READ_ONLY_TOOLS = new Set([
    "get_products",
    "get_product_details",
    "get_product_price",
    "get_categories",
    "get_payment_methods",
    "get_my_orders",
    "get_active_orders",
    "get_mesa_by_number",
]);

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

async function runGeminiLoop(input: LoopInput) {
    const contents: GeminiContent[] = input.turns.map((t) => ({
        role: t.role === "assistant" ? "model" : "user",
        parts: [{ text: t.text }],
    }));

    const userParts: GeminiPart[] = [{ text: input.userText }];
    if (input.audioBase64) {
        userParts.push({
            inlineData: {
                mimeType: input.audioMimeType || "audio/ogg",
                data: input.audioBase64,
            },
        });
    }
    if (input.imageBase64) {
        userParts.push({
            inlineData: {
                mimeType: input.imageMimeType || "image/jpeg",
                data: input.imageBase64,
            },
        });
    }
    contents.push({ role: "user", parts: userParts });

    const usages: TokenUsageRecord[] = [];
    let actionPerformed: AgentResponse["action"] | undefined;
    let lastFingerprint = "";
    let maxIterations = 6;

    while (maxIterations > 0) {
        maxIterations--;
        const res = await callGeminiGenerateContent({
            model: input.modelId,
            systemInstruction: input.systemPrompt,
            contents,
            tools: input.allowedTools,
            maxOutputTokens: input.config.max_tokens || 900,
            thinkingBudget: 0,
        });
        usages.push(res.usage);

        if (res.functionCalls.length === 0) {
            return {
                replyText: res.text,
                actionPerformed,
                totalUsage: aggregateUsage("gemini", input.modelId, usages),
            };
        }

        // Preservar exactamente las partes devueltas por el modelo
        contents.push({ role: "model", parts: res.parts });

        const responseParts: GeminiPart[] = [];
        for (const fc of res.functionCalls) {
            const fp = `${fc.name}:${JSON.stringify(fc.args || {})}`;
            if (fp === lastFingerprint) {
                return {
                    replyText: res.text || "Listo, ya quedó procesado. ¿Necesitás algo más?",
                    actionPerformed,
                    totalUsage: aggregateUsage("gemini", input.modelId, usages),
                };
            }
            lastFingerprint = fp;

            const toolResult = await executeTool(
                fc.name,
                fc.args || {},
                input.sucursalId,
                input.config,
                input.senderPhone,
                input.userRole,
                input.runtime
            );

            let parsedResult: any;
            try {
                parsedResult = JSON.parse(toolResult);
            } catch {
                parsedResult = { text: toolResult };
            }

            responseParts.push({
                functionResponse: {
                    name: fc.name,
                    response: { result: parsedResult },
                },
            });

            if (!READ_ONLY_TOOLS.has(fc.name)) {
                actionPerformed = {
                    type: fc.name,
                    details: fc.args || {},
                    result: toolResult,
                };
            }
        }

        contents.push({ role: "user", parts: responseParts });
    }

    return {
        replyText: "Perdón, se me complicó un poco procesar eso. ¿Me decís de nuevo qué necesitabas?",
        actionPerformed,
        totalUsage: aggregateUsage("gemini", input.modelId, usages),
    };
}

async function runOpenAILoop(input: LoopInput) {
    const openAITools = convertToolsToOpenAIFormat(input.allowedTools);
    const messages: any[] = [
        { role: "system", content: input.systemPrompt },
        ...input.turns.map((t) => ({ role: t.role, content: t.text })),
    ];

    if (input.imageBase64) {
        const mime = input.imageMimeType || "image/jpeg";
        messages.push({
            role: "user",
            content: [
                { type: "text", text: input.userText },
                {
                    type: "image_url",
                    image_url: { url: `data:${mime};base64,${input.imageBase64}` },
                },
            ],
        });
    } else {
        messages.push({ role: "user", content: input.userText });
    }

    const usages: TokenUsageRecord[] = [];
    let actionPerformed: AgentResponse["action"] | undefined;
    let lastFingerprint = "";
    let maxIterations = 6;

    while (maxIterations > 0) {
        maxIterations--;
        const res = await callOpenAIChatCompletion({
            model: input.modelId,
            messages,
            tools: openAITools,
            maxTokens: input.config.max_tokens || 900,
        });
        usages.push(res.usage);

        const msg = res.message;
        messages.push(msg);

        if (!msg.tool_calls || msg.tool_calls.length === 0) {
            return {
                replyText: msg.content || "",
                actionPerformed,
                totalUsage: aggregateUsage("openai", input.modelId, usages),
            };
        }

        for (const toolCall of msg.tool_calls) {
            const functionName = toolCall.function.name;
            let functionArgs: Record<string, any> = {};
            try {
                functionArgs = cleanToolArgs(JSON.parse(toolCall.function.arguments || "{}"));
            } catch {
                functionArgs = {};
            }

            const fp = `${functionName}:${toolCall.function.arguments || ""}`;
            if (fp === lastFingerprint) {
                return {
                    replyText: "Listo, ya quedó procesado. ¿Necesitás algo más?",
                    actionPerformed,
                    totalUsage: aggregateUsage("openai", input.modelId, usages),
                };
            }
            lastFingerprint = fp;

            const toolResult = await executeTool(
                functionName,
                functionArgs,
                input.sucursalId,
                input.config,
                input.senderPhone,
                input.userRole,
                input.runtime
            );

            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: toolResult,
            });

            if (!READ_ONLY_TOOLS.has(functionName)) {
                actionPerformed = {
                    type: functionName,
                    details: functionArgs,
                    result: toolResult,
                };
            }
        }
    }

    return {
        replyText: "Perdón, la operación quedó un poco larga. ¿Me repetís qué querías pedir?",
        actionPerformed,
        totalUsage: aggregateUsage("openai", input.modelId, usages),
    };
}

async function runGroqLoop(input: LoopInput) {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
    const groqTools = convertToolsToOpenAIFormat(input.allowedTools);

    const messages: any[] = [
        { role: "system", content: input.systemPrompt },
        ...input.turns.map((t) => ({ role: t.role, content: t.text })),
        { role: "user", content: input.userText },
    ];

    const usages: TokenUsageRecord[] = [];
    let actionPerformed: AgentResponse["action"] | undefined;
    let lastToolCallFingerprint = "";
    let maxIterations = 6;

    while (maxIterations > 0) {
        maxIterations--;
        const response = await groq.chat.completions.create({
            model: input.modelId,
            messages,
            tools: groqTools,
            tool_choice: groqTools ? "auto" : undefined,
        });

        const u: any = response.usage || {};
        const promptTokens = Number(u.prompt_tokens || 0);
        const outputTokens = Number(u.completion_tokens || 0);
        const totalTokens = Number(u.total_tokens || promptTokens + outputTokens);
        usages.push({
            provider: "groq",
            model: input.modelId,
            promptTokens,
            cachedTokens: 0,
            outputTokens,
            totalTokens,
            estimatedCostUsd: estimateCostUsd(input.modelId, promptTokens, 0, outputTokens),
        });

        const responseMessage: any = response.choices?.[0]?.message || {};
        messages.push({
            role: "assistant",
            content: responseMessage.content ?? null,
            ...(responseMessage.tool_calls ? { tool_calls: responseMessage.tool_calls } : {}),
        });

        if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
            return {
                replyText: responseMessage.content || "",
                actionPerformed,
                totalUsage: aggregateUsage("groq", input.modelId, usages),
            };
        }

        for (const toolCall of responseMessage.tool_calls) {
            const functionName = toolCall.function.name;
            let functionArgs: Record<string, any> = {};
            try {
                functionArgs = cleanToolArgs(JSON.parse(toolCall.function.arguments || "{}"));
            } catch {
                functionArgs = {};
            }

            const fingerprint = `${functionName}:${toolCall.function.arguments || ""}`;
            if (fingerprint === lastToolCallFingerprint) {
                return {
                    replyText: "Entendido, ya procesé la acción anterior. ¿Necesitás algo más?",
                    actionPerformed,
                    totalUsage: aggregateUsage("groq", input.modelId, usages),
                };
            }
            lastToolCallFingerprint = fingerprint;

            const toolResult = await executeTool(
                functionName,
                functionArgs,
                input.sucursalId,
                input.config,
                input.senderPhone,
                input.userRole,
                input.runtime
            );

            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: toolResult,
            });

            if (!READ_ONLY_TOOLS.has(functionName)) {
                actionPerformed = {
                    type: functionName,
                    details: functionArgs,
                    result: toolResult,
                };
            }
        }
    }

    return {
        replyText: "Perdón, se me complicó procesar eso. ¿Podés repetirlo en un mensaje corto?",
        actionPerformed,
        totalUsage: aggregateUsage("groq", input.modelId, usages),
    };
}
