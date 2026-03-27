"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import {
    Save, Loader2, Upload, Store, Palette, Type, Share2,
    Instagram, Facebook, MessageCircle, Video, Globe,
    Eye, RefreshCw, Image, X, ChefHat
} from "lucide-react";

type WebConfig = {
    // sucursales
    nombre: string;
    descripcion: string;
    logo_url: string;
    // config_sucursal
    color_primario: string;
    color_secundario: string;
    banner_url: string;
    mensaje_bienvenida: string;
    mensaje_cerrado: string;
    texto_delivery: string;
    texto_takeaway: string;
    // redes
    whatsapp_numero: string;
    instagram_url: string;
    facebook_url: string;
    tiktok_url: string;
};

const DEFAULT: WebConfig = {
    nombre: "",
    descripcion: "",
    logo_url: "",
    color_primario: "#f97316",
    color_secundario: "#1a1a2e",
    banner_url: "",
    mensaje_bienvenida: "",
    mensaje_cerrado: "Estamos cerrados en este momento",
    texto_delivery: "DELIVERY",
    texto_takeaway: "RETIRO EN LOCAL",
    whatsapp_numero: "",
    instagram_url: "",
    facebook_url: "",
    tiktok_url: "",
};

type Section = "identidad" | "colores" | "textos" | "redes";

export function WebConfigTab() {
    const { sucursalId } = useTenant();
    const [config, setConfig] = useState<WebConfig>(DEFAULT);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [activeSection, setActiveSection] = useState<Section>("identidad");
    const logoRef = useRef<HTMLInputElement>(null);
    const bannerRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (sucursalId) fetchConfig();
    }, [sucursalId]);

    async function fetchConfig() {
        if (!sucursalId) return;
        setLoading(true);
        try {
            const [{ data: suc }, { data: cfg }] = await Promise.all([
                supabase.from("sucursales").select("nombre, descripcion, logo_url, whatsapp_numero").eq("id", sucursalId).single(),
                supabase.from("config_sucursal").select("color_primario, color_secundario, banner_url, instagram_url, facebook_url, tiktok_url, mensaje_bienvenida, mensaje_cerrado, texto_delivery, texto_takeaway").eq("sucursal_id", sucursalId).maybeSingle(),
            ]);
            setConfig({
                nombre: suc?.nombre || "",
                descripcion: (suc as any)?.descripcion || "",
                logo_url: suc?.logo_url || "",
                whatsapp_numero: (suc as any)?.whatsapp_numero || "",
                color_primario: (cfg as any)?.color_primario || "#f97316",
                color_secundario: (cfg as any)?.color_secundario || "#1a1a2e",
                banner_url: (cfg as any)?.banner_url || "",
                instagram_url: (cfg as any)?.instagram_url || "",
                facebook_url: (cfg as any)?.facebook_url || "",
                tiktok_url: (cfg as any)?.tiktok_url || "",
                mensaje_bienvenida: (cfg as any)?.mensaje_bienvenida || "",
                mensaje_cerrado: (cfg as any)?.mensaje_cerrado || "Estamos cerrados en este momento",
                texto_delivery: (cfg as any)?.texto_delivery || "DELIVERY",
                texto_takeaway: (cfg as any)?.texto_takeaway || "RETIRO EN LOCAL",
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!sucursalId) return;
        setSaving(true);
        try {
            await supabase.from("sucursales").update({
                nombre: config.nombre,
                descripcion: config.descripcion,
                logo_url: config.logo_url,
                whatsapp_numero: config.whatsapp_numero,
            } as any).eq("id", sucursalId);

            await supabase.from("config_sucursal").upsert({
                sucursal_id: sucursalId,
                color_primario: config.color_primario,
                color_secundario: config.color_secundario,
                banner_url: config.banner_url,
                instagram_url: config.instagram_url,
                facebook_url: config.facebook_url,
                tiktok_url: config.tiktok_url,
                mensaje_bienvenida: config.mensaje_bienvenida,
                mensaje_cerrado: config.mensaje_cerrado,
                texto_delivery: config.texto_delivery,
                texto_takeaway: config.texto_takeaway,
            } as any, { onConflict: "sucursal_id" });

            alert("✅ Configuración guardada correctamente");
        } catch (e: any) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleImageUpload(
        e: React.ChangeEvent<HTMLInputElement>,
        field: "logo_url" | "banner_url",
        setUploading: (v: boolean) => void
    ) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const ext = file.name.split(".").pop();
            const path = `${field === "logo_url" ? "logos" : "banners"}/${sucursalId}-${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from("images").upload(path, file, { upsert: true, contentType: file.type });
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(path);
            setConfig(prev => ({ ...prev, [field]: publicUrl }));
        } catch (e: any) {
            alert("Error subiendo imagen: " + e.message);
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    }

    const set = (k: keyof WebConfig, v: string) => setConfig(prev => ({ ...prev, [k]: v }));

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    const SECTIONS: { id: Section; label: string; icon: any }[] = [
        { id: "identidad", label: "Identidad", icon: Store },
        { id: "colores", label: "Colores", icon: Palette },
        { id: "textos", label: "Textos", icon: Type },
        { id: "redes", label: "Redes sociales", icon: Share2 },
    ];

    return (
        <div className="pt-6 grid grid-cols-[220px_1fr] gap-6">
            {/* Sidebar nav */}
            <div className="space-y-1">
                {SECTIONS.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left ${activeSection === s.id
                            ? "bg-gray-900 text-white shadow-md"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                    >
                        <s.icon size={15} />
                        {s.label}
                    </button>
                ))}

                <div className="pt-4 border-t border-gray-100 mt-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50 text-sm"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={15} />}
                        {saving ? "Guardando..." : "Guardar Todo"}
                    </button>
                </div>
            </div>

            {/* Content panel */}
            <div className="space-y-6">

                {/* ===== IDENTIDAD ===== */}
                {activeSection === "identidad" && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Identidad del Negocio</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Esta información aparece en el encabezado de tu página web.</p>
                        </div>

                        {/* Logo */}
                        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Logo</p>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-gray-200 overflow-hidden flex items-center justify-center shrink-0 border border-gray-200">
                                    {config.logo_url ? (
                                        <img src={config.logo_url} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <Store size={28} className="text-gray-400" />
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => logoRef.current?.click()}
                                        disabled={uploadingLogo}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:border-purple-300 hover:text-purple-600 transition-all shadow-sm"
                                    >
                                        {uploadingLogo ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                                        {uploadingLogo ? "Subiendo..." : "Subir logo"}
                                    </button>
                                    {config.logo_url && (
                                        <button onClick={() => set("logo_url", "")} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors">
                                            <X size={11} /> Quitar logo
                                        </button>
                                    )}
                                    <p className="text-[10px] text-gray-400">PNG o JPG, cuadrado, mín. 200×200px</p>
                                </div>
                            </div>
                            <input ref={logoRef} type="file" accept="image/*" className="hidden"
                                onChange={e => handleImageUpload(e, "logo_url", setUploadingLogo)} />
                        </div>

                        {/* Banner */}
                        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Banner / Portada</p>
                            {config.banner_url ? (
                                <div className="relative group">
                                    <img src={config.banner_url} alt="Banner" className="w-full h-32 object-cover rounded-xl" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
                                        <button onClick={() => bannerRef.current?.click()} className="p-2 bg-white rounded-xl text-gray-800 hover:bg-gray-100 transition-colors">
                                            <RefreshCw size={14} />
                                        </button>
                                        <button onClick={() => set("banner_url", "")} className="p-2 bg-red-500 rounded-xl text-white hover:bg-red-600 transition-colors">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => bannerRef.current?.click()}
                                    disabled={uploadingBanner}
                                    className="w-full h-28 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-purple-300 hover:bg-purple-50/30 transition-all text-gray-400 group"
                                >
                                    {uploadingBanner ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <>
                                            <Image size={22} className="group-hover:text-purple-500 transition-colors" />
                                            <span className="text-xs font-medium">Subir banner de portada</span>
                                        </>
                                    )}
                                </button>
                            )}
                            <input ref={bannerRef} type="file" accept="image/*" className="hidden"
                                onChange={e => handleImageUpload(e, "banner_url", setUploadingBanner)} />
                            <p className="text-[10px] text-gray-400 mt-2">Recomendado: 1200×300px. Se muestra detrás del header.</p>
                        </div>

                        {/* Nombre */}
                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Nombre del local</label>
                            <input
                                type="text"
                                value={config.nombre}
                                onChange={e => set("nombre", e.target.value)}
                                placeholder="Ej: MMM Pizza Artesanal"
                                className="mt-1.5 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/10 transition-all"
                            />
                        </div>

                        {/* Descripción */}
                        <div>
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Descripción / Slogan</label>
                            <textarea
                                value={config.descripcion}
                                onChange={e => set("descripcion", e.target.value)}
                                placeholder="Ej: Las mejores pizzas de la ciudad, hechas con amor desde 2020."
                                rows={3}
                                className="mt-1.5 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/10 transition-all resize-none"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Puede aparecer debajo del nombre en el header.</p>
                        </div>
                    </div>
                )}

                {/* ===== COLORES ===== */}
                {activeSection === "colores" && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Colores del Sitio</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Define la paleta de colores de tu menú online.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Color primario */}
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Color Primario</p>
                                <p className="text-[10px] text-gray-400 mb-3">Botones, resaltes y elementos de acción</p>
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <input
                                            type="color"
                                            value={config.color_primario}
                                            onChange={e => set("color_primario", e.target.value)}
                                            className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer p-0.5 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            value={config.color_primario}
                                            onChange={e => set("color_primario", e.target.value)}
                                            className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono uppercase text-gray-800 outline-none focus:border-purple-400 transition-colors"
                                        />
                                    </div>
                                </div>
                                {/* Presets */}
                                <div className="flex gap-2 mt-3 flex-wrap">
                                    {["#f97316", "#e11d48", "#7c3aed", "#2563eb", "#16a34a", "#d97706", "#ec4899"].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => set("color_primario", c)}
                                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${config.color_primario === c ? "border-gray-700 scale-110" : "border-gray-200"}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Color secundario */}
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Color Secundario</p>
                                <p className="text-[10px] text-gray-400 mb-3">Fondo principal del degradado del sitio</p>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={config.color_secundario}
                                        onChange={e => set("color_secundario", e.target.value)}
                                        className="w-12 h-12 rounded-xl border-2 border-gray-200 cursor-pointer p-0.5 bg-white"
                                    />
                                    <input
                                        type="text"
                                        value={config.color_secundario}
                                        onChange={e => set("color_secundario", e.target.value)}
                                        className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-mono uppercase text-gray-800 outline-none focus:border-purple-400 transition-colors"
                                    />
                                </div>
                                <div className="flex gap-2 mt-3 flex-wrap">
                                    {["#1a1a2e", "#0f172a", "#1e1b4b", "#0c1a12", "#1a0a00", "#111827", "#18181b"].map(c => (
                                        <button
                                            key={c}
                                            onClick={() => set("color_secundario", c)}
                                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${config.color_secundario === c ? "border-gray-400 scale-110" : "border-gray-300"}`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-md">
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 border-b border-gray-200">
                                <Eye size={13} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Preview del Header</span>
                            </div>
                            <div
                                className="p-8 flex flex-col items-center gap-3"
                                style={{
                                    background: `radial-gradient(circle at top, ${config.color_secundario} 0%, #050505 100%)`,
                                }}
                            >
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/10 flex items-center justify-center">
                                    {config.logo_url ? (
                                        <img src={config.logo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl font-black text-white">{config.nombre?.charAt(0) || "M"}</span>
                                    )}
                                </div>
                                <p className="text-white font-black text-lg tracking-tighter">{config.nombre || "Tu Negocio"}</p>
                                {config.descripcion && <p className="text-white/50 text-xs text-center">{config.descripcion}</p>}
                                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 gap-1 mt-1 w-48">
                                    <div
                                        className="flex-1 py-2 rounded-xl text-center text-[9px] font-black tracking-wider text-white uppercase"
                                        style={{ backgroundColor: config.color_primario }}
                                    >
                                        {config.texto_delivery || "DELIVERY"}
                                    </div>
                                    <div className="flex-1 py-2 rounded-xl text-center text-[9px] font-black tracking-wider text-white/40 uppercase">
                                        {config.texto_takeaway || "RETIRO"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== TEXTOS ===== */}
                {activeSection === "textos" && (
                    <div className="space-y-5 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Textos del Sitio</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Personalizá los mensajes que ven tus clientes.</p>
                        </div>

                        <Field label="Mensaje de bienvenida" hint="Aparece en el banner al abrir la página (próximamente)">
                            <input
                                type="text"
                                value={config.mensaje_bienvenida}
                                onChange={e => set("mensaje_bienvenida", e.target.value)}
                                placeholder="Ej: ¡Bienvenido! Te esperamos con las mejores pizzas."
                                className="input-style"
                            />
                        </Field>

                        <Field label="Mensaje de local cerrado" hint="Se muestra cuando el horario indica que está cerrado">
                            <input
                                type="text"
                                value={config.mensaje_cerrado}
                                onChange={e => set("mensaje_cerrado", e.target.value)}
                                placeholder="Ej: Estamos cerrados en este momento"
                                className="input-style"
                            />
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Botón de Delivery" hint="Texto del botón de modalidad delivery">
                                <input
                                    type="text"
                                    value={config.texto_delivery}
                                    onChange={e => set("texto_delivery", e.target.value)}
                                    placeholder="DELIVERY"
                                    className="input-style uppercase"
                                />
                            </Field>
                            <Field label="Botón de Retiro" hint="Texto del botón de retiro en local">
                                <input
                                    type="text"
                                    value={config.texto_takeaway}
                                    onChange={e => set("texto_takeaway", e.target.value)}
                                    placeholder="RETIRO EN LOCAL"
                                    className="input-style uppercase"
                                />
                            </Field>
                        </div>
                    </div>
                )}

                {/* ===== REDES ===== */}
                {activeSection === "redes" && (
                    <div className="space-y-5 animate-in fade-in duration-300">
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Redes Sociales y Contacto</h3>
                            <p className="text-xs text-gray-400 mt-0.5">Links que aparecen en tu menú online.</p>
                        </div>

                        <SocialField icon={MessageCircle} label="WhatsApp" color="text-green-500" placeholder="+54 11 1234-5678">
                            <input
                                type="text"
                                value={config.whatsapp_numero}
                                onChange={e => set("whatsapp_numero", e.target.value)}
                                placeholder="+54 11 1234-5678"
                                className="input-style"
                            />
                        </SocialField>

                        <SocialField icon={Instagram} label="Instagram" color="text-pink-500" placeholder="https://instagram.com/tu-local">
                            <input
                                type="text"
                                value={config.instagram_url}
                                onChange={e => set("instagram_url", e.target.value)}
                                placeholder="https://instagram.com/tu-local"
                                className="input-style"
                            />
                        </SocialField>

                        <SocialField icon={Facebook} label="Facebook" color="text-blue-500" placeholder="https://facebook.com/tu-local">
                            <input
                                type="text"
                                value={config.facebook_url}
                                onChange={e => set("facebook_url", e.target.value)}
                                placeholder="https://facebook.com/tu-local"
                                className="input-style"
                            />
                        </SocialField>

                        <SocialField icon={Video} label="TikTok" color="text-gray-900" placeholder="https://tiktok.com/@tu-local">
                            <input
                                type="text"
                                value={config.tiktok_url}
                                onChange={e => set("tiktok_url", e.target.value)}
                                placeholder="https://tiktok.com/@tu-local"
                                className="input-style"
                            />
                        </SocialField>
                    </div>
                )}
            </div>
        </div>
    );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{label}</label>
            {hint && <p className="text-[10px] text-gray-400 mb-1">{hint}</p>}
            <div className="mt-1.5 [&_.input-style]:w-full [&_.input-style]:border [&_.input-style]:border-gray-200 [&_.input-style]:rounded-xl [&_.input-style]:px-4 [&_.input-style]:py-2.5 [&_.input-style]:text-sm [&_.input-style]:text-gray-700 [&_.input-style]:outline-none [&_.input-style]:transition-all focus-within:[&_.input-style]:border-purple-400">
                {children}
            </div>
        </div>
    );
}

function SocialField({ icon: Icon, label, color, placeholder, children }: { icon: any; label: string; color: string; placeholder: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className={`shrink-0 w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center ${color}`}>
                <Icon size={18} />
            </div>
            <div className="flex-1 [&_.input-style]:w-full [&_.input-style]:bg-transparent [&_.input-style]:outline-none [&_.input-style]:text-sm [&_.input-style]:text-gray-800">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                {children}
            </div>
        </div>
    );
}
