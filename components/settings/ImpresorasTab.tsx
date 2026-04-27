"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { Printer } from "lucide-react";

const FIXED_PRINTERS = [
    { id: "COCINA1", name: "COCINA 1" },
    { id: "COCINA2", name: "COCINA 2" },
    { id: "ENTRADA", name: "ENTRADA" },
    { id: "BARRA", name: "BARRA" },
    { id: "FACTURACION", name: "FACTURACIÓN" },
];

export function ImpresorasTab() {
    const [config, setConfig] = useState<Record<string, { enabled: boolean; ip: string }>>({});
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
                .from("config_sucursal")
                .select("panel_settings")
                .eq("sucursal_id", sucursalId)
                .maybeSingle();

            const dbConfig = data?.panel_settings?.impresoras || {};
            
            // Initialize with defaults for all fixed printers
            const initialConfig: Record<string, { enabled: boolean; ip: string }> = {};
            FIXED_PRINTERS.forEach(p => {
                initialConfig[p.id] = {
                    enabled: dbConfig[p.id]?.enabled ?? true,
                    ip: dbConfig[p.id]?.ip || ""
                };
            });
            setConfig(initialConfig);
        } catch (error) {
            console.error("Error cargando configuración de impresoras:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!sucursalId) return;
        setSaving(true);
        try {
            const { data: currentCfg } = await supabase
                .from("config_sucursal")
                .select("id, panel_settings")
                .eq("sucursal_id", sucursalId)
                .maybeSingle();

            if (currentCfg) {
                const newSettings = { 
                    ...(currentCfg.panel_settings || {}), 
                    impresoras: config 
                };
                await supabase
                    .from("config_sucursal")
                    .update({ panel_settings: newSettings })
                    .eq("id", currentCfg.id);
            }

            alert("Configuración de impresoras guardada");
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
            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        <Printer size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Impresoras del Sistema</h3>
                        <p className="text-sm text-gray-500">Configurá las impresoras disponibles para enviar comandas y tickets.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {FIXED_PRINTERS.map(printer => (
                        <div key={printer.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-purple-200 transition-colors bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={config[printer.id]?.enabled ?? true}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            [printer.id]: { ...config[printer.id], enabled: e.target.checked }
                                        })}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                                <div>
                                    <h4 className="font-bold text-gray-900">{printer.name}</h4>
                                    <p className="text-xs text-gray-500">
                                        ID interno: {printer.id}
                                    </p>
                                </div>
                            </div>
                            <div className="w-64">
                                <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">IP de red (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: 192.168.1.100"
                                    value={config[printer.id]?.ip || ""}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        [printer.id]: { ...config[printer.id], ip: e.target.value }
                                    })}
                                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    {saving ? "Guardando..." : "Guardar impresoras"}
                </button>
            </div>
        </div>
    );
}
