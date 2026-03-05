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
import FlyerOverlay from "@/components/public-menu/FlyerOverlay";

type Producto = {
  id: string;
  nombre: string;
  descripcion?: string;
  precio: number;
  imagen_url?: string;
  producto_sugerido?: boolean;
  categoria_nombre?: string;
  categoria_id?: string;
};

import { TenantProvider, useTenant } from "@/context/TenantContext";

export default function PublicMenuPage({ params }: { params: { tenant: string } }) {
  return (
    <TenantProvider>
      <CartProvider>
        <PublicMenuContent />
      </CartProvider>
    </TenantProvider>
  );
}

function PublicMenuContent() {
  const { sucursalData: sucursal, sucursalId, loading: tenantLoading } = useTenant();
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Producto | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [flyerOpen, setFlyerOpen] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [storeColors, setStoreColors] = useState({ primario: "#f97316", secundario: "#1a1a2e" });
  const [descuentos, setDescuentos] = useState<any[]>([]);

  useEffect(() => {
    if (sucursalId) {
      fetchMenuData();
      fetchIsOpen();
    }
  }, [sucursalId]);

  // ========== Manejo del historial para botón Atrás de Android ==========
  useEffect(() => {
    function handlePopState() {
      const hash = window.location.hash;
      // Si el hash ya no tiene #producto ni #carrito → cerrar modales
      if (!hash.startsWith("#producto") && !hash.startsWith("#carrito")) {
        setSelectedProduct(null);
        setCartOpen(false);
      } else if (hash === "#carrito") {
        setSelectedProduct(null);
      } else if (hash.startsWith("#producto")) {
        setCartOpen(false);
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function openProduct(producto: Producto) {
    // Empujar estado al historial → Atrás cerrará el modal en vez de salir
    window.history.pushState({ modal: "producto", id: producto.id }, "", `#producto-${producto.id}`);
    setSelectedProduct(producto);
  }

  function closeProduct() {
    setSelectedProduct(null);
    // Si el hash actual es el del producto, volver atrás en el historial
    if (window.location.hash.startsWith("#producto")) {
      window.history.back();
    }
  }

  function openCart() {
    window.history.pushState({ modal: "carrito" }, "", "#carrito");
    setCartOpen(true);
  }

  function closeCart() {
    setCartOpen(false);
    if (window.location.hash === "#carrito") {
      window.history.back();
    }
  }


  async function fetchIsOpen() {
    try {
      // Check cerrado_temporalmente first
      const { data: config } = await supabase
        .from("config_sucursal")
        .select("cerrado_temporalmente")
        .limit(1)
        .maybeSingle();

      if (config?.cerrado_temporalmente) {
        setIsOpen(false);
        return;
      }

      // Get today's schedule (JS getDay: 0=Sun → system dia: 0=Lun)
      const now = new Date();
      const jsDow = now.getDay(); // 0=Sun,1=Mon...
      const sysDow = (jsDow + 6) % 7; // 0=Lun,1=Mar,...,6=Dom
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      const { data: horario } = await supabase
        .from("horarios_sucursal")
        .select("cerrado, apertura1, cierre1, apertura2, cierre2")
        .eq("dia", sysDow)
        .maybeSingle();

      if (!horario || horario.cerrado) {
        setIsOpen(false);
        return;
      }

      function inRange(start: string, end: string, current: string) {
        if (!start || !end) return false;
        return current >= start && current <= end;
      }

      const openNow =
        inRange(horario.apertura1, horario.cierre1, currentTime) ||
        inRange(horario.apertura2, horario.cierre2, currentTime);

      setIsOpen(openNow);
    } catch (err) {
      console.error("Error fetching horarios:", err);
      setIsOpen(false);
    }
  }

  async function fetchMenuData() {
    if (!sucursalId || !sucursal) return;
    try {
      setLoading(true);

      // Fetch store colors from config_sucursal
      if (sucursal?.id) {
        const { data: cfg } = await supabase
          .from("config_sucursal")
          .select("color_primario, color_secundario")
          .eq("sucursal_id", sucursal.id)
          .maybeSingle();
        if (cfg) {
          setStoreColors({
            primario: cfg.color_primario || "#f97316",
            secundario: cfg.color_secundario || "#1a1a2e",
          });
        }
      }

      const { data: catsData } = await supabase
        .from("categorias")
        .select(`
          id,
          nombre,
          imagen_url,
          descripcion,
          productos (
            id,
            nombre,
            descripcion,
            precio,
            imagen_url,
            producto_sugerido,
            visible_en_menu,
            producto_oculto,
            activo,
            orden
          )
        `)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("orden", { ascending: true, referencedTable: "productos" });

      if (catsData) {
        const filteredCats = catsData
          .map((cat: any) => ({
            ...cat,
            productos: (cat.productos || [])
              .filter((p: any) =>
                p.activo && p.visible_en_menu && !p.producto_oculto
              )
              .sort((a: any, b: any) => (a.orden ?? 999) - (b.orden ?? 999)),
          }))
          .filter((cat: any) => cat.productos.length > 0);

        setCategorias(filteredCats);
        if (filteredCats.length > 0) {
          setActiveCategoryId(filteredCats[0].id);
        }
      }

      // Fetch active discounts
      const { data: descs } = await supabase
        .from("descuentos")
        .select("*")
        .eq("activo", true);
      setDescuentos(descs || []);
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
    <main
      className="min-h-screen text-slate-50"
      style={{
        "--color-primario": storeColors.primario,
        "--color-secundario": storeColors.secundario,
        backgroundColor: "#050505",
        backgroundImage: `radial-gradient(circle at top, ${storeColors.secundario} 0%, #050505 100%)`,
      } as React.CSSProperties}
    >
      {/* Header — hidden when product detail modal is open */}
      {!selectedProduct && <PublicHeader sucursal={sucursal} isOpen={isOpen} />}

      {/* Category Nav — hidden when product detail modal is open */}
      {!selectedProduct && (
        <PublicCategoryNav
          categorias={categorias}
          activeCategoryId={activeCategoryId}
          onCategoryClick={handleCategoryClick}
        />
      )}

      {/* Product List */}
      <PublicProductList
        categorias={categorias}
        onProductClick={openProduct}
        descuentos={descuentos}
      />

      {/* Floating Cart Button — hidden when product detail modal is open */}
      {!selectedProduct && <FloatingCartButton onClick={openCart} />}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          producto={selectedProduct}
          onClose={closeProduct}
          descuentos={descuentos}
        />
      )}

      {/* Cart Modal */}
      {cartOpen && (
        <CartModal onClose={closeCart} isOpen={isOpen} />
      )}

      {/* Flyer Overlay */}
      {sucursal?.id && flyerOpen && (
        <FlyerOverlay
          sucursalId={sucursal.id}
          onClose={() => setFlyerOpen(false)}
          onOpenProduct={openProduct}
        />
      )}
    </main>
  );
}
