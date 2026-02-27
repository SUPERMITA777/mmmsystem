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
    imagen_url?: string;
    descripcion?: string;
    productos: Product[];
}

interface PublicProductListProps {
    categorias: CategoryWithProducts[];
    onProductClick: (producto: Product & { categoria_nombre: string }) => void;
}

export default function PublicProductList({ categorias, onProductClick }: PublicProductListProps) {
    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-12 pb-32">
            {categorias.map((cat) => (
                <section key={cat.id} id={cat.id} className="scroll-mt-32">
                    <div className="space-y-4 mb-8">
                        {cat.imagen_url && (
                            <div className="relative aspect-[768/210] w-full rounded-3xl overflow-hidden shadow-2xl shadow-black/50 border border-white/5">
                                <img
                                    src={cat.imagen_url}
                                    alt={cat.nombre}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-6 left-8">
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter drop-shadow-lg">
                                        {cat.nombre}
                                    </h2>
                                    {cat.descripcion && (
                                        <p className="text-slate-300 text-xs font-medium uppercase tracking-[0.2em] mt-1 drop-shadow-md">
                                            {cat.descripcion}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {!cat.imagen_url && (
                            <div className="flex items-center gap-3">
                                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em]">
                                    {cat.nombre}
                                </h2>
                                <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cat.productos.map((prod) => (
                            <button
                                key={prod.id}
                                onClick={() => onProductClick({ ...prod, categoria_nombre: cat.nombre })}
                                className="w-full flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 hover:bg-slate-800/40 hover:border-slate-700/50 transition-all duration-300 text-left group active:scale-[0.98] shadow-lg shadow-black/20"
                            >
                                {/* Info */}
                                <div className="flex-1 space-y-1.5 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="font-black text-slate-100 text-[13px] uppercase tracking-wide leading-tight line-clamp-2">
                                            {prod.nombre}
                                        </h3>
                                        {prod.producto_sugerido && (
                                            <Star size={12} className="text-orange-400 fill-orange-400 shrink-0" />
                                        )}
                                    </div>
                                    {prod.descripcion && (
                                        <p className="text-slate-500 text-[10px] line-clamp-2 leading-relaxed uppercase tracking-wider font-medium">
                                            {prod.descripcion}
                                        </p>
                                    )}
                                    <div className="pt-1">
                                        <span className="text-white font-black text-base tracking-tight">
                                            $ {new Intl.NumberFormat("es-AR").format(prod.precio)}
                                        </span>
                                    </div>
                                </div>

                                {/* Image */}
                                <div className="relative shrink-0 w-[92px] h-[92px] rounded-[1.25rem] overflow-hidden bg-slate-800 shadow-inner">
                                    <img
                                        src={prod.imagen_url || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=300&h=300&fit=crop"}
                                        alt={prod.nombre}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    {/* Subtle Overlay on hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />

                                    {/* + button overlaid at bottom right */}
                                    <div
                                        className="absolute bottom-1 right-1 w-6 h-6 rounded-lg flex items-center justify-center shadow-lg transform translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300"
                                        style={{ backgroundColor: 'var(--color-primario, #f97316)' }}
                                    >
                                        <Plus size={14} className="text-white" strokeWidth={3} />
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
