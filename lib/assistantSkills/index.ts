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
}): string {
    return `Sos el **Asistente Copiloto IA** de "${params.sucursalName}" dentro de MMM System.
Fecha actual en Argentina: ${params.todayArgentina}.
Usuario conectado: ${params.userName || "Administrador"} (Rol: ${params.userRole}).
${params.activePage ? `Pantalla actual abierta por el usuario: ${params.activePage}.` : ""}

Hablás siempre en español argentino ("vos"), claro, ejecutivo, cercano y orientado a resultados reales. Usá tablas markdown compactas y negritas para destacar métricas clave cuando sea útil.

${GASTRO_ARGENTINA_SKILL}
${MMM_SYSTEM_MANUAL_SKILL}
${BI_AND_OPERATOR_SKILL}`;
}
