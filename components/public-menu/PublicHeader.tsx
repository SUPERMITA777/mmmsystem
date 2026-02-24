"use client";

import Image from "next/image";
import { Clock, MapPin, Star, ChevronLeft } from "lucide-react";

interface PublicHeaderProps {
    sucursal: any;
    isOpen: boolean;
}

export default function PublicHeader({ sucursal, isOpen }: PublicHeaderProps) {
    return (
        <header className="relative w-full overflow-hidden bg-slate-950">
            {/* Background Hero Image */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-10" />
                <img
                    src="/hero-pizza.jpg" // We'll generate this
                    alt="Banner"
                    className="w-full h-full object-cover object-center opacity-80"
                />
                <button className="absolute top-4 left-4 z-20 p-2 bg-slate-950/50 backdrop-blur-md rounded-full text-white hover:bg-slate-950 transition-colors">
                    <ChevronLeft size={24} />
                </button>
            </div>

            {/* Info Container */}
            <div className="relative z-20 max-w-5xl mx-auto px-4 -mt-16 pb-6">
                <div className="flex flex-col md:flex-row md:items-end gap-6">
                    {/* Logo */}
                    <div className="relative shrink-0 border-4 border-slate-950 rounded-2xl overflow-hidden bg-slate-900 shadow-2xl h-32 w-32 md:h-40 md:w-40">
                        <img
                            src="/logo-mmm.png" // We'll generate this
                            alt={sucursal?.nombre}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Business Info */}
                    <div className="flex-1 space-y-1">
                        <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">
                            {sucursal?.nombre || "MMM PIZZA"}
                        </h1>

                        <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-slate-400 text-[10px] uppercase font-bold tracking-[0.1em]">
                            <div className="flex items-center gap-1.5 px-0 py-1 rounded-md">
                                <Star size={12} className="text-orange-500 fill-orange-500" />
                                <span className="text-white">5.0</span>
                                <span className="text-slate-500">(5 reseñas)</span>
                            </div>
                            <span className="hidden md:inline text-slate-600">•</span>
                            <div className="flex items-center gap-1.5">
                                <MapPin size={16} className="text-slate-500" />
                                <span>{sucursal?.direccion || "Pizza Artesanal"}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="mt-6 flex flex-col gap-3">
                    <div className={`w-full py-2.5 rounded-xl text-center font-black text-[10px] tracking-[0.2em] uppercase transition-all ${isOpen
                        ? "bg-white/5 text-green-400 border border-green-500/20"
                        : "bg-red-500/10 text-red-500 border border-red-500/20"
                        }`}>
                        {isOpen ? "Abierto ahora" : "Cerrado • Abre a las 18:45"}
                    </div>

                    {/* Delivery/Retiro Switch */}
                    <div className="flex bg-white/5 p-1 rounded-[15px] border border-white/5 backdrop-blur-md">
                        <button className="flex-1 py-3 px-4 rounded-xl text-[10px] font-black tracking-[0.15em] bg-orange-600 text-white shadow-xl shadow-orange-600/20 transition-all uppercase">
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
