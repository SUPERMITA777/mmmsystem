"use client";

import { useState } from "react";
import {
    Download,
    Copy,
    Check,
    Share2,
    Store,
    RefreshCw,
    ExternalLink,
    Sparkles,
    Smartphone,
    Instagram,
    Eye,
    Pencil,
    Loader2,
    Wand2
} from "lucide-react";

export interface GeneratedFlyer {
    id: string;
    imagen_url: string;
    copy_social: string;
    producto_nombre: string;
    precio?: number | null;
    ingredientes?: string;
    estilo: string;
    formato: string;
    created_at?: string;
}

interface FlyerResultViewProps {
    flyer: GeneratedFlyer;
    sucursalId: string;
    onReset: () => void;
    onFlyerUpdated?: (flyer: GeneratedFlyer) => void;
}

export default function FlyerResultView({ flyer, sucursalId, onReset, onFlyerUpdated }: FlyerResultViewProps) {
    const [copied, setCopied] = useState(false);
    const [settingAsPopup, setSettingAsPopup] = useState(false);
    const [popupSuccess, setPopupSuccess] = useState(false);
    const [fullImageModal, setFullImageModal] = useState(false);
    const [correctionText, setCorrectionText] = useState("");
    const [correcting, setCorrecting] = useState(false);
    const [correctionError, setCorrectionError] = useState("");

    const handleCopyText = () => {
        if (!flyer.copy_social) return;
        navigator.clipboard.writeText(flyer.copy_social);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownload = async () => {
        try {
            const response = await fetch(flyer.imagen_url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = `flyer_${flyer.producto_nombre.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            // Fallback si CORS bloquea el blob
            window.open(flyer.imagen_url, "_blank");
        }
    };

    const handleShareWhatsApp = () => {
        const text = encodeURIComponent(
            `${flyer.copy_social}\n\n👉 Mirá la imagen promocional aquí: ${flyer.imagen_url}`
        );
        window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
    };

    const handleSetAsWebFlyer = async () => {
        if (!sucursalId) return;
        setSettingAsPopup(true);
        setPopupSuccess(false);

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
                setPopupSuccess(true);
                setTimeout(() => setPopupSuccess(false), 4000);
            } else {
                alert("No se pudo activar el flyer en la tienda: " + (json.message || "Error"));
            }
        } catch (err: any) {
            alert("Error al conectar con la API de flyers: " + err.message);
        } finally {
            setSettingAsPopup(false);
        }
    };

    const isStory = flyer.formato === "story_9_16";

    const handleCorrection = async () => {
        if (!correctionText.trim() || correcting) return;
        setCorrecting(true);
        setCorrectionError("");

        try {
            // Download current flyer image as base64 for reference
            const imgRes = await fetch(flyer.imagen_url);
            const imgBlob = await imgRes.blob();
            const imgBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(imgBlob);
            });

            const res = await fetch("/api/marketing/flyer/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursal_id: sucursalId,
                    producto_nombre: flyer.producto_nombre,
                    precio: flyer.precio,
                    ingredientes: flyer.ingredientes,
                    estilo: flyer.estilo,
                    formato: flyer.formato,
                    correccion: correctionText.trim(),
                    imagen_origen_url: flyer.imagen_url,
                    flyer_origen_id: flyer.id,
                    imagenes_referencia: [{
                        data: imgBase64,
                        mimeType: "image/png",
                        tipo: "Flyer Original",
                        nombre: "Flyer a corregir",
                    }],
                }),
            });

            const json = await res.json();
            if (json.success && json.flyer) {
                setCorrectionText("");
                if (onFlyerUpdated) {
                    onFlyerUpdated(json.flyer);
                }
            } else {
                setCorrectionError(json.message || "Error al aplicar correcciones");
            }
        } catch (err: any) {
            setCorrectionError(err.message || "Error de conexión");
        } finally {
            setCorrecting(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-900 to-[#7B1FA2] text-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-amber-300">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-base leading-tight">¡Flyer Generado con Éxito!</h3>
                        <p className="text-xs text-purple-100/80">
                            Listo para publicar en redes sociales o promocionar en tu tienda web
                        </p>
                    </div>
                </div>

                <button
                    onClick={onReset}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-sm transition-all text-white active:scale-95"
                >
                    <RefreshCw size={14} />
                    Crear Otro Flyer
                </button>
            </div>

            {/* Content Body */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Visualizer Column */}
                <div className="lg:col-span-6 flex flex-col items-center">
                    <div className="relative group w-full max-w-sm rounded-2xl overflow-hidden border-2 border-purple-100 shadow-xl bg-gray-900">
                        {/* Smartphone mockup badge */}
                        <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-medium text-white flex items-center gap-1.5 shadow">
                            {isStory ? <Smartphone size={13} className="text-purple-300" /> : <Instagram size={13} className="text-pink-300" />}
                            {isStory ? "Story / Estado (9:16)" : flyer.formato === "post_4_5" ? "Post Retrato (4:5)" : "Post Cuadrado (1:1)"}
                        </div>

                        {/* Full view trigger button */}
                        <button
                            onClick={() => setFullImageModal(true)}
                            className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 backdrop-blur-md p-1.5 rounded-full text-white transition-all shadow opacity-80 hover:opacity-100"
                            title="Ver en pantalla completa"
                        >
                            <Eye size={16} />
                        </button>

                        {/* The Image */}
                        <img
                            src={flyer.imagen_url}
                            alt={flyer.producto_nombre}
                            className={`w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                                isStory ? "aspect-[9/16]" : flyer.formato === "post_4_5" ? "aspect-[4/5]" : "aspect-square"
                            }`}
                        />

                        {/* Quick Overlay Action Bar */}
                        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between text-white">
                            <div>
                                <p className="font-bold text-sm leading-tight text-white drop-shadow">
                                    {flyer.producto_nombre}
                                </p>
                                {flyer.precio && (
                                    <p className="text-xs text-amber-300 font-semibold drop-shadow">
                                        ${flyer.precio.toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={handleDownload}
                                className="px-3 py-1.5 rounded-lg bg-[#7B1FA2] hover:bg-purple-600 text-xs font-bold shadow-lg transition-colors flex items-center gap-1"
                            >
                                <Download size={14} />
                                Descargar
                            </button>
                        </div>
                    </div>

                    <p className="text-xs text-gray-400 mt-2.5 text-center">
                        Generado en alta resolución PNG lista para impresión digital o redes
                    </p>
                </div>

                {/* Copy & Actions Column */}
                <div className="lg:col-span-6 flex flex-col space-y-5">
                    {/* Copy Box */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                📝 Copy sugerido para redes
                            </span>
                            <button
                                onClick={handleCopyText}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    copied
                                        ? "bg-green-600 text-white shadow-sm"
                                        : "bg-purple-100 text-[#7B1FA2] hover:bg-purple-200"
                                }`}
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? "¡Copiado!" : "Copiar Texto"}
                            </button>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-gray-200 text-sm text-gray-800 font-sans whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto custom-scrollbar select-all">
                            {flyer.copy_social}
                        </div>
                    </div>

                    {/* Quick Publishing Actions */}
                    <div className="space-y-2.5">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Acciones de Publicación
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Download Button */}
                            <button
                                onClick={handleDownload}
                                className="flex items-center justify-center gap-2 p-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm shadow transition-all active:scale-95"
                            >
                                <Download size={16} />
                                Descargar PNG
                            </button>

                            {/* Share to WhatsApp */}
                            <button
                                onClick={handleShareWhatsApp}
                                className="flex items-center justify-center gap-2 p-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-sm shadow transition-all active:scale-95"
                            >
                                <Share2 size={16} />
                                Enviar por WhatsApp
                            </button>
                        </div>

                        {/* Set as Web Store Popup Flyer */}
                        <div className="pt-2">
                            <button
                                onClick={handleSetAsWebFlyer}
                                disabled={settingAsPopup}
                                className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-sm transition-all border ${
                                    popupSuccess
                                        ? "bg-green-50 border-green-300 text-green-700"
                                        : "bg-purple-50 hover:bg-purple-100 border-purple-200 text-[#7B1FA2]"
                                } disabled:opacity-50`}
                            >
                                {settingAsPopup ? (
                                    <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                ) : popupSuccess ? (
                                    <Check size={18} className="text-green-600" />
                                ) : (
                                    <Store size={18} />
                                )}
                                {popupSuccess
                                    ? "¡Flyer activado como pop-up en la tienda online!"
                                    : "Establecer como Flyer de la Tienda Web (Pop-up)"}
                            </button>
                            <p className="text-[11px] text-gray-500 mt-1 text-center">
                                Se mostrará a los clientes cuando entren a tu menú digital
                            </p>
                        </div>
                    </div>

                    {/* Correcciones con IA */}
                    <div className="bg-amber-50/60 rounded-xl p-4 border border-amber-200/60 space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                                <Wand2 size={15} />
                            </div>
                            <div>
                                <span className="text-xs font-bold text-gray-800 block">Correcciones con IA</span>
                                <span className="text-[11px] text-gray-500">
                                    Describí los cambios y se generará una versión corregida
                                </span>
                            </div>
                        </div>

                        <textarea
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                            placeholder='Ej: El texto dice "Piza", debería ser "Pizza". Hacé el logo más grande. Cambiá el fondo a más oscuro...'
                            className="w-full p-3 rounded-xl border border-amber-200 bg-white text-sm text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition-all"
                            rows={3}
                            disabled={correcting}
                        />

                        {correctionError && (
                            <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                                {correctionError}
                            </p>
                        )}

                        <button
                            onClick={handleCorrection}
                            disabled={!correctionText.trim() || correcting}
                            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        >
                            {correcting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Aplicando correcciones con IA...
                                </>
                            ) : (
                                <>
                                    <Wand2 size={16} />
                                    Corregir con IA
                                </>
                            )}
                        </button>
                    </div>

                    {/* Metadata summary */}
                    <div className="p-3 bg-gray-50/60 rounded-xl border border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-500">
                        <span>
                            Estilo: <strong className="text-gray-700 capitalize">{flyer.estilo}</strong>
                        </span>
                        <span>
                            Formato: <strong className="text-gray-700 uppercase">{flyer.formato.replace(/_/g, " ")}</strong>
                        </span>
                        {flyer.precio && (
                            <span>
                                Precio: <strong className="text-gray-700">${flyer.precio}</strong>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Pantalla Completa */}
            {fullImageModal && (
                <div
                    onClick={() => setFullImageModal(false)}
                    className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
                >
                    <div className="relative max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl bg-black">
                        <img
                            src={flyer.imagen_url}
                            alt={flyer.producto_nombre}
                            className="max-h-[85vh] w-auto object-contain mx-auto"
                        />
                        <button
                            onClick={() => setFullImageModal(false)}
                            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md"
                        >
                            Cerrar ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
