"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";

export default function FloatingCartButton({ onClick }: { onClick: () => void }) {
    const { totalItems, total } = useCart();

    if (totalItems === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
            <button
                onClick={onClick}
                className="w-full active:scale-95 text-white font-black py-4 rounded-2xl shadow-2xl flex items-center justify-between px-5 transition-all group"
                style={{ backgroundColor: 'var(--color-primario, #f97316)' }}
            >
                {/* Items count bubble */}
                <span className="flex items-center gap-2">
                    <ShoppingCart size={20} />
                    <span className="bg-white/20 px-2 py-0.5 rounded-lg text-xs font-black">
                        {totalItems}
                    </span>
                </span>

                <span className="tracking-widest uppercase text-sm">Ver mi pedido</span>

                <span className="text-base font-black">
                    $ {new Intl.NumberFormat("es-AR").format(total)}
                </span>
            </button>
        </div>
    );
}
