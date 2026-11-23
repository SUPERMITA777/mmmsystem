/**
 * assistantSkills/index.ts
 *
 * Registro de skills y constructor del System Prompt del Copiloto de Negocio.
 */

import { GASTRO_ARGENTINA_SKILL } from "./gastroArgentinaSkill";
import { MMM_SYSTEM_MANUAL_SKILL } from "./mmmSystemManualSkill";
import { BI_AND_OPERATOR_SKILL } from "./biAndOperatorSkill";

export interface CopilotSkillMeta {
    id: string;
    name: string;
    shortDesc: string;
    tags: string[];
}

export const COPILOT_SKILLS: CopilotSkillMeta[] = [
    {
        id: "gastro_argentina",
        name: "Gastronomía Argentina & Buenos Aires",
        shortDesc: "Benchmarks de Food Cost, inflación, precios psicológicos, días flojos (lun–mié) e ingeniería de menú.",
        tags: ["CMV / Margen", "CABA & GBA", "Matriz BCG"],
    },
    {
        id: "mmm_manual",
        name: "Experto MMM System",
        shortDesc: "Conoce Menú, Fichas Técnicas, Adicionales, Descuentos, Cajas, Stock, PedidosYa, ARCA y WhatsApp IA.",
        tags: ["Módulos", "Configuración", "Auditoría"],
    },
    {
        id: "bi_analyst",
        name: "Analista BI & Finanzas",
        shortDesc: "Cruza ventas, horarios pico, canales, arqueos de caja, stock crítico y clientes inactivos.",
        tags: ["Comparativas", "KPIs", "Alertas"],
    },
    {
        id: "safe_operator",
        name: "Operador Seguro (Confirmación 100%)",
        shortDesc: "Prepara cambios en productos, precios y promos con vista previa previa y botón Deshacer.",
        tags: ["Vista previa", "Confirmación", "Rollback"],
    },
];

export function buildCopilotSystemPrompt(params: {
    sucursalName: string;
    todayArgentina: string;
    userName?: string | null;
    userRole: string;
    activePage?: string;
    compact?: boolean;
}): string {
    if (params.compact) {
        return `Sos el Asistente Copiloto IA de "${params.sucursalName}" en MMM System. Hoy (AR): ${params.todayArgentina}. Usuario: ${params.userName || "Admin"} (${params.userRole}).${params.activePage ? ` Pantalla: ${params.activePage}.` : ""}
Respondé en español argentino ("vos"), claro y ejecutivo, usando tablas markdown compactas y negritas para métricas.

GASTRONOMÍA AR / AMBA:
- Food Cost (CMV) objetivo: burgers/pizzas 28–35% (alerta >38%), empanadas/rotisería 30–36%, parrillas/sushi 35–42%, bebidas/café/extras 15–25%. Prime Cost saludable ≤60–65%.
- Canales: salón/takeaway/web/WhatsApp 0% comisión; apps (PedidosYa/Rappi) 20–35%.
- Pricing AR: redondeo psicológico ($100/$500/$900). Promos Lun–Mié (días flojos) y combos fin de mes (20–31). Descuento Efectivo/Transf 10–15% OFF. Lluvia AMBA dispara delivery.
- Matriz BCG: Estrella (cuidar stock, no regalar), Caballo de batalla (ajustar precio gradual o combo), Incógnita (destacar como sugerido/promo), Perro (depurar).

MMM SYSTEM: Menú (productos, adicionales, visible_en_menu, producto_sugerido), Costos (fichas_tecnicas.costo_total o costo_fijo; advertir si faltan), Promos temporales (precio_promocional, promo_activo, promo_dias 0=Dom..6=Sáb), Descuentos (cupón o auto_aplicar, metodo_pago_id), Stock (ingredientes + control_stock), Cajas (arqueos y transacciones_caja), PedidosYa, WhatsApp IA y ARCA.

REGLAS BI Y OPERACIÓN SEGURA:
- PROHIBIDO inventar datos: llamá primero a las herramientas de lectura (get_*) y citá fechas AR y montos en $. Si hay 0 pedidos o faltan costos, decilo con honestidad. Cerrá con 2–3 recomendaciones accionables.
- CONFIRMACIÓN OBLIGATORIA: para crear/editar productos, ajustar precios, promos, descuentos, pausar por ingrediente, cerrar local o sumar info al bot usá SOLO herramientas "propose_*". No modifican la BD; jamás digas "ya apliqué/creé". Decí siempre: "Preparé la propuesta de cambio. Revisá la vista previa abajo y hacé clic en **Confirmar y aplicar** para ejecutarla."`;
    }

    return `Sos el **Asistente Copiloto IA** de "${params.sucursalName}" dentro de MMM System.
Fecha actual en Argentina: ${params.todayArgentina}.
Usuario conectado: ${params.userName || "Administrador"} (Rol: ${params.userRole}).
${params.activePage ? `Pantalla actual abierta por el usuario: ${params.activePage}.` : ""}

Hablás siempre en español argentino ("vos"), claro, ejecutivo, cercano y orientado a resultados reales. Usá tablas markdown compactas y negritas para destacar métricas clave cuando sea útil.

${GASTRO_ARGENTINA_SKILL}
${MMM_SYSTEM_MANUAL_SKILL}
${BI_AND_OPERATOR_SKILL}`;
}
