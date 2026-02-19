"use client";

import { Star } from "lucide-react";

interface Product {
    id: string;
    nombre: string;
    descripcion: string;
    precio: number;
    imagen_url?: string;
    producto_sugerido?: boolean;
}

interface CategoryWithProducts {
    id: string;
    nombre: string;
    productos: Product[];
}

interface PublicProductListProps {
    categorias: CategoryWithProducts[];
}

export default function PublicProductList({ categorias }: PublicProductListProps) {
    return (
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-12 pb-32">
            {categorias.map((cat) => (
                <section key={cat.id} id={cat.id} className="scroll-mt-24">
                    <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider mb-6 pb-2 border-b border-slate-800 inline-block">
                        {cat.nombre}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cat.productos.map((prod) => (
                            <div
                                key={prod.id}
                                className="group relative flex gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/50 hover:bg-slate-900/80 hover:border-slate-700 transition-all cursor-pointer overflow-hidden"
                            >
                                {/* Product Info */}
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-100 text-base md:text-lg leading-tight uppercase">
                                            {prod.nombre}
                                        </h3>
                                        {prod.producto_sugerido && (
                                            <Star size={14} className="text-orange-500 fill-orange-500 shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-slate-400 text-sm line-clamp-2 leading-relaxed">
                                        {prod.descripcion || "Sin descripción disponible."}
                                    </p>
                                    <div className="pt-1">
                                        <span className="text-lg font-black text-white">
                                            ${new Intl.NumberFormat("es-AR").format(prod.precio)}
                                        </span>
                                    </div>
                                </div>

                                {/* Product Image */}
                                <div className="relative shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden bg-slate-800">
                                    <img
                                        src={prod.imagen_url || "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop"}
                                        alt={prod.nombre}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 to-transparent" />
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
