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
                    <div className="flex-1 space-y-2">
                        <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                            {sucursal?.nombre || "MMM PIZZA"}
                        </h1>

                        <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-slate-300 text-sm md:text-base">
                            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-md backdrop-blur-sm">
                                <Star size={16} className="text-orange-500 fill-orange-500" />
                                <span className="font-bold text-white">5.0</span>
                                <span className="text-slate-400 font-medium">De 5 reseñas</span>
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
                <div className="mt-8 flex flex-col gap-4">
                    <div className={`w-full py-2.5 rounded-xl text-center font-bold text-sm tracking-widest uppercase transition-all shadow-lg ${isOpen
                            ? "bg-green-500/10 text-green-500 border border-green-500/20"
                            : "bg-red-500 text-white border border-red-400/20 shadow-red-500/20"
                        }`}>
                        {isOpen ? "Abierto ahora" : "Cerrado • Abre a las 18:45"}
                    </div>

                    {/* Delivery/Retiro Switch */}
                    <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 backdrop-blur-md">
                        <button className="flex-1 py-2.5 px-4 rounded-lg text-sm font-bold bg-orange-600 text-white shadow-lg shadow-orange-600/20 transition-all">
                            DELIVERY
                        </button>
                        <button className="flex-1 py-2.5 px-4 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition-all">
                            RETIRAR
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
