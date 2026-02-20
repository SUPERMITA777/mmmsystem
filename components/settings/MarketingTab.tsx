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
            <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-2"><Image size={14} /> Logo de la tienda</p>
                <div className="flex items-center gap-4">
                    {logoUrl ? (
                        <div className="relative group">
                            <img src={logoUrl} alt="Logo preview" className="w-20 h-20 object-contain rounded-lg border border-gray-200 bg-white" />
                            <div className="mt-2 flex gap-3 text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('logo-upload')?.click()}
                                    className="text-purple-600 hover:text-purple-700 font-medium"
                                >
                                    Cambiar
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                    type="button"
                                    onClick={() => setLogoUrl("")}
                                    className="text-red-500 hover:text-red-600 font-medium"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => document.getElementById('logo-upload')?.click()}
                            className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-purple-300 hover:bg-purple-50 transition-all text-gray-400"
                        >
                            <Image size={16} />
                            <span className="text-[10px] font-medium">Subir</span>
                        </button>
                    )}
                    <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-2">Se recomienda un logo en formato PNG o SVG con fondo transparente.</p>
                        <input
                            id="logo-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                    const fileExt = file.name.split('.').pop();
                                    const fileName = `logo-${Math.random().toString(36).substring(2)}.${fileExt}`;
                                    const filePath = `marketing/${fileName}`;
                                    const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
                                    if (uploadError) throw uploadError;
                                    const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
                                    setLogoUrl(publicUrl);
                                } catch (error: any) {
                                    alert("Error subiendo el logo: " + error.message);
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Banner */}
            <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-2"><Image size={14} /> Banner de la tienda</p>
                <div className="space-y-3">
                    {config.banner_url ? (
                        <div className="relative group">
                            <img src={config.banner_url} alt="Banner preview" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                            <div className="mt-2 flex gap-3 text-[11px]">
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('banner-upload')?.click()}
                                    className="text-purple-600 hover:text-purple-700 font-medium"
                                >
                                    Cambiar banner
                                </button>
                                <span className="text-gray-300">|</span>
                                <button
                                    type="button"
                                    onClick={() => setConfig({ ...config, banner_url: "" })}
                                    className="text-red-500 hover:text-red-600 font-medium"
                                >
                                    Eliminar banner
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => document.getElementById('banner-upload')?.click()}
                            className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-purple-300 hover:bg-purple-50 transition-all text-gray-400 group"
                        >
                            <Image size={24} className="group-hover:text-purple-500 transition-colors" />
                            <div className="text-center">
                                <p className="text-xs font-medium text-gray-600">Haz clic para subir un banner</p>
                                <p className="text-[10px] text-gray-400">Dimensión recomendada: 1200x400px</p>
                            </div>
                        </button>
                    )}
                    <input
                        id="banner-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                                const fileExt = file.name.split('.').pop();
                                const fileName = `banner-${Math.random().toString(36).substring(2)}.${fileExt}`;
                                const filePath = `marketing/${fileName}`;
                                const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
                                if (uploadError) throw uploadError;
                                const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(filePath);
                                setConfig({ ...config, banner_url: publicUrl });
                            } catch (error: any) {
                                alert("Error subiendo el banner: " + error.message);
                            }
                        }}
                    />
                </div>
            </div>

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
