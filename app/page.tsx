"use client";

import { useEffect, useState } from "react";
import { 
    Phone, Mail, MessageSquare, Check, ArrowRight, Shield, 
    Smartphone, Bot, Printer, Layers, Loader2, Sparkles, Building, Lock
} from "lucide-react";

export default function SalesLandingPage() {
    const [config, setConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchConfig() {
            try {
                const res = await fetch("/api/superadmin/landing-config");
                if (res.ok) {
                    const data = await res.json();
                    setConfig(data);
                }
            } catch (err) {
                console.error("Error fetching landing config:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchConfig();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#070b19] flex flex-col items-center justify-center text-white">
                <Loader2 className="animate-spin text-cyan-400 w-10 h-10 mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Cargando experiencia...</p>
            </div>
        );
    }

    const c = config || {
        phone: "+54 9 11 1234-5678",
        whatsapp: "5491112345678",
        email: "contacto@mmmsystem.com",
        title: "MMM System",
        subtitle: "El ecosistema definitivo para la gestión integral y automatizada de tu restaurante.",
        heroTitle: "Revoluciona la Gestión de tu Restaurante",
        heroSubtitle: "Control centralizado de pedidos, salón interactivo, delivery sincronizado y un asistente de Inteligencia Artificial las 24 horas.",
        aboutTitle: "Diseñado por Gastronómicos, para Gastronómicos",
        aboutText: "MMM System nace para dar respuesta a la necesidad de un control absoluto, rápido y sin fricciones.",
        features: [],
        pricingTitle: "Planes a la Medida de tu Negocio",
        pricingSubtitle: "Escalabilidad asegurada con licencias flexibles.",
        plans: []
    };

    return (
        <div className="min-h-screen bg-[#070b19] text-slate-100 font-sans selection:bg-cyan-500/30 overflow-x-hidden relative">
            {/* Background glowing blobs */}
            <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] bg-purple-900/10 rounded-full blur-[160px] pointer-events-none" />
            <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[160px] pointer-events-none" />
            <div className="absolute top-[40%] right-[10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[160px] pointer-events-none" />

            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#070b19]/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-xl flex items-center justify-center text-white font-black shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                            M
                        </div>
                        <div>
                            <span className="text-lg font-black tracking-tight text-white uppercase italic">{c.title}</span>
                            <span className="block text-[8px] text-cyan-400 uppercase tracking-widest font-black">Gastronomy ecosystem</span>
                        </div>
                    </div>

                    <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
                        <a href="#caracteristicas" className="hover:text-cyan-400 transition-colors">Características</a>
                        <a href="#nosotros" className="hover:text-cyan-400 transition-colors">Nosotros</a>
                        <a href="#planes" className="hover:text-cyan-400 transition-colors">Planes</a>
                        <a href="#contacto" className="hover:text-cyan-400 transition-colors">Contacto</a>
                    </nav>

                    <div className="flex items-center gap-3">
                        <a 
                            href="/login" 
                            className="hidden sm:inline-block text-xs font-black uppercase tracking-wider text-slate-300 hover:text-cyan-400 transition-all px-4 py-2.5 border border-white/5 rounded-xl hover:border-cyan-500/30 hover:bg-cyan-500/5 active:scale-95"
                        >
                            Acceso Admin
                        </a>
                        <a 
                            href={`https://wa.me/${c.whatsapp}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="bg-cyan-500 hover:bg-cyan-600 text-[#070b19] font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95 flex items-center gap-2"
                        >
                            <MessageSquare size={14} /> WhatsApp
                        </a>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-20 pb-24 px-6 max-w-7xl mx-auto text-center z-10">
                <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-md">
                    <Sparkles size={14} className="text-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-black tracking-widest text-slate-300 uppercase">Solución Todo en Uno para Gastronomía</span>
                </div>
                
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-tight tracking-tight uppercase italic max-w-5xl mx-auto">
                    {c.heroTitle} <br />
                    <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">Inteligente y Sin Fricciones</span>
                </h1>
                
                <p className="text-slate-400 text-lg md:text-xl max-w-3xl mx-auto mt-6 leading-relaxed">
                    {c.heroSubtitle}
                </p>

                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <a 
                        href="#planes" 
                        className="w-full sm:w-auto bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 text-[#070b19] font-black px-8 py-4 rounded-2xl transition-all shadow-xl shadow-cyan-950/20 active:scale-95 text-sm uppercase tracking-widest flex items-center justify-center gap-3"
                    >
                        Ver Planes Activos <ArrowRight size={16} />
                    </a>
                    <a 
                        href="#contacto" 
                        className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black px-8 py-4 rounded-2xl transition-all active:scale-95 text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        Solicitar Demo Gratuita
                    </a>
                </div>
            </section>

            {/* Dashboard Mockup Showcase */}
            <section className="px-6 pb-24 max-w-6xl mx-auto z-10 relative">
                <div className="bg-gradient-to-b from-white/10 to-transparent p-2 rounded-[2.5rem] border border-white/10 shadow-2xl">
                    <div className="bg-[#0b1329] rounded-[2rem] overflow-hidden aspect-video relative border border-white/5 shadow-inner flex flex-col justify-between p-8 group">
                        {/* Interactive UI Simulation inside mockup */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                            </div>
                            <div className="bg-white/5 px-6 py-1 rounded-full text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                app.mmmsystem.com/admin/dashboard
                            </div>
                            <div className="w-6 h-6 rounded-full bg-cyan-400/20" />
                        </div>
                        
                        <div className="flex-1 grid grid-cols-3 gap-6 pt-6">
                            <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col justify-between">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mesa 4 — Estado</p>
                                <div className="flex items-center gap-3 my-2 text-yellow-400">
                                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-ping" />
                                    <span className="font-black text-lg italic uppercase">PRE-CUENTA</span>
                                </div>
                                <p className="text-[9px] text-slate-400">Mesa lista para facturación e impresión inmediata.</p>
                            </div>
                            <div className="bg-white/5 rounded-2xl p-6 border border-white/5 flex flex-col justify-between col-span-2">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estadísticas Semanales</p>
                                <div className="h-24 flex items-end gap-2 pt-4">
                                    <div className="bg-cyan-400/20 h-[30%] w-full rounded-md hover:bg-cyan-400 transition-all duration-300 cursor-pointer" />
                                    <div className="bg-cyan-400/20 h-[50%] w-full rounded-md hover:bg-cyan-400 transition-all duration-300 cursor-pointer" />
                                    <div className="bg-cyan-400/20 h-[45%] w-full rounded-md hover:bg-cyan-400 transition-all duration-300 cursor-pointer" />
                                    <div className="bg-cyan-400/20 h-[85%] w-full rounded-md hover:bg-cyan-400 transition-all duration-300 cursor-pointer" />
                                    <div className="bg-gradient-to-t from-cyan-400 to-purple-500 h-[100%] w-full rounded-md shadow-lg shadow-cyan-500/20" />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/5 pt-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            <span>Módulo Salón v3.5</span>
                            <span>Sistema Local-First Offline</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="caracteristicas" className="py-24 px-6 max-w-7xl mx-auto z-10 relative">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase italic">
                        Todo lo que Necesitas para <span className="text-cyan-400">Crecer</span>
                    </h2>
                    <p className="text-slate-400 mt-3 font-medium text-lg">
                        Módulos integrados de alto rendimiento para agilizar tu operación diaria.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {c.features && c.features.length > 0 ? (
                        c.features.map((feat: any, idx: number) => {
                            const Icons = [Smartphone, Bot, Printer, Layers];
                            const CurIcon = Icons[idx % Icons.length];
                            return (
                                <div key={idx} className="bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 p-8 rounded-3xl transition-all duration-500 hover:translate-y-[-4px] flex flex-col justify-between group">
                                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <CurIcon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xl text-white mb-2 tracking-tight">{feat.title}</h3>
                                        <p className="text-slate-400 text-xs leading-relaxed font-medium">{feat.description}</p>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full text-center text-slate-500">No hay características definidas.</div>
                    )}
                </div>
            </section>

            {/* About Section */}
            <section id="nosotros" className="py-20 px-6 max-w-6xl mx-auto z-10 relative border-t border-white/5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-6">
                            <Shield size={24} />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight uppercase italic leading-tight mb-6">
                            {c.aboutTitle}
                        </h2>
                        <p className="text-slate-400 leading-relaxed font-medium text-sm md:text-base">
                            {c.aboutText}
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-900/10 to-cyan-900/10 border border-white/10 rounded-[2.5rem] p-8 aspect-square flex flex-col justify-center items-center text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-400/5 rounded-full blur-2xl" />
                        <Building size={48} className="text-cyan-400 mb-6 animate-pulse" />
                        <h4 className="font-black text-2xl text-white mb-2">Multi-Sucursal Escalable</h4>
                        <p className="text-slate-400 text-xs max-w-sm font-medium">Controla múltiples negocios desde un único panel administrativo. Define accesos específicos para cada sucursal de manera robusta y ágil.</p>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="planes" className="py-24 px-6 max-w-7xl mx-auto z-10 relative border-t border-white/5">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight uppercase italic">
                        {c.pricingTitle}
                    </h2>
                    <p className="text-slate-400 mt-3 font-medium text-lg">
                        {c.pricingSubtitle}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {c.plans && c.plans.length > 0 ? (
                        c.plans.map((plan: any, idx: number) => {
                            const isPro = idx === 1; // Highlight second plan
                            return (
                                <div key={idx} className={`border p-8 rounded-[2rem] flex flex-col justify-between relative overflow-hidden transition-all duration-500 ${
                                    isPro 
                                    ? "bg-gradient-to-b from-cyan-950/20 to-purple-950/20 border-cyan-500/40 shadow-2xl scale-105" 
                                    : "bg-white/[0.01] border-white/5 hover:border-white/20"
                                }`}>
                                    {isPro && (
                                        <div className="absolute top-4 right-4 bg-cyan-400 text-[#070b19] px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider">
                                            Recomendado
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-black text-2xl text-white mb-2">{plan.name}</h3>
                                        <div className="flex items-baseline gap-2 my-6">
                                            <span className="text-3xl md:text-4xl font-black text-white tracking-tight">{plan.price}</span>
                                        </div>
                                        
                                        <div className="w-full h-px bg-white/5 my-6" />

                                        <ul className="space-y-4">
                                            {plan.features?.map((f: string, fIdx: number) => (
                                                <li key={fIdx} className="flex items-center gap-3 text-xs font-semibold text-slate-300">
                                                    <div className="w-5 h-5 rounded-full bg-cyan-400/10 flex items-center justify-center text-cyan-400">
                                                        <Check size={12} />
                                                    </div>
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="mt-8">
                                        <a 
                                            href={`https://wa.me/${c.whatsapp}?text=Hola!%20Me%20interesa%20el%20${encodeURIComponent(plan.name)}`} 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-center block transition-all active:scale-95 ${
                                                isPro 
                                                ? "bg-cyan-400 text-[#070b19] hover:bg-cyan-500 shadow-xl shadow-cyan-950/50" 
                                                : "bg-white/5 text-white hover:bg-white/10 border border-white/10"
                                            }`}
                                        >
                                            Contratar Plan
                                        </a>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full text-center text-slate-500">No hay planes definidos.</div>
                    )}
                </div>
            </section>

            {/* Footer / Contact Section */}
            <footer id="contacto" className="bg-[#040610] py-20 px-6 border-t border-white/5 z-10 relative">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-xl flex items-center justify-center text-white font-black">
                                M
                            </div>
                            <span className="text-lg font-black tracking-tight text-white uppercase italic">{c.title}</span>
                        </div>
                        <p className="text-slate-500 text-xs leading-relaxed max-w-xs font-medium">
                            El ecosistema definitivo para potenciar la rentabilidad y automatización de tu negocio gastronómico.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Panel de Control</h4>
                        <ul className="space-y-3 text-slate-400 text-xs font-semibold">
                            <li className="flex items-center gap-3 hover:text-cyan-400 transition-colors">
                                <Lock size={14} className="text-cyan-400" />
                                <a href="/login">Acceso Administradores</a>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contacto Directo</h4>
                        <ul className="space-y-3 text-slate-400 text-xs font-semibold">
                            <li className="flex items-center gap-3 hover:text-cyan-400 transition-colors">
                                <Phone size={14} className="text-cyan-400" />
                                <a href={`tel:${c.phone}`}>{c.phone}</a>
                            </li>
                            <li className="flex items-center gap-3 hover:text-cyan-400 transition-colors">
                                <Mail size={14} className="text-cyan-400" />
                                <a href={`mailto:${c.email}`}>{c.email}</a>
                            </li>
                            <li className="flex items-center gap-3 hover:text-cyan-400 transition-colors">
                                <MessageSquare size={14} className="text-cyan-400" />
                                <a href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp: {c.phone}</a>
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Garantía Tecnológica</h4>
                        <p className="text-slate-500 text-xs leading-relaxed font-medium">
                            Nuestra plataforma cuenta con redundancia local-first. Tu negocio sigue facturando e imprimiendo comandas en cocina incluso sin conexión a internet.
                        </p>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                    <span>© 2026 {c.title}. Todos los derechos reservados.</span>
                    <span>Desarrollado para entornos de alta exigencia.</span>
                </div>
            </footer>
        </div>
    );
}
