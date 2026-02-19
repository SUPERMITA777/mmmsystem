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
  const [productos, setProductos] = useState<Producto[]>([]);
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
      setProductos([]);
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
        const productosFormateados: ProductoListType[] = data.map(p => ({
          id: p.id,
          nombre: p.nombre,
          activo: p.activo,
          orden: p.orden,
        }));
        setProductos(productosFormateados as any);
        if (data.length > 0 && !productoSeleccionado) {
          setProductoSeleccionado(data[0].id);
        }
      }
    } catch (error) {
      console.error("Error cargando productos:", error);
    }
  }

  function handleSaveProducto(producto: Producto) {
    // TODO: Implementar guardado
    console.log("Guardar producto:", producto);
    alert("Producto guardado correctamente");
  }

  async function handleDuplicateCategoria(id: string) {
    try {
      setLoading(true);
      // 1. Get original category
      const { data: originalCat } = await supabase.from("categorias").select("*").eq("id", id).single();
      if (!originalCat) return;

      // 2. Destructure to remove fields that should be auto-generated
      const { id: _, created_at, updated_at, ...categoryData } = originalCat;

      // 3. Insert new category
      const { data: newCat, error: catError } = await supabase
        .from("categorias")
        .insert([{
          ...categoryData,
          nombre: `${originalCat.nombre} (copia)`
        }])
        .select()
        .single();

      if (catError) throw catError;

      // 4. Get original products
      const { data: products } = await supabase.from("productos").select("*").eq("categoria_id", id);

      if (products && products.length > 0) {
        // 5. Insert duplicated products
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

  const productoActual = productos.find((p) => p.id === productoSeleccionado) || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Header con acciones */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setTipoMenu("delivery")}
              className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors ${tipoMenu === "delivery"
                ? "bg-purple-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
                }`}
            >
              Delivery
            </button>
            <button
              onClick={() => setTipoMenu("takeaway")}
              className={`px-4 py-2 font-medium text-sm rounded-lg transition-colors ${tipoMenu === "takeaway"
                ? "bg-purple-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
                }`}
            >
              Take Away
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">
              <Download size={16} />
              Exportar menú
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">
              <Upload size={16} />
              Importar menú
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">
              <DollarSign size={16} />
              Precios
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm">
              <Plus size={16} />
              Adicionales
            </button>
          </div>
        </div>
      </div>

      {/* Contenido principal - tres columnas */}
      <div className="flex-1 flex overflow-hidden">
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
            productos={productos}
            productoSeleccionado={productoSeleccionado}
            onSelectProducto={setProductoSeleccionado}
            onCreateProducto={() => alert("Crear producto - Próximamente")}
          />
        </div>

        {/* Columna 3: Editor */}
        <div className="flex-1">
          <ProductoEditor
            producto={productoActual}
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

