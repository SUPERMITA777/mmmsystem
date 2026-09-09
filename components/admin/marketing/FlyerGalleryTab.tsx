"use client";

import { useState, useEffect } from "react";
import {
    Download,
    Copy,
    Check,
    Trash2,
    Store,
    Calendar,
    Eye,
    Tag,
    Share2,
    Smartphone,
    Instagram,
    Loader2,
    Sparkles
} from "lucide-react";
import { GeneratedFlyer } from "./FlyerResultView";

interface FlyerGalleryTabProps {
    sucursalId: string;
    onGoToGenerator: () => void;
}

export default function FlyerGalleryTab({ sucursalId, onGoToGenerator }: FlyerGalleryTabProps) {
    const [flyers, setFlyers] = useState<GeneratedFlyer[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFlyer, setSelectedFlyer] = useState<GeneratedFlyer | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [settingAsPopupId, setSettingAsPopupId] = useState<string | null>(null);
    const [popupSuccessId, setPopupSuccessId] = useState<string | null>(null);

    useEffect(() => {
        if (sucursalId) {
            loadGallery();
        }
    }, [sucursalId]);

    async function loadGallery() {
        setLoading(true);
        try {
            const res = await fetch(`/api/marketing/flyers?sucursal_id=${sucursalId}`);
            const json = await res.json();
            if (json.success) {
                setFlyers(json.data || []);
            }
        } catch (err) {
            console.error("Error cargando galería de flyers:", err);
        } finally {
            setLoading(false);
        }
    }

    const handleCopy = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2500);
    };

    const handleDownload = async (flyer: GeneratedFlyer) => {
        try {
            const response = await fetch(flyer.imagen_url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `flyer_${flyer.producto_nombre.replace(/\s+/g, "_").toLowerCase()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            window.open(flyer.imagen_url, "_blank");
        }
    };

    const handleSetAsWebFlyer = async (flyer: GeneratedFlyer) => {
        setSettingAsPopupId(flyer.id);
        setPopupSuccessId(null);

        try {
            const res = await fetch("/api/flyer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursal_id: sucursalId,
                    imagen_url: flyer.imagen_url,
                    es_eterno: true,
                    activo: true,
                }),
            });

            const json = await res.json();
            if (json.success) {
                setPopupSuccessId(flyer.id);
                setTimeout(() => setPopupSuccessId(null), 3500);
            } else {
                alert("No se pudo activar el flyer: " + (json.message || "Error"));
            }
        } catch (err: any) {
            alert("Error al activar flyer: " + err.message);
        } finally {
            setSettingAsPopupId(null);
        }
    };

    const handleDelete = async (flyerId: string) => {
        if (!confirm("¿Estás seguro de eliminar este flyer del historial?")) return;

        try {
            const res = await fetch(`/api/marketing/flyers?id=${flyerId}&sucursal_id=${sucursalId}`, {
                method: "DELETE",
            });
            const json = await res.json();
            if (json.success) {
                setFlyers((prev) => prev.filter((f) => f.id !== flyerId));
                if (selectedFlyer?.id === flyerId) setSelectedFlyer(null);
            } else {
                alert("Error al eliminar: " + json.message);
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
                <Loader2 size={32} className="animate-spin text-[#7B1FA2] mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-700">Cargando galería de flyers generados...</p>
            </div>
        );
    }

    if (flyers.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#7B1FA2] flex items-center justify-center mx-auto shadow-inner">
                    <Sparkles size={32} />
                </div>
                <div className="max-w-md mx-auto">
                    <h3 className="text-lg font-bold text-gray-900">Aún no has generado ningún flyer</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Utilizá el Generador con Inteligencia Artificial para crear pósters promocionales atractivos para tus redes.
                    </p>
                </div>
                <button
                    onClick={onGoToGenerator}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7B1FA2] hover:bg-purple-700 text-white text-sm font-bold shadow-md transition-all active:scale-95"
                >
                    <Sparkles size={16} />
                    Crear mi Primer Flyer
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header de la galería */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Historial de Flyers Guardados</h3>
                    <p className="text-xs text-gray-500">
                        {flyers.length} {flyers.length === 1 ? "flyer disponible" : "flyers disponibles"} para reutilizar o publicar
                    </p>
                </div>
                <button
                    onClick={onGoToGenerator}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7B1FA2] text-xs font-bold transition-all border border-purple-200"
                >
                    <Sparkles size={15} />
                    Generar Nuevo Flyer
                </button>
            </div>

            {/* Grid de Flyers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {flyers.map((flyer) => {
                    const isStory = flyer.formato === "story_9_16";
                    return (
                        <div
                            key={flyer.id}
                            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                        >
                            {/* Visual Preview */}
                            <div className="relative bg-gray-900 overflow-hidden aspect-[9/16] max-h-72">
                                <img
                                    src={flyer.imagen_url}
                                    alt={flyer.producto_nombre}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />

                                {/* Formato badge */}
                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-medium text-white flex items-center gap-1 shadow">
                                    {isStory ? <Smartphone size={11} className="text-purple-300" /> : <Instagram size={11} className="text-pink-300" />}
                                    {isStory ? "Story" : "Feed"}
                                </div>

                                {/* Quick Inspect Overlay Button */}
                                <button
                                    onClick={() => setSelectedFlyer(flyer)}
                                    className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-[2px]"
                                >
                                    <Eye size={18} />
                                    Ver Detalle
                                </button>
                            </div>

                            {/* Info & Content */}
                            <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                                <div>
                                    <h4 className="font-bold text-sm text-gray-900 leading-snug line-clamp-1">
                                        {flyer.producto_nombre}
                                    </h4>
                                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                                        {flyer.precio ? (
                                            <span className="font-bold text-[#7B1FA2]">${flyer.precio.toLocaleString()}</span>
                                        ) : (
                                            <span className="text-gray-400">Promo general</span>
                                        )}
                                        <span className="text-[10px] capitalize text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                            {flyer.estilo}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons Toolbar */}
                                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1">
                                    <button
                                        onClick={() => handleDownload(flyer)}
                                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Descargar imagen"
                                    >
                                        <Download size={15} />
                                    </button>

                                    <button
                                        onClick={() => handleCopy(flyer.id, flyer.copy_social)}
                                        className={`p-2 rounded-lg transition-colors ${
                                            copiedId === flyer.id
                                                ? "text-green-600 bg-green-50"
                                                : "text-gray-500 hover:text-[#7B1FA2] hover:bg-purple-50"
                                        }`}
                                        title="Copiar texto de redes"
                                    >
                                        {copiedId === flyer.id ? <Check size={15} /> : <Copy size={15} />}
                                    </button>

                                    <button
                                        onClick={() => handleSetAsWebFlyer(flyer)}
                                        disabled={settingAsPopupId === flyer.id}
                                        className={`p-2 rounded-lg transition-colors ${
                                            popupSuccessId === flyer.id
                                                ? "text-green-600 bg-green-50"
                                                : "text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                        }`}
                                        title="Usar como Pop-up de la tienda web"
                                    >
                                        {popupSuccessId === flyer.id ? (
                                            <Check size={15} />
                                        ) : (
                                            <Store size={15} />
                                        )}
                                    </button>

                                    <button
                                        onClick={() => handleDelete(flyer.id)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar del historial"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal de Detalle Completo de Flyer */}
            {selectedFlyer && (
                <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-base">{selectedFlyer.producto_nombre}</h3>
                            <button
                                onClick={() => setSelectedFlyer(null)}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="rounded-xl overflow-hidden bg-gray-900 shadow-md max-h-80 flex items-center justify-center">
                                <img
                                    src={selectedFlyer.imagen_url}
                                    alt={selectedFlyer.producto_nombre}
                                    className="max-h-80 w-auto object-contain"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-700 uppercase">Texto para Redes Sociales:</label>
                                <div className="bg-gray-50 p-3 rounded-xl text-xs text-gray-800 whitespace-pre-wrap max-h-40 overflow-y-auto border border-gray-200 select-all">
                                    {selectedFlyer.copy_social}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            <button
                                onClick={() => handleCopy(selectedFlyer.id, selectedFlyer.copy_social)}
                                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-1.5"
                            >
                                {copiedId === selectedFlyer.id ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                {copiedId === selectedFlyer.id ? "¡Texto Copiado!" : "Copiar Texto"}
                            </button>

                            <button
                                onClick={() => handleDownload(selectedFlyer)}
                                className="px-4 py-2 rounded-xl bg-[#7B1FA2] text-white text-xs font-bold hover:bg-purple-700 flex items-center gap-1.5 shadow"
                            >
                                <Download size={14} />
                                Descargar Flyer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
