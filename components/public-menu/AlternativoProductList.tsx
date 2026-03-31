"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getProductDiscount, Descuento } from "@/lib/discountUtils";

interface Product {
    id: string;
    nombre: string;
    descripcion?: string;
    precio: number;
    imagen_url?: string;
    producto_sugerido?: boolean;
    categoria_nombre?: string;
    categoria_id?: string;
}

interface CategoryWithProducts {
    id: string;
    nombre: string;
    imagen_url?: string;
    descripcion?: string;
    productos: Product[];
}

interface AlternativoProductListProps {
    categorias: CategoryWithProducts[];
    onProductClick: (producto: Product & { categoria_nombre: string }) => void;
    descuentos?: Descuento[];
}

export default function AlternativoProductList({ categorias, onProductClick, descuentos = [] }: AlternativoProductListProps) {
    // Accordion state - By default we expand the first category, or all of them. Let's expand just the first one.
    const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
        [categorias[0]?.id]: true
    });

    const toggleCategory = (id: string) => {
        setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="max-w-2xl mx-auto bg-[#f8f9fa] min-h-screen pb-32">
            {categorias.map((cat) => {
                const isExpanded = expandedCats[cat.id];

                return (
                    <div key={cat.id} className="mb-2">
                        {/* Category Header (Accordion toggle) */}
                        <button
                            onClick={() => toggleCategory(cat.id)}
                            className="w-full bg-[#f1f3f5] py-4 px-4 flex items-center justify-between transition-colors hover:bg-[#e9ecef]"
                        >
                            <span className="w-5" /> {/* spacer to center text */}
                            <h2 className="text-sm font-bold text-gray-800 tracking-wider uppercase">
                                {cat.nombre}
                            </h2>
                            {isExpanded ? (
                                <ChevronUp size={20} className="text-gray-400" />
                            ) : (
                                <ChevronDown size={20} className="text-gray-400" />
                            )}
                        </button>

                        {/* Product List */}
                        {isExpanded && (
                            <div className="bg-white">
                                {cat.productos.map((prod, index) => {
                                    const discount = getProductDiscount(prod.id, cat.id, descuentos);
                                    const hasPercentDiscount = discount && discount.porcentaje > 0;
                                    const precioConDescuento = discount ? discount.precioFinal(prod.precio) : prod.precio;
                                    const isLast = index === cat.productos.length - 1;

                                    return (
                                        <div
                                            key={prod.id}
                                            onClick={() => onProductClick({ ...prod, categoria_nombre: cat.nombre, categoria_id: cat.id })}
                                            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}
                                        >
                                            <div className="flex gap-4 max-w-full">
                                                {/* Details */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-base font-bold text-gray-900 leading-tight">
                                                        {prod.nombre}
                                                    </h3>
                                                    {prod.descripcion && (
                                                        <p className="text-sm text-gray-500 italic mt-1 leading-snug line-clamp-2">
                                                            {prod.descripcion}
                                                        </p>
                                                    )}
                                                    
                                                    <div className="mt-3 flex items-center gap-2">
                                                        {hasPercentDiscount ? (
                                                            <>
                                                                <span className="text-gray-400 text-sm line-through">
                                                                    $ {new Intl.NumberFormat("es-AR").format(prod.precio)}
                                                                </span>
                                                                <span className="text-green-600 font-bold text-base">
                                                                    $ {new Intl.NumberFormat("es-AR").format(precioConDescuento)}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-900 font-bold text-base">
                                                                $ {new Intl.NumberFormat("es-AR").format(prod.precio)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action / Image */}
                                                <div className="shrink-0 flex flex-col items-end justify-between">
                                                    {prod.imagen_url && (
                                                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shadow-sm mb-2">
                                                            <img
                                                                src={prod.imagen_url}
                                                                alt={prod.nombre}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    )}
                                                    <button
                                                        className="px-3 py-1.5 rounded-lg text-white text-xs font-bold uppercase tracking-wider shadow-sm mt-auto"
                                                        style={{ backgroundColor: 'var(--color-primario, #f97316)' }}
                                                    >
                                                        Pedir +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

