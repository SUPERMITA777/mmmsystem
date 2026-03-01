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
            const { data, error } = await supabase
                .from("sucursal_flyers")
                .select("id, imagen_url, producto_id")
                .eq("sucursal_id", sucursalId)
                .eq("activo", true)
                .or(`es_eterno.eq.true,vence_at.gt.${new Date().toISOString()}`)
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
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
                onClick={onClose}
            />

            {/* Flyer Content */}
            <div className="relative w-full max-w-md animate-in fade-in zoom-in duration-300">
                {/* Close Button Top Right (Small X) */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="bg-[#1a1a1a] rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
                    <img
                        src={flyer.imagen_url}
                        alt="Promoción Especial"
                        className="w-full aspect-[4/5] object-cover"
                    />

                    <div className="p-4 grid grid-cols-2 gap-3 bg-gradient-to-t from-black to-[#1a1a1a]">
                        {/* VER LA CARTA (Left) */}
                        <button
                            onClick={onClose}
                            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-white/5"
                        >
                            <View size={16} />
                            VER LA CARTA
                        </button>

                        {/* LO QUIERO! (Right) */}
                        <button
                            onClick={handleLoQuiero}
                            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-orange-600/20"
                        >
                            <ShoppingCart size={16} />
                            LO QUIERO!
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
