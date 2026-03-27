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
  const [flyerOpen, setFlyerOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [storeColors, setStoreColors] = useState({ primario: "#f97316", secundario: "#1a1a2e" });
  const [descuentos, setDescuentos] = useState<any[]>([]);
  const [webConfig, setWebConfig] = useState({
    primario: "#f97316",
    secundario: "#1a1a2e",
    bannerUrl: "",
    descripcion: "",
    textoDelivery: "DELIVERY",
    textoTakeaway: "RETIRAR",
    mensajeCerrado: "",
  });

  useEffect(() => {
    if (sucursalId) {
      fetchMenuData();
      fetchIsOpen();
      // Abrir flyer automáticamente al cargar la página
      setFlyerOpen(true);
    }
  }, [sucursalId]);

  // Auto-abrir carrito si viene de la página promo con ?openCart=1
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openCart") === "1") {
      setCartOpen(true);
    }
  }, []);

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
        .eq("sucursal_id", sucursalId)
        .limit(1)
        .maybeSingle();

      if (config?.cerrado_temporalmente) {
        setIsOpen(false);
        setStatusMessage("Cerrado Temporalmente");
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
        .eq("sucursal_id", sucursalId)
        .eq("dia", sysDow)
        .maybeSingle();

      if (!horario || horario.cerrado) {
        setIsOpen(false);
        setStatusMessage("Cerrado por hoy");
        return;
      }

      function inRange(start: string, end: string, current: string) {
        if (!start || !end) return false;
        return current >= start && current <= end;
      }

      const open1 = inRange(horario.apertura1, horario.cierre1, currentTime);
      const open2 = inRange(horario.apertura2, horario.cierre2, currentTime);

      if (open1 || open2) {
        setIsOpen(true);
        setStatusMessage("Abierto ahora");
      } else {
        setIsOpen(false);
        // Determine if there is a shift coming up exactly today
        if (horario.apertura1 && currentTime < horario.apertura1) {
          setStatusMessage(`Abre a las ${horario.apertura1}`);
        } else if (horario.apertura2 && currentTime < horario.apertura2) {
          setStatusMessage(`Abre a las ${horario.apertura2}`);
        } else {
          setStatusMessage("Cerrado por hoy");
        }
      }
    } catch (err) {
      console.error("Error fetching horarios:", err);
      setIsOpen(false);
      setStatusMessage("");
    }
  }

  async function fetchMenuData() {
    if (!sucursalId || !sucursal) return;
    try {
      setLoading(true);

      // Fetch store config
      if (sucursal?.id) {
        const { data: cfg } = await supabase
          .from("config_sucursal")
          .select("color_primario, color_secundario, banner_url, texto_delivery, texto_takeaway, mensaje_cerrado")
          .eq("sucursal_id", sucursal.id)
          .maybeSingle();
        if (cfg) {
          setWebConfig({
            primario: (cfg as any).color_primario || "#f97316",
            secundario: (cfg as any).color_secundario || "#1a1a2e",
            bannerUrl: (cfg as any).banner_url || "",
            descripcion: (sucursal as any)?.descripcion || "",
            textoDelivery: (cfg as any).texto_delivery || "DELIVERY",
            textoTakeaway: (cfg as any).texto_takeaway || "RETIRAR",
            mensajeCerrado: (cfg as any).mensaje_cerrado || "",
          });
        }
      }

      const { data: catsData, error: catsError } = await supabase
        .from("categorias")
        .select(`
          id,
          nombre,
          activo,
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
        .eq("sucursal_id", sucursalId)
        .order("orden", { ascending: true })
        .order("orden", { ascending: true, referencedTable: "productos" });

      if (catsError) {
        console.error("Error fetching menu data (Check if sucursal_id exists in all related tables):", catsError);
      }

      if (catsData) {
        // 1. Deduplicate Categories by ID
        const uniqueCats = catsData.reduce((acc: any[], current: any) => {
          if (!acc.some(cat => cat.id === current.id)) {
            acc.push(current);
          }
          return acc;
        }, []);

        const filteredCats = uniqueCats
          .map((cat: any) => {
            // 2. Deduplicate Products by ID within Category
            const uniqueProds = (cat.productos || []).reduce((acc: any[], current: any) => {
              if (!acc.some(p => p.id === current.id)) {
                acc.push(current);
              }
              return acc;
            }, []);

            return {
              ...cat,
              productos: uniqueProds
                .filter((p: any) =>
                  p.activo && p.visible_en_menu && !p.producto_oculto
                )
                .sort((a: any, b: any) => (a.orden ?? 999) - (b.orden ?? 999)),
            };
          })
          .filter((cat: any) => cat.activo && cat.productos.length > 0);

        setCategorias(filteredCats);
        if (filteredCats.length > 0) {
          setActiveCategoryId(filteredCats[0].id);
        }
      }

      // Fetch active discounts
      const { data: descs } = await supabase
        .from("descuentos")
        .select("*")
        .eq("sucursal_id", sucursalId)
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
        "--color-primario": webConfig.primario,
        "--color-secundario": webConfig.secundario,
        backgroundColor: "#050505",
        backgroundImage: `radial-gradient(circle at top, ${webConfig.secundario} 0%, #050505 100%)`,
      } as React.CSSProperties}
    >
      {/* Header — hidden when product detail modal is open */}
      {!selectedProduct && <PublicHeader
        sucursal={sucursal}
        isOpen={isOpen}
        statusMessage={statusMessage || (webConfig.mensajeCerrado && !isOpen ? webConfig.mensajeCerrado : undefined)}
        textoDelivery={webConfig.textoDelivery}
        textoTakeaway={webConfig.textoTakeaway}
        bannerUrl={webConfig.bannerUrl}
        descripcion={webConfig.descripcion}
      />}

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
          onOpenCart={openCart}
        />
      )}
    </main>
  );
}
