"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Star, Minus, Plus } from "lucide-react";
import { useCart } from "@/context/CartContext";

type Producto = {
    id: string;
    nombre: string;
    descripcion?: string;
    precio: number;
    imagen_url?: string;
    producto_sugerido?: boolean;
    categoria_nombre?: string;
};

type Adicional = {
    id: string;
    nombre: string;
    precio_venta: number;
    seleccion_maxima: number;
};

type GrupoAdicional = {
    id: string;
    titulo: string;
    seleccion_obligatoria: boolean;
    seleccion_minima: number;
    seleccion_maxima: number;
    adicionales: Adicional[];
};

export default function ProductDetailModal({
    producto,
    onClose,
}: {
    producto: Producto;
    onClose: () => void;
}) {
    const [cantidad, setCantidad] = useState(1);
    const [grupos, setGrupos] = useState<GrupoAdicional[]>([]);

    // Estado de selección: Guardamos un array de IDs de adicionales por cada grupo (un ID puede repetirse si se selecciona varias veces)
    const [seleccion, setSeleccion] = useState<Record<string, string[]>>({});
    const { addItem } = useCart();

    useEffect(() => {
        loadAdicionales();
    }, []);

    async function loadAdicionales() {
        const { data: asignaciones } = await supabase
            .from("producto_grupos_adicionales")
            .select("grupo_id")
            .eq("producto_id", producto.id);

        if (!asignaciones || asignaciones.length === 0) return;

        const grupoIds = asignaciones.map((a: any) => a.grupo_id);
        const { data: gruposData } = await supabase
            .from("grupos_adicionales")
            .select("*")
            .in("id", grupoIds)
            .order("created_at", { ascending: true });

        if (!gruposData) return;

        const gruposConOpciones = await Promise.all(gruposData.map(async (g: any) => {
            const { data: options } = await supabase
                .from("adicionales")
                .select("*")
                .eq("grupo_id", g.id)
                .eq("visible", true)
                .order("created_at", { ascending: true });
            return { ...g, adicionales: options || [] };
        }));

        setGrupos(gruposConOpciones);

        // Inicializar estado de selección vacío
        const selInit: Record<string, string[]> = {};
        gruposConOpciones.forEach(g => selInit[g.id] = []);
        setSeleccion(selInit);
    }

    function addAdicional(grupo: GrupoAdicional, adic: Adicional) {
        const actualGroupSelection = seleccion[grupo.id] || [];

        // Validar máximo del grupo entero
        if (actualGroupSelection.length >= grupo.seleccion_maxima) return;

        // Validar máximo de este ítem específico
        const countOfThisItem = actualGroupSelection.filter(id => id === adic.id).length;
        if (countOfThisItem >= adic.seleccion_maxima) return;

        setSeleccion({ ...seleccion, [grupo.id]: [...actualGroupSelection, adic.id] });
    }

    function removeAdicional(grupoId: string, adicId: string) {
        const actualGroupSelection = seleccion[grupoId] || [];
        const index = actualGroupSelection.lastIndexOf(adicId);
        if (index > -1) {
            const newSelection = [...actualGroupSelection];
            newSelection.splice(index, 1);
            setSeleccion({ ...seleccion, [grupoId]: newSelection });
        }
    }

    // Validar si todos los grupos obligatorios cumplen su mínimo
    const isCartValid = grupos.every(g => {
        if (!g.seleccion_obligatoria) return true;
        const count = (seleccion[g.id] || []).length;
        return count >= g.seleccion_minima;
    });

    function handleAgregar() {
        if (!isCartValid) return;

        // Calculate additional info for the cart
        const adicionalesSeleccionados: any[] = [];
        grupos.forEach(g => {
            const ids = seleccion[g.id] || [];

            // Agrupar IDs repetidos para pasarlos al cart como "2x Queso"
            const conteo: Record<string, number> = {};
            ids.forEach(id => conteo[id] = (conteo[id] || 0) + 1);

            Object.entries(conteo).forEach(([oid, qty]) => {
                const opt = g.adicionales.find(o => o.id === oid);
                if (opt) {
                    for (let i = 0; i < qty; i++) {
                        adicionalesSeleccionados.push({
                            nombre: opt.nombre,
                            precio: opt.precio_venta,
                            grupo: g.titulo
                        });
                    }
                }
            });
        });

        addItem({
            productoId: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad,
            imagen_url: producto.imagen_url,
            adicionales: adicionalesSeleccionados,
        });
        onClose();
    }

    const calculoAdicionales = grupos.reduce((acc, g) => {
        const ids = seleccion[g.id] || [];
        const sub = ids.reduce((s, oid) => {
            const opt = g.adicionales.find(o => o.id === oid);
            return s + (opt?.precio_venta || 0);
        }, 0);
        return acc + sub;
    }, 0);

    const totalLinea = (producto.precio + calculoAdicionales) * cantidad;

    return (
        <div className="fixed inset-0 z-50 bg-[#0d0d0d] flex flex-col overflow-hidden">
            {/* Hero Image */}
            <div className="relative w-full h-64 md:h-80 bg-slate-900 shrink-0">
                <img
                    src={producto.imagen_url || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=600&fit=crop"}
                    alt={producto.nombre}
                    className="w-full h-full object-cover"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-transparent to-transparent" />

                {/* Back button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 left-4 w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-5 pt-4 pb-4">
                    {/* Category */}
                    {producto.categoria_nombre && (
                        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1 font-medium">
                            {producto.categoria_nombre}
                        </p>
                    )}

                    {/* Name + star */}
                    <div className="flex items-center gap-2 mb-2">
                        <h1 className="text-2xl font-black text-white uppercase tracking-wide leading-tight">
                            {producto.nombre}
                        </h1>
                        {producto.producto_sugerido && (
                            <Star size={18} className="text-orange-400 fill-orange-400 shrink-0" />
                        )}
                    </div>

                    {/* Description */}
                    {producto.descripcion && (
                        <p className="text-sm text-slate-400 uppercase tracking-wide leading-relaxed mb-4">
                            {producto.descripcion}
                        </p>
                    )}

                    {/* Price */}
                    <p className="text-2xl font-black text-white mb-6 border-b border-slate-800 pb-6">
                        $ {new Intl.NumberFormat("es-AR").format(producto.precio)}
                    </p>

                    {/* Groups of Additionals */}
                    <div className="space-y-8 pb-10 mt-6">
                        {grupos.map(g => {
                            const selectedCount = (seleccion[g.id] || []).length;
                            const isGroupValid = !g.seleccion_obligatoria || selectedCount >= g.seleccion_minima;

                            return (
                                <div key={g.id} className={`rounded-2xl border ${!isGroupValid ? 'border-orange-500/50 bg-orange-500/5' : 'border-slate-800/50 bg-slate-900/20'} overflow-hidden`}>
                                    <div className={`px-4 py-4 border-b ${!isGroupValid ? 'border-orange-500/20' : 'border-slate-800/50'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="text-base font-black text-white uppercase tracking-wider">{g.titulo}</h3>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${g.seleccion_obligatoria ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-400"}`}>
                                                {g.seleccion_obligatoria ? "Requerido" : "Opcional"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span>Seleccionados {selectedCount} de {g.seleccion_maxima}</span>
                                            {g.seleccion_obligatoria && <span>Mínimo {g.seleccion_minima}</span>}
                                        </div>
                                    </div>
                                    <div className="divide-y divide-slate-800/50">
                                        {g.adicionales.map(o => {
                                            const countSelected = (seleccion[g.id] || []).filter(id => id === o.id).length;

                                            return (
                                                <div key={o.id} className="flex items-center justify-between p-4">
                                                    <div>
                                                        <div className="text-sm font-bold text-white uppercase">{o.nombre}</div>
                                                        {o.precio_venta > 0 && (
                                                            <div className="text-sm font-black text-orange-400 mt-0.5">
                                                                + $ {new Intl.NumberFormat("es-AR").format(o.precio_venta)}
                                                            </div>
                                                        )}
                                                        {o.seleccion_maxima > 1 && (
                                                            <div className="text-[10px] text-slate-500 uppercase font-bold mt-0.5">Máx. {o.seleccion_maxima}</div>
                                                        )}
                                                    </div>

                                                    {/* Quantity Controls for Item */}
                                                    <div className="flex items-center gap-3">
                                                        {countSelected > 0 ? (
                                                            <>
                                                                <button
                                                                    onClick={() => removeAdicional(g.id, o.id)}
                                                                    className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition"
                                                                >
                                                                    <Minus size={16} />
                                                                </button>
                                                                <span className="text-white font-bold w-4 text-center">{countSelected}</span>
                                                                <button
                                                                    disabled={countSelected >= o.seleccion_maxima || selectedCount >= g.seleccion_maxima}
                                                                    onClick={() => addAdicional(g, o)}
                                                                    className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center disabled:opacity-30 disabled:bg-slate-800 transition"
                                                                >
                                                                    <Plus size={16} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                disabled={selectedCount >= g.seleccion_maxima}
                                                                onClick={() => addAdicional(g, o)}
                                                                className="w-8 h-8 rounded-full border border-slate-700 text-slate-400 flex items-center justify-center disabled:opacity-30 hover:border-orange-500 hover:text-orange-500 transition"
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Sticky footer: qty + add button */}
            <div className="px-5 py-4 border-t border-slate-800 bg-[#0d0d0d] flex items-center gap-4">
                {/* Quantity selector */}
                <div className="flex items-center gap-3 bg-slate-800 rounded-full px-2 py-1">
                    <button
                        onClick={() => setCantidad(c => Math.max(1, c - 1))}
                        className="w-8 h-8 flex items-center justify-center text-white hover:text-orange-400 transition-colors"
                    >
                        <Minus size={16} />
                    </button>
                    <span className="text-white font-bold text-base min-w-[24px] text-center">{cantidad}</span>
                    <button
                        onClick={() => setCantidad(c => c + 1)}
                        className="w-8 h-8 flex items-center justify-center text-white hover:text-orange-400 transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Add to cart button */}
                <button
                    disabled={!isCartValid}
                    onClick={handleAgregar}
                    className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-500 active:scale-95 text-white font-black py-3.5 rounded-xl transition-all text-sm tracking-wide"
                >
                    {isCartValid ? `AGREGAR $ ${new Intl.NumberFormat("es-AR").format(totalLinea)}` : 'SELECCIONÁ LOS ADICIONALES'}
                </button>
            </div>
        </div>
    );
}
