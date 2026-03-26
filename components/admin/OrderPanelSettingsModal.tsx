"use client";

import { useState, useEffect } from "react";
import { X, Settings, Bell, MessageSquare, Monitor, Printer, Upload, Music, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface PanelSettings {
    columnas: string[];
    ocultar_mapa_delivery: boolean;
    ocultar_mapa_mesas: boolean;
    ocultar_pedidos_pago_pendiente: boolean;
    sonido_notificacion: string;
    notificacion_sonora: boolean;
    sonido_notificacion_custom_url?: string;
    whatsapp_templates: {
        confirmado: string;
        listo: string;
        entregado: string;
    };
    promo_qr_text?: string;
    promo_qr_image_url?: string;
}

interface OrderPanelSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSettingsUpdated: (settings: PanelSettings) => void;
    configId: string | null;
    initialSettings: PanelSettings | null;
}

export default function OrderPanelSettingsModal({
    isOpen,
    onClose,
    onSettingsUpdated,
    configId,
    initialSettings
}: OrderPanelSettingsModalProps) {
    const [settings, setSettings] = useState<PanelSettings>({
        columnas: ["pendiente", "preparando", "listo"],
        ocultar_mapa_delivery: false,
        ocultar_mapa_mesas: true,
        ocultar_pedidos_pago_pendiente: false,
        sonido_notificacion: "campana_1",
        notificacion_sonora: true,
        whatsapp_templates: {
            confirmado: "¡Hola! Tu pedido ya fue confirmado y se encuentra en preparación. Te avisaremos cuando esté en camino!",
            listo: "TU PEDIDO YA ESTÁ LISTO Y EN CAMINO A TU DOMICILIO. QUE LO DISFRUTES!!!",
            entregado: "¡Gracias por elegirnos! Esperamos que hayas disfrutado tu pedido."
        },
        promo_qr_text: "#GRACIAS POR ELEGIRNOS"
    });
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (initialSettings) {
            setSettings(initialSettings);
        }
    }, [initialSettings]);

    if (!isOpen) return null;

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.includes("audio/") && !file.name.endsWith(".mp3")) {
            alert("Por favor, sube un archivo de audio válido (.mp3, .wav, etc)");
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `notification-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `notifications/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('images')
                .getPublicUrl(filePath);

            setSettings({ ...settings, sonido_notificacion_custom_url: publicUrl });
        } catch (error: any) {
            alert("Error subiendo el archivo: " + error.message);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    async function handleSave() {
        if (!configId) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from("config_sucursal")
                .update({ panel_settings: settings })
                .eq("id", configId);

            if (error) throw error;
            onSettingsUpdated(settings);
            onClose();
        } catch (error) {
            console.error("Error saving settings:", error);
            alert("Error al guardar la configuración.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Settings className="text-[#7B1FA2]" size={18} />
                        <h2 className="text-lg font-bold text-gray-800">Ajustes del panel de pedidos</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Generales */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <Monitor size={14} /> <span>Generales</span>
                        </div>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={!settings.ocultar_mapa_mesas}
                                    onChange={e => setSettings({ ...settings, ocultar_mapa_mesas: !e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-[#7B1FA2] focus:ring-[#7B1FA2]"
                                />
                                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Mostrar mapa de mesas. (Sin modalidad activa)</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={settings.ocultar_mapa_delivery}
                                    onChange={e => setSettings({ ...settings, ocultar_mapa_delivery: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-[#7B1FA2] focus:ring-[#7B1FA2]"
                                />
                                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Ocultar mapa de delivery.</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={settings.ocultar_pedidos_pago_pendiente}
                                    onChange={e => setSettings({ ...settings, ocultar_pedidos_pago_pendiente: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-[#7B1FA2] focus:ring-[#7B1FA2]"
                                />
                                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Ocultar pedidos con pago pendiente (Mercado Pago vinculado)</span>
                            </label>
                        </div>
                    </section>

                    {/* Comandas */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <Printer size={14} /> <span>Comandas</span>
                        </div>
                        <p className="text-xs text-blue-500 bg-blue-50 p-3 rounded-lg border border-blue-100 italic">
                            Consulta el <span className="underline font-bold cursor-pointer">tutorial de impresión automática</span> para eliminar la ventana de confirmación.
                        </p>
                        {/* Opciones de comanda mockeadas por ahora */}
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 opacity-50">
                                <input type="checkbox" disabled className="w-5 h-5 rounded border-gray-300" />
                                <span className="text-sm text-gray-600">Imprimir al recibir el pedido.</span>
                            </label>
                            <label className="flex items-center gap-3 opacity-50">
                                <input type="checkbox" disabled className="w-5 h-5 rounded border-gray-300" />
                                <span className="text-sm text-gray-600">Imprimir al confirmar el pedido.</span>
                            </label>
                        </div>
                    </section>

                    {/* Notificaciones */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <Bell size={14} /> <span>Notificaciones</span>
                        </div>
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={settings.notificacion_sonora}
                                    onChange={e => setSettings({ ...settings, notificacion_sonora: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-[#7B1FA2] focus:ring-[#7B1FA2]"
                                />
                                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">Notificación sonora al recibir pedidos.</span>
                            </label>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400 uppercase font-bold px-1">Sonido</label>
                                    <select
                                        value={settings.sonido_notificacion}
                                        onChange={e => setSettings({ ...settings, sonido_notificacion: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7B1FA2]/20"
                                    >
                                        <option value="campana_1">🔔 Campana 1 (Clásica)</option>
                                        <option value="campana_2">🔔 Campana 2 (Doble)</option>
                                        <option value="burbuja">🫧 Burbuja (Moderno)</option>
                                        <option value="custom">🎵 MP3 Propio</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400 uppercase font-bold px-1">Repetir</label>
                                    <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none" disabled title="Próximamente">
                                        <option>No repetir</option>
                                        <option>1 vez</option>
                                        <option>Hasta ver el pedido</option>
                                    </select>
                                </div>
                            </div>

                            {settings.sonido_notificacion === "custom" && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200 bg-purple-50 border border-purple-100 rounded-2xl p-4">
                                    <div className="flex items-center gap-2">
                                        <Music size={14} className="text-purple-500" />
                                        <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Subir MP3 personalizado</span>
                                    </div>

                                    {settings.sonido_notificacion_custom_url ? (
                                        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
                                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg shrink-0">
                                                <Music size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-gray-900">Sonido cargado ✓</p>
                                                <p className="text-[10px] text-gray-400 truncate">{settings.sonido_notificacion_custom_url.split('/').pop()}</p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => {
                                                        const audio = new Audio(settings.sonido_notificacion_custom_url);
                                                        audio.play().catch(e => alert("Error al reproducir: " + e.message));
                                                    }}
                                                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors"
                                                >
                                                    ▶ Probar
                                                </button>
                                                <button
                                                    onClick={() => setSettings({ ...settings, sonido_notificacion_custom_url: "" })}
                                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar sonido"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => document.getElementById('sound-upload')?.click()}
                                            disabled={uploading}
                                            className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-purple-200 rounded-xl hover:border-purple-400 hover:bg-purple-100/50 transition-all text-purple-400 group bg-white"
                                        >
                                            {uploading ? (
                                                <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Upload size={24} className="group-hover:text-purple-600 transition-colors" />
                                                    <span className="text-xs font-bold group-hover:text-purple-700 transition-colors">Subir archivo .mp3 / .wav</span>
                                                    <span className="text-[10px] text-purple-300">Máx. recomendado: 500 KB</span>
                                                </>
                                            )}
                                        </button>
                                    )}

                                    <div className="flex items-center gap-2">
                                        <div className="h-px flex-1 bg-purple-200" />
                                        <span className="text-[10px] text-purple-400 font-bold uppercase">o pega una URL</span>
                                        <div className="h-px flex-1 bg-purple-200" />
                                    </div>

                                    <input
                                        type="text"
                                        value={settings.sonido_notificacion_custom_url || ""}
                                        onChange={e => setSettings({ ...settings, sonido_notificacion_custom_url: e.target.value })}
                                        placeholder="https://ejemplo.com/sonido.mp3"
                                        className="w-full bg-white border border-purple-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-300"
                                    />

                                    <input
                                        id="sound-upload"
                                        type="file"
                                        accept="audio/*,.mp3,.wav,.ogg"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            )}
                        </div>
                    </section>

                    {/* WhatsApp Notifications */}
                    <section className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <MessageSquare size={14} /> <span>Notificaciones por WhatsApp</span>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">De "Nuevo" a "En Preparación"</label>
                                <textarea
                                    value={settings.whatsapp_templates?.confirmado || ""}
                                    onChange={e => setSettings({
                                        ...settings,
                                        whatsapp_templates: { ...(settings.whatsapp_templates || {}), confirmado: e.target.value } as any
                                    })}
                                    className="w-full h-20 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-[#7B1FA2]/20 outline-none"
                                    placeholder="Mensaje al confirmar..."
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">De "En Preparación" a "Listo"</label>
                                <textarea
                                    value={settings.whatsapp_templates?.listo || ""}
                                    onChange={e => setSettings({
                                        ...settings,
                                        whatsapp_templates: { ...(settings.whatsapp_templates || {}), listo: e.target.value } as any
                                    })}
                                    className="w-full h-24 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold uppercase resize-none focus:ring-2 focus:ring-[#7B1FA2]/20 outline-none"
                                    placeholder="Mensaje al estar listo..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* Promo QR Web */}
                    <section className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                            <Monitor size={14} /> <span>Promo QR Web</span>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Texto debajo del QR (Impresión libre)</label>
                            <input
                                type="text"
                                value={settings.promo_qr_text || ""}
                                onChange={e => setSettings({ ...settings, promo_qr_text: e.target.value })}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7B1FA2]/20"
                                placeholder="#GRACIAS POR ELEGIRNOS"
                            />
                        </div>
                        <div className="space-y-1 mt-4">
                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Logo del ticket (Opcional)</label>
                            <div className="flex flex-col gap-3">
                                {settings.promo_qr_image_url ? (
                                    <div className="flex items-center gap-3 bg-purple-50 p-3 rounded-xl border border-purple-100">
                                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                            <img src={settings.promo_qr_image_url} alt="Logo preview" className="h-8 object-contain" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-900 truncate">Logo cargado</p>
                                        </div>
                                        <button
                                            onClick={() => setSettings({ ...settings, promo_qr_image_url: "" })}
                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => document.getElementById('logo-upload')?.click()}
                                        disabled={uploading}
                                        className="w-full flex flex-col items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-all text-gray-400 group"
                                    >
                                        {uploading ? (
                                            <div className="w-6 h-6 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Upload size={20} className="group-hover:text-purple-500" />
                                                <span className="text-xs font-bold group-hover:text-gray-700">Subir Logo (.png, .jpg)</span>
                                            </>
                                        )}
                                    </button>
                                )}
                                <input
                                    id="logo-upload"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setUploading(true);
                                        try {
                                            const fileExt = file.name.split('.').pop();
                                            const fileName = `logo-${Math.random().toString(36).substring(2)}.${fileExt}`;
                                            const filePath = `logos/${fileName}`;
                                            const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
                                            if (uploadError) throw uploadError;
                                            const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
                                            setSettings({ ...settings, promo_qr_image_url: publicUrl });
                                        } catch (error: any) {
                                            alert("Error subiendo el logo: " + error.message);
                                        } finally {
                                            setUploading(false);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-black text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                        {loading ? "Guardando..." : "Guardar cambios"}
                    </button>
                </div>
            </div>
        </div>
    );
}
