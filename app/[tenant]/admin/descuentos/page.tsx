"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Trash2, Tag, Search, X, Edit3 } from "lucide-react";
import { useTenant } from "@/context/TenantContext";

type Descuento = {
    id: string;
    nombre: string;
    codigo: string;
    tipo: string;
    valor: number;
    minimo_compra: number;
    activo: boolean;
    uso_limite: number | null;
    uso_actual: number;
    aplicar_a: string; // 'general' | 'producto' | 'categoria'
    producto_id: string | null;
    categoria_id: string | null;
    no_acumulable: boolean;
    fecha_desde: string | null;
    fecha_hasta: string | null;
    hora_desde: string | null;
    hora_hasta: string | null;
    productos_ids: string[] | null;
    categorias_ids: string[] | null;
    metodo_pago_id: string | null;
    auto_aplicar: boolean;
};


export default function DescuentosPage() {
    const [descuentos, setDescuentos] = useState<Descuento[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [form, setForm] = useState({
        nombre: "", codigo: "", tipo: "porcentaje", valor: "",
        minimo_compra: "", uso_limite: "",
        aplicar_a: "general",
        productos_ids: [] as string[],
        categorias_ids: [] as string[],
        no_acumulable: false,
        fecha_desde: "", fecha_hasta: "",
        hora_desde: "", hora_hasta: "",
        metodo_pago_id: "",
        auto_aplicar: false
    });


    // Lookups
    const [productos, setProductos] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [metodosPago, setMetodosPago] = useState<any[]>([]);
    const [searchProd, setSearchProd] = useState("");
    const [showProdSearch, setShowProdSearch] = useState(false);


    const { sucursalId } = useTenant();

    useEffect(() => {
        if (sucursalId) {
            fetchDescuentos();
            fetchLookups();
        }
    }, [sucursalId]);

    async function fetchDescuentos() {
        if (!sucursalId) return;
        const { data } = await supabase.from("descuentos").select("*").eq("sucursal_id", sucursalId).order("created_at", { ascending: false });
        setDescuentos(data || []);
        setLoading(false);
    }

    async function fetchLookups() {
        if (!sucursalId) return;
        const { data: prods } = await supabase.from("productos").select("id, nombre, precio").eq("activo", true).order("nombre");
        setProductos(prods || []);
        const { data: cats } = await supabase.from("categorias").select("id, nombre").eq("sucursal_id", sucursalId).eq("activo", true).order("orden");
        setCategorias(cats || []);
        const { data: mPagos } = await supabase.from("metodos_pago").select("id, nombre").eq("sucursal_id", sucursalId).eq("activo", true).order("orden");
        setMetodosPago(mPagos || []);
    }


    function resetForm() {
        setForm({
            nombre: "", codigo: "", tipo: "porcentaje", valor: "", minimo_compra: "", uso_limite: "",
            aplicar_a: "general", productos_ids: [], categorias_ids: [], no_acumulable: false,
            fecha_desde: "", fecha_hasta: "", hora_desde: "", hora_hasta: "",
            metodo_pago_id: "", auto_aplicar: false
        });

        setEditingId(null);
        setShowForm(false);
    }

    function handleEdit(d: Descuento) {
        // Collect old single id if array is empty
        const initialProductos = d.productos_ids || (d.producto_id ? [d.producto_id] : []);
        const initialCategorias = d.categorias_ids || (d.categoria_id ? [d.categoria_id] : []);

        setForm({
            nombre: d.nombre,
            codigo: d.codigo || "",
            tipo: d.tipo,
            valor: String(d.valor),
            minimo_compra: d.minimo_compra ? String(d.minimo_compra) : "",
            uso_limite: d.uso_limite ? String(d.uso_limite) : "",
            aplicar_a: d.aplicar_a,
            productos_ids: initialProductos,
            categorias_ids: initialCategorias,
            no_acumulable: !!d.no_acumulable,
            fecha_desde: d.fecha_desde || "",
            fecha_hasta: d.fecha_hasta || "",
            hora_desde: d.hora_desde ? d.hora_desde.substring(0, 5) : "",
            hora_hasta: d.hora_hasta ? d.hora_hasta.substring(0, 5) : "",
            metodo_pago_id: d.metodo_pago_id || "",
            auto_aplicar: !!d.auto_aplicar
        });

        setEditingId(d.id);
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    async function handleSave() {
        if (!form.nombre || !form.valor) return;

        const payload = {
            nombre: form.nombre,
            codigo: form.codigo || null,
            tipo: form.tipo,
            valor: Number(form.valor),
            minimo_compra: form.minimo_compra ? Number(form.minimo_compra) : null,
            uso_limite: form.uso_limite ? Number(form.uso_limite) : null,
            aplicar_a: form.aplicar_a,
            no_acumulable: form.no_acumulable,
            fecha_desde: form.fecha_desde || null,
            fecha_hasta: form.fecha_hasta || null,
            hora_desde: form.hora_desde ? form.hora_desde + ":00" : null,
            hora_hasta: form.hora_hasta ? form.hora_hasta + ":00" : null,
            productos_ids: form.aplicar_a === "producto" && form.productos_ids.length > 0 ? form.productos_ids : null,
            categorias_ids: form.aplicar_a === "categoria" && form.categorias_ids.length > 0 ? form.categorias_ids : null,
            metodo_pago_id: form.metodo_pago_id || null,
            auto_aplicar: form.auto_aplicar,
            // Keep legacy fields null on new edits to prioritize arrays
            producto_id: null,
            categoria_id: null
        };


        if (editingId) {
            await supabase.from("descuentos").update(payload).eq("id", editingId);
        } else {
            await supabase.from("descuentos").insert({ ...payload, sucursal_id: sucursalId });
        }

        resetForm();
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

    const filteredProds = productos.filter(p => p.nombre.toLowerCase().includes(searchProd.toLowerCase()) && !form.productos_ids.includes(p.id));

    return (
        <section className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Descuentos</h2>
                <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                    <Plus size={14} /> Nuevo descuento
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2 col-span-1 md:col-span-2">
                            <legend className="text-xs text-gray-500 px-1">Nombre</legend>
                            <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Ej: 20% OFF Pizzas" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Código (opcional)</legend>
                            <input type="text" value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })} className="w-full bg-transparent outline-none text-sm text-gray-900 font-mono" placeholder="PROMO20" />
                        </fieldset>
                        <div className="flex items-center border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 gap-2 cursor-pointer" onClick={() => setForm({ ...form, no_acumulable: !form.no_acumulable })}>
                            <input type="checkbox" checked={form.no_acumulable} onChange={e => setForm({ ...form, no_acumulable: e.target.checked })} className="w-4 h-4 text-purple-600 rounded" />
                            <span className="text-sm font-bold text-gray-700 select-none">No acumulable</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50">
                        <fieldset className="border border-emerald-200 bg-white rounded-lg px-3 py-2">
                            <legend className="text-xs text-emerald-600 font-bold px-1">Forma de Pago Requerida</legend>
                            <select 
                                value={form.metodo_pago_id} 
                                onChange={e => setForm({ ...form, metodo_pago_id: e.target.value })} 
                                className="w-full bg-transparent outline-none text-sm text-gray-900 font-medium"
                            >
                                <option value="">Cualquier medio de pago</option>
                                {metodosPago.map(m => (
                                    <option key={m.id} value={m.id}>{m.nombre}</option>
                                ))}
                            </select>
                        </fieldset>
                        <div 
                            className="flex items-center border border-emerald-200 bg-white rounded-lg px-4 py-2 gap-3 cursor-pointer hover:bg-emerald-50 transition-colors shadow-sm"
                            onClick={() => setForm({ ...form, auto_aplicar: !form.auto_aplicar })}
                        >
                            <input 
                                type="checkbox" 
                                checked={form.auto_aplicar} 
                                onChange={e => setForm({ ...form, auto_aplicar: e.target.checked })} 
                                className="w-5 h-5 text-emerald-600 rounded-md border-emerald-300 focus:ring-emerald-500" 
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-emerald-800 leading-none">Auto-aplicar</span>
                                <span className="text-[10px] text-emerald-600 font-medium mt-1">Se aplica solo al cumplir condiciones</span>
                            </div>
                        </div>
                    </div>


                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                        <fieldset className="border border-blue-200 bg-white rounded-lg px-3 py-1.5 focus-within:border-blue-400 text-sm">
                            <legend className="text-xs text-blue-600 px-1">Fecha de inicio</legend>
                            <input type="date" value={form.fecha_desde} onChange={e => setForm({ ...form, fecha_desde: e.target.value })} className="w-full bg-transparent outline-none text-gray-700" />
                        </fieldset>
                        <fieldset className="border border-blue-200 bg-white rounded-lg px-3 py-1.5 focus-within:border-blue-400 text-sm">
                            <legend className="text-xs text-blue-600 px-1">Fecha de fin</legend>
                            <input type="date" value={form.fecha_hasta} onChange={e => setForm({ ...form, fecha_hasta: e.target.value })} className="w-full bg-transparent outline-none text-gray-700" />
                        </fieldset>
                        <fieldset className="border border-blue-200 bg-white rounded-lg px-3 py-1.5 focus-within:border-blue-400 text-sm">
                            <legend className="text-xs text-blue-600 px-1">Hora desde</legend>
                            <input type="time" value={form.hora_desde} onChange={e => setForm({ ...form, hora_desde: e.target.value })} className="w-full bg-transparent outline-none text-gray-700" />
                        </fieldset>
                        <fieldset className="border border-blue-200 bg-white rounded-lg px-3 py-1.5 focus-within:border-blue-400 text-sm">
                            <legend className="text-xs text-blue-600 px-1">Hora hasta</legend>
                            <input type="time" value={form.hora_hasta} onChange={e => setForm({ ...form, hora_hasta: e.target.value })} className="w-full bg-transparent outline-none text-gray-700" />
                        </fieldset>
                    </div>

                    {/* ── Aplicar a ── */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Aplicar a</label>
                        <div className="flex gap-2">
                            {(["general", "producto", "categoria"] as const).map(opt => (
                                <button key={opt} onClick={() => setForm({ ...form, aplicar_a: opt, productos_ids: [], categorias_ids: [] })}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors capitalize ${form.aplicar_a === opt ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                                    {opt === "general" ? "General" : opt === "producto" ? "Productos Específicos" : "Categorías Específicas"}
                                </button>
                            ))}
                        </div>

                        {form.aplicar_a === "producto" && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input type="text" value={searchProd} onChange={e => { setSearchProd(e.target.value); setShowProdSearch(true); }}
                                        onFocus={() => setShowProdSearch(true)}
                                        className="w-full border border-gray-200 bg-white rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none focus:border-purple-400 transition-colors"
                                        placeholder="Buscar producto para aplicar descuento..." />

                                    {showProdSearch && searchProd && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                                            {filteredProds.length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-gray-500 text-center">No se encontraron productos o ya están seleccionados</div>
                                            ) : (
                                                filteredProds.map(p => (
                                                    <button key={p.id} onClick={() => {
                                                        setForm({ ...form, productos_ids: [...form.productos_ids, p.id] });
                                                        setShowProdSearch(false);
                                                        setSearchProd("");
                                                    }}
                                                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 flex justify-between border-b border-gray-100 last:border-0">
                                                        <span className="font-medium text-gray-900">{p.nombre}</span>
                                                        <span className="text-purple-600 font-bold text-xs">$ {p.precio}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {form.productos_ids.map(id => {
                                        const p = productos.find(x => x.id === id);
                                        if (!p) return null;
                                        return (
                                            <div key={id} className="flex items-center gap-1.5 bg-purple-100 text-purple-800 px-3 py-1.5 rounded-lg text-sm border border-purple-200">
                                                <span className="font-medium">{p.nombre}</span>
                                                <button onClick={() => setForm({ ...form, productos_ids: form.productos_ids.filter(x => x !== id) })} className="hover:text-red-500 bg-white rounded-full p-0.5"><X size={12} /></button>
                                            </div>
                                        )
                                    })}
                                    {form.productos_ids.length === 0 && <p className="text-xs text-gray-500 italic">Buscá y seleccioná los productos a los que se aplicará este descuento.</p>}
                                </div>
                            </div>
                        )}

                        {form.aplicar_a === "categoria" && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <p className="text-xs text-gray-500 mb-3">Marcá las categorías a las que se aplicará este descuento:</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {categorias.map(c => {
                                        const isSelected = form.categorias_ids.includes(c.id);
                                        return (
                                            <label key={c.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
                                                <input type="checkbox" checked={isSelected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setForm({ ...form, categorias_ids: [...form.categorias_ids, c.id] });
                                                        else setForm({ ...form, categorias_ids: form.categorias_ids.filter(x => x !== c.id) });
                                                    }} className="w-4 h-4 text-purple-600 rounded" />
                                                <span className="text-sm font-medium">{c.nombre}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {form.categorias_ids.length === 0 && <p className="text-xs text-red-500 mt-2 font-medium">⚠ Debés seleccionar al menos una categoría.</p>}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                        <button onClick={handleSave} className="bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-500 shadow-sm transition-colors">
                            {editingId ? "Actualizar descuento" : "Guardar descuento"}
                        </button>
                        <button onClick={resetForm} className="text-gray-500 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">Cancelar</button>
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
                    {descuentos.map(d => {
                        const cantProductos = (d.productos_ids?.length || 0) + (d.producto_id ? 1 : 0);
                        const cantCategorias = (d.categorias_ids?.length || 0) + (d.categoria_id ? 1 : 0);
                        return (
                            <div key={d.id} className={`bg-white rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${!d.activo ? 'opacity-60 border-gray-200' : 'border-gray-300 shadow-sm'}`}>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-900 text-base">{d.nombre}</h3>
                                        {!d.activo && <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Inactivo</span>}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-gray-600">
                                        {d.codigo && <span className="font-mono bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded shadow-sm">{d.codigo}</span>}
                                        <span className="font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded shadow-sm">{d.tipo === "porcentaje" ? `${d.valor}%` : `$${d.valor}`}</span>
                                        <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded font-bold shadow-sm">
                                            {d.aplicar_a === 'general' ? 'General' :
                                                d.aplicar_a === 'producto' ? `Productos (${cantProductos})` : `Categorías (${cantCategorias})`}
                                        </span>
                                        {d.no_acumulable && <span className="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded font-bold shadow-sm">No Acumulable</span>}

                                        {(d.fecha_desde || d.fecha_hasta || d.hora_desde || d.hora_hasta) && (
                                            <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded font-medium shadow-sm ml-1">
                                                ⏱️ {d.fecha_desde ? new Date(d.fecha_desde).toLocaleDateString() : 'Siempre'} {d.fecha_hasta ? `al ${new Date(d.fecha_hasta).toLocaleDateString()}` : ''}
                                                {(d.hora_desde || d.hora_hasta) && ` (${d.hora_desde ? d.hora_desde.substring(0, 5) : '00:00'} - ${d.hora_hasta ? d.hora_hasta.substring(0, 5) : '23:59'})`}
                                            </span>
                                        )}

                                        {d.minimo_compra > 0 && <span className="ml-1">Mínimo: ${d.minimo_compra}</span>}
                                        {d.uso_limite && <span className="ml-1 opacity-70">Usos: {d.uso_actual}/{d.uso_limite}</span>}
                                        {d.metodo_pago_id && (
                                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black uppercase ml-1">
                                                💳 {metodosPago.find(m => m.id === d.metodo_pago_id)?.nombre || 'Pago específico'}
                                            </span>
                                        )}
                                        {d.auto_aplicar && (
                                            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-black uppercase ml-1">
                                                ✨ Automático
                                            </span>
                                        )}
                                    </div>

                                </div>
                                <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                                    <button
                                        onClick={() => handleEdit(d)}
                                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit3 size={18} />
                                    </button>
                                    <button
                                        onClick={() => toggleActivo(d)}
                                        title={d.activo ? "Desactivar" : "Activar"}
                                        className={`w-11 h-6 rounded-full relative transition-colors ${d.activo ? "bg-green-500" : "bg-gray-300"}`}
                                    >
                                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${d.activo ? "left-5.5" : "left-0.5"}`} />
                                    </button>
                                    <button onClick={() => handleDelete(d.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
