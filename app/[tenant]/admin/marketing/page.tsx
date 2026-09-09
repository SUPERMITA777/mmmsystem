"use client";

import { useState } from "react";
import { useTenant } from "@/context/TenantContext";
import { Sparkles, Image as ImageIcon, Settings2, Megaphone, Loader2 } from "lucide-react";
import FlyerGeneratorTab from "@/components/admin/marketing/FlyerGeneratorTab";
import FlyerGalleryTab from "@/components/admin/marketing/FlyerGalleryTab";
import MarketingConfigTab from "@/components/admin/marketing/MarketingConfigTab";

export default function MarketingPage() {
    const { sucursalId, loading: tenantLoading } = useTenant();
    const [activeTab, setActiveTab] = useState<"generator" | "gallery" | "config">("generator");

    if (tenantLoading || !sucursalId) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-[#7B1FA2] mb-3" size={32} />
                <p className="text-sm font-semibold text-gray-600">Cargando Centro de Marketing...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Top Banner Header */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-gray-900 via-purple-950 to-[#7B1FA2] text-white p-6 sm:p-8 shadow-xl">
                <div className="relative z-10 max-w-2xl space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-purple-200 text-xs font-bold border border-white/10">
                        <Sparkles size={14} className="text-amber-300" />
                        Centro de Marketing & Redes Sociales
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                        Generador de Flyers con IA
                    </h1>
                    <p className="text-sm text-purple-100/80 leading-relaxed">
                        Crea pósters gastronómicos de alta definición y textos persuasivos para Instagram, WhatsApp y tu tienda online extrayendo los productos directamente de tu carta.
                    </p>
                </div>

                {/* Decorative background glow */}
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-purple-500/20 to-transparent pointer-events-none" />
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto custom-scrollbar">
                <button
                    onClick={() => setActiveTab("generator")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === "generator"
                            ? "bg-[#7B1FA2] text-white shadow-md shadow-purple-200"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                >
                    <Sparkles size={16} className={activeTab === "generator" ? "text-amber-300" : "text-purple-600"} />
                    Generador con IA
                </button>

                <button
                    onClick={() => setActiveTab("gallery")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === "gallery"
                            ? "bg-[#7B1FA2] text-white shadow-md shadow-purple-200"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                >
                    <ImageIcon size={16} className={activeTab === "gallery" ? "text-white" : "text-gray-500"} />
                    Galería de Flyers
                </button>

                <button
                    onClick={() => setActiveTab("config")}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                        activeTab === "config"
                            ? "bg-[#7B1FA2] text-white shadow-md shadow-purple-200"
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                >
                    <Settings2 size={16} className={activeTab === "config" ? "text-white" : "text-gray-500"} />
                    Configuración & IA
                </button>
            </div>

            {/* Active Tab Content */}
            <div className="min-h-[500px]">
                {activeTab === "generator" && (
                    <FlyerGeneratorTab sucursalId={sucursalId} />
                )}

                {activeTab === "gallery" && (
                    <FlyerGalleryTab
                        sucursalId={sucursalId}
                        onGoToGenerator={() => setActiveTab("generator")}
                    />
                )}

                {activeTab === "config" && (
                    <MarketingConfigTab />
                )}
            </div>
        </div>
    );
}
