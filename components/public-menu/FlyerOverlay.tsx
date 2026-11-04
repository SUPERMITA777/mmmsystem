"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, ShoppingCart, BookOpen, Loader2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { getProductDiscount, Descuento } from "@/lib/discountUtils";

interface FlyerData {
    id: string;
    imagen_url: string;
    producto_id: string | null;
    es_eterno: boolean;
    vence_at: string | null;
    activo: boolean;
}

interface Producto {
    id: string;
    nombre: string;
    precio: number;
    imagen_url?: string;
    descripcion?: string;
    categoria_nombre?: string;
    categoria_id?: string;
    precio_promocional?: number;
    promo_activo?: boolean;
    promo_desde?: string;
    promo_hasta?: string;
    promo_hora_desde?: string;
    promo_hora_hasta?: string;
    promo_dias?: number[];
}

export default function FlyerOverlay({
    sucursalId,
    onClose,
    onOpenProduct,
    onOpenCart,
    categorias = [],
    descuentos = [],
}: {
    sucursalId: string;
    onClose: () => void;
    onOpenProduct: (producto: Producto) => void;
    onOpenCart?: () => void;
    categorias?: any[];
    descuentos?: any[];
}) {
    const [flyer, setFlyer] = useState<FlyerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const { addItem } = useCart();

    useEffect(() => {
        fetchActiveFlyer();
    }, [sucursalId]);

    async function fetchActiveFlyer() {
        try {
            const { data, error } = await supabase
                .from("sucursal_flyers")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .eq("activo", true);

            if (error) throw error;

            if (data && data.length > 0) {
                const now = new Date();
                // Buscar un flyer válido: eterno o que no haya vencido (usando vence_at)
                const validFlyer = data.find((f: any) => {
                    if (f.es_eterno) return true;
                    if (!f.vence_at) return true; // Sin fecha de vencimiento = siempre activo
                    return now <= new Date(f.vence_at);
                });
                if (validFlyer) {
                    setFlyer(validFlyer);
                }
            }
        } catch (err) {
            console.error("Error fetching flyer:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleAgregarAlCarrito() {
        if (!flyer?.producto_id || adding) {
            onClose();
            return;
        }

        setAdding(true);
        try {
            // 1. Obtener datos del producto (primero de categorías ya cargadas, o de la base de datos)
            let prod: any = null;
            if (categorias && categorias.length > 0) {
                for (const cat of categorias) {
                    const found = (cat.productos || []).find((p: any) => p.id === flyer.producto_id);
                    if (found) {
                        prod = {
                            ...found,
                            categoria_nombre: cat.nombre,
                            categoria_id: cat.id,
                        };
                        break;
                    }
                }
            }

            if (!prod) {
                const { data: fetchedProd, error: prodErr } = await supabase
                    .from("productos")
                    .select("*, categorias(id, nombre)")
                    .eq("id", flyer.producto_id)
                    .maybeSingle();

                if (prodErr || !fetchedProd) {
                    console.error("Error obteniendo producto del flyer:", prodErr);
                    onClose();
                    return;
                }

                prod = {
                    ...fetchedProd,
                    categoria_nombre: fetchedProd.categorias?.nombre,
                    categoria_id: fetchedProd.categoria_id || fetchedProd.categorias?.id,
                };
            }

            // 2. Verificar si el producto tiene grupos de adicionales asociados
            const { data: asignaciones, error: asigErr } = await supabase
                .from("producto_grupos_adicionales")
                .select("grupo_id")
                .eq("producto_id", prod.id);

            if (asigErr) {
                console.error("Error consultando producto_grupos_adicionales:", asigErr);
            }

            let tieneEleccionesObligatorias = false;

            if (asignaciones && asignaciones.length > 0) {
                const grupoIds = asignaciones.map((a: any) => a.grupo_id);
                const { data: gruposData, error: gruposErr } = await supabase
                    .from("grupos_adicionales")
                    .select("id, titulo, seleccion_obligatoria, seleccion_minima, seleccion_maxima")
                    .in("id", grupoIds);

                if (gruposErr) {
                    console.error("Error consultando grupos_adicionales:", gruposErr);
                }

                if (gruposData && gruposData.length > 0) {
                    tieneEleccionesObligatorias = gruposData.some((g: any) => {
                        const esObligatorio = Boolean(g.seleccion_obligatoria);
                        const minRequerido = Number(g.seleccion_minima || 0);
                        return esObligatorio || minRequerido > 0;
                    });
                }
            }

            // 3. Si tiene elecciones obligatorias, obligar a seleccionar opciones abriendo el detalle del producto
            if (tieneEleccionesObligatorias) {
                onOpenProduct(prod);
                onClose();
                return;
            }

            // 4. Si no tiene elecciones obligatorias, agregar directamente al carrito
            const discount = getProductDiscount(
                prod.id,
                prod.categoria_id || "",
                descuentos as Descuento[],
                prod as any
            );
            const precioBase = discount ? discount.precioFinal(prod.precio) : prod.precio;

            addItem({
                productoId: prod.id,
                nombre: prod.nombre,
                precio: precioBase,
                cantidad: 1,
                imagen_url: prod.imagen_url,
                adicionales: [],
                categoriaNombre: prod.categoria_nombre,
                descuentoInfo: discount ? {
                    id: discount.id,
                    porcentaje: discount.porcentaje,
                    no_acumulable: discount.no_acumulable,
                    nombre: discount.nombre,
                } : null,
            });

            onClose();
            if (onOpenCart) {
                onOpenCart();
            }
        } catch (err) {
            console.error("Error al agregar al carrito desde flyer:", err);
            onClose();
        } finally {
            setAdding(false);
        }
    }

    function handleVerCarta() {
        // Solo cerrar el flyer → el usuario queda en la carta
        onClose();
    }

    // Si cargando o no hay flyer activo → no renderizamos nada
    if (loading || !flyer) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Contenido del Flyer */}
            <div className="relative w-full max-w-sm animate-in fade-in zoom-in duration-300 flex flex-col gap-3">
                {/* Botón Cerrar */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors z-10"
                >
                    <X size={28} />
                </button>

                {/* Imagen */}
                <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl">
                    <img
                        src={flyer.imagen_url}
                        alt="Promoción Especial"
                        className="w-full aspect-[9/16] object-cover"
                    />
                </div>

                {/* Botones de Acción */}
                <div className="flex gap-3 w-full">
                    {/* VER CARTA - izquierda, naranja */}
                    <button
                        onClick={handleVerCarta}
                        className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg transition-all text-sm"
                    >
                        <BookOpen size={18} />
                        VER CARTA
                    </button>

                    {/* AGREGAR AL CARRITO - derecha, verde */}
                    <button
                        onClick={handleAgregarAlCarrito}
                        disabled={adding}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg transition-all text-sm disabled:opacity-75"
                    >
                        {adding ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>CARGANDO...</span>
                            </>
                        ) : (
                            <>
                                <ShoppingCart size={18} />
                                <span>AGREGAR</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}