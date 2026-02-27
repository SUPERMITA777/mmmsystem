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
        <nav className="sticky top-0 z-40 bg-[#0d0d0d]/80 backdrop-blur-xl border-b border-white/5">
            <div
                ref={containerRef}
                className="max-w-5xl mx-auto px-4 flex gap-6 overflow-x-auto no-scrollbar scroll-smooth"
            >
                <button className="py-4 shrink-0 text-slate-500 hover:text-white transition-colors">
                    <div className="bg-white/5 p-2 rounded-xl">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </div>
                </button>

                {categorias.map((cat) => (
                    <button
                        key={cat.id}
                        data-id={cat.id}
                        onClick={() => onCategoryClick(cat.id)}
                        className={`py-5 shrink-0 text-[11px] font-black tracking-[0.2em] uppercase transition-all border-b-2 whitespace-nowrap ${activeCategoryId === cat.id
                            ? "text-white"
                            : "border-transparent text-slate-500 hover:text-slate-300"
                            }`}
                        style={activeCategoryId === cat.id ? { borderBottomColor: 'var(--color-primario)' } : undefined}
                    >
                        {cat.nombre}
                    </button>
                ))}
            </div>
        </nav>
    );
}
