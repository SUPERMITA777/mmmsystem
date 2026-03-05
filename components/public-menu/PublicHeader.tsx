"use client";

import { Clock } from "lucide-react";

interface PublicHeaderProps {
    sucursal: any;
    isOpen: boolean;
}

export default function PublicHeader({ sucursal, isOpen }: PublicHeaderProps) {
    return (
        <header className="relative w-full bg-slate-950">
            {/* Info Container */}
            <div className="relative z-20 max-w-5xl mx-auto px-4 pt-6 pb-6">
                <div className="flex flex-col items-center gap-4">
                    {/* Logo */}
                    <div className="shrink-0 rounded-2xl overflow-hidden bg-slate-900 shadow-2xl h-28 w-28">
                        {sucursal?.logo_url ? (
                            <img
                                src={sucursal.logo_url}
                                alt={sucursal?.nombre}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                                <span className="text-4xl font-black text-white">{sucursal?.nombre?.charAt(0) || 'M'}</span>
                            </div>
                        )}
                    </div>

                    {/* Store Name */}
                    <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter text-center">
                        {sucursal?.nombre || "MMM PIZZA ARTESANAL"}
                    </h1>
                </div>

                {/* Status Bar */}
                <div className="mt-5 flex flex-col gap-3">
                    <div className={`w-full py-2.5 rounded-xl text-center font-black text-[10px] tracking-[0.2em] uppercase transition-all ${isOpen
                        ? "bg-white/5 text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}>
                        {isOpen ? "Abierto ahora" : "Cerrado"}
                    </div>

                    {/* Delivery/Retiro Switch */}
                    <div className="flex bg-white/5 p-1 rounded-[15px] border border-white/5 backdrop-blur-md">
                        <button
                            className="flex-1 py-3 px-4 rounded-xl text-[10px] font-black tracking-[0.15em] text-white shadow-xl transition-all uppercase"
                            style={{ backgroundColor: 'var(--color-primario, #f97316)' }}
                        >
                            DELIVERY
                        </button>
                        <button className="flex-1 py-3 px-4 rounded-xl text-[10px] font-black tracking-[0.15em] text-slate-500 hover:text-white transition-all uppercase">
                            RETIRAR
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
