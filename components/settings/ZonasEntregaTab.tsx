"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MapPin, Plus, Trash2, DollarSign } from "lucide-react";

type Zona = {
    id: string;
    nombre: string;
    costo_envio: number;
    minimo_compra: number;
    envio_gratis_desde: number | null;
    tiempo_estimado_minutos: number | null;
    activo: boolean;
};

export function ZonasEntregaTab() {
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ nombre: "", costo_envio: 0, minimo_compra: 0, envio_gratis_desde: "", tiempo_estimado_minutos: "" });

    useEffect(() => { fetchZonas(); }, []);

    async function fetchZonas() {
        const { data } = await supabase.from("zonas_entrega").select("*").order("nombre");
        setZonas(data || []);
        setLoading(false);
    }

    async function handleCreate() {
        if (!form.nombre.trim()) return;
        const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
        await supabase.from("zonas_entrega").insert({
            sucursal_id: suc?.id,
            nombre: form.nombre,
            costo_envio: form.costo_envio,
            minimo_compra: form.minimo_compra,
            envio_gratis_desde: form.envio_gratis_desde ? Number(form.envio_gratis_desde) : null,
            tiempo_estimado_minutos: form.tiempo_estimado_minutos ? Number(form.tiempo_estimado_minutos) : null,
        });
        setForm({ nombre: "", costo_envio: 0, minimo_compra: 0, envio_gratis_desde: "", tiempo_estimado_minutos: "" });
        setShowForm(false);
        fetchZonas();
    }

    async function toggleActivo(zona: Zona) {
        await supabase.from("zonas_entrega").update({ activo: !zona.activo }).eq("id", zona.id);
        fetchZonas();
    }

    async function handleDelete(id: string) {
        if (!confirm("¿Eliminar esta zona?")) return;
        await supabase.from("zonas_entrega").delete().eq("id", id);
        fetchZonas();
    }

    if (loading) return <p className="text-gray-400 py-8 text-center text-sm">Cargando zonas...</p>;

    return (
        <div className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Zonas de entrega</h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                    <Plus size={14} /> Nueva zona
                </button>
            </div>

            {showForm && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                    <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                        <legend className="text-xs text-gray-500 px-1">Nombre de la zona</legend>
                        <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Ej: Centro" />
                    </fieldset>
                    <div className="grid grid-cols-2 gap-3">
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Costo envío ($)</legend>
                            <input type="number" value={form.costo_envio} onChange={e => setForm({ ...form, costo_envio: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm text-gray-900" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Mínimo compra ($)</legend>
                            <input type="number" value={form.minimo_compra} onChange={e => setForm({ ...form, minimo_compra: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm text-gray-900" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Envío gratis desde ($)</legend>
                            <input type="number" value={form.envio_gratis_desde} onChange={e => setForm({ ...form, envio_gratis_desde: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Opcional" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Tiempo estimado (min)</legend>
                            <input type="number" value={form.tiempo_estimado_minutos} onChange={e => setForm({ ...form, tiempo_estimado_minutos: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Opcional" />
                        </fieldset>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreate} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-500">Guardar</button>
                        <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:text-gray-700">Cancelar</button>
                    </div>
                </div>
            )}

            {zonas.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <MapPin size={40} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No hay zonas configuradas</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {zonas.map(zona => (
                        <div key={zona.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                            <div>
                                <span className="font-medium text-gray-900 text-sm">{zona.nombre}</span>
                                <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                                    <span>Envío: ${zona.costo_envio}</span>
                                    <span>Mín: ${zona.minimo_compra}</span>
                                    {zona.tiempo_estimado_minutos && <span>{zona.tiempo_estimado_minutos} min</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => toggleActivo(zona)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${zona.activo ? "bg-green-500" : "bg-gray-300"}`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${zona.activo ? "left-5" : "left-0.5"}`} />
                                </button>
                                <button onClick={() => handleDelete(zona.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
