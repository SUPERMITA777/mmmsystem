"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CartProvider } from "@/context/CartContext";
import PublicHeader from "@/components/public-menu/PublicHeader";
import PublicCategoryNav from "@/components/public-menu/PublicCategoryNav";
import PublicProductList from "@/components/public-menu/PublicProductList";
import ProductDetailModal from "@/components/public-menu/ProductDetailModal";
import CartModal from "@/components/public-menu/CartModal";
import FloatingCartButton from "@/components/public-menu/FloatingCartButton";

type Producto = {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  imagen_url?: string;
  producto_sugerido?: boolean;
  categoria_nombre?: string;
};

export default function PublicMenuPage() {
  return (
    <CartProvider>
      <PublicMenuContent />
    </CartProvider>
  );
}

function PublicMenuContent() {
  const [sucursal, setSucursal] = useState<any>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    fetchMenuData();
  }, []);

  async function fetchMenuData() {
    try {
      setLoading(true);

      const { data: sucData } = await supabase
        .from("sucursales")
        .select("*")
        .eq("activo", true)
        .limit(1)
        .single();

      setSucursal(sucData);

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
            producto_sugerido,
            visible_en_menu,
            producto_oculto,
            activo
          )
        `)
        .eq("activo", true)
        .order("orden", { ascending: true });

      if (catsData) {
        const filteredCats = catsData
          .map((cat: any) => ({
            ...cat,
            productos: (cat.productos || []).filter((p: any) =>
              p.activo && p.visible_en_menu && !p.producto_oculto
            ),
          }))
          .filter((cat: any) => cat.productos.length > 0);

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

  function handleCategoryClick(id: string) {
    setActiveCategoryId(id);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium tracking-widest uppercase text-xs">Cargando Menú...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0d0d0d] text-slate-50 selection:bg-orange-500/30">
      {/* Header */}
      <PublicHeader sucursal={sucursal} isOpen={true} />

      {/* Category Nav */}
      <PublicCategoryNav
        categorias={categorias}
        activeCategoryId={activeCategoryId}
        onCategoryClick={handleCategoryClick}
      />

      {/* Product List */}
      <PublicProductList
        categorias={categorias}
        onProductClick={setSelectedProduct}
      />

      {/* Floating Cart Button */}
      <FloatingCartButton onClick={() => setCartOpen(true)} />

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          producto={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* Cart Modal */}
      {cartOpen && (
        <CartModal onClose={() => setCartOpen(false)} />
      )}
    </main>
  );
}
