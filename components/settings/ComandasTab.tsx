"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";

const FONT_ITEMS = [
    { key: "fuente_titulo", label: "Título (Delivery N°)" },
    { key: "fuente_subtitulo", label: "Subtítulo (Nombre Local)" },
    { key: "fuente_cliente_nombre", label: "Nombre Cliente" },
    { key: "fuente_cliente_detalles", label: "Detalles Cliente (Tel/Mail)" },
    { key: "fuente_direccion", label: "Dirección" },
    { key: "fuente_items", label: "Items de Producto" },
    { key: "fuente_adicionales", label: "Adicionales" },
    { key: "fuente_totales", label: "Totales (Subtotal/Envío)" },
    { key: "fuente_total_bold", label: "Total Grande" },
    { key: "fuente_footer", label: "Footer / Fecha / Hora" },
];

const DEFAULT_BOLD: Record<string, boolean> = {
    fuente_titulo: true,
    fuente_subtitulo: true,
    fuente_cliente_nombre: true,
    fuente_cliente_detalles: false,
    fuente_direccion: false,
    fuente_items: false,
    fuente_adicionales: false,
    fuente_totales: false,
    fuente_total_bold: true,
    fuente_footer: false,
};

export function ComandasTab() {
    const [config, setConfig] = useState<Record<string, any>>({
        fuente_titulo: 22,
        fuente_subtitulo: 15,
        fuente_cliente_nombre: 19,
        fuente_cliente_detalles: 13,
        fuente_direccion: 14,
        fuente_items: 15,
        fuente_adicionales: 12,
        fuente_totales: 14,
        fuente_total_bold: 18,
        fuente_footer: 12,
        mostrar_telefono: true,
        mostrar_direccion: true,
        mostrar_fecha_hora: true,
        color_accents: '#2563eb',
    });
    const [boldMap, setBoldMap] = useState<Record<string, boolean>>({ ...DEFAULT_BOLD });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { sucursalId } = useTenant();

    useEffect(() => {
        if (sucursalId) loadConfig();
    }, [sucursalId]);

    async function loadConfig() {
        if (!sucursalId) return;
        try {
            const { data } = await supabase
                .from("config_impresion")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .maybeSingle();

            if (data) {
                setConfig({
                    fuente_titulo: data.fuente_titulo ?? 22,
                    fuente_subtitulo: data.fuente_subtitulo ?? 15,
                    fuente_cliente_nombre: data.fuente_cliente_nombre ?? 19,
                    fuente_cliente_detalles: data.fuente_cliente_detalles ?? 13,
                    fuente_direccion: data.fuente_direccion ?? 14,
                    fuente_items: data.fuente_items ?? 15,
                    fuente_totales: data.fuente_totales ?? 14,
                    fuente_total_bold: data.fuente_total_bold ?? 18,
                    fuente_footer: data.fuente_footer ?? 12,
                    mostrar_telefono: data.mostrar_telefono ?? true,
                    mostrar_direccion: data.mostrar_direccion ?? true,
                    mostrar_fecha_hora: data.mostrar_fecha_hora ?? true,
                    color_accents: data.color_accents ?? '#2563eb',
                });
            }

            // Load bold settings + fuente_adicionales from config_sucursal.panel_settings
            const { data: suc } = await supabase.from("config_sucursal").select("panel_settings").eq("sucursal_id", sucursalId).maybeSingle();
            if (suc?.panel_settings?.print_bold) {
                setBoldMap({ ...DEFAULT_BOLD, ...suc.panel_settings.print_bold });
            }
            if (suc?.panel_settings?.fuente_adicionales) {
                setConfig(prev => ({ ...prev, fuente_adicionales: suc.panel_settings.fuente_adicionales }));
            }
        } catch (error) {
            console.error("Error cargando configuración de impresión:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!sucursalId) return;
        setSaving(true);
        try {
            // Save font sizes and visibility to config_impresion (only known DB columns)
            const { error } = await supabase
                .from("config_impresion")
                .upsert({
                    sucursal_id: sucursalId,
                    fuente_titulo: config.fuente_titulo,
                    fuente_subtitulo: config.fuente_subtitulo,
                    fuente_cliente_nombre: config.fuente_cliente_nombre,
                    fuente_cliente_detalles: config.fuente_cliente_detalles,
                    fuente_direccion: config.fuente_direccion,
                    fuente_items: config.fuente_items,
                    fuente_totales: config.fuente_totales,
                    fuente_total_bold: config.fuente_total_bold,
                    fuente_footer: config.fuente_footer,
                    mostrar_telefono: config.mostrar_telefono,
                    mostrar_direccion: config.mostrar_direccion,
                    mostrar_fecha_hora: config.mostrar_fecha_hora,
                    color_accents: config.color_accents,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'sucursal_id' });
            if (error) throw error;

            // Save bold settings + fuente_adicionales to config_sucursal.panel_settings (JSON column)
            const { data: currentCfg } = await supabase.from("config_sucursal").select("id, panel_settings").eq("sucursal_id", sucursalId).maybeSingle();
            if (currentCfg) {
                const newSettings = { ...(currentCfg.panel_settings || {}), print_bold: boldMap, fuente_adicionales: config.fuente_adicionales };
                await supabase.from("config_sucursal").update({ panel_settings: newSettings }).eq("id", currentCfg.id);
            }

            alert("Configuración de comandas guardada");
        } catch (error) {
            console.error(error);
            alert("Error al guardar la configuración");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="text-center py-8 text-slate-500">Cargando...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Tamaños de Fuente + Negrita */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Tamaños de Fuente (px)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {FONT_ITEMS.map(item => (
                        <div key={item.key}>
                            <label className="block text-sm font-medium text-slate-700 mb-2">{item.label}</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={config[item.key]}
                                    onChange={(e) => setConfig({ ...config, [item.key]: parseInt(e.target.value) })}
                                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                />
                                <label className="flex items-center gap-1.5 cursor-pointer shrink-0 px-2 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" title="Negrita">
                                    <span className="text-xs font-black text-slate-500">B</span>
                                    <input
                                        type="checkbox"
                                        checked={boldMap[item.key] ?? false}
                                        onChange={(e) => setBoldMap({ ...boldMap, [item.key]: e.target.checked })}
                                        className="w-4 h-4 text-purple-600 rounded"
                                    />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Visibilidad y Colores */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Visibilidad y Estilo</h3>
                <div className="space-y-4">
                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <div>
                            <span className="font-medium">Mostrar teléfono del cliente</span>
                            <p className="text-sm text-slate-500">Incluye el número de WhatsApp en el ticket</p>
                        </div>
                        <input type="checkbox" checked={config.mostrar_telefono} onChange={(e) => setConfig({ ...config, mostrar_telefono: e.target.checked })} className="w-5 h-5 text-purple-600 rounded" />
                    </label>

                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <div>
                            <span className="font-medium">Mostrar dirección</span>
                            <p className="text-sm text-slate-500">Incluye la dirección de entrega en el ticket</p>
                        </div>
                        <input type="checkbox" checked={config.mostrar_direccion} onChange={(e) => setConfig({ ...config, mostrar_direccion: e.target.checked })} className="w-5 h-5 text-purple-600 rounded" />
                    </label>

                    <label className="flex items-center justify-between p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <div>
                            <span className="font-medium">Mostrar fecha y hora</span>
                            <p className="text-sm text-slate-500">Incluye el momento de creación del pedido</p>
                        </div>
                        <input type="checkbox" checked={config.mostrar_fecha_hora} onChange={(e) => setConfig({ ...config, mostrar_fecha_hora: e.target.checked })} className="w-5 h-5 text-purple-600 rounded" />
                    </label>

                    <div className="p-3 border border-slate-200 rounded-lg">
                        <label className="block font-medium mb-1">Color de acento (Footer)</label>
                        <p className="text-sm text-slate-500 mb-3">Color para el texto "Comprobante no válido..."</p>
                        <div className="flex items-center gap-3">
                            <input type="color" value={config.color_accents} onChange={(e) => setConfig({ ...config, color_accents: e.target.value })} className="w-10 h-10 border-0 p-0 cursor-pointer" />
                            <input type="text" value={config.color_accents} onChange={(e) => setConfig({ ...config, color_accents: e.target.value })} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? "Guardando..." : "Guardar cambios"}
                </button>
            </div>
        </div>
    );
}
