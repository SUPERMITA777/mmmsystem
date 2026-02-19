"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CategoriasList } from "@/components/menu/CategoriasList";
import { ProductosList, type Producto as ProductoListType } from "@/components/menu/ProductosList";
import { ProductoEditor } from "@/components/menu/ProductoEditor";
import CategoriasSortModal from "@/components/menu/CategoriasSortModal";
import CategoriaEditorModal from "@/components/menu/CategoriaEditorModal";
import { Download, Upload, DollarSign, Plus } from "lucide-react";

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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [sucursalId, setSucursalId] = useState<string>("");

  useEffect(() => {
    loadCategorias();
  }, []);

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
    try {
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .eq("activo", true)
        .order("orden");

      if (data) {
        setCategorias(data);
        if (data.length > 0) {
          if (!sucursalId) setSucursalId(data[0].sucursal_id);
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

  function handleSaveProducto(producto: Producto) {
    console.log("Guardar producto:", producto);
    alert("Producto guardado correctamente");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

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
          <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 text-sm transition-colors">
            <Upload size={15} />
            Importar menú
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 text-sm transition-colors">
            <DollarSign size={15} />
            Precios
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm transition-colors font-medium">
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
            onCreateProducto={() => alert("Crear producto - Próximamente")}
          />
        </div>

        {/* Columna 3: Editor */}
        <div className="flex-1">
          <ProductoEditor
            producto={productoActual}
            categorias={categorias}
            onSave={handleSaveProducto}
            onCancel={() => setProductoSeleccionado(null)}
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
    </div>
  );
}
