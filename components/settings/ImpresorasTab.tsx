"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { Printer, RefreshCw, Search, CheckCircle2, AlertCircle, Play, ChevronDown, Info } from "lucide-react";

const FIXED_PRINTERS = [
    { id: "COCINA1", name: "COCINA 1" },
    { id: "COCINA2", name: "COCINA 2" },
    { id: "ENTRADA", name: "ENTRADA" },
    { id: "BARRA", name: "BARRA" },
    { id: "FACTURACION", name: "FACTURACIÓN" },
];

const COMMON_BRIDGE_PORTS = [3000, 3001, 8080, 8000];

export function ImpresorasTab() {
    const [config, setConfig] = useState<Record<string, { enabled: boolean; ip: string; printerName: string }>>({});
    const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
    const [scanning, setScanning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);
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
            const initialConfig: Record<string, { enabled: boolean; ip: string; printerName: string }> = {};
            FIXED_PRINTERS.forEach(p => {
                initialConfig[p.id] = {
                    enabled: dbConfig[p.id]?.enabled ?? true,
                    ip: dbConfig[p.id]?.ip || "",
                    printerName: dbConfig[p.id]?.printerName || ""
                };
            });
            setConfig(initialConfig);
            
            // Try to auto-scan on load
            scanPrinters();
        } catch (error) {
            console.error("Error cargando configuración de impresoras:", error);
        } finally {
            setLoading(false);
        }
    }

    async function scanPrinters() {
        setScanning(true);
        try {
            // 1. Check Experimental Web Printing API
            if ('printing' in navigator) {
                try {
                    const printers = await (navigator as any).printing.getPrinters();
                    if (printers && printers.length > 0) {
                        setAvailablePrinters(printers.map((p: any) => p.name));
                        setScanning(false);
                        return;
                    }
                } catch (e) {}
            }

            // 2. Check Local Bridge
            for (const port of COMMON_BRIDGE_PORTS) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 800);
                    const res = await fetch(`http://localhost:${port}/printers`, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (res.ok) {
                        const data = await res.json();
                        if (Array.isArray(data)) {
                            setAvailablePrinters(data);
                            setScanning(false);
                            return;
                        }
                    }
                } catch (e) {}
            }
        } catch (error) {
            console.error("Error escaneando impresoras:", error);
        } finally {
            setScanning(false);
        }
    }

    async function handleTest(printerId: string) {
        setTestingId(printerId);
        const printer = config[printerId];
        if (!printer || !printer.enabled) {
            setTestingId(null);
            return;
        }

        try {
            // Try to send a test print through the bridge or browser
            if (printer.printerName) {
                // If we have a bridge, send test command
                let sent = false;
                for (const port of COMMON_BRIDGE_PORTS) {
                    try {
                        const res = await fetch(`http://localhost:${port}/print-test`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ printerName: printer.printerName })
                        });
                        if (res.ok) { sent = true; break; }
                    } catch (e) {}
                }
                if (sent) {
                    alert(`Prueba enviada a: ${printer.printerName}`);
                } else {
                    // Fallback to window.print mock logic or simple alert
                    alert(`Probando impresora "${printer.printerName}"... (Asegurate de que el puente esté activo)`);
                }
            } else if (printer.ip) {
                alert(`Probando conectividad con IP ${printer.ip}...`);
            } else {
                alert("Seleccioná una impresora para probar.");
            }
        } finally {
            setTestingId(null);
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
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Impresoras del Sistema</h3>
                            <p className="text-sm text-gray-500">Configurá las impresoras disponibles para enviar comandas y tickets.</p>
                        </div>
                    </div>
                    <button 
                        onClick={scanPrinters}
                        disabled={scanning}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
                        {scanning ? "Escaneando..." : "Escanear Impresoras"}
                    </button>
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
                            <div className="flex items-center gap-4 flex-1">
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Impresora del Sistema</label>
                                    <div className="relative mt-1">
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <select
                                                    value={availablePrinters.includes(config[printer.id]?.printerName || "") ? config[printer.id]?.printerName : "manual"}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val !== "manual") {
                                                            setConfig({
                                                                ...config,
                                                                [printer.id]: { ...config[printer.id], printerName: val }
                                                            });
                                                        }
                                                    }}
                                                    className="w-full pl-3 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none appearance-none"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {availablePrinters.map(p => (
                                                        <option key={p} value={p}>{p}</option>
                                                    ))}
                                                    <option value="manual">✎ Ingresar manualmente...</option>
                                                </select>
                                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                                    <ChevronDown size={14} />
                                                </div>
                                            </div>
                                            
                                            {(availablePrinters.length === 0 || !availablePrinters.includes(config[printer.id]?.printerName || "") || config[printer.id]?.printerName === "") && (
                                                <input
                                                    type="text"
                                                    placeholder="Nombre de Windows/Mac"
                                                    value={config[printer.id]?.printerName || ""}
                                                    onChange={(e) => setConfig({
                                                        ...config,
                                                        [printer.id]: { ...config[printer.id], printerName: e.target.value }
                                                    })}
                                                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="w-48">
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
                                <div className="pt-5">
                                    <button
                                        onClick={() => handleTest(printer.id)}
                                        disabled={testingId === printer.id || !config[printer.id]?.enabled}
                                        className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-200 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                                        title="Probar impresora"
                                    >
                                        {testingId === printer.id ? (
                                            <RefreshCw size={16} className="animate-spin text-purple-600" />
                                        ) : (
                                            <Play size={16} className="group-hover:scale-110 transition-transform" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-sm"
                >
                    {saving ? "Guardando..." : "Guardar Configuración"}
                </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                <Info className="text-blue-500 shrink-0" size={20} />
                <div className="text-sm text-blue-800 space-y-2">
                    <p className="font-bold">¿No aparecen tus impresoras?</p>
                    <ul className="list-disc ml-4 space-y-1">
                        <li>Asegurate de tener el <b>Puente de Impresión MMM</b> instalado y ejecutándose en esta PC.</li>
                        <li>Si usas Google Chrome, podés habilitar la detección nativa en: <code className="bg-blue-100 px-1 rounded text-[12px]">chrome://flags/#enable-web-printing</code></li>
                        <li>También podés escribir el nombre exacto de la impresora (como figura en Windows) manualmente.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
