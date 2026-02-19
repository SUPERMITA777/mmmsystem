"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PublicHeader from "@/components/public-menu/PublicHeader";
import PublicCategoryNav from "@/components/public-menu/PublicCategoryNav";
import PublicProductList from "@/components/public-menu/PublicProductList";

export default function PublicMenuPage() {
  const [sucursal, setSucursal] = useState<any>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState("");

  useEffect(() => {
    fetchMenuData();
  }, []);

  async function fetchMenuData() {
    try {
      setLoading(true);

      // 1. Fetch Sucursal
      const { data: sucData } = await supabase
        .from("sucursales")
        .select("*")
        .eq("activo", true)
        .limit(1)
        .single();

      setSucursal(sucData);

      // 2. Fetch Categorias with Products
      const { data: catsData } = await supabase
        .from("categorias")
        .select(`
          id,
          nombre,
          productos (
            id,
            nombre,
            descripcion,
            precio,
            imagen_url,
            producto_sugerido
          )
        `)
        .eq("activo", true)
        .order("orden", { ascending: true });

      if (catsData) {
        // Filter out categories without products
        const filteredCats = catsData.filter((cat: any) => cat.productos && cat.productos.length > 0);
        setCategorias(filteredCats);
        if (filteredCats.length > 0) {
          setActiveCategoryId(filteredCats[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching menu data:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleCategoryClick = (id: string) => {
    setActiveCategoryId(id);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; // Sticky nav height
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium tracking-widest uppercase text-xs">Cargando Menú...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-orange-500/30">
      {/* Premium Public Header */}
      <PublicHeader sucursal={sucursal} isOpen={true} />

      {/* Sticky Category Navigation */}
      <PublicCategoryNav
        categorias={categorias}
        activeCategoryId={activeCategoryId}
        onCategoryClick={handleCategoryClick}
      />

      {/* Main Product List */}
      <PublicProductList categorias={categorias} />

      {/* Float Cart Button Placeholder (Next step) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
        <button className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-4 rounded-2xl shadow-2xl shadow-orange-600/30 flex items-center justify-between px-6 transition-all active:scale-95 group">
          <span className="bg-white/20 px-2 py-1 rounded-lg text-xs">0</span>
          <span className="tracking-widest uppercase">Ver mi pedido</span>
          <span className="text-lg">$0.00</span>
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-400 to-orange-600 rounded-2xl blur opacity-0 group-hover:opacity-30 transition-opacity" />
        </button>
      </div>
    </main>
  );
}
