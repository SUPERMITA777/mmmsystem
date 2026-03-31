"use client";

import { MapPin, Phone, MessageCircle, Share2, Info } from "lucide-react";

interface AlternativoHeaderProps {
    sucursal: any;
    isOpen: boolean;
    statusMessage?: string;
    textoDelivery?: string;
    textoTakeaway?: string;
    bannerUrl?: string;
    descripcion?: string;
}

export default function AlternativoHeader({
    sucursal,
    isOpen,
    statusMessage,
    textoDelivery = "DELIVERY",
    textoTakeaway = "RETIRO",
    bannerUrl,
    descripcion,
}: AlternativoHeaderProps) {
    
    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: sucursal?.nombre,
                    text: descripcion || "Mira nuestro menú online",
                    url: window.location.href,
                });
            } catch (err) {
                console.error("Error sharing", err);
            }
        }
    };

    return (
        <header className="relative w-full bg-[#f8f9fa] pb-4">
            {/* Banner hero */}
            <div className="relative w-full h-48 sm:h-64 bg-slate-300 overflow-hidden">
                {bannerUrl ? (
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full bg-gradient-to-r from-[var(--color-primario)] to-[#ff8c42]"></div>
                )}
                
                {/* Status Badge floating */}
                <div className="absolute top-4 right-4 flex gap-2">
                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide uppercase shadow-lg ${isOpen ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
                        {statusMessage || (isOpen ? "Abierto" : "Cerrado")}
                    </div>
                </div>
            </div>

            {/* Profile Card Overlay */}
            <div className="relative z-20 px-4 -mt-16 sm:-mt-20 max-w-2xl mx-auto">
                <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] p-6 pt-0 flex flex-col items-center text-center">
                    
                    {/* Logo (overlapping) */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white overflow-hidden bg-white shadow-xl -mt-12 sm:-mt-14 mb-3 flex-shrink-0">
                        {sucursal?.logo_url ? (
                            <img src={sucursal.logo_url} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white bg-[var(--color-primario)]">
                                {sucursal?.nombre?.charAt(0) || "M"}
                            </div>
                        )}
                    </div>

                    <h1 className="text-2xl font-black text-gray-900 mb-1">{sucursal?.nombre || "Tu Negocio"}</h1>
                    {descripcion && <p className="text-sm text-gray-500 mb-4 font-medium italic">{descripcion}</p>}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-center gap-6 mt-2 mb-2 w-full">
                        {sucursal?.whatsapp_numero && (
                            <a 
                                href={`https://wa.me/${sucursal.whatsapp_numero.replace(/\D/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex flex-col items-center gap-1.5 group"
                            >
                                <div className="w-11 h-11 rounded-full bg-green-50 flex items-center justify-center text-green-500 group-hover:bg-green-100 transition-colors">
                                    <MessageCircle size={20} fill="currentColor" />
                                </div>
                                <span className="text-[10px] font-bold text-gray-400">WhatsApp</span>
                            </a>
                        )}
                        <button onClick={handleShare} className="flex flex-col items-center gap-1.5 group">
                            <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition-colors">
                                <Share2 size={20} />
                            </div>
                            <span className="text-[10px] font-bold text-gray-400">Compartir</span>
                        </button>
                        <button className="flex flex-col items-center gap-1.5 group">
                            <div className="w-11 h-11 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 group-hover:bg-gray-100 transition-colors">
                                <Info size={20} />
                            </div>
                            <span className="text-[10px] font-bold text-gray-400">Info</span>
                        </button>
                    </div>

                    {/* Delivery / Retiro Toggle */}
                    <div className="mt-4 w-full flex bg-gray-100 p-1 rounded-2xl">
                        <button
                            className="flex-1 py-3 px-4 rounded-xl text-xs font-black tracking-wider text-white shadow-sm transition-all uppercase"
                            style={{ backgroundColor: 'var(--color-primario, #f97316)' }}
                        >
                            {textoDelivery}
                        </button>
                        <button className="flex-1 py-3 px-4 rounded-xl text-xs font-black tracking-wider text-gray-500 hover:text-gray-800 transition-all uppercase">
                            {textoTakeaway}
                        </button>
                    </div>

                </div>
            </div>
        </header>
    );
}
