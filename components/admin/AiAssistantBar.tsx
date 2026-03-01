"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, Send, ChevronDown, ChevronUp, RotateCcw, Clock, CheckCircle, XCircle, Undo2, Loader2 } from "lucide-react";

interface LogEntry {
    id: string;
    comando_original: string;
    comando_interpretado: string;
    tabla_afectada: string;
    registro_nombre: string;
    campo_modificado: string;
    valor_anterior: string;
    valor_nuevo: string;
    estado: string;
    created_at: string;
}

interface CommandResponse {
    success: boolean;
    message: string;
    interpreted: string;
    affectedCount?: number;
}

export function AiAssistantBar() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [command, setCommand] = useState("");
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<LogEntry[]>([]);
    const [lastResponse, setLastResponse] = useState<CommandResponse | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [undoingId, setUndoingId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load history when expanded
    useEffect(() => {
        if (isExpanded) {
            loadHistory();
            // Focus input when expanding
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isExpanded]);

    async function loadHistory() {
        try {
            const res = await fetch("/api/ai-assistant");
            const data = await res.json();
            if (data.success && data.data) {
                setHistory(data.data);
            }
        } catch (err) {
            console.error("Error loading AI history:", err);
        }
    }

    async function handleSubmit(e?: React.FormEvent) {
        e?.preventDefault();
        if (!command.trim() || loading) return;

        setLoading(true);
        setLastResponse(null);

        try {
            const res = await fetch("/api/ai-assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ command: command.trim() }),
            });

            const data: CommandResponse = await res.json();
            setLastResponse(data);

            if (data.success) {
                setCommand("");
                loadHistory(); // Refresh history
            }
        } catch (err) {
            setLastResponse({
                success: false,
                message: "Error de conexión con el servidor.",
                interpreted: "",
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleUndo(logId: string) {
        setUndoingId(logId);
        try {
            const res = await fetch("/api/ai-assistant", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logId }),
            });

            const data = await res.json();
            setLastResponse({
                success: data.success,
                message: data.message,
                interpreted: "Deshacer cambio",
            });

            if (data.success) {
                loadHistory();
            }
        } catch (err) {
            setLastResponse({
                success: false,
                message: "Error al deshacer el cambio.",
                interpreted: "",
            });
        } finally {
            setUndoingId(null);
        }
    }

    function formatTime(dateStr: string) {
        const d = new Date(dateStr);
        return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    }

    function formatDate(dateStr: string) {
        const d = new Date(dateStr);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return "Hoy";
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return "Ayer";
        return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
    }

    // Collapsed state
    if (!isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600/5 via-purple-500/10 to-purple-600/5 hover:from-purple-600/10 hover:via-purple-500/15 hover:to-purple-600/10 border-b border-purple-200/50 transition-all duration-300 group"
            >
                <Sparkles
                    size={14}
                    className="text-purple-500 group-hover:text-purple-600 transition-colors"
                />
                <span className="text-xs font-medium text-purple-600/80 group-hover:text-purple-700 transition-colors">
                    Asistente IA
                </span>
                <ChevronDown
                    size={12}
                    className="text-purple-400 group-hover:text-purple-600 transition-colors"
                />
            </button>
        );
    }

    // Expanded state
    return (
        <div className="border-b border-purple-200/60 bg-gradient-to-r from-slate-50 via-purple-50/50 to-slate-50 animate-in slide-in-from-top duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm">
                        <Sparkles size={12} className="text-white" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800">Asistente IA</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full font-medium">
                        BETA
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-all ${showHistory
                                ? "bg-purple-100 text-purple-700"
                                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            }`}
                    >
                        <Clock size={12} />
                        Historial
                    </button>
                    <button
                        onClick={() => {
                            setIsExpanded(false);
                            setShowHistory(false);
                            setLastResponse(null);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
                    >
                        <ChevronUp size={14} />
                    </button>
                </div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="px-4 pb-2">
                <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={command}
                            onChange={(e) => setCommand(e.target.value)}
                            disabled={loading}
                            placeholder='Ej: "deshabilita empanadas de carne", "aumenta las pizzas un 10%"...'
                            className="w-full px-4 py-2.5 text-sm border border-gray-200/80 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:border-purple-300 placeholder:text-gray-400 disabled:opacity-50 shadow-sm transition-all"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!command.trim() || loading}
                        className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-white hover:from-purple-600 hover:to-purple-800 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-all hover:shadow-md active:scale-95"
                    >
                        {loading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Send size={15} />
                        )}
                    </button>
                </div>
            </form>

            {/* Response */}
            {lastResponse && (
                <div className="px-4 pb-2">
                    <div
                        className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-sm ${lastResponse.success
                                ? "bg-emerald-50/80 text-emerald-800 border border-emerald-200/60"
                                : "bg-red-50/80 text-red-800 border border-red-200/60"
                            }`}
                    >
                        {lastResponse.success ? (
                            <CheckCircle size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                        ) : (
                            <XCircle size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                            {lastResponse.interpreted && (
                                <div className="text-[10px] font-medium opacity-60 mb-0.5 uppercase tracking-wider">
                                    {lastResponse.interpreted}
                                </div>
                            )}
                            <div className="whitespace-pre-line leading-relaxed">
                                {lastResponse.message}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Panel */}
            {showHistory && (
                <div className="px-4 pb-3 max-h-64 overflow-y-auto">
                    <div className="space-y-1">
                        {history.length === 0 ? (
                            <div className="text-center py-6 text-gray-400 text-xs">
                                No hay comandos recientes
                            </div>
                        ) : (
                            history.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all ${entry.estado === "revertido"
                                            ? "bg-gray-50 text-gray-400"
                                            : "bg-white hover:bg-gray-50/80 text-gray-700 border border-gray-100"
                                        }`}
                                >
                                    {/* Status icon */}
                                    <div className="flex-shrink-0">
                                        {entry.estado === "revertido" ? (
                                            <RotateCcw size={12} className="text-gray-400" />
                                        ) : (
                                            <CheckCircle size={12} className="text-emerald-500" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">
                                            {entry.comando_interpretado}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                                            <span>{entry.registro_nombre}</span>
                                            <span className="text-gray-300">•</span>
                                            <span>{entry.campo_modificado}: {entry.valor_anterior} → {entry.valor_nuevo}</span>
                                        </div>
                                    </div>

                                    {/* Time */}
                                    <div className="text-[10px] text-gray-400 flex-shrink-0">
                                        {formatDate(entry.created_at)} {formatTime(entry.created_at)}
                                    </div>

                                    {/* Undo button */}
                                    {entry.estado === "ejecutado" && (
                                        <button
                                            onClick={() => handleUndo(entry.id)}
                                            disabled={undoingId === entry.id}
                                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-md transition-all disabled:opacity-50"
                                            title="Deshacer este cambio"
                                        >
                                            {undoingId === entry.id ? (
                                                <Loader2 size={10} className="animate-spin" />
                                            ) : (
                                                <Undo2 size={10} />
                                            )}
                                            Deshacer
                                        </button>
                                    )}

                                    {entry.estado === "revertido" && (
                                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                                            Revertido
                                        </span>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
