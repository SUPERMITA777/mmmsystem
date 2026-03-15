"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CategoriasList } from "@/components/menu/CategoriasList";
import { ProductosList, type Producto as ProductoListType } from "@/components/menu/ProductosList";
import { ProductoEditor } from "@/components/menu/ProductoEditor";
import CategoriasSortModal from "@/components/menu/CategoriasSortModal";
import ProductosSortModal from "@/components/menu/ProductosSortModal";
import CategoriaEditorModal from "@/components/menu/CategoriaEditorModal";
import AdicionalesManagerModal from "@/components/menu/AdicionalesManagerModal";
import FlyerManagerModal from "@/components/admin/FlyerManagerModal";
import CartaGeneratorButton from "@/components/admin/CartaGeneratorButton";
import MenuExportButton from "@/components/menu/MenuExportButton";
import { Upload, DollarSign, Megaphone } from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import ImportarMenuModal from "@/components/menu/ImportarMenuModal";


type Categoria = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

type Producto = {
  id: string;
  nombre: string;
  nombre_interno?: string;
  descripcion?: string;
  precio: number;
  imagen_url?: string;
  categoria_id: string;
  activo: boolean;
  tiempo_coccion?: number;
  visible_en_menu: boolean;
  producto_oculto: boolean;
  producto_sugerido: boolean;
};

export default function MenuPage() {
  const [tipoMenu, setTipoMenu] = useState<"delivery" | "takeaway">("delivery");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productosCompletos, setProductosCompletos] = useState<Producto[]>([]);
  const [productosLista, setProductosLista] = useState<ProductoListType[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [productoSeleccionado, setProductoSeleccionado] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [isProductosSortOpen, setIsProductosSortOpen] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAdicionalesModalOpen, setIsAdicionalesModalOpen] = useState(false);
  const [isFlyerModalOpen, setIsFlyerModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const { sucursalId, loading: tenantLoading } = useTenant();

  useEffect(() => {
    if (sucursalId) loadCategorias();
  }, [sucursalId]);

  useEffect(() => {
    if (categoriaSeleccionada) {
      loadProductos(categoriaSeleccionada);
    } else {
      setProductosCompletos([]);
      setProductosLista([]);
      setProductoSeleccionado(null);
    }
  }, [categoriaSeleccionada]);

  async function loadCategorias() {
    if (!sucursalId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .eq("sucursal_id", sucursalId)
        .eq("activo", true)
        .order("orden");

      if (data) {
        // Verificar huérfanos
        const { count } = await supabase
          .from("productos")
          .select("id", { count: "exact", head: true })
          .is("categoria_id", null)
          .eq("sucursal_id", sucursalId);

        let finalCategorias = data;
        if (count && count > 0) {
          finalCategorias = [
            ...data,
            { id: "sin-categoria", nombre: "Sin Categoría (Huérfanos)", activo: true, orden: 9999 }
          ];
        }

        setCategorias(finalCategorias);
        if (finalCategorias.length > 0) {
          if (!categoriaSeleccionada) setCategoriaSeleccionada(finalCategorias[0].id);
        }
      }
    } catch (error) {
      console.error("Error cargando categorías:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProductos(categoriaId: string) {
    try {
      let query = supabase.from("productos").select("*").order("orden");
      if (categoriaId === "sin-categoria") {
        query = query.is("categoria_id", null).eq("sucursal_id", sucursalId!);
      } else {
        query = query.eq("categoria_id", categoriaId);
      }

      const { data, error } = await query;

      if (data) {
        setProductosCompletos(data);
        const productosFormateados: ProductoListType[] = data.map(p => ({
          id: p.id,
          nombre: p.nombre,
          activo: p.activo,
          visible_en_menu: p.visible_en_menu,
          producto_oculto: p.producto_oculto,
          orden: p.orden,
        }));
        setProductosLista(productosFormateados);
        if (data.length > 0 && !productoSeleccionado) {
          setProductoSeleccionado(data[0].id);
        }
      }
    } catch (error) {
      console.error("Error cargando productos:", error);
    }
  }

  async function handleCreateProducto(producto: Omit<Producto, 'id'> & { grupos_adicionales?: string[] }) {
    try {
      setLoading(true);
      const { grupos_adicionales, ...pData } = producto;

      if (!pData.categoria_id || pData.categoria_id === "sin-categoria") {
        alert("Por favor, selecciona una categoría válida antes de crear el producto.");
        setLoading(false);
        return;
      }

      // Get max orden for this category
      const { data: existing } = await supabase
        .from("productos")
        .select("orden")
        .eq("categoria_id", pData.categoria_id)
        .order("orden", { ascending: false })
        .limit(1);

      const maxOrden = existing?.[0]?.orden || 0;

      const { data: newProd, error: insertError } = await supabase
        .from("productos")
        .insert([{ ...pData, orden: maxOrden + 1 }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Link adicionales if any
      if (grupos_adicionales && grupos_adicionales.length > 0 && newProd) {
        const asignaciones = grupos_adicionales.map(gid => ({
          producto_id: newProd.id,
          grupo_id: gid,
          sucursal_id: sucursalId
        }));
        await supabase.from("producto_grupos_adicionales").insert(asignaciones);
      }

      alert("Producto creado correctamente");
      setIsCreatingProduct(false);
      if (categoriaSeleccionada) loadProductos(categoriaSeleccionada);
      if (newProd) setProductoSeleccionado(newProd.id);
    } catch (error) {
      console.error("Error al crear:", error);
      alert("Error al crear el producto");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProducto(producto: Producto & { grupos_adicionales?: string[] }) {
    try {
      setLoading(true);
      const { grupos_adicionales, ...pData } = producto;

      if (!pData.categoria_id || pData.categoria_id === "sin-categoria") {
        alert("Por favor, selecciona una categoría válida antes de guardar.");
        setLoading(false);
        return;
      }

      // 1. Actualizar tabla productos
      const { error: pError } = await supabase
        .from("productos")
        .update(pData)
        .eq("id", pData.id);

      if (pError) throw pError;

      // 2. Actualizar asociaciones de adicionales
      if (grupos_adicionales) {
        // Eliminar existentes
        await supabase.from("producto_grupos_adicionales").delete().eq("producto_id", pData.id);

        // Insertar nuevos
        if (grupos_adicionales.length > 0) {
          const newAsignaciones = grupos_adicionales.map(gid => ({
            producto_id: pData.id,
            grupo_id: gid,
            sucursal_id: sucursalId
          }));
          await supabase.from("producto_grupos_adicionales").insert(newAsignaciones);
        }
      }

      alert("Producto actualizado correctamente");
      if (categoriaSeleccionada) loadProductos(categoriaSeleccionada);
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar los cambios");
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicateCategoria(id: string) {
    try {
      setLoading(true);
      const { data: originalCat } = await supabase.from("categorias").select("*").eq("id", id).single();
      if (!originalCat) return;

      const { id: _, created_at, updated_at, ...categoryData } = originalCat;

      const { data: newCat, error: catError } = await supabase
        .from("categorias")
        .insert([{
          ...categoryData,
          nombre: `${originalCat.nombre} (copia)`
        }])
        .select()
        .single();

      if (catError) throw catError;

      const { data: products } = await supabase.from("productos").select("*").eq("categoria_id", id);

      if (products && products.length > 0) {
        const duplicatedProducts = products.map(p => {
          const { id: __, created_at: ___, updated_at: ____, ...productData } = p;
          return {
            ...productData,
            categoria_id: newCat.id
          };
        });
        const { error: prodError } = await supabase.from("productos").insert(duplicatedProducts);
        if (prodError) throw prodError;
      }

      await loadCategorias();
      alert("Categoría duplicada con éxito");
    } catch (error) {
      console.error("Error duplicating category:", error);
      alert("Error al duplicar la categoría");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCategoria(id: string) {
    if (!confirm("¿Estás seguro de que querés eliminar esta categoría y todos sus productos?")) return;

    try {
      setLoading(true);
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;

      await loadCategorias();
      if (categoriaSeleccionada === id) {
        setCategoriaSeleccionada(null);
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Error al eliminar la categoría");
    } finally {
      setLoading(false);
    }
  }

  function handleEditCategoria(cat: Categoria) {
    setEditingCategoria(cat);
    setIsEditModalOpen(true);
  }

  function handleCreateCategoria() {
    setEditingCategoria(null);
    setIsEditModalOpen(true);
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function handleGenerateCartaCategoria(categoriaId: string) {
    try {
      // 1. Fetch logo & sucursal name
      const { data: suc } = await supabase.from("sucursales").select("nombre, logo_url").eq("id", sucursalId).single();

      // 2. Fetch category name
      const cat = categorias.find(c => c.id === categoriaId);
      if (!cat) { alert("Categoría no encontrada."); return; }

      // 3. Fetch products for this category
      const { data: prods } = await supabase
        .from("productos")
        .select("id, nombre, precio, activo, visible_en_menu, producto_oculto, orden")
        .eq("categoria_id", categoriaId)
        .order("orden", { ascending: true });

      const filtered = (prods || [])
        .filter((p: any) => p.activo && p.visible_en_menu && !p.producto_oculto)
        .sort((a: any, b: any) => (a.orden ?? 999) - (b.orden ?? 999));

      if (filtered.length === 0) { alert("No hay productos habilitados en esta categoría."); return; }

      // 4. Fetch active discounts
      const { data: descs } = await supabase.from("descuentos").select("*").eq("activo", true);

      function getDiscount(prodId: string, catId: string) {
        if (!descs) return null;
        const d = descs.find((x: any) => x.aplicar_a === 'producto' && x.producto_id === prodId)
          || descs.find((x: any) => x.aplicar_a === 'categoria' && x.categoria_id === catId)
          || descs.find((x: any) => x.aplicar_a === 'general');
        if (!d) return null;
        if (d.tipo === 'porcentaje') return d.valor;
        return null;
      }

      // 5. Calc dimensions
      const W = 1080;
      const PADDING_X = 80;
      const NAME_LEFT = PADDING_X;
      const PRICE_RIGHT = W - PADDING_X;
      const ROW_H = 38;
      const CAT_TITLE_H = 55;
      const CAT_GAP = 20;
      const HEADER_H = 220;
      const FOOTER_H = 60;

      let totalContentH = HEADER_H + CAT_TITLE_H + CAT_GAP + (filtered.length * ROW_H) + CAT_GAP + FOOTER_H;
      const minH = Math.round(W * 16 / 9);
      const H = Math.max(minH, totalContentH);

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Background
      ctx.fillStyle = "#0d0d0d";
      ctx.fillRect(0, 0, W, H);

      // Decorative top gradient
      const grd = ctx.createLinearGradient(0, 0, 0, 300);
      grd.addColorStop(0, "rgba(249,115,22,0.12)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, 300);

      let y = 50;

      // 6. Draw logo
      if (suc?.logo_url) {
        try {
          const logo = await loadImage(suc.logo_url);
          const logoH = 100;
          const logoW = (logo.width / logo.height) * logoH;
          ctx.drawImage(logo, (W - logoW) / 2, y, logoW, logoH);
          y += logoH + 20;
        } catch {
          y += 10;
        }
      }

      // Store name
      if (suc?.nombre) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 32px 'Arial', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(suc.nombre.toUpperCase(), W / 2, y);
        y += 15;
      }

      // Divider
      y += 15;
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING_X, y);
      ctx.lineTo(W - PADDING_X, y);
      ctx.stroke();
      y += 25;

      const fmt = (n: number) => new Intl.NumberFormat("es-AR").format(n);

      // 7. Category title
      ctx.fillStyle = "#f97316";
      ctx.font = "bold 28px 'Arial', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(cat.nombre.toUpperCase(), W / 2, y);
      y += 8;

      const tw = ctx.measureText(cat.nombre.toUpperCase()).width;
      ctx.strokeStyle = "rgba(249,115,22,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo((W - tw) / 2, y);
      ctx.lineTo((W + tw) / 2, y);
      ctx.stroke();
      y += CAT_GAP;

      // 8. Products
      for (const prod of filtered) {
        const disc = getDiscount(prod.id, categoriaId);

        // Product name
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "500 20px 'Arial', sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(prod.nombre, NAME_LEFT, y);
        const nameW = ctx.measureText(prod.nombre).width;

        // Price
        let priceEndX: number;
        if (disc && disc > 0) {
          const discountedPrice = `$ ${fmt(Math.round(prod.precio * (1 - disc / 100)))}`;
          ctx.fillStyle = "#4ade80";
          ctx.font = "bold 20px 'Arial', sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(discountedPrice, PRICE_RIGHT, y);
          const dpW = ctx.measureText(discountedPrice).width;

          const originalPrice = `$ ${fmt(prod.precio)}`;
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.font = "500 16px 'Arial', sans-serif";
          ctx.textAlign = "right";
          const opX = PRICE_RIGHT - dpW - 12;
          ctx.fillText(originalPrice, opX, y);
          const opW = ctx.measureText(originalPrice).width;
          ctx.strokeStyle = "rgba(255,255,255,0.4)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(opX - opW, y - 5);
          ctx.lineTo(opX, y - 5);
          ctx.stroke();
          priceEndX = opX - opW - 10;
        } else {
          const priceText = `$ ${fmt(prod.precio)}`;
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 20px 'Arial', sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(priceText, PRICE_RIGHT, y);
          const prW = ctx.measureText(priceText).width;
          priceEndX = PRICE_RIGHT - prW - 10;
        }

        // Dotted line
        const dotsStartX = NAME_LEFT + nameW + 8;
        const dotsEndX = priceEndX;
        if (dotsEndX > dotsStartX + 10) {
          ctx.setLineDash([2, 5]);
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(dotsStartX, y - 5);
          ctx.lineTo(dotsEndX, y - 5);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        y += ROW_H;
      }

      // 9. Download
      const link = document.createElement("a");
      link.download = `carta-${cat.nombre}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Error generating carta de categoría:", err);
      alert("Error al generar la imagen de la categoría");
    }
  }

  const productoActual = productosCompletos.find((p) => p.id === productoSeleccionado) || null;

  async function handleDuplicateProducto(id: string) {
    try {
      setLoading(true);
      const { data: original } = await supabase.from("productos").select("*").eq("id", id).single();
      if (!original) return;
      const { id: _, created_at, updated_at, ...prodData } = original;
      const { data: existing } = await supabase.from("productos").select("orden").eq("categoria_id", prodData.categoria_id).order("orden", { ascending: false }).limit(1);
      const maxOrden = existing?.[0]?.orden || 0;
      
      if (!prodData.categoria_id) {
        alert("No podés duplicar un producto huérfano. Asígnale una categoría válida primero.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("productos").insert([{ ...prodData, nombre: `${original.nombre} (copia)`, orden: maxOrden + 1 }]);
      if (error) throw error;
      if (categoriaSeleccionada) loadProductos(categoriaSeleccionada);
      alert("Producto duplicado");
    } catch (error) {
      console.error(error);
      alert("Error al duplicar");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProducto(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      setLoading(true);
      await supabase.from("producto_grupos_adicionales").delete().eq("producto_id", id);
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
      if (productoSeleccionado === id) setProductoSeleccionado(null);
      if (categoriaSeleccionada) loadProductos(categoriaSeleccionada);
    } catch (error) {
      console.error(error);
      alert("Error al eliminar");
    } finally {
      setLoading(false);
    }
  }

  if (loading || tenantLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!sucursalId) return null;

  return (
    <div className="h-screen flex flex-col">
      {/* Header con tabs y acciones */}
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setTipoMenu("delivery")}
            className={`px-1 py-2 font-semibold text-sm transition-colors border-b-2 ${tipoMenu === "delivery"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
          >
            Delivery
          </button>
          <button
            onClick={() => setTipoMenu("takeaway")}
            className={`px-1 py-2 font-semibold text-sm transition-colors border-b-2 ${tipoMenu === "takeaway"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
          >
            Take Away
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFlyerModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:text-purple-900 text-sm transition-colors font-semibold"
          >
            <Megaphone size={15} />
            FLYER
          </button>
          <div className="flex items-center gap-2">
            <CartaGeneratorButton sucursalId={sucursalId} />
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <Upload size={16} />
              IMPORTAR MENU
            </button>
            <MenuExportButton sucursalId={sucursalId} />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 text-sm transition-colors">
            <DollarSign size={15} />
            Precios
          </button>
          <button
            onClick={() => setIsAdicionalesModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm transition-colors font-medium"
          >
            Adicionales
          </button>
        </div>
      </div>

      {/* Contenido principal - tres columnas en cards */}
      <div className="flex-1 flex overflow-hidden px-4 pb-4 gap-0">
        {/* Columna 1: Categorías */}
        <div className="w-64 flex-shrink-0">
          <CategoriasList
            categorias={categorias}
            categoriaSeleccionada={categoriaSeleccionada}
            onSelectCategoria={setCategoriaSeleccionada}
            onCreateCategoria={handleCreateCategoria}
            onOpenSort={() => setIsSortModalOpen(true)}
            onEditCategoria={handleEditCategoria}
            onDuplicateCategoria={handleDuplicateCategoria}
            onDeleteCategoria={handleDeleteCategoria}
            onGenerateCartaCategoria={handleGenerateCartaCategoria}
          />
        </div>

        {/* Columna 2: Productos */}
        <div className="w-64 flex-shrink-0">
          <ProductosList
            productos={productosLista}
            productoSeleccionado={productoSeleccionado}
            onSelectProducto={setProductoSeleccionado}
            onCreateProducto={() => {
              setIsCreatingProduct(true);
              setProductoSeleccionado(null);
            }}
            onOpenSort={() => setIsProductosSortOpen(true)}
            onDuplicateProducto={handleDuplicateProducto}
            onDeleteProducto={handleDeleteProducto}
          />
        </div>

        {/* Columna 3: Editor */}
        <div className="flex-1">
          <ProductoEditor
            producto={isCreatingProduct ? null : productoActual}
            categorias={categorias}
            onSave={handleSaveProducto}
            onCancel={() => {
              setProductoSeleccionado(null);
              setIsCreatingProduct(false);
            }}
            isCreating={isCreatingProduct}
            onCreate={handleCreateProducto}
            defaultCategoriaId={categoriaSeleccionada || undefined}
          />
        </div>
      </div>

      {/* Modal de ordenamiento */}
      <CategoriasSortModal
        isOpen={isSortModalOpen}
        onClose={() => setIsSortModalOpen(false)}
        categorias={categorias}
        onSaved={loadCategorias}
      />

      <ProductosSortModal
        isOpen={isProductosSortOpen}
        onClose={() => setIsProductosSortOpen(false)}
        productos={productosLista.map(p => ({ id: p.id, nombre: p.nombre, orden: p.orden || 0 }))}
        onSaved={() => { if (categoriaSeleccionada) loadProductos(categoriaSeleccionada); }}
      />

      <CategoriaEditorModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCategoria(null);
        }}
        categoria={editingCategoria}
        onSaved={loadCategorias}
        sucursalId={sucursalId}
      />

      <AdicionalesManagerModal
        isOpen={isAdicionalesModalOpen}
        onClose={() => setIsAdicionalesModalOpen(false)}
        sucursalId={sucursalId}
      />

      <FlyerManagerModal
        isOpen={isFlyerModalOpen}
        onClose={() => setIsFlyerModalOpen(false)}
        sucursalId={sucursalId}
      />

      <ImportarMenuModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        sucursalId={sucursalId}
        onSuccess={() => {
          loadCategorias();
          if (categoriaSeleccionada) loadProductos(categoriaSeleccionada);
        }}
      />
    </div>
  );
}
