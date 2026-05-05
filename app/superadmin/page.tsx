"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
    Plus, Building2, ExternalLink, ShieldCheck, 
    Mail, LogOut, Loader2, BarChart3, Users as UsersIcon, 
    TrendingUp, Eye, Search, Filter, MoreVertical, X, Pencil,
    Bot, ToggleLeft, ToggleRight
} from "lucide-react";
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, Cell, AreaChart, Area 
} from 'recharts';

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

    const [activeTab, setActiveTab] = useState<"tenants" | "users" | "metrics" | "landing_config">("tenants");
    const [users, setUsers] = useState<any[]>([]);

    const [landingForm, setLandingForm] = useState<any>({
        phone: "",
        whatsapp: "",
        email: "",
        title: "",
        subtitle: "",
        heroTitle: "",
        heroSubtitle: "",
        aboutTitle: "",
        aboutText: "",
        features: [],
        pricingTitle: "",
        pricingSubtitle: "",
        plans: []
    });
    const [landingLoading, setLandingLoading] = useState(false);

    async function fetchLandingConfig() {
        setLandingLoading(true);
        try {
            const res = await fetch("/api/superadmin/landing-config");
            if (res.ok) {
                const data = await res.json();
                setLandingForm(data);
            }
        } catch (err) {
            console.error("Error loading landing config:", err);
        } finally {
            setLandingLoading(false);
        }
    }

    async function handleSaveLandingConfig(e: React.FormEvent) {
        e.preventDefault();
        setLandingLoading(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/superadmin/landing-config", {
                method: "POST",
                headers,
                body: JSON.stringify(landingForm)
            });
            if (res.ok) {
                alert("Configuración de página de ventas guardada correctamente!");
            } else {
                const err = await res.json();
                alert("Error al guardar: " + (err.error || "Desconocido"));
            }
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setLandingLoading(false);
        }
    }

    
    // Metrics filtering
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split("T")[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [metricsData, setMetricsData] = useState<any[]>([]);
    const [metricsLoading, setMetricsLoading] = useState(false);
    const [selectedSucursalFilter, setSelectedSucursalFilter] = useState("all");

    // User Edit modal states
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [userForm, setUserForm] = useState({
        email: "",
        password: "",
        role: "user",
        sucursal_id: ""
    });

    const [extendingTenant, setExtendingTenant] = useState<string | null>(null);
    const [extendDays, setExtendDays] = useState("30");
    const [togglingAgent, setTogglingAgent] = useState<string | null>(null);

    // Helper to get auth headers with Bearer token for API calls
    async function getAuthHeaders(): Promise<Record<string, string>> {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            "Content-Type": "application/json",
            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {})
        };
    }

    async function fetchUsers() {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/superadmin/users", { headers });
        if (res.ok) {
            const data = await res.json();
            setUsers(data.users || []);
        }
    }

    async function fetchMetrics() {
        setMetricsLoading(true);
        try {
            let query = supabase
                .from("analytics_visitas")
                .select(`
                    id,
                    fecha,
                    hora,
                    cantidad,
                    sucursales (nombre, slug)
                `)
                .gte("fecha", startDate)
                .lte("fecha", endDate);

            if (selectedSucursalFilter !== "all") {
                query = query.eq("sucursal_id", selectedSucursalFilter);
            }

            const { data, error } = await query;

            if (error) throw error;
            setMetricsData(data || []);
        } catch (e) {
            console.error("Error fetching metrics:", e);
        } finally {
            setMetricsLoading(false);
        }
    }

    useEffect(() => {
        if (isSuperAdmin) {
            fetchSucursales();
            fetchUsers();
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        if (isSuperAdmin && activeTab === "metrics") {
            fetchMetrics();
        }
    }, [activeTab, isSuperAdmin, startDate, endDate, selectedSucursalFilter]);

    useEffect(() => {
        if (isSuperAdmin && activeTab === "landing_config") {
            fetchLandingConfig();
        }
    }, [activeTab, isSuperAdmin]);

    async function handleExtendSubscription(tenantId: string) {
        if(!extendDays || isNaN(Number(extendDays))) return alert("Días inválidos");
        
        try {
            const res = await fetch("/api/superadmin/tenant/subscription", {
                method: "PUT",
                headers: { "Content-Type" : "application/json"},
                body: JSON.stringify({ sucursal_id: tenantId, days_to_add: Number(extendDays) })
            });
            if(!res.ok) throw new Error("Error extendiendo suscripción");
            alert("Suscripción extendida");
            fetchSucursales();
            setExtendingTenant(null);
        } catch(e: any) {
            alert(e.message);
        }
    }

    async function handleToggleAgent(tenantId: string, currentlyEnabled: boolean) {
        setTogglingAgent(tenantId);
        try {
            const res = await fetch("/api/ai/agent-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sucursal_id: tenantId,
                    config: { enabled: !currentlyEnabled }
                })
            });
            if (!res.ok) throw new Error("Error al cambiar estado del agente");
            // Update local state
            setSucursales(prev => prev.map(s => {
                if (s.id === tenantId) {
                    return {
                        ...s,
                        _agent_enabled: !currentlyEnabled
                    };
                }
                return s;
            }));
        } catch(e: any) {
            alert(e.message);
        } finally {
            setTogglingAgent(null);
        }
    }

    async function handleSaveUser(e: React.FormEvent) {
        e.preventDefault();
        try {
            const isNew = !editingUser?.id;
            const url = "/api/superadmin/users";
            const method = isNew ? "POST" : "PUT";
            
            const payload = isNew 
                ? { ...userForm }
                : { user_id: editingUser.id, ...userForm };

            const headers = await getAuthHeaders();
            const res = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(payload)
            });

            if(!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error guardando usuario");
            }
            alert(isNew ? "Usuario creado" : "Usuario modificado");
            setShowUserModal(false);
            fetchUsers();
        } catch (error: any) {
            alert(error.message);
        }
    }

    // ========== Metrics calculations (Hoisted from JSX) ==========
    const dataByDate = useMemo(() => {
        const grouped: Record<string, number> = {};
        metricsData.forEach(m => {
            grouped[m.fecha] = (grouped[m.fecha] || 0) + Number(m.cantidad);
        });
        return Object.entries(grouped)
            .map(([fecha, cantidad]) => ({ fecha, cantidad }))
            .sort((a,b) => a.fecha.localeCompare(b.fecha));
    }, [metricsData]);

    const dataByTenant = useMemo(() => {
        const grouped: Record<string, number> = {};
        metricsData.forEach(m => {
            const name = m.sucursales?.nombre || "Desconocido";
            grouped[name] = (grouped[name] || 0) + Number(m.cantidad);
        });
        return Object.entries(grouped)
            .map(([name, cantidad]) => ({ name, cantidad }))
            .sort((a,b) => b.cantidad - a.cantidad);
    }, [metricsData]);

    const totalVisits = useMemo(() => 
        metricsData.reduce((acc, curr) => acc + Number(curr.cantidad), 0)
    , [metricsData]);

    const dataByHour = useMemo(() => {
        const grouped: Record<number, number> = {};
        metricsData.forEach(m => {
            const h = Number(m.hora || 0);
            grouped[h] = (grouped[h] || 0) + Number(m.cantidad);
        });
        return Array.from({length: 24}).map((_, i) => ({
            hora_str: `${i.toString().padStart(2, '0')}:00`,
            cantidad: grouped[i] || 0
        }));
    }, [metricsData]);

    const handleExportCSV = () => {
        const headers = ["Fecha", "Local", "Visitas"];
        const rows = metricsData.map(m => [m.fecha, m.sucursales?.nombre || "N/A", m.cantidad]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_visitas_${startDate}_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (authChecking) return <div className="min-h-screen bg-[#111] flex items-center justify-center text-white"><span className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" /></div>;

    if (!isSuperAdmin) {
        return (
            <div className="min-h-screen bg-[#060e20] flex items-center justify-center p-4 relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#00B2FF]/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />

                <form onSubmit={handleLogin} className="w-full max-w-md bg-white/[0.03] backdrop-blur-2xl p-12 rounded-[3rem] border border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-500">
                    <div className="text-center mb-12">
                        <div className="w-20 h-20 bg-[#00B2FF]/10 text-[#00B2FF] rounded-3xl flex items-center justify-center mx-auto mb-6 border border-[#00B2FF]/20 shadow-[0_0_30px_rgba(0,178,255,0.2)]">
                            <ShieldCheck size={40} />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight uppercase italic">MMM SUPERADMIN</h1>
                        <p className="text-[10px] text-slate-500 mt-2 font-black uppercase tracking-[0.3em]">Acceso de Seguridad Nivel 1</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Identificación</label>
                            <input
                                type="email" placeholder="email@ejemplo.com" required value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-[#00B2FF] transition-all placeholder:text-slate-700 font-bold"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Contraseña Maestra</label>
                            <input
                                type="password" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none focus:border-[#00B2FF] transition-all placeholder:text-slate-700"
                            />
                        </div>
                    </div>

                    <button type="submit" className="w-full bg-[#00B2FF] hover:bg-[#0092d1] text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] text-xs transition-all shadow-[0_0_30px_rgba(0,178,255,0.3)] mt-8 active:scale-[0.98]">
                        Autenticar Acceso
                    </button>

                    <div className="text-center mt-12 flex flex-col items-center gap-4">
                        <div className="w-px h-8 bg-gradient-to-b from-transparent to-white/10" />
                        <p className="text-[10px] text-slate-600 font-bold tracking-widest uppercase">
                            Infraestructura de Gestión v3.5
                        </p>
                    </div>
                </form>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#060e20] text-slate-100 font-sans selection:bg-cyan-500/30">
            {/* Header / Nav */}
            <header className="bg-[#0f172a]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#00B2FF] rounded-xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,178,255,0.4)]">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-white uppercase italic">MMM SUPERADMIN</h1>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Panel de Control Global</p>
                        </div>
                    </div>
                </div>

                <nav className="flex items-center gap-2 bg-black/20 p-1 rounded-2xl border border-white/5">
                    {[
                        { id: "tenants", label: "Locales", icon: Building2 },
                        { id: "users", label: "Usuarios", icon: UsersIcon },
                        { id: "metrics", label: "Métricas", icon: BarChart3 },
                        { id: "landing_config", label: "Pág. Ventas", icon: Bot },
                    ].map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-2 text-xs font-bold px-5 py-2 rounded-xl transition-all ${
                                activeTab === t.id 
                                ? "bg-[#00B2FF] text-white shadow-lg shadow-cyan-900/40" 
                                : "text-slate-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            <t.icon size={16} />
                            {t.label}
                        </button>
                    ))}
                </nav>

                <button
                    onClick={async () => { await supabase.auth.signOut(); checkUser(); }}
                    className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-all font-bold bg-white/5 hover:bg-red-500/10 px-4 py-2.5 rounded-xl border border-white/5 hover:border-red-500/20"
                >
                    <LogOut size={16} /> Salir
                </button>
            </header>

            <main className="p-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

                {activeTab === "tenants" && (
                    <div className="space-y-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl shadow-2xl">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight">Negocios Registrados <span className="text-[#00B2FF]">({sucursales.length})</span></h2>
                                <p className="text-sm text-slate-400 mt-2 font-medium">Control centralizado de instancias y licencias SaaS.</p>
                            </div>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="bg-[#00B2FF] hover:bg-[#0092d1] text-white font-bold px-8 py-3.5 rounded-2xl transition-all shadow-[0_0_20px_rgba(0,178,255,0.3)] flex items-center gap-3 text-sm active:scale-95"
                            >
                                <Plus size={20} /> Crear Nuevo Negocio
                            </button>
                        </div>

                        {showForm && (
                            <div className="bg-[#0f172a] p-8 rounded-[2rem] border border-[#00B2FF]/20 shadow-2xl animate-in zoom-in-95 duration-300">
                                <form onSubmit={handleCreateTenant} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Nombre del Local</label>
                                            <input required type="text" value={form.nombre} onChange={e => {
                                                const val = e.target.value;
                                                setForm({ ...form, nombre: val, slug: form.slug || val.toLowerCase().replace(/[^a-z0-9]/g, '-') });
                                            }} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#00B2FF] transition-all text-white placeholder:text-slate-600" placeholder="Ej: Pizzería Roma" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">URL Slug (Identificador)</label>
                                            <input required type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#00B2FF] transition-all text-white" placeholder="pizzeria-roma" />
                                        </div>
                                    </div>

                                    <div className="space-y-6 md:border-l border-white/5 md:pl-8">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Email del Administrador</label>
                                            <input required type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#00B2FF] transition-all text-white" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Contraseña de Acceso</label>
                                            <input required type="text" value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm outline-none focus:border-[#00B2FF] transition-all text-white" minLength={6} />
                                        </div>
                                    </div>
                                    <div className="col-span-full pt-6 flex gap-4 justify-end border-t border-white/5 mt-4">
                                        <button type="button" onClick={() => setShowForm(false)} className="px-8 py-3.5 text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all">Cancelar</button>
                                        <button type="submit" className="bg-[#00B2FF] hover:bg-[#0092d1] text-white px-10 py-3.5 text-sm font-black rounded-2xl shadow-xl shadow-cyan-900/20 uppercase tracking-widest">Inicializar Tenant</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {loading ? (
                            <div className="py-20 flex justify-center items-center gap-3">
                                <Loader2 size={32} className="animate-spin text-[#00B2FF]" />
                                <span className="text-slate-500 font-bold tracking-widest text-xs uppercase">Sincronizando Datos...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {sucursales.map(s => {
                                    const isExpired = s.subscription_end && new Date(s.subscription_end) < new Date();
                                    return (
                                    <div key={s.id} className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 flex flex-col justify-between group hover:border-[#00B2FF]/40 transition-all duration-500 hover:translate-y-[-4px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                                        <div className="relative">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center font-black text-[#00B2FF] text-2xl overflow-hidden shrink-0 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                    {s.imagen_url ? <img src={s.imagen_url} alt="Logo" className="w-full h-full object-cover" /> : s.nombre.charAt(0).toUpperCase()}
                                                </div>
                                                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border transition-all ${
                                                    isExpired 
                                                    ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
                                                    : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isExpired ? "bg-red-500" : "bg-emerald-500"}`} />
                                                    {isExpired ? "EXPIRADO" : "ACTIVO"}
                                                </div>
                                            </div>

                                            <h3 className="font-black text-2xl mb-1 text-white leading-tight group-hover:text-[#00B2FF] transition-colors">{s.nombre}</h3>
                                            <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase mb-6 truncate opacity-60">UUID: {s.id}</p>
                                            
                                            <div className="mt-8 p-6 bg-black/30 rounded-3xl border border-white/5 relative overflow-hidden group/sub">
                                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/sub:opacity-30 transition-opacity">
                                                    <ShieldCheck size={40} className="text-[#00B2FF]" />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Vencimiento Suscripción</p>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className={`text-lg font-black tracking-tight ${isExpired ? 'text-red-400' : 'text-white'}`}>
                                                        {s.subscription_end ? new Date(s.subscription_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'PLAN ILIMITADO'}
                                                    </span>
                                                </div>
                                                <div className="mt-4 pt-4 border-t border-white/5">
                                                    {extendingTenant === s.id ? (
                                                        <div className="flex items-center gap-3 animate-in slide-in-from-right-4">
                                                            <input type="number" min="1" value={extendDays} onChange={e=>setExtendDays(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#00B2FF] text-white" placeholder="Días..." />
                                                            <button onClick={() => handleExtendSubscription(s.id)} className="bg-[#00B2FF] text-white px-6 py-2.5 text-xs rounded-xl font-black hover:bg-[#0092d1] transition-all">OK</button>
                                                            <button onClick={() => setExtendingTenant(null)} className="text-slate-500 hover:text-white p-2 bg-white/5 rounded-xl transition-all"><X size={18} /></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setExtendingTenant(s.id)} className="w-full text-xs text-[#00B2FF] hover:text-white font-black bg-[#00B2FF]/10 hover:bg-[#00B2FF] py-3 rounded-xl transition-all border border-[#00B2FF]/20 uppercase tracking-widest">Extender Licencia</button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Agent IA Toggle */}
                                        <div className="mt-6 p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                                        <Bot size={18} className="text-purple-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-white uppercase tracking-wider">Agente IA</p>
                                                        <p className="text-[10px] text-slate-500 mt-0.5">WhatsApp + Administración Autónoma</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleAgent(s.id, s._agent_enabled || false)}
                                                    disabled={togglingAgent === s.id}
                                                    className={`p-1 rounded-full transition-colors ${s._agent_enabled ? 'text-purple-400' : 'text-slate-600'}`}
                                                >
                                                    {togglingAgent === s.id
                                                        ? <Loader2 size={32} className="animate-spin text-purple-400" />
                                                        : s._agent_enabled
                                                            ? <ToggleRight size={32} strokeWidth={1.5} />
                                                            : <ToggleLeft size={32} strokeWidth={1.5} />
                                                    }
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-8 grid grid-cols-2 gap-4">
                                            <a href={`/${s.slug}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-xs font-black text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 py-4 rounded-2xl transition-all border border-white/5 hover:border-white/20 uppercase tracking-widest">
                                                <Eye size={16} /> Ver Tienda
                                            </a>
                                            <a href={`/${s.slug}/admin`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 text-xs font-black text-[#00B2FF] hover:text-white bg-[#00B2FF]/5 hover:bg-[#00B2FF] py-4 rounded-2xl transition-all border border-[#00B2FF]/10 hover:border-[#00B2FF] uppercase tracking-widest">
                                                <ShieldCheck size={16} /> Panel Admin
                                            </a>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "users" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl shadow-2xl">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight">Gestión de Usuarios</h2>
                                <p className="text-sm text-slate-400 mt-2 font-medium">Control de accesos, roles y asignación de sucursales.</p>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingUser(null);
                                    setUserForm({ email: "", password: "", role: "user", sucursal_id: "" });
                                    setShowUserModal(true);
                                }}
                                className="bg-[#00B2FF] hover:bg-[#0092d1] text-white font-bold px-8 py-3.5 rounded-2xl transition-all shadow-[0_0_20px_rgba(0,178,255,0.3)] flex items-center gap-3 text-sm active:scale-95"
                            >
                                <Plus size={20} /> Nuevo Usuario
                            </button>
                        </div>

                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-white/5 text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black border-b border-white/5">
                                    <tr>
                                        <th className="py-6 px-8">Usuario / Email</th>
                                        <th className="py-6 px-8">Rol</th>
                                        <th className="py-6 px-8">Local Asignado</th>
                                        <th className="py-6 px-8">Registro</th>
                                        <th className="py-6 px-8 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {users.map(u => (
                                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="py-6 px-8 font-bold text-white flex items-center gap-3">
                                                <div className="w-8 h-8 bg-[#00B2FF]/10 rounded-lg flex items-center justify-center text-[#00B2FF]">
                                                    <Mail size={14} />
                                                </div>
                                                {u.email}
                                            </td>
                                            <td className="py-6 px-8">
                                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase border ${
                                                    u.role === 'superadmin' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                                                    u.role === 'admin' ? 'bg-[#00B2FF]/10 text-[#00B2FF] border-[#00B2FF]/20' : 
                                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="py-6 px-8 font-medium">
                                                {u.sucursal_nombre ? (
                                                    <div className="flex items-center gap-2">
                                                        <Building2 size={14} className="text-[#00B2FF]" />
                                                        {u.sucursal_nombre}
                                                    </div>
                                                ) : <span className="text-slate-600 italic text-xs">Sin asignar</span>}
                                            </td>
                                            <td className="py-6 px-8 text-slate-500 font-bold text-xs uppercase tracking-wider">{new Date(u.created_at).toLocaleDateString('es-ES')}</td>
                                            <td className="py-6 px-8 text-right">
                                                <button onClick={() => {
                                                    setEditingUser(u);
                                                    setUserForm({ email: u.email, password: "", role: u.role, sucursal_id: u.sucursal_id || "" });
                                                    setShowUserModal(true);
                                                }} className="bg-white/5 hover:bg-[#00B2FF]/10 text-slate-400 hover:text-[#00B2FF] p-2.5 rounded-xl transition-all border border-white/5 hover:border-[#00B2FF]/30" title="Editar Usuario">
                                                    <Pencil size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr><td colSpan={5} className="py-20 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">No hay usuarios registrados</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                     </div>
                )}

                {activeTab === "metrics" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight">Analíticas de <span className="text-[#00B2FF]">Alcance</span></h2>
                                <p className="text-sm text-slate-400 mt-2 font-medium">Reporte detallado de visitas a páginas públicas.</p>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-4 bg-black/40 p-2 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3 px-4 border-r border-white/10">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Local</span>
                                        <select 
                                            value={selectedSucursalFilter} 
                                            onChange={e => setSelectedSucursalFilter(e.target.value)}
                                            className="bg-transparent text-white text-xs font-bold outline-none border-b border-white/10 focus:border-[#00B2FF] cursor-pointer"
                                        >
                                            <option value="all" className="bg-[#111]">Todos los Locales</option>
                                            {sucursales.map(s => (
                                                <option key={s.id} value={s.id} className="bg-[#111]">{s.nombre}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 px-4">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Desde</span>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-white text-xs font-bold outline-none border-b border-white/10 focus:border-[#00B2FF]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hasta</span>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-white text-xs font-bold outline-none border-b border-white/10 focus:border-[#00B2FF]" />
                                    </div>
                                </div>
                                <button 
                                    onClick={handleExportCSV}
                                    className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl transition-all border border-white/10 flex items-center gap-3 text-xs"
                                >
                                    <TrendingUp size={16} className="text-[#00B2FF]" /> Exportar CSV
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Visitas Totales Periodo</p>
                                <h3 className="text-4xl font-black text-white">{totalVisits.toLocaleString()}</h3>
                                <div className="mt-4 flex items-center gap-2 text-emerald-400 text-xs font-bold">
                                    <TrendingUp size={14} />
                                    <span>Tráfico Consolidado</span>
                                </div>
                            </div>
                            <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Locales con Tráfico</p>
                                <h3 className="text-4xl font-black text-white">{dataByTenant.length}</h3>
                                <div className="mt-4 flex items-center gap-2 text-[#00B2FF] text-xs font-bold">
                                    <Building2 size={14} />
                                    <span>Negocios con actividad</span>
                                </div>
                            </div>
                            <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Promedio Diario</p>
                                <h3 className="text-4xl font-black text-white">
                                    {dataByDate.length > 0 ? Math.round(totalVisits / dataByDate.length).toLocaleString() : 0}
                                </h3>
                                <div className="mt-4 flex items-center gap-2 text-slate-400 text-xs font-bold">
                                    <Eye size={14} />
                                    <span>Frecuencia por jornada</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl h-[450px] flex flex-col">
                                <h3 className="font-black text-white uppercase tracking-widest text-xs mb-8 flex items-center gap-3">
                                    <div className="w-2 h-2 bg-[#00B2FF] rounded-full" />
                                    Evolución de Tráfico Diario
                                </h3>
                                {metricsLoading ? (
                                    <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#00B2FF]" /></div>
                                ) : (
                                    <div className="flex-1 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={dataByDate}>
                                                <defs>
                                                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#00B2FF" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#00B2FF" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                                                <XAxis dataKey="fecha" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(val) => new Date(val).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} />
                                                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '1rem', border: '1px solid #ffffff10', color: '#fff' }}
                                                    itemStyle={{ color: '#00B2FF', fontWeight: 'bold' }}
                                                />
                                                <Area type="monotone" dataKey="cantidad" stroke="#00B2FF" strokeWidth={4} fillOpacity={1} fill="url(#colorVisits)" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl h-[450px] flex flex-col">
                                <h3 className="font-black text-white uppercase tracking-widest text-xs mb-8 flex items-center gap-3">
                                    <div className="w-2 h-2 bg-[#00B2FF] rounded-full" />
                                    Ranking de Alcance por Local
                                </h3>
                                {metricsLoading ? (
                                    <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-[#00B2FF]" /></div>
                                ) : (
                                    <div className="flex-1 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={dataByTenant} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                                                <XAxis type="number" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                                                <YAxis type="category" dataKey="name" stroke="#fff" fontSize={10} width={100} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '1rem', border: '1px solid #ffffff10', color: '#fff' }}
                                                    cursor={{ fill: '#ffffff05' }}
                                                />
                                                <Bar dataKey="cantidad" radius={[0, 8, 8, 0]} barSize={20}>
                                                    {dataByTenant.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index === 0 ? "#00B2FF" : "#00B2FF80"} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Nueva Gráfica de Horarios Pico */}
                        <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl mt-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
                                    <TrendingUp size={20} className="text-orange-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white tracking-tight">Horarios Pico</h3>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mt-1">Acumulado Histórico por Hora</p>
                                </div>
                            </div>
                            
                            <div className="h-[300px] w-full">
                                {metricsData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dataByHour} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorHora" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.1}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="hora_str" stroke="rgba(255,255,255,0.4)" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} fontWeight={800} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#111', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
                                                itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: '800' }}
                                                labelStyle={{ color: '#00B2FF', fontSize: '12px', fontWeight: '800', marginBottom: '8px' }}
                                                formatter={(value: any) => [`${value} visitas`, "Cantidad"]}
                                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            />
                                            <Bar dataKey="cantidad" fill="url(#colorHora)" radius={[4, 4, 0, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mb-4 animate-pulse">
                                            <TrendingUp size={24} className="text-slate-600" />
                                        </div>
                                        <p className="text-sm font-semibold tracking-wide">NO HAY DATOS EN EL PERÍODO SELECCIONADO</p>
                                    </div>
                                )}
                            </div>
                        </div>
                )}

                {activeTab === "landing_config" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl">
                            <div>
                                <h2 className="text-3xl font-black text-white tracking-tight">Página de <span className="text-[#00B2FF]">Ventas</span></h2>
                                <p className="text-sm text-slate-400 mt-2 font-medium">Define los textos, contactos, características y planes de tu landing page global.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <a 
                                    href="/ventas" 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-5 py-3 rounded-xl transition-all flex items-center gap-2 text-xs"
                                >
                                    <ExternalLink size={16} className="text-[#00B2FF]" /> Ver Landing Page
                                </a>
                            </div>
                        </div>

                        {landingLoading ? (
                            <div className="bg-white/5 rounded-[2rem] border border-white/10 p-20 flex flex-col items-center justify-center">
                                <Loader2 className="animate-spin text-[#00B2FF] w-10 h-10 mb-4" />
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Cargando configuraciones...</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSaveLandingConfig} className="space-y-8">
                                {/* Seccion General e Info de Contacto */}
                                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl space-y-6">
                                    <h3 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-3 border-b border-white/5 pb-4">
                                        <div className="w-2 h-2 bg-[#00B2FF] rounded-full" />
                                        Configuraciones de Contacto e Identidad
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nombre del Sistema</label>
                                            <input required type="text" value={landingForm.title || ""} onChange={e => setLandingForm({...landingForm, title: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Teléfono de Contacto</label>
                                            <input required type="text" value={landingForm.phone || ""} onChange={e => setLandingForm({...landingForm, phone: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">WhatsApp Enlace (Sin + ni espacios)</label>
                                            <input required type="text" value={landingForm.whatsapp || ""} onChange={e => setLandingForm({...landingForm, whatsapp: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all" placeholder="Ej: 5491112345678" />
                                        </div>
                                        <div className="space-y-2 col-span-full">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Correo de Soporte</label>
                                            <input required type="email" value={landingForm.email || ""} onChange={e => setLandingForm({...landingForm, email: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all" />
                                        </div>
                                    </div>
                                </div>

                                {/* Presentación Hero */}
                                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl space-y-6">
                                    <h3 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-3 border-b border-white/5 pb-4">
                                        <div className="w-2 h-2 bg-[#00B2FF] rounded-full" />
                                        Textos Principales & Hero
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Título Hero</label>
                                            <input required type="text" value={landingForm.heroTitle || ""} onChange={e => setLandingForm({...landingForm, heroTitle: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Subtítulo Hero</label>
                                            <textarea required rows={3} value={landingForm.heroSubtitle || ""} onChange={e => setLandingForm({...landingForm, heroSubtitle: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all resize-none" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Título Sección "Nosotros"</label>
                                                <input required type="text" value={landingForm.aboutTitle || ""} onChange={e => setLandingForm({...landingForm, aboutTitle: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Texto Sección "Nosotros"</label>
                                                <textarea required rows={3} value={landingForm.aboutText || ""} onChange={e => setLandingForm({...landingForm, aboutText: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all resize-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Características / Módulos */}
                                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl space-y-6">
                                    <h3 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-3 border-b border-white/5 pb-4">
                                        <div className="w-2 h-2 bg-[#00B2FF] rounded-full" />
                                        Características / Módulos del Sistema
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {(landingForm.features || []).map((feat: any, idx: number) => (
                                            <div key={idx} className="bg-black/20 p-6 rounded-2xl border border-white/5 space-y-4">
                                                <span className="text-[10px] font-black text-[#00B2FF] uppercase tracking-widest">Módulo {idx + 1}</span>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Título</label>
                                                    <input required type="text" value={feat.title || ""} onChange={e => {
                                                        const updated = [...landingForm.features];
                                                        updated[idx].title = e.target.value;
                                                        setLandingForm({...landingForm, features: updated});
                                                    }} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Descripción</label>
                                                    <textarea required rows={2} value={feat.description || ""} onChange={e => {
                                                        const updated = [...landingForm.features];
                                                        updated[idx].description = e.target.value;
                                                        setLandingForm({...landingForm, features: updated});
                                                    }} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#00B2FF] transition-all resize-none" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Planes y Precios */}
                                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl space-y-6">
                                    <h3 className="font-black text-white uppercase tracking-widest text-xs flex items-center gap-3 border-b border-white/5 pb-4">
                                        <div className="w-2 h-2 bg-[#00B2FF] rounded-full" />
                                        Planes & Licencias
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                        {(landingForm.plans || []).map((plan: any, idx: number) => (
                                            <div key={idx} className="bg-black/20 p-6 rounded-2xl border border-white/5 space-y-4">
                                                <span className="text-[10px] font-black text-[#00B2FF] uppercase tracking-widest">Plan {idx + 1}</span>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Nombre del Plan</label>
                                                    <input required type="text" value={plan.name || ""} onChange={e => {
                                                        const updated = [...landingForm.plans];
                                                        updated[idx].name = e.target.value;
                                                        setLandingForm({...landingForm, plans: updated});
                                                    }} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Precio</label>
                                                    <input required type="text" value={plan.price || ""} onChange={e => {
                                                        const updated = [...landingForm.plans];
                                                        updated[idx].price = e.target.value;
                                                        setLandingForm({...landingForm, plans: updated});
                                                    }} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#00B2FF] transition-all" />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Características (Separadas por comas)</label>
                                                    <textarea required rows={4} value={(plan.features || []).join(", ")} onChange={e => {
                                                        const updated = [...landingForm.plans];
                                                        updated[idx].features = e.target.value.split(",").map(f => f.trim()).filter(Boolean);
                                                        setLandingForm({...landingForm, plans: updated});
                                                    }} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#00B2FF] transition-all resize-none" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4 border-t border-white/5 pt-8">
                                    <button 
                                        type="submit" 
                                        disabled={landingLoading}
                                        className="bg-[#00B2FF] hover:bg-[#0092d1] text-white px-10 py-4 text-xs font-black rounded-2xl shadow-xl shadow-cyan-900/40 uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {landingLoading && <Loader2 className="animate-spin" size={14} />}
                                        Guardar Configuración
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </main>

            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#0f172a] rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden border border-[#00B2FF]/20 relative">
                        {/* Background glow */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00B2FF]/10 rounded-full blur-3xl" />
                        
                        <div className="px-10 py-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center relative z-10">
                            <div>
                                <h3 className="font-black text-2xl text-white tracking-tight">{editingUser ? "Configurar Perfil" : "Alta de Usuario"}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Sistema de Privilegios</p>
                            </div>
                            <button onClick={() => setShowUserModal(false)} className="bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-white p-3 rounded-2xl transition-all border border-white/5 hover:border-red-500/20"><X size={20} /></button>
                        </div>
                        
                        <form onSubmit={handleSaveUser} className="p-10 space-y-8 relative z-10">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Correo Electrónico</label>
                                <input required type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] disabled:opacity-50 transition-all" />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                    {editingUser ? "Actualizar Contraseña (Opcional)" : "Asignar Contraseña"}
                                </label>
                                <input type="text" minLength={6} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] placeholder:text-slate-600 transition-all" required={!editingUser} placeholder={editingUser ? "Dejar en blanco para mantener actual" : "Mínimo 6 caracteres"} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Rol en el Sistema</label>
                                    <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] appearance-none transition-all">
                                        <option value="user" className="bg-[#0f172a]">Usuario normal</option>
                                        <option value="cocina" className="bg-[#0f172a]">Cocina / Staff</option>
                                        <option value="admin" className="bg-[#0f172a]">Admin de Tienda</option>
                                        <option value="superadmin" className="bg-[#0f172a]">Superadmin Pro</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Instancia Asignada</label>
                                    <select value={userForm.sucursal_id} onChange={e => setUserForm({...userForm, sucursal_id: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-4 text-sm font-bold text-white outline-none focus:border-[#00B2FF] appearance-none transition-all">
                                        <option value="" className="bg-[#0f172a]">Sin Asignación</option>
                                        {sucursales.map(s => <option key={s.id} value={s.id} className="bg-[#0f172a]">{s.nombre}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-6 flex gap-4 justify-end border-t border-white/5">
                                <button type="button" onClick={() => setShowUserModal(false)} className="px-8 py-3.5 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5">Cancelar</button>
                                <button type="submit" className="bg-[#00B2FF] hover:bg-[#0092d1] text-white px-10 py-3.5 text-xs font-black rounded-2xl shadow-xl shadow-cyan-900/40 uppercase tracking-widest transition-all">
                                    Finalizar Operación
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
