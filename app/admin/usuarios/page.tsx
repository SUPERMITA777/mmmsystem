"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit2, Trash2, X, Lock, Mail, User, Shield, Key } from "lucide-react";

type Usuario = {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    activo: boolean;
    pin?: string;
};

const ROL_BADGE: Record<string, string> = {
    super_admin: "bg-red-100 text-red-700",
    admin: "bg-purple-100 text-purple-700",
    cajero: "bg-blue-100 text-blue-700",
    cocinero: "bg-orange-100 text-orange-700",
    repartidor: "bg-green-100 text-green-700",
    empleado: "bg-gray-100 text-gray-700",
};

const ROL_LABELS: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Administrador",
    cajero: "Cajero",
    cocinero: "Cocinero",
    repartidor: "Repartidor",
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
        activo: true
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchUsuarios(); }, []);

    async function fetchUsuarios() {
        const { data } = await supabase.from("usuarios").select("*").order("nombre");
        setUsuarios(data || []);
        setLoading(false);
    }

    const openModal = (u: Usuario | "new") => {
        if (u === "new") {
            setForm({ nombre: "", email: "", rol: "empleado", pin: "", password: "", activo: true });
        } else {
            setForm({
                nombre: u.nombre,
                email: u.email,
                rol: u.rol,
                pin: u.pin || "",
                password: "",
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
                const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, sucursal_id: suc?.id })
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
        <section className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-black text-gray-900">Gestión de Usuarios</h2>
                    <p className="text-gray-500 text-sm">Crea y administra los accesos de tu equipo.</p>
                </div>
                <button
                    onClick={() => openModal("new")}
                    className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95"
                >
                    <Plus size={18} /> Nuevo Usuario
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                            <th className="px-8 py-5 text-left">Usuario</th>
                            <th className="px-8 py-5 text-left">Email / Acceso</th>
                            <th className="px-8 py-5 text-left">Rango</th>
                            <th className="px-8 py-5 text-center">Estado</th>
                            <th className="px-8 py-5 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-20">
                                <div className="flex flex-col items-center gap-2 opacity-20">
                                    <div className="w-8 h-8 rounded-full border-4 border-black border-t-transparent animate-spin" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Cargando...</span>
                                </div>
                            </td></tr>
                        ) : usuarios.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-20 text-gray-400 font-medium">No hay usuarios registrados</td></tr>
                        ) : usuarios.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 font-bold">
                                            {u.nombre.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">{u.nombre}</p>
                                            <p className="text-[11px] text-gray-400">ID: {u.id.substring(0, 8)}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-600">{u.email}</span>
                                        {u.pin && <span className="text-[10px] font-black text-purple-500 uppercase">PIN: {u.pin}</span>}
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tight ${ROL_BADGE[u.rol] || "bg-gray-100 text-gray-500"}`}>
                                        {ROL_LABELS[u.rol] || u.rol}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-center">
                                    <button
                                        onClick={() => toggleActivo(u)}
                                        disabled={loading}
                                        className={`w-11 h-6 rounded-full relative transition-all duration-300 ${u.activo ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "bg-gray-200"}`}
                                    >
                                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${u.activo ? "left-6" : "left-1"}`} />
                                    </button>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openModal(u)}
                                            className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all"
                                            title="Editar"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(u.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── MODAL USUARIO ── */}
            {modalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md">
                    <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900">
                                {modalUser === "new" ? "Nuevo Usuario" : "Editar Usuario"}
                            </h3>
                            <button onClick={() => setModalUser(null)} className="text-gray-400 hover:text-gray-900">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-8 space-y-5">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus-within:border-black transition-all">
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
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus-within:border-black transition-all">
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
                                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus-within:border-black transition-all">
                                            <Shield size={16} className="text-gray-400" />
                                            <select
                                                value={form.rol}
                                                onChange={e => setForm({ ...form, rol: e.target.value })}
                                                className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full appearance-none"
                                            >
                                                {Object.entries(ROL_LABELS).map(([key, label]) => (
                                                    <option key={key} value={key}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">PIN (Venta)</label>
                                        <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus-within:border-black transition-all">
                                            <Key size={16} className="text-gray-400" />
                                            <input
                                                type="text"
                                                value={form.pin}
                                                onChange={e => setForm({ ...form, pin: e.target.value })}
                                                className="bg-transparent outline-none text-sm font-bold text-gray-900 w-full"
                                                maxLength={4}
                                                placeholder="1234"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                                        {modalUser === "new" ? "Contraseña" : "Nueva Contraseña (opcional)"}
                                    </label>
                                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus-within:border-black transition-all">
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

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setModalUser(null)}
                                    className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="flex-1 bg-black text-white px-6 py-4 rounded-2xl text-sm font-black hover:bg-gray-800 transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:scale-100"
                                >
                                    {submitting ? "Guardando..." : "Guardar Cambios"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
