"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Palette, Image, Save } from "lucide-react";

export function MarketingTab() {
    const [config, setConfig] = useState({
        color_primario: "#f97316",
        color_secundario: "#1a1a2e",
        banner_url: "",
    });
    const [sucursalId, setSucursalId] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchConfig(); }, []);

    async function fetchConfig() {
        const { data: suc } = await supabase.from("sucursales").select("id, logo_url").limit(1).single();
        if (suc) {
            setSucursalId(suc.id);
            setLogoUrl(suc.logo_url || "");
            const { data: cfg } = await supabase.from("config_sucursal").select("*").eq("sucursal_id", suc.id).single();
            if (cfg) {
                setConfig({
                    color_primario: (cfg as any).color_primario || "#f97316",
                    color_secundario: (cfg as any).color_secundario || "#1a1a2e",
                    banner_url: (cfg as any).banner_url || "",
                });
            }
        }
        setLoading(false);
    }

    async function handleSave() {
        setSaving(true);
        await supabase.from("sucursales").update({ logo_url: logoUrl }).eq("id", sucursalId);
        await supabase.from("config_sucursal").upsert({
            sucursal_id: sucursalId,
            color_primario: config.color_primario,
            color_secundario: config.color_secundario,
            banner_url: config.banner_url,
        } as any, { onConflict: "sucursal_id" });
        setSaving(false);
    }

    if (loading) return <p className="text-gray-400 py-8 text-center text-sm">Cargando...</p>;

    return (
        <div className="pt-6 space-y-6 max-w-lg">
            <h3 className="font-semibold text-gray-900">Marketing y marca</h3>

            {/* Colores */}
            <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-2"><Palette size={14} /> Colores de la tienda</p>
                <div className="grid grid-cols-2 gap-3">
                    <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                        <legend className="text-xs text-gray-500 px-1">Color primario</legend>
                        <div className="flex items-center gap-2">
                            <input type="color" value={config.color_primario} onChange={e => setConfig({ ...config, color_primario: e.target.value })} className="w-8 h-8 rounded border-none cursor-pointer" />
                            <span className="text-sm text-gray-600 font-mono">{config.color_primario}</span>
                        </div>
                    </fieldset>
                    <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                        <legend className="text-xs text-gray-500 px-1">Color secundario</legend>
                        <div className="flex items-center gap-2">
                            <input type="color" value={config.color_secundario} onChange={e => setConfig({ ...config, color_secundario: e.target.value })} className="w-8 h-8 rounded border-none cursor-pointer" />
                            <span className="text-sm text-gray-600 font-mono">{config.color_secundario}</span>
                        </div>
                    </fieldset>
                </div>
            </div>

            {/* Logo */}
            <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                <legend className="text-xs text-gray-500 px-1 flex items-center gap-1"><Image size={12} /> URL del logo</legend>
                <input type="text" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="https://..." />
            </fieldset>
            {logoUrl && (
                <div className="flex items-center gap-3">
                    <img src={logoUrl} alt="Logo preview" className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white" />
                    <span className="text-xs text-gray-400">Vista previa del logo</span>
                </div>
            )}

            {/* Banner */}
            <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                <legend className="text-xs text-gray-500 px-1 flex items-center gap-1"><Image size={12} /> URL del banner</legend>
                <input type="text" value={config.banner_url} onChange={e => setConfig({ ...config, banner_url: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="https://..." />
            </fieldset>
            {config.banner_url && (
                <img src={config.banner_url} alt="Banner preview" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
            )}

            <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
                <Save size={14} />
                {saving ? "Guardando..." : "Guardar cambios"}
            </button>
        </div>
    );
}
