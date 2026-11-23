"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTenant } from "@/context/TenantContext";
import { COPILOT_SKILLS } from "@/lib/assistantSkills";
import {
    BrainCircuit,
    Sparkles,
    Send,
    Clock,
    CheckCircle,
    XCircle,
    Undo2,
    Loader2,
    Maximize2,
    X,
    ShieldCheck,
    AlertTriangle,
    RotateCcw,
    Trash2,
    Wrench,
} from "lucide-react";

interface ProposalPreviewRow {
    label: string;
    before?: string;
    after: string;
    detail?: string;
}

interface PendingActionProposal {
    id: string;
    actionType: string;
    title: string;
    summary: string;
    riskLevel: "low" | "medium" | "high";
    previewRows: ProposalPreviewRow[];
    payload: Record<string, any>;
}

interface ProposalRuntimeState {
    status: "pending" | "executing" | "applied" | "cancelled" | "reverted" | "error";
    resultMessage?: string;
    logIds?: string[];
}

interface ChatItem {
    id: string;
    role: "user" | "assistant";
    content: string;
    proposals?: PendingActionProposal[];
    toolsUsed?: string[];
    originalPrompt?: string;
}

interface LogEntry {
    id: string;
    comando_original: string;
    comando_interpretado: string;
    tabla_afectada: string;
    registro_nombre: string;
    campo_modificado: string;
    valor_anterior: string | null;
    valor_nuevo: string | null;
    estado: string;
    created_at: string;
}

const TOOL_LABELS: Record<string, string> = {
    get_sales_summary: "Ventas",
    get_menu_engineering: "Ingeniería de Menú",
    get_stock_alerts: "Stock",
    get_finance_cashflow: "Caja y Finanzas",
    get_customers_insights: "Clientes",
    get_catalog_and_promos: "Catálogo y Promos",
    get_store_overview: "Configuración",
    propose_create_product: "Propuesta: Crear producto",
    propose_update_product: "Propuesta: Editar producto",
    propose_bulk_update_prices: "Propuesta: Precios",
    propose_toggle_by_ingredient: "Propuesta: Por ingrediente",
    propose_set_product_promo: "Propuesta: Promo temporal",
    propose_create_discount: "Propuesta: Descuento",
    propose_toggle_discount: "Propuesta: Estado descuento",
    propose_store_or_bot_action: "Propuesta: Local / WhatsApp",
};

const QUICK_CHIPS = [
    {
        label: "📊 Resumen últimos 7 días",
        prompt: "Analizame las ventas de los últimos 7 días comparando contra la semana anterior (canales, medios de pago, horarios pico y ticket promedio).",
    },
    {
        label: "🍔 Ingeniería de menú (BCG)",
        prompt: "Haceme una ingeniería de menú de los últimos 30 días: cuáles son mis platos estrella, cuáles tienen food cost alto y qué ajustes me recomendás.",
    },
    {
        label: "🚨 Stock crítico",
        prompt: "Revisá mis alertas de stock e insumos críticos para este fin de semana y decime qué productos se verían afectados.",
    },
    {
        label: "💰 Caja y finanzas",
        prompt: "Analizá el flujo de cajas, egresos y diferencias de arqueo de los últimos 7 días.",
    },
    {
        label: "🎁 Promo días flojos",
        prompt: "Analizá qué días vendo menos y proponeme una promo temporal concreta para levantar martes y miércoles.",
    },
    {
        label: "🤖 Auditoría del sistema",
        prompt: "Revisá el estado general de mi configuración (horarios, zonas, productos sin costo cargado y bot WhatsApp) y decime qué debería mejorar.",
    },
];

function renderInlineFormatting(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
            return (
                <strong key={idx} className="font-semibold text-gray-900">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
            return (
                <code
                    key={idx}
                    className="px-1 py-0.5 bg-gray-100 text-purple-700 rounded text-[11px] font-mono"
                >
                    {part.slice(1, -1)}
                </code>
            );
        }
        return <Fragment key={idx}>{part}</Fragment>;
    });
}

function FormattedMarkdown({ content }: { content: string }) {
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    const blocks: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Markdown table block
        if (
            line.trim().startsWith("|") &&
            i + 1 < lines.length &&
            /^\s*\|?[\s:-]+\|/.test(lines[i + 1])
        ) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith("|")) {
                tableLines.push(lines[i].trim());
                i++;
            }
            const parseRow = (row: string) =>
                row
                    .replace(/^\|/, "")
                    .replace(/\|$/, "")
                    .split("|")
                    .map((c) => c.trim());

            const headers = parseRow(tableLines[0]);
            const bodyRows = tableLines.slice(2).map(parseRow);

            blocks.push(
                <div
                    key={`tbl-${i}`}
                    className="my-2.5 overflow-x-auto rounded-xl border border-gray-200 bg-white"
                >
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                {headers.map((h, hi) => (
                                    <th key={hi} className="px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                                        {renderInlineFormatting(h)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {bodyRows.map((row, ri) => (
                                <tr key={ri} className="hover:bg-purple-50/30">
                                    {headers.map((_, ci) => (
                                        <td key={ci} className="px-3 py-1.5 text-gray-700">
                                            {renderInlineFormatting(row[ci] || "")}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        // Heading
        const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
        if (headingMatch) {
            blocks.push(
                <p key={`h-${i}`} className="font-bold text-gray-900 mt-2.5 mb-1 text-sm">
                    {renderInlineFormatting(headingMatch[2])}
                </p>
            );
            i++;
            continue;
        }

        // Bullet or numbered list
        if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
            const listItems: string[] = [];
            while (
                i < lines.length &&
                (/^\s*[-*•]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))
            ) {
                listItems.push(
                    lines[i].replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+\.\s+/, "")
                );
                i++;
            }
            blocks.push(
                <ul key={`ul-${i}`} className="my-1.5 space-y-1 pl-4 list-disc marker:text-purple-500">
                    {listItems.map((it, idx) => (
                        <li key={idx} className="leading-relaxed">
                            {renderInlineFormatting(it)}
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        if (!line.trim()) {
            blocks.push(<div key={`sp-${i}`} className="h-1.5" />);
            i++;
            continue;
        }

        blocks.push(
            <p key={`p-${i}`} className="leading-relaxed">
                {renderInlineFormatting(line)}
            </p>
        );
        i++;
    }

    return <div className="space-y-0.5 text-[13px] text-gray-700">{blocks}</div>;
}

export function BusinessCopilotChat({
    mode,
    onClose,
    externalPrompt,
    onExternalPromptConsumed,
}: {
    mode: "drawer" | "page";
    onClose?: () => void;
    externalPrompt?: string | null;
    onExternalPromptConsumed?: () => void;
}) {
    const { sucursalId, sucursalData } = useTenant();
    const params = useParams();
    const pathname = usePathname();
    const tenant = (params?.tenant as string) || pathname.split("/")[1] || "demo";

    const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");
    const [messages, setMessages] = useState<ChatItem[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [proposalStates, setProposalStates] = useState<Record<string, ProposalRuntimeState>>({});
    const [historyLogs, setHistoryLogs] = useState<LogEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [undoingId, setUndoingId] = useState<string | null>(null);
    const [monthlyUsage, setMonthlyUsage] = useState<{ totalTokens: number; estimatedCostUsd: number } | null>(null);

    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    useEffect(() => {
        if (mode === "drawer") {
            setTimeout(() => inputRef.current?.focus(), 120);
        }
    }, [mode]);

    useEffect(() => {
        if (sucursalId) {
            loadHistory();
        }
    }, [sucursalId]);

    useEffect(() => {
        if (externalPrompt && sucursalId && !loading) {
            const textToSend = externalPrompt;
            onExternalPromptConsumed?.();
            setActiveTab("chat");
            void sendMessage(textToSend);
        }
    }, [externalPrompt, sucursalId]);

    async function loadHistory() {
        if (!sucursalId) return;
        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/ai-copilot?sucursal_id=${sucursalId}`);
            const data = await res.json();
            if (data.success) {
                setHistoryLogs(data.data || []);
                if (data.usage) {
                    setMonthlyUsage({
                        totalTokens: data.usage.totalTokens || 0,
                        estimatedCostUsd: data.usage.estimatedCostUsd || 0,
                    });
                }
            }
        } catch (err) {
            console.error("Error loading copilot history:", err);
        } finally {
            setLoadingHistory(false);
        }
    }

    async function sendMessage(overrideText?: string) {
        const text = (overrideText ?? input).trim();
        if (!text || !sucursalId || loading) return;

        if (!overrideText) setInput("");

        const historySnapshot = messages.map((m) => ({
            role: m.role,
            content: m.content,
        }));

        const userMsg: ChatItem = {
            id: `u-${Date.now()}`,
            role: "user",
            content: text,
        };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        try {
            const res = await fetch("/api/ai-copilot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursalId,
                    message: text,
                    history: historySnapshot,
                    activePage: pathname,
                }),
            });

            const rawText = await res.text();
            let data: any = null;
            try {
                data = rawText ? JSON.parse(rawText) : {};
            } catch {
                data = null;
            }

            if (res.ok && data?.success) {
                const newProps: PendingActionProposal[] = data.proposals || [];
                if (newProps.length > 0) {
                    setProposalStates((prev) => {
                        const next = { ...prev };
                        for (const p of newProps) {
                            next[p.id] = { status: "pending" };
                        }
                        return next;
                    });
                }

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `a-${Date.now()}`,
                        role: "assistant",
                        content: data.reply,
                        proposals: newProps,
                        toolsUsed: data.toolsUsed || [],
                        originalPrompt: text,
                    },
                ]);

                if (data.usage) {
                    loadHistory();
                }
            } else {
                const errDetail = data?.error || rawText.slice(0, 300) || `Error del servidor (HTTP ${res.status})`;
                console.error("[BusinessCopilot] Error HTTP", res.status, errDetail);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `err-${Date.now()}`,
                        role: "assistant",
                        content: `⚠️ ${data?.error || `Error del servidor (HTTP ${res.status}). Revisá la configuración o volvé a intentar.`}`,
                    },
                ]);
            }
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `err-${Date.now()}`,
                    role: "assistant",
                    content: "⚠️ Error de conexión con el servidor del Copiloto IA.",
                },
            ]);
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirmProposal(proposal: PendingActionProposal, originalCommand: string) {
        if (!sucursalId) return;
        setProposalStates((prev) => ({
            ...prev,
            [proposal.id]: { status: "executing" },
        }));

        try {
            const res = await fetch("/api/ai-copilot/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursalId,
                    proposal,
                    originalCommand,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setProposalStates((prev) => ({
                    ...prev,
                    [proposal.id]: {
                        status: "applied",
                        resultMessage: data.message,
                        logIds: data.logIds || [],
                    },
                }));
                loadHistory();
            } else {
                setProposalStates((prev) => ({
                    ...prev,
                    [proposal.id]: {
                        status: "error",
                        resultMessage: data.message || data.error || "No se pudo aplicar el cambio.",
                    },
                }));
            }
        } catch {
            setProposalStates((prev) => ({
                ...prev,
                [proposal.id]: {
                    status: "error",
                    resultMessage: "Error de conexión al ejecutar el cambio.",
                },
            }));
        }
    }

    function handleCancelProposal(proposalId: string) {
        setProposalStates((prev) => ({
            ...prev,
            [proposalId]: {
                status: "cancelled",
                resultMessage: "Propuesta cancelada. No se modificó ningún dato.",
            },
        }));
    }

    async function handleUndoLog(logId: string, proposalId?: string) {
        if (!sucursalId) return;
        setUndoingId(logId);
        try {
            const res = await fetch("/api/ai-copilot/execute", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sucursalId, logId }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (proposalId) {
                    setProposalStates((prev) => ({
                        ...prev,
                        [proposalId]: {
                            status: "reverted",
                            resultMessage: data.message,
                        },
                    }));
                }
                loadHistory();
            } else {
                alert(data.message || data.error || "No se pudo deshacer el cambio.");
            }
        } catch {
            alert("Error de conexión al intentar deshacer.");
        } finally {
            setUndoingId(null);
        }
    }

    function formatDateShort(dateStr: string) {
        return new Date(dateStr).toLocaleString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 via-white to-purple-50/40 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-violet-700 flex items-center justify-center shadow-sm shrink-0">
                        <BrainCircuit size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-sm truncate">
                                Copiloto IA · {sucursalData?.nombre || "Negocio"}
                            </h3>
                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <ShieldCheck size={10} /> Confirmación obligatoria
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">
                            Consultor gastronómico AR/BA + análisis en vivo + editor seguro
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {messages.length > 0 && activeTab === "chat" && (
                        <button
                            onClick={() => {
                                setMessages([]);
                                setProposalStates({});
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Nueva conversación"
                        >
                            <Trash2 size={15} />
                        </button>
                    )}

                    <div className="flex bg-gray-100 p-0.5 rounded-lg">
                        <button
                            onClick={() => setActiveTab("chat")}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                activeTab === "chat"
                                    ? "bg-white text-purple-700 shadow-sm"
                                    : "text-gray-500 hover:text-gray-800"
                            }`}
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab("history");
                                loadHistory();
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                                activeTab === "history"
                                    ? "bg-white text-purple-700 shadow-sm"
                                    : "text-gray-500 hover:text-gray-800"
                            }`}
                        >
                            <Clock size={12} />
                            Cambios ({historyLogs.filter((l) => l.estado === "ejecutado").length})
                        </button>
                    </div>

                    {mode === "drawer" && (
                        <Link
                            href={`/${tenant}/admin/asistente-ia`}
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Abrir en vista completa"
                        >
                            <Maximize2 size={15} />
                        </Link>
                    )}

                    {mode === "drawer" && onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Cerrar (Esc)"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Body */}
            {activeTab === "history" ? (
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/40 custom-scrollbar">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-500">
                            Últimos cambios aplicados en esta sucursal (podés revertir cualquiera con 1 clic).
                        </p>
                        {monthlyUsage && (
                            <span className="text-[11px] font-medium text-gray-500 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                                Mes: {new Intl.NumberFormat("es-AR").format(monthlyUsage.totalTokens)} tokens · US$ {monthlyUsage.estimatedCostUsd.toFixed(4)}
                            </span>
                        )}
                    </div>

                    {loadingHistory ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 size={20} className="animate-spin text-purple-500" />
                        </div>
                    ) : historyLogs.length === 0 ? (
                        <div className="text-center py-12 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                            Aún no hay cambios aplicados por el Asistente IA.
                        </div>
                    ) : (
                        historyLogs.map((entry) => (
                            <div
                                key={entry.id}
                                className={`flex items-center justify-between gap-3 p-3 rounded-xl border text-xs transition-all ${
                                    entry.estado === "revertido"
                                        ? "bg-gray-50 border-gray-200 text-gray-400"
                                        : "bg-white border-gray-200 text-gray-700 shadow-sm"
                                }`}
                            >
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    {entry.estado === "revertido" ? (
                                        <RotateCcw size={14} className="text-gray-400 mt-0.5 shrink-0" />
                                    ) : (
                                        <CheckCircle size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-gray-800 truncate">
                                            {entry.comando_interpretado}
                                        </p>
                                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                            {entry.registro_nombre} ·{" "}
                                            {entry.campo_modificado === "__created__"
                                                ? "Registro creado"
                                                : entry.campo_modificado === "__json_snapshot__"
                                                ? "Edición múltiple"
                                                : entry.campo_modificado === "__wa_snippet_added__"
                                                ? "Conocimiento WhatsApp agregado"
                                                : `${entry.campo_modificado}: ${entry.valor_anterior ?? "—"} → ${entry.valor_nuevo ?? "—"}`}
                                        </p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                            {formatDateShort(entry.created_at)}
                                        </p>
                                    </div>
                                </div>

                                {entry.estado === "ejecutado" ? (
                                    <button
                                        onClick={() => handleUndoLog(entry.id)}
                                        disabled={undoingId === entry.id}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors shrink-0 disabled:opacity-50"
                                    >
                                        {undoingId === entry.id ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <Undo2 size={12} />
                                        )}
                                        Deshacer
                                    </button>
                                ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold shrink-0">
                                        Revertido
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <>
                    {/* Messages area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40 custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="max-w-2xl mx-auto py-4 space-y-5">
                                <div className="text-center space-y-2">
                                    <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
                                        <Sparkles size={24} />
                                    </div>
                                    <h4 className="font-bold text-gray-900 text-base">
                                        ¿Qué analizamos o ajustamos hoy en tu negocio?
                                    </h4>
                                    <p className="text-xs text-gray-500 max-w-lg mx-auto">
                                        Tengo acceso en vivo a tus ventas, costos, stock, cajas y catálogo, con criterios del mercado gastronómico argentino. Todo cambio que me pidas te mostrará una vista previa antes de aplicarse.
                                    </p>
                                </div>

                                {mode === "drawer" && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {COPILOT_SKILLS.map((sk) => (
                                            <div
                                                key={sk.id}
                                                className="p-2.5 rounded-xl bg-white border border-gray-200/80 text-left"
                                            >
                                                <p className="text-xs font-semibold text-gray-800">{sk.name}</p>
                                                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                                                    {sk.shortDesc}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-center">
                                        Consultas rápidas
                                    </p>
                                    <div className="flex flex-wrap justify-center gap-2">
                                        {QUICK_CHIPS.map((chip) => (
                                            <button
                                                key={chip.label}
                                                type="button"
                                                onClick={() => void sendMessage(chip.prompt)}
                                                className="px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:border-purple-300 hover:text-purple-700 text-xs font-medium text-gray-600 shadow-sm transition-all"
                                            >
                                                {chip.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${
                                        msg.role === "user" ? "items-end" : "items-start"
                                    }`}
                                >
                                    <div
                                        className={`max-w-[92%] rounded-2xl px-4 py-3 shadow-sm ${
                                            msg.role === "user"
                                                ? "bg-purple-600 text-white rounded-tr-none text-sm"
                                                : "bg-white border border-gray-200 rounded-tl-none w-full sm:w-auto"
                                        }`}
                                    >
                                        {msg.role === "user" ? (
                                            <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                                        ) : (
                                            <>
                                                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-gray-100">
                                                        {msg.toolsUsed.map((t) => (
                                                            <span
                                                                key={t}
                                                                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100"
                                                            >
                                                                <Wrench size={9} />
                                                                {TOOL_LABELS[t] || t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <FormattedMarkdown content={msg.content} />
                                            </>
                                        )}
                                    </div>

                                    {/* Confirmation Cards for Proposed Changes */}
                                    {msg.proposals && msg.proposals.length > 0 && (
                                        <div className="mt-2.5 space-y-2.5 w-full max-w-[95%]">
                                            {msg.proposals.map((prop) => {
                                                const pState = proposalStates[prop.id] || { status: "pending" };
                                                const riskBadge =
                                                    prop.riskLevel === "high"
                                                        ? "bg-red-100 text-red-700 border-red-200"
                                                        : prop.riskLevel === "medium"
                                                        ? "bg-amber-100 text-amber-800 border-amber-200"
                                                        : "bg-blue-100 text-blue-700 border-blue-200";

                                                return (
                                                    <div
                                                        key={prop.id}
                                                        className="rounded-2xl border-2 border-purple-200 bg-white shadow-sm overflow-hidden"
                                                    >
                                                        <div className="px-4 py-3 bg-purple-50/70 border-b border-purple-100 flex items-start justify-between gap-2">
                                                            <div>
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-xs font-bold text-purple-900">
                                                                        {prop.title}
                                                                    </span>
                                                                    <span
                                                                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${riskBadge}`}
                                                                    >
                                                                        {prop.riskLevel === "high"
                                                                            ? "Impacto alto"
                                                                            : prop.riskLevel === "medium"
                                                                            ? "Impacto medio"
                                                                            : "Cambio puntual"}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-purple-700 mt-0.5">
                                                                    {prop.summary}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {prop.previewRows && prop.previewRows.length > 0 && (
                                                            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 text-xs">
                                                                {prop.previewRows.map((row, rIdx) => (
                                                                    <div
                                                                        key={rIdx}
                                                                        className="px-4 py-2 flex items-center justify-between gap-3"
                                                                    >
                                                                        <span className="font-medium text-gray-800 truncate">
                                                                            {row.label}
                                                                        </span>
                                                                        <div className="flex items-center gap-2 shrink-0 text-right">
                                                                            {row.before && (
                                                                                <>
                                                                                    <span className="text-gray-400 line-through">
                                                                                        {row.before}
                                                                                    </span>
                                                                                    <span className="text-gray-400">→</span>
                                                                                </>
                                                                            )}
                                                                            <span className="font-semibold text-emerald-700">
                                                                                {row.after}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                                                            {pState.status === "pending" && (
                                                                <>
                                                                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                                                        <AlertTriangle size={12} className="text-amber-500" />
                                                                        Requiere tu confirmación para aplicarse
                                                                    </span>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleCancelProposal(prop.id)}
                                                                            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-100"
                                                                        >
                                                                            Cancelar
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleConfirmProposal(
                                                                                    prop,
                                                                                    msg.originalPrompt || prop.title
                                                                                )
                                                                            }
                                                                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm"
                                                                        >
                                                                            <CheckCircle size={13} />
                                                                            Confirmar y aplicar
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}

                                                            {pState.status === "executing" && (
                                                                <span className="text-xs text-purple-700 font-medium flex items-center gap-2">
                                                                    <Loader2 size={14} className="animate-spin" />
                                                                    Aplicando cambios en la sucursal...
                                                                </span>
                                                            )}

                                                            {pState.status === "applied" && (
                                                                <div className="w-full flex items-center justify-between gap-2">
                                                                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                                                                        <CheckCircle size={14} />
                                                                        {pState.resultMessage || "Cambios aplicados"}
                                                                    </span>
                                                                    {pState.logIds && pState.logIds.length === 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                handleUndoLog(pState.logIds![0], prop.id)
                                                                            }
                                                                            disabled={undoingId === pState.logIds[0]}
                                                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[11px] font-semibold text-gray-700 hover:text-purple-700 hover:border-purple-200"
                                                                        >
                                                                            <Undo2 size={11} /> Deshacer
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {pState.status === "cancelled" && (
                                                                <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                                                    <XCircle size={14} className="text-gray-400" />
                                                                    {pState.resultMessage}
                                                                </span>
                                                            )}

                                                            {pState.status === "reverted" && (
                                                                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                                                                    <RotateCcw size={14} className="text-purple-500" />
                                                                    {pState.resultMessage}
                                                                </span>
                                                            )}

                                                            {pState.status === "error" && (
                                                                <span className="text-xs text-red-700 flex items-center gap-1.5">
                                                                    <XCircle size={14} />
                                                                    {pState.resultMessage}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {loading && (
                            <div className="flex items-start">
                                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2 text-xs text-gray-500">
                                    <Loader2 size={14} className="animate-spin text-purple-600" />
                                    Consultando datos del negocio y analizando...
                                </div>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>

                    {/* Input Footer */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            void sendMessage();
                        }}
                        className="p-3 border-t border-gray-200 bg-white shrink-0"
                    >
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={loading || !sucursalId}
                                placeholder="Preguntá por ventas, márgenes, stock o pedí cambios (ej: subí las pizzas un 10% redondeando a $500)..."
                                className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-400 placeholder:text-gray-400 disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || loading || !sucursalId}
                                className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 shadow-sm transition-all active:scale-95 shrink-0"
                            >
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
}
