"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { BusinessCopilotChat } from "@/components/admin/BusinessCopilotChat";

export function AiAssistantBar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const isDedicatedPage = pathname?.endsWith("/admin/asistente-ia");

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                if (isDedicatedPage) return;
                e.preventDefault();
                setIsOpen((prev) => !prev);
            } else if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isDedicatedPage]);

    // En la pantalla dedicada del Asistente IA no hace falta mostrar la barra superior
    if (isDedicatedPage) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-2 bg-gradient-to-r from-purple-600/5 via-purple-500/10 to-purple-600/5 hover:from-purple-600/10 hover:via-purple-500/15 hover:to-purple-600/10 border-b border-purple-200/60 transition-all duration-200 group"
            >
                <Sparkles
                    size={14}
                    className="text-purple-600 group-hover:scale-110 transition-transform"
                />
                <span className="text-xs font-semibold text-purple-700">
                    Asistente IA Copiloto
                </span>
                <span className="hidden sm:inline text-[11px] text-purple-600/75">
                    · Consultá ventas, márgenes, stock o proponé cambios
                </span>
                <kbd className="hidden md:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/90 text-purple-700 border border-purple-200 shadow-sm">
                    Ctrl+K
                </kbd>
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[80] flex justify-end">
                    <div
                        className="fixed inset-0 bg-black/35 backdrop-blur-[1px] transition-opacity"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-2xl h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-200">
                        <BusinessCopilotChat
                            mode="drawer"
                            onClose={() => setIsOpen(false)}
                        />
                    </div>
                </div>
            )}
        </>
    );
}
