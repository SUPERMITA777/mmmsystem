"use client";

import { useState } from "react";
import { BusinessCopilotChat } from "@/components/admin/BusinessCopilotChat";
import { COPILOT_SKILLS } from "@/lib/assistantSkills";
import {
    BrainCircuit,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Layers,
    AlertTriangle,
} from "lucide-react";

const PROMPT_GROUPS = [
    {
        category: "Análisis y Finanzas",
        prompts: [
            "¿Cómo vienen las ventas esta semana vs. la anterior?",
            "Analizame el mix de pagos y diferencias de caja de los últimos 7 días",
            "¿A qué hora y qué días vendo más y menos en el local?",
        ],
    },
    {
        category: "Menú y Rentabilidad (AR/BA)",
        prompts: [
            "Hacé una ingeniería de menú (BCG) de los últimos 30 días y detectá platos con Food Cost alto",
            "¿Qué platos debería destacar o promocionar para levantar los martes y miércoles?",
            "Revisá qué productos tengo sin costo cargado o con cero ventas",
        ],
    },
    {
        category: "Stock y Clientes",
        prompts: [
            "¿Qué ingredientes están críticos para el finde y qué platos afectan?",
            "Mostrame mis mejores clientes y cuáles dejaron de pedir hace más de 30 días",
        ],
    },
    {
        category: "Cambios Seguros (con confirmación)",
        prompts: [
            "Aumentá un 10% las pizzas redondeando a $500",
            "Creá un descuento del 10% automático pagando en Efectivo",
            "Armame una promo de martes y miércoles de 19 a 22hs",
        ],
    },
];

export default function AsistenteIAPage() {
    const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);

    return (
        <div className="flex-1 p-4 md:p-6 max-w-[1440px] mx-auto w-full h-[calc(100vh-4.5rem)] flex flex-col gap-4">
            {/* Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center shadow-md shadow-purple-200">
                        <BrainCircuit size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                            Asistente IA Copiloto de Negocio
                        </h1>
                        <p className="text-xs text-gray-500">
                            Consultor gastronómico argentino + análisis BI en vivo + cambios con confirmación obligatoria
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl font-medium">
                    <ShieldCheck size={15} />
                    <span>Ningún cambio se ejecuta sin tu confirmación</span>
                </div>
            </div>

            {/* Main 2-column workspace */}
            <div className="flex-1 min-h-0 flex gap-4">
                {/* Main Chat Panel */}
                <div className="flex-1 min-w-0 rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white">
                    <BusinessCopilotChat
                        mode="page"
                        externalPrompt={queuedPrompt}
                        onExternalPromptConsumed={() => setQueuedPrompt(null)}
                    />
                </div>

                {/* Right Sidebar: Skills & Suggested Prompts */}
                <aside className="hidden xl:flex w-80 shrink-0 flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
                    {/* Active Skills Card */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
                        <div className="flex items-center gap-2">
                            <Layers size={15} className="text-purple-600" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                Skills Cargados ({COPILOT_SKILLS.length})
                            </h2>
                        </div>
                        <div className="space-y-2.5">
                            {COPILOT_SKILLS.map((skill) => (
                                <div
                                    key={skill.id}
                                    className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5"
                                >
                                    <p className="text-xs font-semibold text-gray-900">{skill.name}</p>
                                    <p className="text-[11px] text-gray-500 leading-snug">
                                        {skill.shortDesc}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {skill.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Suggested Prompts */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
                        <div className="flex items-center gap-2">
                            <Sparkles size={15} className="text-purple-600" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                                Prompts Sugeridos
                            </h2>
                        </div>

                        <div className="space-y-3">
                            {PROMPT_GROUPS.map((group) => (
                                <div key={group.category} className="space-y-1.5">
                                    <p className="text-[11px] font-semibold text-gray-500 flex items-center gap-1">
                                        <TrendingUp size={11} className="text-purple-500" />
                                        {group.category}
                                    </p>
                                    <div className="space-y-1">
                                        {group.prompts.map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setQueuedPrompt(p)}
                                                className="w-full text-left text-[11px] text-gray-700 hover:text-purple-700 bg-gray-50 hover:bg-purple-50/70 border border-gray-100 hover:border-purple-200 rounded-lg px-2.5 py-2 transition-colors leading-snug"
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Security Note */}
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 text-[11px] text-amber-900 space-y-1">
                        <p className="font-semibold flex items-center gap-1.5">
                            <AlertTriangle size={13} className="text-amber-600" />
                            Control total y Rollback
                        </p>
                        <p className="leading-relaxed text-amber-800/90">
                            Cada cambio que solicites muestra primero una vista previa con los valores exactos. Al confirmar queda guardado en el historial para poder deshacerlo cuando quieras.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
