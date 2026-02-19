"use client";

import { useRef, useEffect, useState } from "react";

interface Category {
    id: string;
    nombre: string;
}

interface PublicCategoryNavProps {
    categorias: Category[];
    activeCategoryId: string;
    onCategoryClick: (id: string) => void;
}

export default function PublicCategoryNav({
    categorias,
    activeCategoryId,
    onCategoryClick,
}: PublicCategoryNavProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Scroll active tab into view
    useEffect(() => {
        if (activeCategoryId && containerRef.current) {
            const activeTab = containerRef.current.querySelector(
                `[data-id="${activeCategoryId}"]`
            ) as HTMLElement;
            if (activeTab) {
                const container = containerRef.current;
                const scrollLeft =
                    activeTab.offsetLeft - container.offsetWidth / 2 + activeTab.offsetWidth / 2;
                container.scrollTo({ left: scrollLeft, behavior: "smooth" });
            }
        }
    }, [activeCategoryId]);

    return (
        <nav className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 shadow-2xl">
            <div
                ref={containerRef}
                className="max-w-5xl mx-auto px-4 flex gap-4 overflow-x-auto no-scrollbar scroll-smooth"
            >
                <button className="py-4 px-2 shrink-0 border-b-2 border-transparent text-slate-400 hover:text-white transition-colors">
                    <div className="bg-slate-800 p-2 rounded-lg">
                        {/* Menu Icon could go here */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </div>
                </button>

                {categorias.map((cat) => (
                    <button
                        key={cat.id}
                        data-id={cat.id}
                        onClick={() => onCategoryClick(cat.id)}
                        className={`py-5 px-3 shrink-0 text-sm font-black tracking-widest uppercase transition-all border-b-2 whitespace-nowrap ${activeCategoryId === cat.id
                                ? "border-orange-600 text-white"
                                : "border-transparent text-slate-500 hover:text-slate-300"
                            }`}
                    >
                        {cat.nombre}
                    </button>
                ))}
            </div>
        </nav>
    );
}
