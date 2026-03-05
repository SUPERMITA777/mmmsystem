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
import { Download, Upload, DollarSign, Plus, Megaphone } from "lucide-react";
import { useTenant } from "@/context/TenantContext";

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
        setCategorias(data);
        if (data.length > 0) {
          if (!categoriaSeleccionada) setCategoriaSeleccionada(data[0].id);
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
      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("categoria_id", categoriaId)
        .order("orden");

      if (data) {
        setProductosCompletos(data);
        const productosFormateados: ProductoListType[] = data.map(p => ({
          id: p.id,
          nombre: p.nombre,
          activo: p.activo,
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
          grupo_id: gid
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
            grupo_id: gid
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

  const productoActual = productosCompletos.find((p) => p.id === productoSeleccionado) || null;

  async function handleDuplicateProducto(id: string) {
    try {
      setLoading(true);
      const { data: original } = await supabase.from("productos").select("*").eq("id", id).single();
      if (!original) return;
      const { id: _, created_at, updated_at, ...prodData } = original;
      const { data: existing } = await supabase.from("productos").select("orden").eq("categoria_id", prodData.categoria_id).order("orden", { ascending: false }).limit(1);
      const maxOrden = existing?.[0]?.orden || 0;
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
          <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 text-sm transition-colors">
            <Download size={15} />
            Exportar menú
          </button>
          <button
            onClick={() => setIsFlyerModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-purple-600 hover:text-purple-900 text-sm transition-colors font-semibold"
          >
            <Megaphone size={15} />
            FLYER
          </button>
          <CartaGeneratorButton sucursalId={sucursalId} />
          <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 text-sm transition-colors">
            <Upload size={15} />
            Importar menú
          </button>
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
    </div>
  );
}
