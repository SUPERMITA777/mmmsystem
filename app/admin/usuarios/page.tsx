"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit2, Trash2 } from "lucide-react";

type Usuario = {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    activo: boolean;
};

const ROL_BADGE: Record<string, string> = {
    super_admin: "bg-red-100 text-red-700",
    admin: "bg-purple-100 text-purple-700",
    cajero: "bg-blue-100 text-blue-700",
    cocinero: "bg-orange-100 text-orange-700",
    repartidor: "bg-green-100 text-green-700",
};

export default function UsuariosPage() {
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ nombre: "", email: "", rol: "cajero", pin: "" });

    useEffect(() => { fetchUsuarios(); }, []);

    async function fetchUsuarios() {
        const { data } = await supabase.from("usuarios").select("*").order("nombre");
        setUsuarios(data || []);
        setLoading(false);
    }

    async function handleCreate() {
        if (!form.nombre || !form.email) return;
        const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
        await supabase.from("usuarios").insert({
            sucursal_id: suc?.id,
            nombre: form.nombre,
            email: form.email,
            rol: form.rol,
            pin: form.pin || null,
        });
        setForm({ nombre: "", email: "", rol: "cajero", pin: "" });
        setShowForm(false);
        fetchUsuarios();
    }

    async function toggleActivo(u: Usuario) {
        await supabase.from("usuarios").update({ activo: !u.activo }).eq("id", u.id);
        fetchUsuarios();
    }

    return (
        <section className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Usuarios</h2>
                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                    <Plus size={14} /> Nuevo usuario
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Nombre</legend>
                            <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Email</legend>
                            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Rol</legend>
                            <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900">
                                <option value="super_admin">Super Admin</option>
                                <option value="admin">Admin</option>
                                <option value="cajero">Cajero</option>
                                <option value="cocinero">Cocinero</option>
                                <option value="repartidor">Repartidor</option>
                            </select>
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">PIN</legend>
                            <input type="text" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" maxLength={4} placeholder="4 dígitos" />
                        </fieldset>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreate} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-500">Guardar</button>
                        <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:text-gray-700">Cancelar</button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                            <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                            <th className="px-4 py-3 text-left font-semibold">Email</th>
                            <th className="px-4 py-3 text-left font-semibold">Rol</th>
                            <th className="px-4 py-3 text-center font-semibold">Estado</th>
                            <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-10 text-gray-400">Cargando...</td></tr>
                        ) : usuarios.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-10 text-gray-400">No hay usuarios</td></tr>
                        ) : usuarios.map(u => (
                            <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">{u.nombre}</td>
                                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                                <td className="px-4 py-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROL_BADGE[u.rol] || "bg-gray-100"}`}>{u.rol}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <button onClick={() => toggleActivo(u)} className={`w-10 h-5 rounded-full relative transition-colors ${u.activo ? "bg-green-500" : "bg-gray-300"}`}>
                                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${u.activo ? "left-5" : "left-0.5"}`} />
                                    </button>
                                </td>
                                <td className="px-4 py-3">
                                    <button className="text-gray-400 hover:text-gray-600"><Edit2 size={14} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
