"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, ShoppingCart, BookOpen } from "lucide-react";
import { useCart } from "@/context/CartContext";

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
}

export default function FlyerOverlay({
    sucursalId,
    onClose,
    onOpenProduct,
    onOpenCart,
}: {
    sucursalId: string;
    onClose: () => void;
    onOpenProduct: (producto: Producto) => void;
    onOpenCart?: () => void;
}) {
    const [flyer, setFlyer] = useState<FlyerData | null>(null);
    const [loading, setLoading] = useState(true);
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
        if (!flyer?.producto_id) {
            onClose();
            return;
        }

        try {
            const { data: prod } = await supabase
                .from("productos")
                .select("*")
                .eq("id", flyer.producto_id)
                .single();

            if (!prod) return;

            // Verificar si tiene opciones / adicionales
            const { data: options } = await supabase
                .from("producto_grupos_adicionales")
                .select("id")
                .eq("producto_id", prod.id)
                .limit(1);

            if (options && options.length > 0) {
                onOpenProduct(prod);
                onClose();
            } else {
                addItem({
                    productoId: prod.id,
                    nombre: prod.nombre,
                    precio: prod.precio,
                    cantidad: 1,
                    imagen_url: prod.imagen_url,
                    adicionales: [],
                });
                onClose();
            }
        } catch (err) {
            console.error("Error al agregar al carrito:", err);
        }
    }

    function handleVerCarta() {
        onClose();
        if (onOpenCart) {
            // pequeño delay para que el flyer cierre primero
            setTimeout(() => onOpenCart(), 150);
        }
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
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 active:scale-95 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg transition-all text-sm"
                    >
                        <ShoppingCart size={18} />
                        AGREGAR
                    </button>
                </div>
            </div>
        </div>
    );
}
