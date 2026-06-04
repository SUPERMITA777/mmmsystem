"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, ArrowLeft, ArrowRight, ShieldCheck, Mail, Sparkles } from "lucide-react";

export default function GlobalLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Credenciales incorrectas o error en el inicio de sesión");
                return;
            }

            // Sincronizar sesión con Supabase Client
            if (data.session) {
                const { supabase } = await import("@/lib/supabaseClient");
                await supabase.auth.setSession(data.session);
            }

            const redirectSlug = data.user?.tenantSlug;
            const role = data.user?.rol;

            if (role === "superadmin") {
                router.push("/superadmin");
                router.refresh();
            } else if (redirectSlug) {
                router.push(`/${redirectSlug}/admin`);
                router.refresh();
            } else {
                setError("Tu usuario no tiene una sucursal o negocio asignado.");
            }
        } catch {
            setError("Error de conexión con el servidor. Reintenta por favor.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#070b19] text-slate-100 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-cyan-500/30">
            {/* Glowing background shapes */}
            <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-purple-900/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-900/10 rounded-full blur-[140px] pointer-events-none" />
            
            {/* Back to landing link */}
            <button 
                onClick={() => router.push("/")}
                className="absolute top-8 left-8 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors group"
            >
                <ArrowLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" />
                Volver al Inicio
            </button>

            {/* Login Card */}
            <div className="w-full max-w-[440px] bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-xl shadow-2xl relative z-10">
                {/* Visual indicator / header */}
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-14 h-14 bg-gradient-to-tr from-cyan-400 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black shadow-[0_0_25px_rgba(34,211,238,0.25)] mb-4">
                        <Lock size={22} className="text-white" />
                    </div>
                    
                    <div className="inline-flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full mb-3">
                        <Sparkles size={11} className="text-cyan-400 animate-pulse" />
                        <span className="text-[9px] font-black tracking-widest text-cyan-400 uppercase">Panel de Acceso</span>
                    </div>

                    <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">
                        MMM System Admin
                    </h1>
                    <p className="text-slate-400 text-xs mt-1 font-semibold">
                        Ingresa para gestionar tu sucursal o restaurante.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            Correo Electrónico
                        </label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                            <input 
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="tuemail@negocio.com"
                                required
                                className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10 transition-all font-semibold"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            Contraseña
                        </label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500" />
                            <input 
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full pl-11 pr-4 py-3.5 bg-white/[0.03] border border-white/10 rounded-2xl text-sm text-white placeholder-slate-600 outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10 transition-all font-semibold"
                            />
                        </div>
                    </div>

                    {/* Error container */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
                            <span className="mt-0.5">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 disabled:from-slate-800 disabled:to-slate-800 text-[#070b19] disabled:text-slate-500 font-black rounded-2xl text-xs uppercase tracking-widest transition-all shadow-xl shadow-cyan-950/20 active:scale-95 flex items-center justify-center gap-2 mt-4"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={14} className="animate-spin text-slate-500" />
                                <span>Verificando...</span>
                            </>
                        ) : (
                            <>
                                <span>Ingresar al Panel</span>
                                <ArrowRight size={14} />
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Footer decoration */}
            <div className="mt-12 flex items-center gap-2 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                <ShieldCheck size={14} className="text-slate-600" />
                <span>Acceso de Seguridad Encriptado</span>
            </div>
        </div>
    );
}
