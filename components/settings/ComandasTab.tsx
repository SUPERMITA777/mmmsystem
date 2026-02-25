"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export function ComandasTab() {
    const [config, setConfig] = useState({
        fuente_titulo: 22,
        fuente_subtitulo: 15,
        fuente_cliente_nombre: 19,
        fuente_cliente_detalles: 13,
        fuente_direccion: 14,
        fuente_items: 15,
        fuente_totales: 14,
        fuente_total_bold: 18,
        fuente_footer: 12,
        mostrar_telefono: true,
        mostrar_direccion: true,
        mostrar_fecha_hora: true,
        color_accents: '#2563eb',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    async function loadConfig() {
        try {
            const { data } = await supabase
                .from("config_impresion")
                .select("*")
                .limit(1)
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
        } catch (error) {
            console.error("Error cargando configuración de impresión:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        try {
            const { data: sucursal } = await supabase.from("sucursales").select("id").limit(1).single();
            if (!sucursal) throw new Error("No se encontró sucursal");

            const { error } = await supabase
                .from("config_impresion")
                .upsert({
                    sucursal_id: sucursal.id,
                    ...config,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'sucursal_id' });

            if (error) throw error;
            alert("Configuración de comandos guardada");
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
            {/* Tamaños de Fuente */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Tamaños de Fuente (px)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Título (Delivery N°)</label>
                        <input type="number" value={config.fuente_titulo} onChange={(e) => setConfig({ ...config, fuente_titulo: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Subtítulo (Nombre Local)</label>
                        <input type="number" value={config.fuente_subtitulo} onChange={(e) => setConfig({ ...config, fuente_subtitulo: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nombre Cliente</label>
                        <input type="number" value={config.fuente_cliente_nombre} onChange={(e) => setConfig({ ...config, fuente_cliente_nombre: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Detalles Cliente (Tel/Mail)</label>
                        <input type="number" value={config.fuente_cliente_detalles} onChange={(e) => setConfig({ ...config, fuente_cliente_detalles: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Dirección</label>
                        <input type="number" value={config.fuente_direccion} onChange={(e) => setConfig({ ...config, fuente_direccion: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Items de Producto</label>
                        <input type="number" value={config.fuente_items} onChange={(e) => setConfig({ ...config, fuente_items: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Totales (Subtotal/Envío)</label>
                        <input type="number" value={config.fuente_totales} onChange={(e) => setConfig({ ...config, fuente_totales: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Total Grande (Negrita)</label>
                        <input type="number" value={config.fuente_total_bold} onChange={(e) => setConfig({ ...config, fuente_total_bold: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Footer / Fecha / Hora</label>
                        <input type="number" value={config.fuente_footer} onChange={(e) => setConfig({ ...config, fuente_footer: parseInt(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
                    </div>
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
