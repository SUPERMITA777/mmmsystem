"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { Printer, RefreshCw, Play, ChevronDown, Info, CheckCircle2, XCircle, Download, Wifi, WifiOff } from "lucide-react";

const FIXED_PRINTERS = [
    { id: "COCINA1", name: "COCINA 1" },
    { id: "COCINA2", name: "COCINA 2" },
    { id: "ENTRADA", name: "ENTRADA" },
    { id: "BARRA", name: "BARRA" },
    { id: "FACTURACION", name: "FACTURACIÓN" },
];

/* Puertos donde buscar el bridge (9100 es el estándar para impresoras) */
const BRIDGE_PORTS = [9100, 9101];

export function ImpresorasTab() {
    const [config, setConfig] = useState<Record<string, { enabled: boolean; ip: string; printerName: string }>>({});
    const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
    const [bridgeStatus, setBridgeStatus] = useState<"connected" | "disconnected" | "checking">("checking");
    const [bridgePort, setBridgePort] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<Record<string, "ok" | "error" | null>>({});
    const [allCategorias, setAllCategorias] = useState<any[]>([]);
    const { sucursalId } = useTenant();

    /* ── Detectar el puente ── */
    const checkBridge = useCallback(async () => {
        setBridgeStatus("checking");
        for (const port of BRIDGE_PORTS) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 1500);
                const res = await fetch(`http://localhost:${port}/status`, { signal: controller.signal });
                clearTimeout(timeout);
                if (res.ok) {
                    setBridgeStatus("connected");
                    setBridgePort(port);
                    // Cargar impresoras del sistema automáticamente
                    try {
                        const pRes = await fetch(`http://localhost:${port}/printers`);
                        if (pRes.ok) {
                            const printers = await pRes.json();
                            if (Array.isArray(printers)) setAvailablePrinters(printers);
                        }
                    } catch {}
                    return;
                }
            } catch {}
        }
        setBridgeStatus("disconnected");
        setBridgePort(null);
    }, []);

    useEffect(() => {
        if (sucursalId) loadConfig();
    }, [sucursalId]);

    useEffect(() => {
        checkBridge();
        // Re-check every 10 seconds
        const interval = setInterval(checkBridge, 10000);
        return () => clearInterval(interval);
    }, [checkBridge]);

    async function loadConfig() {
        if (!sucursalId) return;
        try {
            const { data } = await supabase
                .from("config_sucursal")
                .select("panel_settings")
                .eq("sucursal_id", sucursalId)
                .maybeSingle();

            const dbConfig = data?.panel_settings?.impresoras || {};
            
            // Cargar categorías disponibles
            const { data: cats } = await supabase
                .from("categorias")
                .select("id, nombre")
                .eq("sucursal_id", sucursalId)
                .order("nombre");
            setAllCategorias(cats || []);
            
            const initialConfig: Record<string, { enabled: boolean; ip: string; printerName: string; categoriasNombres: string[] }> = {};
            FIXED_PRINTERS.forEach(p => {
                initialConfig[p.id] = {
                    enabled: dbConfig[p.id]?.enabled ?? true,
                    ip: dbConfig[p.id]?.ip || "",
                    printerName: dbConfig[p.id]?.printerName || "",
                    categoriasNombres: dbConfig[p.id]?.categoriasNombres || []
                };
            });
            setConfig(initialConfig);
        } catch (error) {
            console.error("Error cargando configuración de impresoras:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleTest(printerId: string) {
        if (!bridgePort) {
            alert("El Puente de Impresión no está activo. Ejecutá iniciar-impresoras.bat primero.");
            return;
        }
        const printer = config[printerId];
        if (!printer?.printerName) {
            alert("Seleccioná una impresora primero.");
            return;
        }

        setTestingId(printerId);
        setTestResult(prev => ({ ...prev, [printerId]: null }));

        try {
            const res = await fetch(`http://localhost:${bridgePort}/print-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ printerName: printer.printerName })
            });
            if (res.ok) {
                setTestResult(prev => ({ ...prev, [printerId]: "ok" }));
            } else {
                setTestResult(prev => ({ ...prev, [printerId]: "error" }));
            }
        } catch {
            setTestResult(prev => ({ ...prev, [printerId]: "error" }));
        } finally {
            setTestingId(null);
            // Clear result after 5s
            setTimeout(() => setTestResult(prev => ({ ...prev, [printerId]: null })), 5000);
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

            alert("✅ Configuración de impresoras guardada");
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
            {/* ── Banner de Estado del Puente ── */}
            {bridgeStatus === "disconnected" && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                            <WifiOff className="text-amber-600" size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-amber-900 text-lg">Puente de Impresión no detectado</h3>
                            <p className="text-sm text-amber-700 mt-1">
                                Para imprimir automáticamente en tus impresoras USB y de red, necesitás ejecutar el Puente de Impresión en esta PC.
                            </p>
                            <div className="mt-4 bg-white/80 rounded-xl p-4 border border-amber-100">
                                <p className="font-bold text-sm text-gray-800 mb-2">Configuración rápida (1 vez):</p>
                                <ol className="text-sm text-gray-600 space-y-2 list-decimal ml-4">
                                    <li>Abrí la carpeta del proyecto: <code className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-xs font-mono">scripts/</code></li>
                                    <li>Hacé doble clic en <code className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-xs font-mono">iniciar-impresoras.bat</code></li>
                                    <li>Elegí &quot;S&quot; para que se inicie solo con Windows</li>
                                    <li>¡Listo! Esta página se actualizará automáticamente.</li>
                                </ol>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <button 
                                    onClick={checkBridge}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
                                >
                                    <RefreshCw size={14} />
                                    Reintentar conexión
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {bridgeStatus === "connected" && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <Wifi className="text-green-600" size={20} />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-green-800">Puente de Impresión activo</p>
                        <p className="text-sm text-green-600">{availablePrinters.length} impresora{availablePrinters.length !== 1 ? 's' : ''} detectada{availablePrinters.length !== 1 ? 's' : ''} en el sistema</p>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
            )}

            {bridgeStatus === "checking" && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
                    <RefreshCw className="text-slate-400 animate-spin" size={20} />
                    <p className="text-sm text-slate-500">Buscando Puente de Impresión...</p>
                </div>
            )}

            {/* ── Configuración de Impresoras ── */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        <Printer size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Asignar Impresoras</h3>
                        <p className="text-sm text-gray-500">
                            {bridgeStatus === "connected" 
                                ? "Seleccioná qué impresora física usa cada estación."
                                : "Escribí el nombre de cada impresora tal como aparece en Windows."
                            }
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    {FIXED_PRINTERS.map(printer => (
                        <div key={printer.id} className={`flex items-center gap-4 p-4 border rounded-xl transition-all ${
                            config[printer.id]?.enabled 
                                ? "border-slate-200 bg-white hover:border-purple-200" 
                                : "border-slate-100 bg-slate-50 opacity-60"
                        }`}>
                            {/* Toggle */}
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
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

                            {/* Name */}
                            <div className="w-28 shrink-0">
                                <h4 className="font-bold text-gray-900 text-sm">{printer.name}</h4>
                                <p className="text-[10px] text-gray-400">{printer.id}</p>
                            </div>

                            {/* Printer selector */}
                            <div className="flex-1">
                                {bridgeStatus === "connected" && availablePrinters.length > 0 ? (
                                    <div className="relative">
                                        <select
                                            value={config[printer.id]?.printerName || ""}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                [printer.id]: { ...config[printer.id], printerName: e.target.value }
                                            })}
                                            disabled={!config[printer.id]?.enabled}
                                            className="w-full pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none appearance-none disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <option value="">— Seleccionar impresora —</option>
                                            {availablePrinters.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="Nombre exacto de la impresora en Windows"
                                        value={config[printer.id]?.printerName || ""}
                                        onChange={(e) => setConfig({
                                            ...config,
                                            [printer.id]: { ...config[printer.id], printerName: e.target.value }
                                        })}
                                        disabled={!config[printer.id]?.enabled}
                                        className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                                    />
                                )}
                            </div>
                            
                            {/* Categories assignment */}
                            <div className="w-64">
                                <div className="flex flex-wrap gap-1 p-1.5 border border-slate-200 rounded-lg min-h-[42px] bg-slate-50/50">
                                    {allCategorias.map(cat => {
                                        const isSelected = config[printer.id]?.categoriasNombres?.includes(cat.nombre);
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    const current = config[printer.id]?.categoriasNombres || [];
                                                    const next = isSelected 
                                                        ? current.filter(n => n !== cat.nombre)
                                                        : [...current, cat.nombre];
                                                    setConfig({
                                                        ...config,
                                                        [printer.id]: { ...config[printer.id], categoriasNombres: next }
                                                    });
                                                }}
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                                    isSelected 
                                                        ? "bg-purple-600 text-white" 
                                                        : "bg-white text-slate-400 border border-slate-200 hover:border-purple-200"
                                                }`}
                                            >
                                                {cat.nombre}
                                            </button>
                                        );
                                    })}
                                    {allCategorias.length === 0 && <span className="text-[10px] text-slate-400 p-1">Sin categorías</span>}
                                </div>
                            </div>

                            {/* IP (optional) */}
                            <div className="w-24 shrink-0">
                                <input
                                    type="text"
                                    placeholder="IP (opcional)"
                                    value={config[printer.id]?.ip || ""}
                                    onChange={(e) => setConfig({
                                        ...config,
                                        [printer.id]: { ...config[printer.id], ip: e.target.value }
                                    })}
                                    disabled={!config[printer.id]?.enabled}
                                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                                />
                            </div>

                            {/* Test button */}
                            <button
                                onClick={() => handleTest(printer.id)}
                                disabled={testingId === printer.id || !config[printer.id]?.enabled || !config[printer.id]?.printerName}
                                className={`p-2.5 rounded-lg transition-all shrink-0 ${
                                    testResult[printer.id] === "ok" 
                                        ? "bg-green-100 text-green-600 border border-green-200" 
                                        : testResult[printer.id] === "error"
                                            ? "bg-red-100 text-red-600 border border-red-200"
                                            : "bg-white border border-slate-200 text-slate-500 hover:text-purple-600 hover:border-purple-200"
                                } disabled:opacity-30 disabled:cursor-not-allowed`}
                                title="Enviar ticket de prueba"
                            >
                                {testingId === printer.id ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                ) : testResult[printer.id] === "ok" ? (
                                    <CheckCircle2 size={16} />
                                ) : testResult[printer.id] === "error" ? (
                                    <XCircle size={16} />
                                ) : (
                                    <Play size={16} />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Save Button ── */}
            <div className="flex justify-end gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg shadow-purple-200"
                >
                    {saving ? "Guardando..." : "💾 Guardar Configuración"}
                </button>
            </div>

            {/* ── Info: Sin puente ── */}
            {bridgeStatus !== "connected" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3">
                    <Info className="text-slate-400 shrink-0 mt-0.5" size={18} />
                    <div className="text-sm text-slate-600">
                        <p><strong>Sin el puente</strong>, los tickets se enviarán a la ventana de impresión de Chrome donde podrás seleccionar la impresora manualmente. El sistema funciona igual, pero requiere un clic extra por cada ticket.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
