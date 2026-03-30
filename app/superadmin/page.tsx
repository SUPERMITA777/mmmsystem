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

    const [activeTab, setActiveTab] = useState<"tenants" | "users">("tenants");
    const [users, setUsers] = useState<any[]>([]);
    
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

    async function fetchUsers() {
        const res = await fetch("/api/superadmin/users");
        if (res.ok) {
            const data = await res.json();
            setUsers(data.users || []);
        }
    }

    useEffect(() => {
        if (isSuperAdmin) {
            fetchSucursales();
            fetchUsers();
        }
    }, [isSuperAdmin]);

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

    async function handleSaveUser(e: React.FormEvent) {
        e.preventDefault();
        try {
            const isNew = !editingUser?.id;
            const url = "/api/superadmin/users";
            const method = isNew ? "POST" : "PUT";
            
            const payload = isNew 
                ? { ...userForm }
                : { user_id: editingUser.id, ...userForm };

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
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
                    <button onClick={() => setActiveTab("tenants")} className={`text-sm font-bold px-4 py-2 rounded-lg transition-colors ${activeTab === 'tenants' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>Locales</button>
                    <button onClick={() => setActiveTab("users")} className={`text-sm font-bold px-4 py-2 rounded-lg transition-colors ${activeTab === 'users' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>Usuarios</button>
                    <div className="w-px h-6 bg-gray-200 mx-2"></div>
                    <button
                        onClick={async () => { await supabase.auth.signOut(); checkUser(); }}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors font-medium border border-gray-200 hover:border-red-200 bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg"
                    >
                        <LogOut size={16} /> Salir
                    </button>
                </div>
            </header>

            <main className="p-6 max-w-7xl mx-auto space-y-6">

                {activeTab === "tenants" && (
                    <>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Negocios Registrados ({sucursales.length})</h2>
                                <p className="text-sm text-gray-500 mt-1">Administra los tenants y suscripciones activos en el sistema.</p>
                            </div>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 text-sm"
                            >
                                <Plus size={16} /> Crear Test Tenant
                            </button>
                        </div>

                        {showForm && (
                            <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-lg shadow-purple-900/5 animate-in fade-in">
                                {/* Form contents unchanged from before */}
                                <form onSubmit={handleCreateTenant} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Nombre del Local</label>
                                            <input required type="text" value={form.nombre} onChange={e => {
                                                const val = e.target.value;
                                                setForm({ ...form, nombre: val, slug: form.slug || val.toLowerCase().replace(/[^a-z0-9]/g, '-') });
                                            }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="Pizzería Roma" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">URL Slug</label>
                                            <input required type="text" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" placeholder="pizzeria-roma" />
                                        </div>
                                    </div>

                                    <div className="space-y-4 md:border-l border-gray-100 md:pl-5">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Email Owner</label>
                                            <input required type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-widest mb-1.5">Contraseña (min 6)</label>
                                            <input required type="text" value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" minLength={6} />
                                        </div>
                                    </div>
                                    <div className="col-span-full pt-4 flex gap-3 justify-end border-t border-gray-100 mt-2">
                                        <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl">Cancelar</button>
                                        <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 text-sm font-bold rounded-xl shadow-md">Crear</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {loading ? (
                            <div className="py-20 flex justify-center"><Loader2 size={32} className="animate-spin text-purple-600" /></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {sucursales.map(s => {
                                    const isExpired = s.subscription_end && new Date(s.subscription_end) < new Date();
                                    return (
                                    <div key={s.id} className="bg-white border text-gray-900 border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-shadow flex flex-col justify-between group">
                                        <div>
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-400 text-xl overflow-hidden shrink-0 border border-gray-200">
                                                    {s.imagen_url ? <img src={s.imagen_url} alt="Logo" className="w-full h-full object-cover" /> : s.nombre.charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-lg ${isExpired ? "bg-rose-100 text-rose-800" : "bg-green-100 text-green-800"}`}>
                                                    {isExpired ? "EXPIRADO" : "ACTIVO"}
                                                </span>
                                            </div>
                                            <h3 className="font-bold text-lg mb-1 leading-tight">{s.nombre}</h3>
                                            <p className="text-xs text-gray-500 mb-2 truncate" title={s.id}>ID: {s.id}</p>
                                            
                                            <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                <p className="text-xs font-bold text-gray-500 uppercase">Suscripción Hasta</p>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className={`text-sm font-bold ${isExpired ? 'text-rose-600' : 'text-gray-900'}`}>
                                                        {s.subscription_end ? new Date(s.subscription_end).toLocaleDateString() : 'Ilimitada'}
                                                    </span>
                                                    {extendingTenant === s.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" min="1" value={extendDays} onChange={e=>setExtendDays(e.target.value)} className="w-16 px-1.5 py-1 text-xs border rounded outline-none" placeholder="Días..." />
                                                            <button onClick={() => handleExtendSubscription(s.id)} className="bg-purple-600 text-white px-2 py-1 text-xs rounded font-bold hover:bg-purple-700">OK</button>
                                                            <button onClick={() => setExtendingTenant(null)} className="text-gray-400 hover:text-gray-600 px-1"><Plus size={14} className="rotate-45" /></button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => setExtendingTenant(s.id)} className="text-xs text-purple-600 hover:text-purple-800 font-bold bg-purple-50 px-2 py-1 rounded">Sumar Días</button>
                                                    )}
                                                </div>
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
                                )})}
                            </div>
                        )}
                    </>
                )}

                {activeTab === "users" && (
                     <div className="space-y-4">
                        <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Gestión de Usuarios</h2>
                                <p className="text-sm text-gray-500 mt-1">Crea nuevos usuarios, modifica contraseñas y asigna roles o locales.</p>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingUser(null);
                                    setUserForm({ email: "", password: "", role: "user", sucursal_id: "" });
                                    setShowUserModal(true);
                                }}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm shadow-md"
                            >
                                <Plus size={16} /> Crear Usuario
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm text-gray-600">
                                <thead className="bg-gray-100 text-xs text-gray-500 uppercase tracking-widest border-b border-gray-200">
                                    <tr>
                                        <th className="py-3 px-4">Email</th>
                                        <th className="py-3 px-4">Rol</th>
                                        <th className="py-3 px-4">Local Asignado</th>
                                        <th className="py-3 px-4">Fecha Creación</th>
                                        <th className="py-3 px-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 font-medium text-gray-900">{u.email}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-black tracking-widest uppercase ${u.role === 'superadmin' ? 'bg-red-100 text-red-700' : u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-700'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">{u.sucursal_nombre || <span className="text-gray-400 italic">No asignado</span>}</td>
                                            <td className="py-3 px-4">{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td className="py-3 px-4 text-right">
                                                <button onClick={() => {
                                                    setEditingUser(u);
                                                    setUserForm({ email: u.email, password: "", role: u.role, sucursal_id: u.sucursal_id || "" });
                                                    setShowUserModal(true);
                                                }} className="text-purple-600 font-bold hover:underline text-xs">Editar</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr><td colSpan={5} className="py-10 text-center">No se encontraron usuarios.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                     </div>
                )}
            </main>

            {/* User Edit Modal */}
            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-purple-200/50">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">{editingUser ? "Editar Usuario" : "Crear Nuevo Usuario"}</h3>
                            <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600"><Plus className="rotate-45" /></button>
                        </div>
                        <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                                <input required type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} disabled={!!editingUser} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-50" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    {editingUser ? "Nueva Contraseña (dejar en blanco para no cambiar)" : "Contraseña"}
                                </label>
                                <input type="text" minLength={6} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" required={!editingUser} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Rol</label>
                                    <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none">
                                        <option value="user">Usuario normal</option>
                                        <option value="cocina">Cocina</option>
                                        <option value="admin">Admin Tienda</option>
                                        <option value="superadmin">Superadmin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Tienda asignada</label>
                                    <select value={userForm.sucursal_id} onChange={e => setUserForm({...userForm, sucursal_id: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none">
                                        <option value="">Ninguna</option>
                                        {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-2 justify-end">
                                <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm">Guardar Usuario</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
