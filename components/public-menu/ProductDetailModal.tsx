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

type Opcion = {
    id: string;
    nombre: string;
    precio_adicional: number;
};

type Grupo = {
    id: string;
    nombre: string;
    tipo_seleccion: string;
    minimo: number;
    maximo?: number;
    obligatorio: boolean;
    opciones: Opcion[];
};

export default function ProductDetailModal({
    producto,
    onClose,
}: {
    producto: Producto;
    onClose: () => void;
}) {
    const [cantidad, setCantidad] = useState(1);
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [seleccion, setSeleccion] = useState<Record<string, string[]>>({}); // grupoId -> [opcionIds]
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
            .eq("activo", true)
            .order("orden");

        if (!gruposData) return;

        const gruposConOpciones = await Promise.all(gruposData.map(async (g: any) => {
            const { data: options } = await supabase
                .from("opciones_adicional")
                .select("*")
                .eq("grupo_id", g.id)
                .eq("activo", true)
                .order("orden");
            return { ...g, opciones: options || [] };
        }));

        setGrupos(gruposConOpciones);
    }

    function toggleOpcion(grupoId: string, opcionId: string, tipo: string, max?: number) {
        const actual = seleccion[grupoId] || [];
        if (tipo === "unico") {
            setSeleccion({ ...seleccion, [grupoId]: [opcionId] });
        } else {
            if (actual.includes(opcionId)) {
                setSeleccion({ ...seleccion, [grupoId]: actual.filter(id => id !== opcionId) });
            } else {
                if (max && actual.length >= max) return;
                setSeleccion({ ...seleccion, [grupoId]: [...actual, opcionId] });
            }
        }
    }

    function handleAgregar() {
        // Calculate additional info for the cart
        const adicionalesSeleccionados: any[] = [];
        grupos.forEach(g => {
            const ids = seleccion[g.id] || [];
            ids.forEach(oid => {
                const opt = g.opciones.find(o => o.id === oid);
                if (opt) {
                    adicionalesSeleccionados.push({
                        nombre: opt.nombre,
                        precio: opt.precio_adicional,
                        grupo: g.nombre
                    });
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
            const opt = g.opciones.find(o => o.id === oid);
            return s + (opt?.precio_adicional || 0);
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

                {/* Cart icon with count */}
                <div className="absolute top-4 right-4 w-10 h-10 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
                    🛒
                </div>
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
                    <p className="text-2xl font-black text-white mb-6">
                        $ {new Intl.NumberFormat("es-AR").format(producto.precio)}
                    </p>

                    {/* Groups of Additionals */}
                    <div className="space-y-8 pb-10">
                        {grupos.map(g => (
                            <div key={g.id}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-base font-black text-white uppercase tracking-wider">{g.nombre}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${g.obligatorio ? "bg-orange-500/20 text-orange-500" : "bg-slate-800 text-slate-400"}`}>
                                        {g.obligatorio ? "OBLIGATORIO" : "OPCIONAL"}
                                    </span>
                                </div>
                                <div className="space-y-1">
                                    {g.opciones.map(o => (
                                        <button
                                            key={o.id}
                                            onClick={() => toggleOpcion(g.id, o.id, g.tipo_seleccion, g.maximo)}
                                            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border ${(seleccion[g.id] || []).includes(o.id)
                                                ? "bg-orange-600/10 border-orange-600/50"
                                                : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${(seleccion[g.id] || []).includes(o.id)
                                                    ? "border-orange-500 bg-orange-500"
                                                    : "border-slate-700"
                                                    }`}>
                                                    {(seleccion[g.id] || []).includes(o.id) && (
                                                        <div className="w-2 h-2 bg-white rounded-full" />
                                                    )}
                                                </div>
                                                <span className="text-sm font-bold text-white uppercase">{o.nombre}</span>
                                            </div>
                                            {o.precio_adicional > 0 && (
                                                <span className="text-sm font-black text-orange-500">
                                                    + $ {new Intl.NumberFormat("es-AR").format(o.precio_adicional)}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky footer: qty + add button */}
            <div className="px-5 py-4 border-t border-slate-800/50 bg-[#0d0d0d] flex items-center gap-4">
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
                    onClick={handleAgregar}
                    className="flex-1 bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-black py-3.5 rounded-xl transition-all text-base tracking-wide"
                >
                    AGREGAR $ {new Intl.NumberFormat("es-AR").format(totalLinea)}
                </button>
            </div>
        </div>
    );
}
