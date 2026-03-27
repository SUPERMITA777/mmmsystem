"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Plus, Edit2, Package, AlertTriangle, DollarSign, CookingPot, History, ArrowUp, ArrowDown, RefreshCcw, ShoppingCart, Filter } from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import IngredientModal from "@/components/admin/stock/IngredientModal";
import MovementModal from "@/components/admin/stock/MovementModal";
import FichasTecnicasTab from "@/components/admin/stock/FichasTecnicasTab";

type Ingrediente = {
    id: string;
    nombre: string;
    stock_actual: number;
    stock_minimo: number;
    unidad: string;
    costo_unitario: number;
    categoria: string;
    proveedor: string;
    updated_at: string;
};

type Movimiento = {
    id: string;
    ingrediente_id: string;
    tipo: "entrada" | "salida" | "ajuste" | "venta";
    cantidad: number;
    motivo: string;
    created_at: string;
    ingredientes?: { nombre: string; unidad: string };
};



export default function StockPage() {
    const [tab, setTab] = useState<"inventario" | "recetas" | "movimientos" | "compras">("inventario");
    const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [filtroProveedor, setFiltroProveedor] = useState("");
    const [filtroCategoria, setFiltroCategoria] = useState("");
    const [loading, setLoading] = useState(true);
    const { sucursalId } = useTenant();

    // Modals
    const [isIngModalOpen, setIsIngModalOpen] = useState(false);
    const [isMovModalOpen, setIsMovModalOpen] = useState(false);
    const [selectedIng, setSelectedIng] = useState<Ingrediente | null>(null);

    useEffect(() => {
        if (sucursalId) {
            if (tab === "inventario" || tab === "compras") fetchIngredientes();
            if (tab === "movimientos") fetchMovimientos();
            // recetas tab is self-contained via FichasTecnicasTab
        }
    }, [sucursalId, tab]);

    async function fetchIngredientes() {
        if (!sucursalId) return;
        setLoading(true);
        const { data } = await supabase.from("ingredientes").select("*").eq("sucursal_id", sucursalId).order("nombre");
        setIngredientes((data as any[]) || []);
        setLoading(false);
    }

    async function fetchMovimientos() {
        if (!sucursalId) return;
        setLoading(true);
        const { data } = await supabase
            .from("movimientos_stock")
            .select("*, ingredientes(nombre, unidad)")
            .eq("sucursal_id", sucursalId)
            .order("created_at", { ascending: false })
            .limit(50);
        setMovimientos((data as any[]) || []);
        setLoading(false);
    }



    const filteredIng = ingredientes.filter(i => i.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    const bajoStock = ingredientes.filter(i => i.stock_actual <= i.stock_minimo).length;
    const valorizacion = ingredientes.reduce((s, i) => s + (i.stock_actual * (i.costo_unitario || 0)), 0);

    const proveedores = Array.from(new Set(ingredientes.map(i => i.proveedor).filter(Boolean)));
    const categorias = Array.from(new Set(ingredientes.map(i => i.categoria).filter(Boolean)));

    const listaCompras = ingredientes.filter(i => {
        const porDebajo = i.stock_actual <= i.stock_minimo;
        const matchesBusqueda = i.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const matchesProveedor = !filtroProveedor || i.proveedor === filtroProveedor;
        const matchesCategoria = !filtroCategoria || i.categoria === filtroCategoria;
        return porDebajo && matchesBusqueda && matchesProveedor && matchesCategoria;
    }).map(i => ({
        ...i,
        comprar: Math.max(0, i.stock_minimo - i.stock_actual),
        total_estimado: Math.max(0, i.stock_minimo - i.stock_actual) * (i.costo_unitario || 0)
    }));

    const totalCompras = listaCompras.reduce((s, i) => s + i.total_estimado, 0);

    const groupedIng = filteredIng.reduce((acc, i) => {
        const cat = i.categoria || "General";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(i);
        return acc;
    }, {} as Record<string, Ingrediente[]>);

    return (
        <section className="p-6">
            {/* Headers & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Gestión de Stock</h2>
                    <p className="text-sm text-gray-500 font-medium">Control de insumos, recetas y costos de producción.</p>
                </div>
                <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl">
                    {[
                        { key: "inventario", label: "Inventario", icon: Package },
                        { key: "recetas", label: "Recetas", icon: CookingPot },
                        { key: "movimientos", label: "Movimientos", icon: History },
                        { key: "compras", label: "Lista de Compras", icon: ShoppingCart },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => { setTab(t.key as any); setBusqueda(""); setFiltroProveedor(""); setFiltroCategoria(""); }}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${tab === t.key ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"}`}
                        >
                            <t.icon size={16} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPIs */}
            {(tab === "inventario" || tab === "compras") && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 flex items-center gap-5 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0"><Package size={28} /></div>
                        <div><p className="text-3xl font-black text-gray-900 leading-tight">{tab === "compras" ? listaCompras.length : ingredientes.length}</p><p className="text-xs text-gray-400 uppercase font-bold tracking-widest">{tab === "compras" ? "Items a comprar" : "Insumos totales"}</p></div>
                    </div>
                    <div className={`bg-white rounded-3xl border p-6 flex items-center gap-5 shadow-sm transition-colors ${bajoStock > 0 ? "border-orange-200 bg-orange-50/30" : "border-gray-100"}`}>
                        <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0"><AlertTriangle size={28} /></div>
                        <div><p className="text-3xl font-black text-orange-600 leading-tight">{bajoStock}</p><p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Alerta de Stock</p></div>
                    </div>
                    <div className="bg-white rounded-3xl border border-gray-100 p-6 flex items-center gap-5 shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 shrink-0"><DollarSign size={28} /></div>
                        <div><p className="text-3xl font-black text-gray-900 leading-tight">$ {new Intl.NumberFormat("es-AR").format(tab === "compras" ? totalCompras : valorizacion)}</p><p className="text-xs text-gray-400 uppercase font-bold tracking-widest">{tab === "compras" ? "Total Estimado" : "Valorización"}</p></div>
                    </div>
                </div>
            )}

            {/* Content per Tab */}
            <div className="space-y-4">
                {/* Search & Action Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-4 w-full">
                        <div className="relative flex-1 group">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors" />
                            <input
                                type="text"
                                placeholder={tab === "inventario" ? "Buscar insumo..." : tab === "recetas" ? "Buscar producto..." : tab === "compras" ? "Filtrar por nombre..." : "Buscar en historial..."}
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-3 text-sm text-gray-900 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all shadow-sm"
                            />
                        </div>

                        {tab === "compras" && (
                            <>
                                <div className="relative group min-w-[150px]">
                                    <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <select
                                        value={filtroProveedor}
                                        onChange={e => setFiltroProveedor(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-900 outline-none focus:border-purple-500 transition-all shadow-sm appearance-none"
                                    >
                                        <option value="">Todos los Proveedores</option>
                                        {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div className="relative group min-w-[150px]">
                                    <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <select
                                        value={filtroCategoria}
                                        onChange={e => setFiltroCategoria(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-900 outline-none focus:border-purple-500 transition-all shadow-sm appearance-none"
                                    >
                                        <option value="">Todas las Categorías</option>
                                        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>
                    {tab === "inventario" && (
                        <button
                            onClick={() => { setSelectedIng(null); setIsIngModalOpen(true); }}
                            className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-95 whitespace-nowrap"
                        >
                            <Plus size={18} /> Nuevo Insumo
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <div className="w-12 h-12 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin mb-4" />
                        <p className="text-gray-400 font-medium">Actualizando datos...</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        {tab === "inventario" && (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-50 bg-gray-50/50">
                                        <th className="px-6 py-4 text-left font-black">Insumo</th>
                                        <th className="px-6 py-4 text-left font-black">Proveedor</th>
                                        <th className="px-6 py-4 text-left font-black">Stock Actual</th>
                                        <th className="px-6 py-4 text-left font-black">Stock Mínimo</th>
                                        <th className="px-6 py-4 text-right font-black">Costo Unitario</th>
                                        <th className="px-6 py-4 text-right font-black">Subtotal Valor</th>
                                        <th className="px-6 py-4 text-center font-black">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(groupedIng).length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-20 text-gray-300">No se encontraron insumos</td></tr>
                                    ) : Object.entries(groupedIng).map(([cat, items]) => (
                                        <React.Fragment key={cat}>
                                            <tr className="bg-gray-50 border-y border-gray-100">
                                                <td colSpan={7} className="px-6 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">{cat}</span>
                                                        <span className="w-4 h-4 rounded-full bg-gray-200 text-[10px] font-bold flex items-center justify-center text-gray-600">{items.length}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {items.map(i => (
                                                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                                                    <td className="px-6 py-4 font-bold text-gray-900">{i.nombre}</td>
                                                    <td className="px-6 py-4 text-gray-500 font-medium italic">{i.proveedor || "—"}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black ${i.stock_actual <= i.stock_minimo ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                                                            {i.stock_actual} <span className="opacity-50 text-[10px] uppercase">{i.unidad}</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 font-medium italic">{i.stock_minimo} {i.unidad}</td>
                                                    <td className="px-6 py-4 text-right text-gray-600 font-bold">$ {new Intl.NumberFormat("es-AR").format(i.costo_unitario)}</td>
                                                    <td className="px-6 py-4 text-right font-black text-gray-900">$ {new Intl.NumberFormat("es-AR").format(i.stock_actual * (i.costo_unitario || 0))}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => { setSelectedIng(i); setIsMovModalOpen(true); }}
                                                                className="px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-[10px] font-black uppercase text-gray-500 hover:bg-gray-50 transition-all hover:border-gray-200 shadow-sm"
                                                            >+ Movimiento</button>
                                                            <button
                                                                onClick={() => { setSelectedIng(i); setIsIngModalOpen(true); }}
                                                                className="p-2 text-gray-300 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                                                            ><Edit2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {tab === "compras" && (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-50 bg-gray-50/50">
                                        <th className="px-6 py-4 text-left font-black">Insumo</th>
                                        <th className="px-6 py-4 text-left font-black">Proveedor</th>
                                        <th className="px-6 py-4 text-left font-black">Categoría</th>
                                        <th className="px-6 py-4 text-center font-black">Stock Actual</th>
                                        <th className="px-6 py-4 text-right font-black">A Comprar</th>
                                        <th className="px-6 py-4 text-right font-black">Precio Unit.</th>
                                        <th className="px-6 py-4 text-right font-black">Total Estimado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {listaCompras.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-20 text-gray-300">No hay insumos que requieran compra</td></tr>
                                    ) : listaCompras.map(i => (
                                        <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-900">{i.nombre}</td>
                                            <td className="px-6 py-4 text-gray-500 font-medium italic">{i.proveedor || "—"}</td>
                                            <td className="px-6 py-4 text-gray-500 font-medium">{i.categoria}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-50 text-red-600">
                                                    {i.stock_actual} <span className="opacity-50 text-[10px] uppercase">{i.unidad}</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-purple-600">
                                                {i.comprar} <span className="text-[10px] opacity-60 uppercase">{i.unidad}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-600 font-bold">$ {new Intl.NumberFormat("es-AR").format(i.costo_unitario)}</td>
                                            <td className="px-6 py-4 text-right font-black text-gray-900">$ {new Intl.NumberFormat("es-AR").format(i.total_estimado)}</td>
                                        </tr>
                                    ))}
                                    {listaCompras.length > 0 && (
                                        <tr className="bg-gray-50 font-black">
                                            <td colSpan={6} className="px-6 py-4 text-right uppercase tracking-widest text-[10px] text-gray-400">Total a Invertir</td>
                                            <td className="px-6 py-4 text-right text-lg text-purple-600">$ {new Intl.NumberFormat("es-AR").format(totalCompras)}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {tab === "movimientos" && (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-50 bg-gray-50/50">
                                        <th className="px-6 py-4 text-left font-black">Fecha</th>
                                        <th className="px-6 py-4 text-left font-black">Insumo</th>
                                        <th className="px-6 py-4 text-center font-black">Tipo</th>
                                        <th className="px-6 py-4 text-right font-black">Cantidad</th>
                                        <th className="px-6 py-4 text-left font-black">Motivo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientos.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center py-20 text-gray-300">No hay movimientos registrados</td></tr>
                                    ) : movimientos.map(m => (
                                        <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-gray-500 font-medium text-xs">
                                                {new Date(m.created_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-900">{m.ingredientes?.nombre}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter ${m.tipo === "entrada" ? "bg-green-100 text-green-700" :
                                                    m.tipo === "salida" ? "bg-red-100 text-red-700" :
                                                        m.tipo === "venta" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                                                    }`}>
                                                    {m.tipo === "entrada" && <ArrowUp size={8} />}
                                                    {m.tipo === "salida" && <ArrowDown size={8} />}
                                                    {m.tipo === "venta" && <DollarSign size={8} />}
                                                    {m.tipo === "ajuste" && <RefreshCcw size={8} />}
                                                    {m.tipo}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-black ${m.tipo === "entrada" ? "text-green-600" : "text-red-500"}`}>
                                                {m.tipo === "entrada" ? "+" : "-"}{m.cantidad} <span className="text-[10px] opacity-60 uppercase">{m.ingredientes?.unidad}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-xs italic">{m.motivo || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {tab === "recetas" && sucursalId && (
                            <div className="p-6">
                                <FichasTecnicasTab
                                    sucursalId={sucursalId}
                                    ingredientes={ingredientes}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <IngredientModal
                isOpen={isIngModalOpen}
                onClose={() => setIsIngModalOpen(false)}
                onSave={fetchIngredientes}
                ingredient={selectedIng}
                sucursalId={sucursalId || ""}
            />
            <MovementModal
                isOpen={isMovModalOpen}
                onClose={() => setIsMovModalOpen(false)}
                onSave={() => { fetchIngredientes(); if (tab === "movimientos") fetchMovimientos(); }}
                ingredient={selectedIng}
                sucursalId={sucursalId || ""}
            />
        </section>
    );
}

