"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Instagram, Facebook, MessageCircle, Globe, Save } from "lucide-react";

export function RedesSocialesTab() {
    const [config, setConfig] = useState({
        whatsapp_numero: "",
        instagram_url: "",
        facebook_url: "",
    });
    const [sucursalId, setSucursalId] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchConfig(); }, []);

    async function fetchConfig() {
        const { data: suc } = await supabase.from("sucursales").select("id, whatsapp_numero").limit(1).single();
        if (suc) {
            setSucursalId(suc.id);
            setConfig(prev => ({ ...prev, whatsapp_numero: suc.whatsapp_numero || "" }));
            const { data: cfg } = await supabase.from("config_sucursal").select("*").eq("sucursal_id", suc.id).single();
            if (cfg) {
                setConfig({
                    whatsapp_numero: suc.whatsapp_numero || "",
                    instagram_url: (cfg as any).instagram_url || "",
                    facebook_url: (cfg as any).facebook_url || "",
                });
            }
        }
        setLoading(false);
    }

    async function handleSave() {
        setSaving(true);
        await supabase.from("sucursales").update({ whatsapp_numero: config.whatsapp_numero }).eq("id", sucursalId);
        await supabase.from("config_sucursal").upsert({
            sucursal_id: sucursalId,
            instagram_url: config.instagram_url,
            facebook_url: config.facebook_url,
        } as any, { onConflict: "sucursal_id" });
        setSaving(false);
    }

    if (loading) return <p className="text-gray-400 py-8 text-center text-sm">Cargando...</p>;

    return (
        <div className="pt-6 space-y-4 max-w-lg">
            <h3 className="font-semibold text-gray-900">Redes sociales</h3>

            <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                <legend className="text-xs text-gray-500 px-1 flex items-center gap-1"><MessageCircle size={12} /> WhatsApp</legend>
                <input type="text" value={config.whatsapp_numero} onChange={e => setConfig({ ...config, whatsapp_numero: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="+54 11 1234 5678" />
            </fieldset>

            <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                <legend className="text-xs text-gray-500 px-1 flex items-center gap-1"><Instagram size={12} /> Instagram</legend>
                <input type="text" value={config.instagram_url} onChange={e => setConfig({ ...config, instagram_url: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="https://instagram.com/tu-local" />
            </fieldset>

            <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                <legend className="text-xs text-gray-500 px-1 flex items-center gap-1"><Facebook size={12} /> Facebook</legend>
                <input type="text" value={config.facebook_url} onChange={e => setConfig({ ...config, facebook_url: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="https://facebook.com/tu-local" />
            </fieldset>

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
