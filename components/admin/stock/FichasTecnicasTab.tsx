"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, ChefHat, Trash2, RefreshCw, TrendingUp, DollarSign, Percent } from "lucide-react";
import NuevaFichaModal from "./NuevaFichaModal";
import { db } from "@/lib/db";

type FichaTecnica = {
    id: string;
    nombre: string;
    descripcion: string | null;
    costo_total: number;
    sucursal_id: string;
};

type FichaItem = {
    id: string;
    ficha_tecnica_id: string;
    tipo: "ingrediente" | "sub_receta";
    cantidad: number;
    ingrediente_id: string | null;
    sub_ficha_id: string | null;
    ingredientes?: { nombre: string; unidad: string; costo_unitario: number } | null;
    sub_ficha?: { nombre: string; costo_total: number } | null;
};

type ProductoConFicha = {
    id: string;
    nombre: string;
    precio: number;
    ficha_tecnica_id: string | null;
    ficha: { nombre: string; costo_total: number } | null;
};

type Props = {
    sucursalId: string;
    ingredientes: any[];
};

export default function FichasTecnicasTab({ sucursalId, ingredientes }: Props) {
    const [fichas, setFichas] = useState<FichaTecnica[]>([]);
    const [selectedFicha, setSelectedFicha] = useState<FichaTecnica | null>(null);
    const [fichaItems, setFichaItems] = useState<FichaItem[]>([]);
    const [productos, setProductos] = useState<ProductoConFicha[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingItems, setLoadingItems] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFicha, setEditingFicha] = useState<FichaTecnica | null>(null);
    const [activeView, setActiveView] = useState<"recetas" | "rentabilidad">("recetas");

    const fetchFichas = useCallback(async () => {
        if (!sucursalId) return;
        setLoading(true);
        console.log("[FichasTab] Cargando fichas para sucursal:", sucursalId);
        try {
            // 1. Intentar local
            const localData = await db.fichas_tecnicas
                .where("sucursal_id")
                .equals(sucursalId)
                .toArray();
            
            if (localData.length > 0) {
                console.log("[FichasTab] Fichas cargadas desde DB Local:", localData.length);
                setFichas(localData as FichaTecnica[]);
                setLoading(false);
                return;
            }

            // 2. Fallback a Supabase
            console.log("[FichasTab] DB Local vacía, consultando Supabase...");
            const { data, error } = await supabase
                .from("fichas_tecnicas")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .order("nombre");
            
            if (error) throw error;
            console.log("[FichasTab] Fichas cargadas desde Supabase:", data?.length || 0);
            setFichas((data as FichaTecnica[]) || []);
        } catch (err) {
            console.error("[FichasTab] Error cargando fichas:", err);
        } finally {
            setLoading(false);
        }
    }, [sucursalId]);

    const fetchFichaItems = useCallback(async (fichaId: string) => {
        setLoadingItems(true);
        const { data } = await supabase
            .from("ficha_tecnica_items")
            .select(`
                *,
                ingredientes(nombre, unidad, costo_unitario),
                sub_ficha:fichas_tecnicas!ficha_tecnica_items_sub_ficha_id_fkey(nombre, costo_total)
            `)
            .eq("ficha_tecnica_id", fichaId);
        setFichaItems((data as FichaItem[]) || []);
        setLoadingItems(false);
    }, []);

    const fetchProductosConFicha = useCallback(async () => {
        if (!sucursalId) return;
        const { data } = await supabase
            .from("productos")
            .select(`
                id, nombre, precio, ficha_tecnica_id,
                ficha:fichas_tecnicas(nombre, costo_total)
            `)
            .eq("sucursal_id", sucursalId)
            .eq("activo", true)
            .not("ficha_tecnica_id", "is", null)
            .order("nombre");
        setProductos((data as any[]) || []);
    }, [sucursalId]);

    useEffect(() => {
        fetchFichas();
        fetchProductosConFicha();
    }, [fetchFichas, fetchProductosConFicha]);

    useEffect(() => {
        if (selectedFicha) {
            fetchFichaItems(selectedFicha.id);
        }
    }, [selectedFicha, fetchFichaItems]);

    async function handleDeleteFicha(ficha: FichaTecnica) {
        if (!confirm(`¿Eliminar la receta "${ficha.nombre}"? Esta acción no se puede deshacer.`)) return;
        await supabase.from("fichas_tecnicas").delete().eq("id", ficha.id);
        setSelectedFicha(null);
        setFichaItems([]);
        fetchFichas();
        fetchProductosConFicha();
    }

    async function handleRemoveItem(itemId: string) {
        await supabase.from("ficha_tecnica_items").delete().eq("id", itemId);
        if (selectedFicha) fetchFichaItems(selectedFicha.id);
    }

    async function handleUpdateCosto() {
        if (!selectedFicha) return;
        const costo = fichaItems.reduce((acc, item) => {
            if (item.tipo === "ingrediente") {
                return acc + (item.cantidad * (item.ingredientes?.costo_unitario || 0));
            } else {
                return acc + (item.cantidad * (item.sub_ficha?.costo_total || 0));
            }
        }, 0);
        await supabase
            .from("fichas_tecnicas")
            .update({ costo_total: costo })
            .eq("id", selectedFicha.id);
        setSelectedFicha({ ...selectedFicha, costo_total: costo });
        fetchFichas();
        fetchProductosConFicha();
    }

    const costoCalculado = fichaItems.reduce((acc, item) => {
        if (item.tipo === "ingrediente") {
            return acc + (item.cantidad * (item.ingredientes?.costo_unitario || 0));
        } else {
            return acc + (item.cantidad * (item.sub_ficha?.costo_total || 0));
        }
    }, 0);

    return (
        <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex items-center justify-between">
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                    <button
                        onClick={() => setActiveView("recetas")}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeView === "recetas" ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        <ChefHat size={15} /> Fichas Técnicas
                    </button>
                    <button
                        onClick={() => setActiveView("rentabilidad")}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${activeView === "rentabilidad" ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        <TrendingUp size={15} /> Rentabilidad
                    </button>
                </div>
                {activeView === "recetas" && (
                    <button
                        onClick={() => { setEditingFicha(null); setIsModalOpen(true); }}
                        className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all shadow-md active:scale-95"
                    >
                        <Plus size={16} /> Nueva Receta
                    </button>
                )}
            </div>

            {/* VIEW: Fichas Técnicas */}
            {activeView === "recetas" && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" />
                        </div>
                    ) : fichas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-3">
                            <div className="w-20 h-20 rounded-3xl bg-purple-50 flex items-center justify-center">
                                <ChefHat size={36} className="text-purple-300" />
                            </div>
                            <p className="text-gray-400 font-medium text-sm">No hay recetas creadas todavía</p>
                            <button
                                onClick={() => { setEditingFicha(null); setIsModalOpen(true); }}
                                className="mt-2 flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-700 transition-all"
                            >
                                <Plus size={16} /> Crear primera receta
                            </button>
                        </div>
                    ) : (
                        <div className="flex h-[60vh]">
                            {/* Left Panel: Lista de fichas */}
                            <div className="w-80 shrink-0 border-r border-gray-100 overflow-y-auto">
                                <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        {fichas.length} {fichas.length === 1 ? "receta" : "recetas"}
                                    </p>
                                </div>
                                <div className="p-2 space-y-1">
                                    {fichas.map(f => (
                                        <button
                                            key={f.id}
                                            onClick={() => setSelectedFicha(f)}
                                            className={`w-full text-left p-3 rounded-xl transition-all group ${selectedFicha?.id === f.id
                                                ? "bg-purple-50 border border-purple-200"
                                                : "hover:bg-gray-50 border border-transparent"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className={`text-sm font-bold truncate ${selectedFicha?.id === f.id ? "text-purple-700" : "text-gray-900"}`}>
                                                        {f.nombre}
                                                    </p>
                                                    <p className="text-xs text-gray-400 font-medium mt-0.5">
                                                        Costo: <span className="font-black text-gray-600">$ {new Intl.NumberFormat("es-AR").format(f.costo_total)}</span>
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setEditingFicha(f); setIsModalOpen(true); }}
                                                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleDeleteFicha(f); }}
                                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Right Panel: Detalle de la ficha seleccionada */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {!selectedFicha ? (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-300">
                                        <ChefHat size={40} />
                                        <p className="text-sm font-medium">Seleccioná una receta para ver el detalle</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Ficha Header */}
                                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/30">
                                            <div>
                                                <h3 className="font-black text-gray-900">{selectedFicha.nombre}</h3>
                                                {selectedFicha.descripcion && (
                                                    <p className="text-xs text-gray-400 mt-0.5">{selectedFicha.descripcion}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={handleUpdateCosto}
                                                    className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-purple-600 border border-gray-200 hover:border-purple-300 px-3 py-2 rounded-xl transition-all bg-white"
                                                >
                                                    <RefreshCw size={13} /> Actualizar Costo
                                                </button>
                                                <button
                                                    onClick={() => { setEditingFicha(selectedFicha); setIsModalOpen(true); }}
                                                    className="flex items-center gap-2 text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-xl transition-all"
                                                >
                                                    <Plus size={13} /> Agregar Ingrediente
                                                </button>
                                            </div>
                                        </div>

                                        {/* Items table */}
                                        <div className="flex-1 overflow-y-auto">
                                            {loadingItems ? (
                                                <div className="flex items-center justify-center py-12">
                                                    <div className="w-8 h-8 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" />
                                                </div>
                                            ) : fichaItems.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                                                    <Plus size={32} className="opacity-30" />
                                                    <p className="text-sm">No hay ingredientes. Hacé click en "Agregar Ingrediente".</p>
                                                </div>
                                            ) : (
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-50 bg-gray-50/50">
                                                            <th className="px-6 py-3 text-left font-black">Ingrediente / Sub-receta</th>
                                                            <th className="px-6 py-3 text-center font-black">Tipo</th>
                                                            <th className="px-6 py-3 text-right font-black">Cantidad</th>
                                                            <th className="px-6 py-3 text-right font-black">Unidad</th>
                                                            <th className="px-6 py-3 text-right font-black">Costo</th>
                                                            <th className="px-6 py-3 text-center font-black">Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {fichaItems.map(item => {
                                                            const nombre = item.tipo === "ingrediente"
                                                                ? item.ingredientes?.nombre
                                                                : item.sub_ficha?.nombre;
                                                            const unidad = item.tipo === "ingrediente"
                                                                ? item.ingredientes?.unidad
                                                                : "unid.";
                                                            const costoParcial = item.tipo === "ingrediente"
                                                                ? item.cantidad * (item.ingredientes?.costo_unitario || 0)
                                                                : item.cantidad * (item.sub_ficha?.costo_total || 0);
                                                            return (
                                                                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                                                                    <td className="px-6 py-3 font-bold text-gray-900">{nombre || "—"}</td>
                                                                    <td className="px-6 py-3 text-center">
                                                                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${item.tipo === "ingrediente" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>
                                                                            {item.tipo === "ingrediente" ? "Ingrediente" : "Sub-receta"}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right font-bold text-gray-700">
                                                                        {item.cantidad}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right text-gray-400 text-xs font-bold uppercase">
                                                                        {unidad}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-right font-black text-gray-900">
                                                                        $ {new Intl.NumberFormat("es-AR").format(costoParcial)}
                                                                    </td>
                                                                    <td className="px-6 py-3 text-center">
                                                                        <button
                                                                            onClick={() => handleRemoveItem(item.id)}
                                                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>

                                        {/* Cost Footer */}
                                        {fichaItems.length > 0 && (
                                            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end shrink-0">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Costo Total de la Receta</p>
                                                    <p className="text-2xl font-black text-gray-900">
                                                        $ {new Intl.NumberFormat("es-AR").format(costoCalculado)}
                                                    </p>
                                                    {costoCalculado !== selectedFicha.costo_total && (
                                                        <p className="text-[10px] text-orange-500 font-bold mt-0.5">
                                                            ⚠ Costo guardado diferente (${new Intl.NumberFormat("es-AR").format(selectedFicha.costo_total)}). Actualizá para sincronizar.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* VIEW: Rentabilidad */}
            {activeView === "rentabilidad" && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/30">
                        <h3 className="font-black text-gray-900">Análisis de Rentabilidad por Producto</h3>
                        <p className="text-xs text-gray-400 mt-0.5">Solo productos con ficha técnica asignada.</p>
                    </div>
                    {productos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-2 text-gray-300">
                            <TrendingUp size={36} />
                            <p className="text-sm font-medium">No hay productos con ficha técnica asignada todavía.</p>
                            <p className="text-xs">Asigná recetas a los productos desde el editor de Menú.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-400 text-[10px] uppercase tracking-widest border-b border-gray-50 bg-gray-50/50">
                                    <th className="px-6 py-4 text-left font-black">Producto</th>
                                    <th className="px-6 py-4 text-left font-black">Receta</th>
                                    <th className="px-6 py-4 text-right font-black">Precio Venta</th>
                                    <th className="px-6 py-4 text-right font-black">Costo Receta</th>
                                    <th className="px-6 py-4 text-right font-black">Utilidad</th>
                                    <th className="px-6 py-4 text-right font-black">Margen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {productos.map(p => {
                                    const costo = p.ficha?.costo_total || 0;
                                    const utilidad = p.precio - costo;
                                    const margen = costo > 0 ? (utilidad / costo) * 100 : 0;
                                    const margenColor = margen > 100
                                        ? "bg-green-100 text-green-700"
                                        : margen > 50
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-orange-100 text-orange-600";
                                    return (
                                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-900">{p.nombre}</td>
                                            <td className="px-6 py-4 text-gray-500 text-xs font-medium italic">{p.ficha?.nombre || "—"}</td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(p.precio)}</td>
                                            <td className="px-6 py-4 text-right font-black text-gray-600">$ {new Intl.NumberFormat("es-AR").format(costo)}</td>
                                            <td className={`px-6 py-4 text-right font-black ${utilidad >= 0 ? "text-green-600" : "text-red-500"}`}>
                                                {utilidad >= 0 ? "+" : ""}$ {new Intl.NumberFormat("es-AR").format(utilidad)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${margenColor}`}>
                                                    <Percent size={10} />
                                                    {Math.round(margen)}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Modal */}
            <NuevaFichaModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingFicha(null); }}
                onSave={async () => {
                    await fetchFichas();
                    await fetchProductosConFicha();
                    if (selectedFicha) {
                        const updated = fichas.find(f => f.id === selectedFicha.id);
                        if (updated) setSelectedFicha(updated);
                        await fetchFichaItems(editingFicha?.id || selectedFicha.id);
                    }
                    setIsModalOpen(false);
                    setEditingFicha(null);
                }}
                editingFicha={editingFicha}
                sucursalId={sucursalId}
                ingredientes={ingredientes}
                todasLasFichas={fichas}
            />
        </div>
    );
}
