"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, ShoppingCart, View } from "lucide-react";
import { useCart } from "@/context/CartContext";

interface FlyerData {
    id: string;
    imagen_url: string;
    producto_id: string | null;
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
}: {
    sucursalId: string;
    onClose: () => void;
    onOpenProduct: (producto: Producto) => void;
}) {
    const [flyer, setFlyer] = useState<FlyerData | null>(null);
    const [loading, setLoading] = useState(true);
    const { addItem } = useCart();

    useEffect(() => {
        fetchActiveFlyer();
    }, [sucursalId]);

    async function fetchActiveFlyer() {
        try {
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from("sucursal_flyers")
                .select("id, imagen_url, producto_id")
                .eq("sucursal_id", sucursalId)
                .eq("activo", true)
                .or(`es_eterno.eq.true,and(fecha_desde.lte.${now},fecha_hasta.gte.${now})`)
                .maybeSingle();

            if (data) {
                setFlyer(data);
            }
        } catch (err) {
            console.error("Error fetching flyer:", err);
        } finally {
            setLoading(false);
        }
    }

    async function handleLoQuiero() {
        if (!flyer?.producto_id) {
            onClose();
            return;
        }

        try {
            // Fetch full product data
            const { data: prod } = await supabase
                .from("productos")
                .select("*")
                .eq("id", flyer.producto_id)
                .single();

            if (!prod) return;

            // Check if it has options/additionals
            const { data: options } = await supabase
                .from("producto_grupos_adicionales")
                .select("id")
                .eq("producto_id", prod.id)
                .limit(1);

            if (options && options.length > 0) {
                // Has options, open the detail modal
                onOpenProduct(prod);
                onClose();
            } else {
                // No options, add directly to cart
                addItem({
                    productoId: prod.id,
                    nombre: prod.nombre,
                    precio: prod.precio,
                    cantidad: 1,
                    imagen_url: prod.imagen_url,
                    adicionales: [],
                });
                onClose();
                alert(`¡"${prod.nombre}" agregado al carrito!`);
            }
        } catch (err) {
            console.error("Error in LO QUIERO:", err);
        }
    }

    if (loading || !flyer) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop - Lighter and blurred to see menu behind */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Flyer Content */}
            <div className="relative w-full max-w-sm animate-in fade-in zoom-in duration-300">
                {/* Close Button Top Right */}
                <button
                    onClick={onClose}
                    className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors z-10"
                >
                    <X size={28} />
                </button>

                <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl flex flex-col cursor-pointer transform transition-transform hover:scale-[1.02] active:scale-[0.98]"
                    onClick={handleLoQuiero}>
                    <img
                        src={flyer.imagen_url}
                        alt="Promoción Especial"
                        className="w-full aspect-[9/16] object-cover"
                    />
                </div>
            </div>
        </div>
    );
}
