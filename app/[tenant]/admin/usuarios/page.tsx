"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit2, Trash2, X, Lock, Mail, User, Shield, Key } from "lucide-react";
import { useTenant } from "@/context/TenantContext";

type Usuario = {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    activo: boolean;
    pin?: string;
    color?: string;
};

const ROL_BADGE: Record<string, string> = {
    super_admin: "bg-red-100 text-red-700",
    admin: "bg-purple-100 text-purple-700",
    cajero: "bg-blue-100 text-blue-700",
    cocinero: "bg-orange-100 text-orange-700",
    repartidor: "bg-green-100 text-green-700",
    camarero: "bg-yellow-100 text-yellow-700",
    empleado: "bg-gray-100 text-gray-700",
};

const ROL_LABELS: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Administrador",
    cajero: "Cajero",
    cocinero: "Cocinero",
    repartidor: "Repartidor",
    camarero: "Camarero",
    empleado: "Empleado",
};

export default function UsuariosPage() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalUser, setModalUser] = useState<Usuario | "new" | null>(null);
    const [form, setForm] = useState({
        nombre: "",
        email: "",
        rol: "empleado",
        pin: "",
        password: "",
        color: "#000000",
        activo: true
    });
    const [submitting, setSubmitting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState<"usuarios" | "permisos">("usuarios");
    const { sucursalId } = useTenant();
    
    // PERMISOS STATE
    const [permisos, setPermisos] = useState<Record<string, any>>({});
    const [savingPermisos, setSavingPermisos] = useState(false);

    const ROLES_LIST = ["super_admin", "admin", "cajero", "cocinero", "repartidor", "camarero", "empleado"];
    const SECCIONES = [
        { id: "settings", label: "Configuraciones" },
        { id: "menu", label: "Menú" },
        { id: "salon", label: "Salón" },
        { id: "panel-pedidos", label: "Panel de pedidos" },
        { id: "cajas", label: "Cajas" },
        { id: "pedidos", label: "Pedidos" },
        { id: "repartidores", label: "Repartidores" },
        { id: "reportes", label: "Reportes" },
        { id: "stock", label: "Stock" },
        { id: "clientes", label: "Clientes" },
        { id: "descuentos", label: "Descuentos" },
        { id: "promos", label: "Promos" },
        { id: "agente-ia", label: "Agente IA" },
        { id: "integraciones", label: "Integraciones" },
        { id: "usuarios", label: "Usuarios" },
        { id: "monitor-cocina", label: "Monitor cocina" },
    ];

    useEffect(() => {
        if (sucursalId) {
            fetchUsuarios();
            loadPermisos();
        }
    }, [sucursalId]);

    async function loadPermisos() {
        if (!sucursalId) return;
        const { data } = await supabase
            .from("config_sucursal")
            .select("permisos")
            .eq("sucursal_id", sucursalId)
            .maybeSingle();

        if (data?.permisos) {
            // Migrate old boolean format to new 3-level format
            const migrated: any = {};
            for (const rol of Object.keys(data.permisos)) {
                migrated[rol] = {};
                for (const sec of Object.keys(data.permisos[rol])) {
                    const val = data.permisos[rol][sec];
                    if (typeof val === "boolean") {
                        migrated[rol][sec] = val ? "edit" : "none";
                    } else {
                        migrated[rol][sec] = val || "none";
                    }
                }
                // Fill missing sections
                SECCIONES.forEach(s => {
                    if (!(s.id in migrated[rol])) {
                        migrated[rol][s.id] = rol === "super_admin" || rol === "admin" ? "edit" : "none";
                    }
                });
            }
            // Fill missing roles
            ROLES_LIST.forEach(r => {
                if (!migrated[r]) {
                    migrated[r] = {};
                    SECCIONES.forEach(s => {
                        migrated[r][s.id] = r === "super_admin" || r === "admin" ? "edit" : "none";
                    });
                }
            });
            setPermisos(migrated);
        } else {
            // Default empty state
            const initial: any = {};
            ROLES_LIST.forEach(r => {
                initial[r] = {};
                SECCIONES.forEach(s => {
                    initial[r][s.id] = (r === "super_admin" || r === "admin") ? "edit" : "none";
                });
            });
            setPermisos(initial);
        }
    }

    async function handleSavePermisos() {
        if (!sucursalId) return;
        setSavingPermisos(true);
        try {
            const { error } = await supabase
                .from("config_sucursal")
                .update({ permisos: permisos })
                .eq("sucursal_id", sucursalId);

            if (error) throw error;
            alert("Permisos guardados correctamente.");
        } catch (error) {
            console.error(error);
            alert("Error al guardar permisos.");
        } finally {
            setSavingPermisos(false);
        }
    }

    function cyclePermiso(rol: string, seccionId: string) {
        if (rol === "super_admin" || rol === "admin") return;
        setPermisos(prev => {
            const current = prev[rol]?.[seccionId] || "none";
            // Cycle: none → view → edit → none
            const next = current === "none" ? "view" : current === "view" ? "edit" : "none";
            return {
                ...prev,
                [rol]: {
                    ...prev[rol],
                    [seccionId]: next
                }
            };
        });
    }

    async function fetchUsuarios() {
        if (!sucursalId) return;
        try {
            // Use server-side API to bypass RLS (super_admin needs cross-tenant access)
            const res = await fetch(`/api/staff?sucursal_id=${sucursalId}&all=true`);
            if (res.ok) {
                const data = await res.json();
                setUsuarios(data || []);
            } else {
                console.error("Error fetching users:", await res.text());
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSync() {
        if (!sucursalId) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/admin/users/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sucursal_id: sucursalId })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Sincronización completada: ${data.synced} usuarios nuevos encontrados.`);
                fetchUsuarios();
            } else {
                throw new Error(data.error);
            }
        } catch (e: any) {
            alert("Error al sincronizar: " + e.message);
        } finally {
            setSyncing(false);
        }
    }

    const openModal = (u: Usuario | "new") => {
        if (u === "new") {
            setForm({ nombre: "", email: "", rol: "empleado", pin: "", password: "", color: "#000000", activo: true });
        } else {
            setForm({
                nombre: u.nombre,
                email: u.email,
                rol: u.rol,
                pin: u.pin || "",
                password: "",
                color: u.color || "#000000",
                activo: u.activo
            });
        }
        setModalUser(u);
    };

    async function handleSubmit() {
        if (!form.nombre || !form.email) return;
        setSubmitting(true);

        try {
            if (modalUser === "new") {
                if (!sucursalId) {
                    alert("Error: No se detectó el ID del local. Por favor recarga la página.");
                    return;
                }
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, sucursal_id: sucursalId })
                });
                const resData = await res.json();
                if (resData.error) throw new Error(resData.error);
            } else if (modalUser) {
                const res = await fetch('/api/admin/users', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: modalUser.id,
                        ...form,
                        // Only send password if it's not empty
                        ...(form.password ? { password: form.password } : {})
                    })
                });
                const resData = await res.json();
                if (resData.error) throw new Error(resData.error);
            }

            setModalUser(null);
            fetchUsuarios();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    async function toggleActivo(u: Usuario) {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: u.id, activo: !u.activo })
            });
            if (res.ok) fetchUsuarios();
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.")) return;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchUsuarios();
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <section className="p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2 uppercase italic">Usuarios y Permisos</h1>
                    <p className="text-gray-500 font-bold text-sm tracking-wide">Gestiona el equipo de trabajo y sus niveles de acceso. (Debug: {usuarios.length} cargados)</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-[10px] text-gray-400 font-mono bg-white px-3 py-2 rounded-xl border border-gray-100 hidden md:block shadow-sm">
                        ID: {sucursalId}
                    </div>
                    {activeTab === "usuarios" && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                title="Sincronizar con Auth de Supabase"
                                className="bg-white border-2 border-gray-100 text-gray-400 hover:text-purple-600 hover:border-purple-100 p-4 rounded-2xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                                <Shield size={20} className={syncing ? "animate-spin" : ""} />
                            </button>
                            <button
                                onClick={() => openModal("new")}
                                className="bg-gray-900 text-white font-black px-8 py-4 rounded-2xl transition-all shadow-xl shadow-gray-200 flex items-center gap-3 text-xs uppercase tracking-widest hover:scale-105 active:scale-95"
                            >
                                <Plus size={18} />
                                Nuevo Usuario
                            </button>
                        </div>
                    )}
                    {activeTab === "permisos" && (
                        <button
                            onClick={handleSavePermisos}
                            disabled={savingPermisos}
                            className="flex items-center gap-2 px-8 py-4 bg-[#7B1FA2] hover:bg-[#6A1B9A] text-white rounded-3xl text-xs font-black transition-all shadow-xl shadow-purple-100 active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                        >
                            <Shield size={18} /> {savingPermisos ? "Guardando..." : "Guardar Permisos"}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-[1.5rem] mb-10 w-fit">
                <button
                    onClick={() => setActiveTab("usuarios")}
                    className={`px-8 py-2.5 rounded-xl text-sm font-black tracking-tight transition-all duration-300 ${activeTab === "usuarios" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                >
                    Usuarios
                </button>
                <button
                    onClick={() => setActiveTab("permisos")}
                    className={`px-8 py-2.5 rounded-xl text-sm font-black tracking-tight transition-all duration-300 ${activeTab === "permisos" ? "bg-white text-[#7B1FA2] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
                >
                    Roles y Accesos
                </button>
            </div>

            {activeTab === "usuarios" ? (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Usuario</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rango</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Estado</th>
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-16 text-center text-gray-400 font-bold italic">
                                        Cargando usuarios...
                                    </td>
                                </tr>
                            ) : usuarios.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-16 text-center text-gray-400 font-bold italic">
                                        No hay usuarios registrados.
                                    </td>
                                </tr>
                            ) : (
                                usuarios.map((u) => (
                                    <tr key={u.id} className="hover:bg-gray-50/30 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div 
                                                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black border-2 border-white shadow-sm uppercase relative overflow-hidden"
                                                    style={{ backgroundColor: u.color || "#111" }}
                                                >
                                                    {u.nombre.charAt(0)}
                                                    {u.rol === 'camarero' && (
                                                        <div className="absolute inset-0 bg-black/10 flex items-end justify-center pb-0.5">
                                                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-black text-gray-900 tracking-tight">{u.nombre}</p>
                                                    <p className="text-[11px] text-gray-400 font-bold">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm ${ROL_BADGE[u.rol] || "bg-gray-100 text-gray-600"}`}>
                                                {ROL_LABELS[u.rol] || u.rol}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex justify-center">
                                                <button
                                                    onClick={() => toggleActivo(u)}
                                                    className={`w-12 h-6 rounded-full relative transition-all duration-500 shadow-inner ${u.activo ? "bg-green-500 shadow-green-200" : "bg-gray-200 shadow-gray-100"}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-xl transition-all duration-500 ${u.activo ? "left-7" : "left-1"}`} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openModal(u)}
                                                    className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all active:scale-90"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(u.id)}
                                                    className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[1200px]">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest sticky left-0 bg-gray-50 z-10">Rango / Sección</th>
                                {SECCIONES.map(s => (
                                    <th key={s.id} className="px-4 py-6 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center whitespace-nowrap">{s.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {ROLES_LIST.map(rol => (
                                <tr key={rol} className="hover:bg-gray-50/30 transition-colors">
                                    <td className="px-8 py-6 sticky left-0 bg-white z-10 border-r border-gray-50 shadow-[5px_0_10px_rgba(0,0,0,0.02)]">
                                        <div className="flex flex-col">
                                            <span className="font-black text-gray-900 tracking-tight">{ROL_LABELS[rol]}</span>
                                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{rol}</span>
                                        </div>
                                    </td>
                                    {SECCIONES.map(seccion => {
                                        const level = permisos[rol]?.[seccion.id] || "none";
                                        const isLocked = rol === "super_admin" || rol === "admin";
                                        
                                        const levelConfig = {
                                            none: { 
                                                label: "✕", 
                                                bg: "bg-red-50", 
                                                text: "text-red-500",
                                                ring: "ring-red-200",
                                                tooltip: "Sin acceso"
                                            },
                                            view: { 
                                                label: "👁", 
                                                bg: "bg-amber-50", 
                                                text: "text-amber-600",
                                                ring: "ring-amber-200",
                                                tooltip: "Solo ver"
                                            },
                                            edit: { 
                                                label: "✓", 
                                                bg: "bg-emerald-50", 
                                                text: "text-emerald-600",
                                                ring: "ring-emerald-200",
                                                tooltip: "Ver + Editar"
                                            },
                                        };
                                        
                                        const config = levelConfig[level as keyof typeof levelConfig] || levelConfig.none;
                                        
                                        return (
                                            <td key={seccion.id} className="px-4 py-6 text-center">
                                                <button
                                                    onClick={() => cyclePermiso(rol, seccion.id)}
                                                    disabled={isLocked}
                                                    title={isLocked ? "Acceso total (bloqueado)" : `${config.tooltip} — Click para cambiar`}
                                                    className={`
                                                        w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold
                                                        transition-all duration-300 ring-2 mx-auto
                                                        ${config.bg} ${config.text} ${config.ring}
                                                        ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:scale-110 active:scale-95 cursor-pointer hover:shadow-md"}
                                                    `}
                                                >
                                                    {config.label}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Legend */}
                    <div className="p-8 bg-gray-50/30 border-t border-gray-100">
                        <div className="flex flex-wrap items-center gap-6 mb-4">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Leyenda:</span>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-red-50 ring-2 ring-red-200 flex items-center justify-center text-red-500 text-xs font-bold">✕</div>
                                <span className="text-xs font-semibold text-gray-600">Sin acceso</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 ring-2 ring-amber-200 flex items-center justify-center text-amber-600 text-xs">👁</div>
                                <span className="text-xs font-semibold text-gray-600">Solo ver (lectura)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 ring-2 ring-emerald-200 flex items-center justify-center text-emerald-600 text-xs font-bold">✓</div>
                                <span className="text-xs font-semibold text-gray-600">Ver + Editar</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center text-[#7B1FA2] shrink-0">
                                <Shield size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-black text-gray-900">Acceso Maestro</p>
                                <p className="text-xs text-gray-500 font-medium mt-0.5">
                                    Los rangos <span className="font-bold text-purple-700 underline decoration-purple-200">Super Admin</span> y <span className="font-bold text-purple-700 underline decoration-purple-200">Administrador</span> siempre tienen acceso total a todas las secciones del sistema.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL USUARIO ── */}
            {modalUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
                    <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900">
                                {modalUser === "new" ? "Nuevo Usuario" : "Editar Usuario"}
                            </h3>
                            <button onClick={() => setModalUser(null)} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all">
                                <X size={20} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-5">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-black transition-all shadow-sm">
                                        <User size={16} className="text-gray-400" />
                                        <input
                                            type="text"
                                            value={form.nombre}
                                            onChange={e => setForm({ ...form, nombre: e.target.value })}
                                            className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full"
                                            placeholder="Ej: Juan Pérez"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email de Acceso</label>
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-black transition-all shadow-sm">
                                        <Mail size={16} className="text-gray-400" />
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={e => setForm({ ...form, email: e.target.value })}
                                            className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full"
                                            placeholder="email@ejemplo.com"
                                            disabled={modalUser !== "new"}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Rango / Rol</label>
                                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-black transition-all shadow-sm relative">
                                            <Shield size={16} className="text-gray-400" />
                                            <select
                                                value={form.rol}
                                                onChange={e => setForm({ ...form, rol: e.target.value })}
                                                className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full appearance-none pr-8"
                                            >
                                                {ROLES_LIST.map(r => (
                                                    <option key={r} value={r}>{ROL_LABELS[r] || r}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">PIN (Venta)</label>
                                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-black transition-all shadow-sm">
                                            <Key size={16} className="text-gray-400" />
                                            <input
                                                type="text"
                                                value={form.pin}
                                                onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                                                className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full"
                                                maxLength={6}
                                                placeholder="4-6 dígitos"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Color Identificador</label>
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-black transition-all shadow-sm">
                                        <input
                                            type="color"
                                            value={form.color}
                                            onChange={e => setForm({ ...form, color: e.target.value })}
                                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                                        />
                                        <input
                                            type="text"
                                            value={form.color}
                                            onChange={e => setForm({ ...form, color: e.target.value })}
                                            className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full uppercase"
                                            placeholder="#000000"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                        {modalUser === "new" ? "Contraseña" : "Nueva Contraseña (opcional)"}
                                    </label>
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3.5 focus-within:border-black transition-all shadow-sm">
                                        <Lock size={16} className="text-gray-400" />
                                        <input
                                            type="password"
                                            value={form.password}
                                            onChange={e => setForm({ ...form, password: e.target.value })}
                                            className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setModalUser(null)}
                                    className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="flex-1 bg-black text-white px-6 py-4 rounded-2xl text-sm font-black hover:bg-gray-800 transition-all shadow-xl shadow-gray-100 active:scale-95 disabled:opacity-50 disabled:scale-100"
                                >
                                    {submitting ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
