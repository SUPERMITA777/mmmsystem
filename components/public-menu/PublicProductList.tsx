"use client";

import { Star, Plus } from "lucide-react";

interface Product {
    id: string;
    nombre: string;
    descripcion?: string;
    precio: number;
    imagen_url?: string;
    producto_sugerido?: boolean;
    categoria_nombre?: string;
}

interface CategoryWithProducts {
    id: string;
    nombre: string;
    productos: Product[];
}

interface PublicProductListProps {
    categorias: CategoryWithProducts[];
    onProductClick: (producto: Product & { categoria_nombre: string }) => void;
}

export default function PublicProductList({ categorias, onProductClick }: PublicProductListProps) {
    return (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-10 pb-32">
            {categorias.map((cat) => (
                <section key={cat.id} id={cat.id} className="scroll-mt-24">
                    <h2 className="text-base font-black text-white uppercase tracking-widest mb-4 pb-2 border-b border-slate-800">
                        {cat.nombre}
                    </h2>

                    <div className="space-y-0 divide-y divide-slate-800/60">
                        {cat.productos.map((prod) => (
                            <button
                                key={prod.id}
                                onClick={() => onProductClick({ ...prod, categoria_nombre: cat.nombre })}
                                className="w-full flex items-center gap-4 py-4 text-left hover:bg-white/3 transition-colors group"
                            >
                                {/* Info */}
                                <div className="flex-1 space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-slate-100 text-sm uppercase tracking-wide leading-tight truncate">
                                            {prod.nombre}
                                        </h3>
                                        {prod.producto_sugerido && (
                                            <Star size={12} className="text-orange-400 fill-orange-400 shrink-0" />
                                        )}
                                    </div>
                                    {prod.descripcion && (
                                        <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed uppercase tracking-wide">
                                            {prod.descripcion}
                                        </p>
                                    )}
                                    <p className="text-white font-black text-sm pt-0.5">
                                        $ {new Intl.NumberFormat("es-AR").format(prod.precio)}
                                    </p>
                                </div>

                                {/* Image + add button */}
                                <div className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-slate-800">
                                    <img
                                        src={prod.imagen_url || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=300&fit=crop"}
                                        alt={prod.nombre}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                    {/* + button overlaid at bottom right */}
                                    <div className="absolute bottom-1.5 right-1.5 w-7 h-7 bg-orange-600 rounded-full flex items-center justify-center shadow-lg">
                                        <Plus size={16} className="text-white" strokeWidth={3} />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
