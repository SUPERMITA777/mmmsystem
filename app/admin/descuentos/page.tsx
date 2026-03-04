"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Trash2, Tag, Search, X } from "lucide-react";

type Descuento = {
    id: string;
    nombre: string;
    codigo: string;
    tipo: string;
    valor: number;
    minimo_compra: number;
    fecha_inicio: string;
    fecha_fin: string;
    activo: boolean;
    uso_limite: number;
    uso_actual: number;
    aplicar_a: string; // 'general' | 'producto' | 'categoria'
    producto_id: string | null;
    categoria_id: string | null;
};

export default function DescuentosPage() {
    const [descuentos, setDescuentos] = useState<Descuento[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        nombre: "", codigo: "", tipo: "porcentaje", valor: "",
        minimo_compra: "", uso_limite: "",
        aplicar_a: "general", producto_id: "", categoria_id: ""
    });

    // Lookups
    const [productos, setProductos] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [searchProd, setSearchProd] = useState("");
    const [showProdSearch, setShowProdSearch] = useState(false);

    useEffect(() => { fetchDescuentos(); fetchLookups(); }, []);

    async function fetchDescuentos() {
        const { data } = await supabase.from("descuentos").select("*").order("created_at", { ascending: false });
        setDescuentos(data || []);
        setLoading(false);
    }

    async function fetchLookups() {
        const { data: prods } = await supabase.from("productos").select("id, nombre, precio").eq("activo", true).order("nombre");
        setProductos(prods || []);
        const { data: cats } = await supabase.from("categorias").select("id, nombre").eq("activo", true).order("orden");
        setCategorias(cats || []);
    }

    async function handleCreate() {
        if (!form.nombre || !form.valor) return;
        const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
        await supabase.from("descuentos").insert({
            sucursal_id: suc?.id,
            nombre: form.nombre,
            codigo: form.codigo || null,
            tipo: form.tipo,
            valor: Number(form.valor),
            minimo_compra: form.minimo_compra ? Number(form.minimo_compra) : null,
            uso_limite: form.uso_limite ? Number(form.uso_limite) : null,
            aplicar_a: form.aplicar_a,
            producto_id: form.aplicar_a === "producto" ? form.producto_id || null : null,
            categoria_id: form.aplicar_a === "categoria" ? form.categoria_id || null : null,
        });
        setForm({ nombre: "", codigo: "", tipo: "porcentaje", valor: "", minimo_compra: "", uso_limite: "", aplicar_a: "general", producto_id: "", categoria_id: "" });
        setShowForm(false);
        fetchDescuentos();
    }

    async function toggleActivo(d: Descuento) {
        await supabase.from("descuentos").update({ activo: !d.activo }).eq("id", d.id);
        fetchDescuentos();
    }

    async function handleDelete(id: string) {
        if (!confirm("¿Eliminar este descuento?")) return;
        await supabase.from("descuentos").delete().eq("id", id);
        fetchDescuentos();
    }

    const selectedProduct = productos.find(p => p.id === form.producto_id);
    const filteredProds = productos.filter(p => p.nombre.toLowerCase().includes(searchProd.toLowerCase()));

    function getTargetLabel(d: Descuento) {
        if (d.aplicar_a === "producto") {
            const p = productos.find(x => x.id === d.producto_id);
            return p ? `Producto: ${p.nombre}` : "Producto";
        }
        if (d.aplicar_a === "categoria") {
            const c = categorias.find(x => x.id === d.categoria_id);
            return c ? `Categoría: ${c.nombre}` : "Categoría";
        }
        return "General";
    }

    return (
        <section className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Descuentos</h2>
                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                    <Plus size={14} /> Nuevo descuento
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Nombre</legend>
                            <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Ej: 20% OFF Pizzas" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Código (opcional)</legend>
                            <input type="text" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })} className="w-full bg-transparent outline-none text-sm text-gray-900 font-mono" placeholder="PROMO20" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Tipo</legend>
                            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900">
                                <option value="porcentaje">Porcentaje (%)</option>
                                <option value="fijo">Monto fijo ($)</option>
                            </select>
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Valor</legend>
                            <input type="number" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder={form.tipo === "porcentaje" ? "20" : "500"} />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Mínimo compra ($)</legend>
                            <input type="number" value={form.minimo_compra} onChange={e => setForm({ ...form, minimo_compra: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Opcional" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Límite de usos</legend>
                            <input type="number" value={form.uso_limite} onChange={e => setForm({ ...form, uso_limite: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Sin límite" />
                        </fieldset>
                    </div>

                    {/* ── Aplicar a ── */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aplicar a</label>
                        <div className="flex gap-2">
                            {(["general", "producto", "categoria"] as const).map(opt => (
                                <button key={opt} onClick={() => setForm({ ...form, aplicar_a: opt, producto_id: "", categoria_id: "" })}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors capitalize ${form.aplicar_a === opt ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                    {opt === "general" ? "General" : opt === "producto" ? "Producto" : "Categoría"}
                                </button>
                            ))}
                        </div>

                        {form.aplicar_a === "producto" && (
                            <div className="relative">
                                {selectedProduct ? (
                                    <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-xl">
                                        <div className="text-sm">
                                            <p className="font-bold text-gray-900">{selectedProduct.nombre}</p>
                                            <p className="text-gray-500">$ {selectedProduct.precio}</p>
                                        </div>
                                        <button onClick={() => setForm({ ...form, producto_id: "" })} className="text-gray-400 hover:text-red-500">
                                            <X size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input type="text" value={searchProd} onChange={e => { setSearchProd(e.target.value); setShowProdSearch(true); }}
                                                onFocus={() => setShowProdSearch(true)}
                                                className="w-full border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gray-400"
                                                placeholder="Buscar producto..." />
                                        </div>
                                        {showProdSearch && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                                                {filteredProds.map(p => (
                                                    <button key={p.id} onClick={() => { setForm({ ...form, producto_id: p.id }); setShowProdSearch(false); setSearchProd(""); }}
                                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex justify-between border-b border-gray-50 last:border-0">
                                                        <span className="font-medium text-gray-900">{p.nombre}</span>
                                                        <span className="text-gray-400 text-xs">$ {p.precio}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {form.aplicar_a === "categoria" && (
                            <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}
                                className="w-full border border-gray-200 rounded-xl py-2.5 px-3 text-sm outline-none focus:border-gray-400">
                                <option value="">Seleccionar categoría...</option>
                                {categorias.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button onClick={handleCreate} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-500">Guardar</button>
                        <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:text-gray-700">Cancelar</button>
                    </div>
                </div>
            )}

            {loading ? <p className="text-center text-gray-400 py-10">Cargando...</p> : descuentos.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <Tag size={40} className="mx-auto mb-3 text-gray-300" />
                    <p>No hay descuentos creados</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {descuentos.map(d => (
                        <div key={d.id} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-900 text-sm">{d.nombre}</h3>
                                <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500">
                                    {d.codigo && <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{d.codigo}</span>}
                                    <span className="font-bold text-purple-600">{d.tipo === "porcentaje" ? `${d.valor}%` : `$${d.valor}`}</span>
                                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold">{getTargetLabel(d)}</span>
                                    {d.minimo_compra > 0 && <span>Mín: ${d.minimo_compra}</span>}
                                    {d.uso_limite && <span>Usos: {d.uso_actual}/{d.uso_limite}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => toggleActivo(d)}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${d.activo ? "bg-green-500" : "bg-gray-300"}`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${d.activo ? "left-5" : "left-0.5"}`} />
                                </button>
                                <button onClick={() => handleDelete(d.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
