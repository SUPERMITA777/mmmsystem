"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Building2, ExternalLink, ShieldCheck, Mail, LogOut, Loader2 } from "lucide-react";

export default function SuperAdminPage() {
    const [authChecking, setAuthChecking] = useState(true);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    const [sucursales, setSucursales] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Auth login for superadmin (in case not logged in)
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Form
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        nombre: "",
        slug: "",
        admin_email: "",
        admin_password: ""
    });

    useEffect(() => { checkUser(); }, []);

    async function checkUser() {
        setAuthChecking(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            // Check roles
            const { data: roleData } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .single();

            if (roleData?.role === "superadmin") {
                setIsSuperAdmin(true);
                fetchSucursales();
            } else {
                setIsSuperAdmin(false);
            }
        } else {
            setIsSuperAdmin(false);
        }
        setAuthChecking(false);
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setAuthChecking(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            alert("Error: " + error.message);
            setAuthChecking(false);
            return;
        }
        await checkUser();
    }

    async function fetchSucursales() {
        setLoading(true);
        const { data } = await supabase.from("sucursales").select("*").order("created_at", { ascending: false });
        if (data) setSucursales(data);
        setLoading(false);
    }

    async function handleCreateTenant(e: React.FormEvent) {
        e.preventDefault();
        if (!form.nombre || !form.slug || !form.admin_email || !form.admin_password) return;

        // Formatear slug para que sea url friendly
        const cleanSlug = form.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

        try {
            // 1. Verificar si slug existe
            const { data: existing } = await supabase.from("sucursales").select("id").eq("slug", cleanSlug).single();
            if (existing) {
                alert("El slug ya está en uso. Elige otro.");
                return;
            }

            // 2. Crear Auth user en Supabase (requiere que el superadmin tenga Service Role para crear a admin user)
            // Ya que desde cliente no podemos crear otro usuario y hacerle bypass de email confirm
            // Vamos a llamar a un API endpoint nuevo /api/superadmin/tenant
            const res = await fetch('/api/superadmin/tenant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, slug: cleanSlug })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error al crear tenant");
            }

            alert("Multi-Tenant Creado Exitosamente!");
            setShowForm(false);
            setForm({ nombre: "", slug: "", admin_email: "", admin_password: "" });
            fetchSucursales();

        } catch (error: any) {
            alert(error.message);
        }
    }

    if (authChecking) return <div className="min-h-screen bg-[#111] flex items-center justify-center text-white"><span className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center p-4">
                <form onSubmit={handleLogin} className="w-full max-w-sm bg-[#1a1a1a] p-8 rounded-3xl border border-white/10 shadow-2xl space-y-5">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-purple-600/20 text-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-purple-500/20">
                            <ShieldCheck size={32} />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-wide">SUPERADMIN</h1>
                        <p className="text-sm text-slate-400 mt-1">Acceso Exclusivo</p>
                    </div>

                    <div className="space-y-3">
                        <input
                            type="email" placeholder="Email" required value={email} onChange={e => setEmail(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500 transition-colors"
                        />
                        <input
                            type="password" placeholder="Contraseña" required value={password} onChange={e => setPassword(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>

                    <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl uppercase tracking-widest text-sm transition-all shadow-lg shadow-purple-900/40">
                        INGRESAR
                    </button>

                    <p className="text-xs text-center text-slate-500 mt-6">
                        MMM SYSTEM | Multi-Tenant Platform V1.0
                    </p>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f3f4f6]">
            {/* Nav */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-inner">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-gray-900 leading-tight">MMM SUPERADMIN</h1>
                        <p className="text-xs text-gray-500 font-medium">Gestión Multi-Tenant</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={async () => { await supabase.auth.signOut(); checkUser(); }}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors font-medium border border-gray-200 hover:border-red-200 bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg"
                    >
                        <LogOut size={16} /> Salir
                    </button>
                </div>
            </header>

            <main className="p-6 max-w-7xl mx-auto space-y-6">

                {/* Header Action */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Negocios Registrados ({sucursales.length})</h2>
                        <p className="text-sm text-gray-500 mt-1">Administra los tenants (sucursales) activos en el SaaS.</p>
                    </div>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 text-sm"
                    >
                        <Plus size={16} /> Crear Nuevo Negocio
                    </button>
                </div>

                {/* Form */}
                {showForm && (
                    <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-lg shadow-purple-900/5 animate-in fade-in slide-in-from-top-4">
                        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                            <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-lg flex items-center justify-center"><Plus size={16} /></div>
                            <h3 className="font-bold text-gray-900">Alta de Nuevo Multi-Tenant</h3>
                        </div>

                        <form onSubmit={handleCreateTenant} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Nombre del Local / Marca</label>
                                    <input required type="text" value={form.nombre} onChange={e => {
                                        const val = e.target.value;
                                        setForm({ ...form, nombre: val, slug: form.slug || val.toLowerCase().replace(/[^a-z0-9]/g, '-') });
                                    }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200" placeholder="Ej: Pizzería Roma" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">URL / Slug Único</label>
                                    <div className="flex items-stretch shadow-sm rounded-xl">
                                        <div className="bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl px-3 flex items-center text-sm text-gray-500 shrink-0 font-medium">mmm-system.com/</div>
                                        <input required type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="w-full bg-gray-50 border border-gray-200 rounded-r-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200" placeholder="pizzeria-roma" />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">El slug determinará la URL de acceso (ej: /pizzeria-roma y /pizzeria-roma/admin).</p>
                                </div>
                            </div>

                            <div className="space-y-4 md:border-l border-gray-100 md:pl-5">
                                <div className="mb-2">
                                    <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2"><Mail size={16} className="text-gray-400" /> Credenciales del Administrador</h4>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Email de Acceso (Owner)</label>
                                    <input required type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200" placeholder="dueño@pizzeriaroma.com" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Contraseña Inicial</label>
                                    <input required type="text" value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200" placeholder="Mínimo 6 caracteres" minLength={6} />
                                </div>
                            </div>

                            <div className="col-span-full pt-4 flex gap-3 justify-end border-t border-gray-100 mt-2">
                                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 text-sm font-bold tracking-wide rounded-xl shadow-md transition-colors">Confirmar y Crear Negocio</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* List */}
                {loading ? (
                    <div className="py-20 flex justify-center"><Loader2 size={32} className="animate-spin text-purple-600" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {sucursales.map(s => (
                            <div key={s.id} className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-shadow flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-400 text-xl overflow-hidden shrink-0 border border-gray-200">
                                            {s.imagen_url ? <img src={s.imagen_url} alt="Logo" className="w-full h-full object-cover" /> : s.nombre.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="bg-green-100 text-green-800 text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-lg">ACTIVO</span>
                                    </div>
                                    <h3 className="font-bold text-lg mb-1 leading-tight">{s.nombre}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                                        <Building2 size={14} className="text-gray-400 shrink-0" />
                                        <span className="truncate" title={s.direccion || "Sin dirección"}>{s.direccion || "Sin configurar"}</span>
                                    </div>
                                </div>
                                <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2">
                                    <a href={`/${s.slug}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 py-2 rounded-lg transition-colors border border-gray-200">
                                        <ExternalLink size={14} /> Tienda
                                    </a>
                                    <a href={`/${s.slug}/admin`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 py-2 rounded-lg transition-colors border border-purple-200">
                                        <ShieldCheck size={14} /> Admin
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
