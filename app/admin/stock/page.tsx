"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Plus, Edit2, Package, AlertTriangle, DollarSign } from "lucide-react";

type Ingrediente = {
    id: string;
    nombre: string;
    stock_actual: number;
    stock_minimo: number;
    unidad_medida: string;
    costo_unitario: number;
    categoria: string;
    updated_at: string;
};

export default function StockPage() {
    const [tab, setTab] = useState<"inventario" | "recetas" | "movimientos">("inventario");
    const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    async function fetchData() {
        const { data } = await supabase.from("ingredientes").select("*").order("nombre");
        setIngredientes((data as any[]) || []);
        setLoading(false);
    }

    const filtered = ingredientes.filter(i => i.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    const bajoStock = ingredientes.filter(i => i.stock_actual <= i.stock_minimo).length;
    const valorizacion = ingredientes.reduce((s, i) => s + (i.stock_actual * (i.costo_unitario || 0)), 0);

    // Group by category
    const grouped = filtered.reduce((acc, i) => {
        const cat = (i as any).categoria || "General";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(i);
        return acc;
    }, {} as Record<string, Ingrediente[]>);

    return (
        <section className="p-6">
            {/* Tabs */}
            <div className="flex items-center gap-6 mb-6">
                <h2 className="text-xl font-bold text-gray-900">Gestión de Stock</h2>
                <div className="flex gap-6 border-b border-gray-200 ml-4">
                    {[
                        { key: "inventario", label: "📦 Inventario" },
                        { key: "recetas", label: "🍳 Recetas" },
                        { key: "movimientos", label: "📋 Movimientos" },
                    ].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key as any)}
                            className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? "border-purple-600 text-gray-900" : "border-transparent text-gray-400"}`}
                        >{t.label}</button>
                    ))}
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Package size={18} className="text-blue-600" /></div>
                    <div><p className="text-2xl font-black text-gray-900">{ingredientes.length}</p><p className="text-xs text-gray-500 uppercase font-semibold">Insumos</p></div>
                </div>
                <div className={`bg-white rounded-2xl border p-4 flex items-center gap-3 ${bajoStock > 0 ? "border-orange-200 bg-orange-50" : "border-gray-200"}`}>
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center"><AlertTriangle size={18} className="text-orange-500" /></div>
                    <div><p className="text-2xl font-black text-orange-600">{bajoStock}</p><p className="text-xs text-gray-500 uppercase font-semibold">Bajo Stock</p></div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center"><DollarSign size={18} className="text-green-600" /></div>
                    <div><p className="text-2xl font-black text-gray-900">$ {new Intl.NumberFormat("es-AR").format(valorizacion)}</p><p className="text-xs text-gray-500 uppercase font-semibold">Valorización Total</p></div>
                </div>
            </div>

            {/* Search + buttons */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 gap-2 flex-1 max-w-md">
                    <Search size={14} className="text-gray-400" />
                    <input type="text" placeholder="Buscar insumo" value={busqueda} onChange={e => setBusqueda(e.target.value)} className="bg-transparent outline-none text-sm text-gray-900 w-full" />
                </div>
                <div className="ml-auto flex gap-2">
                    <button className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
                        <Plus size={14} /> Nuevo insumo
                    </button>
                </div>
            </div>

            {/* Table */}
            {loading ? <p className="text-center text-gray-400 py-10">Cargando...</p> : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                <th className="px-4 py-3 text-left font-semibold">Insumo</th>
                                <th className="px-4 py-3 text-left font-semibold">Stock</th>
                                <th className="px-4 py-3 text-left font-semibold">Stock mínimo</th>
                                <th className="px-4 py-3 text-right font-semibold">Costo unitario</th>
                                <th className="px-4 py-3 text-right font-semibold">Costo total</th>
                                <th className="px-4 py-3 text-left font-semibold">Último movimiento</th>
                                <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(grouped).map(([cat, items]) => (
                                <>
                                    <tr key={`cat-${cat}`} className="bg-gray-50">
                                        <td colSpan={7} className="px-4 py-2">
                                            <span className="font-bold text-gray-900 uppercase text-xs">{cat} ({items.length})</span>
                                            <span className="text-green-600 text-xs font-bold ml-2">
                                                | $ {new Intl.NumberFormat("es-AR").format(items.reduce((s, i) => s + (i.stock_actual * (i.costo_unitario || 0)), 0))}
                                            </span>
                                        </td>
                                    </tr>
                                    {items.map(i => (
                                        <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                                            <td className="px-4 py-3 text-gray-900 pl-8">{i.nombre}</td>
                                            <td className={`px-4 py-3 font-bold ${i.stock_actual <= i.stock_minimo ? "text-red-500" : "text-green-600"}`}>
                                                {i.stock_actual} {i.unidad_medida}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{i.stock_minimo} {i.unidad_medida}</td>
                                            <td className="px-4 py-3 text-right text-gray-700">$ {new Intl.NumberFormat("es-AR").format(i.costo_unitario)} x {i.unidad_medida}</td>
                                            <td className="px-4 py-3 text-right text-gray-900 font-medium">$ {new Intl.NumberFormat("es-AR").format(i.stock_actual * (i.costo_unitario || 0))}</td>
                                            <td className="px-4 py-3 text-gray-400 text-xs">{i.updated_at ? new Date(i.updated_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <button className="text-xs bg-white border border-gray-200 rounded-lg px-3 py-1 text-gray-600 hover:bg-gray-50">+ Movimiento</button>
                                                    <button className="text-gray-400 hover:text-gray-600"><Edit2 size={14} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
