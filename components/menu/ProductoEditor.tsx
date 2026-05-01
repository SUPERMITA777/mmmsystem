"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ExternalLink, ChefHat, TrendingUp, ChevronDown, Check } from "lucide-react";
import ImageCropperModal from "@/components/ui/ImageCropperModal";
import { useTenant } from "@/context/TenantContext";
import { db } from "@/lib/db";

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
  precio_costo?: number;
  imagen_url?: string;
  categoria_id: string;
  activo: boolean;
  tiempo_coccion?: number;
  visible_en_menu: boolean;
  producto_oculto: boolean;
  producto_sugerido: boolean;
  grupos_adicionales?: string[];
  ficha_tecnica_id?: string | null;
  impresora?: string;
};

type GrupoAdicional = {
  id: string;
  titulo: string;
};

type FichaTecnica = {
  id: string;
  nombre: string;
  costo_total: number;
};

export function ProductoEditor({
  producto,
  categorias,
  onSave,
  onCancel,
  isCreating = false,
  onCreate,
  defaultCategoriaId,
}: {
  producto: Producto | null;
  categorias?: Categoria[];
  onSave: (producto: Producto) => void;
  onCancel: () => void;
  isCreating?: boolean;
  onCreate?: (producto: Omit<Producto, 'id'>) => void;
  defaultCategoriaId?: string;
}) {
  const { sucursalId } = useTenant();
  const emptyProduct: Producto = {
    id: '',
    nombre: '',
    nombre_interno: '',
    descripcion: '',
    precio: 0,
    imagen_url: '',
    categoria_id: defaultCategoriaId || '',
    activo: true,
    visible_en_menu: true,
    producto_oculto: false,
    producto_sugerido: false,
    impresora: 'COCINA1',
  };

  const [formData, setFormData] = useState<Producto | null>(isCreating ? emptyProduct : producto);
  const [todosLosGrupos, setTodosLosGrupos] = useState<GrupoAdicional[]>([]);
  const [gruposAsignados, setGruposAsignados] = useState<string[]>([]);
  const [fichasTecnicas, setFichasTecnicas] = useState<FichaTecnica[]>([]);
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (isCreating) {
      setFormData({ ...emptyProduct, categoria_id: defaultCategoriaId || '' });
      setGruposAsignados([]);
    } else {
      setFormData(producto);
      if (producto) {
        loadGruposYAsignaciones(producto.id);
      }
    }
    
    if (sucursalId) {
      loadFichasTecnicas();
    }
  }, [producto, isCreating, defaultCategoriaId, sucursalId]);

  async function loadFichasTecnicas() {
    if (!sucursalId) return;
    try {
      console.log("[ProductoEditor] Cargando fichas para sucursal:", sucursalId);
      // Intentar primero local (Local-First)
      const local = await db.fichas_tecnicas.where("sucursal_id").equals(sucursalId).toArray();
      if (local && local.length > 0) {
        console.log("[ProductoEditor] Fichas cargadas desde Dexie:", local.length);
        setFichasTecnicas(local as FichaTecnica[]);
        return;
      }

      // Fallback a Supabase si no hay nada local
      console.log("[ProductoEditor] Dexie vacío, consultando Supabase...");
      const { data, error } = await supabase
        .from("fichas_tecnicas")
        .select("id, nombre, costo_total")
        .eq("sucursal_id", sucursalId)
        .order("nombre");
      
      if (error) throw error;
      console.log("[ProductoEditor] Fichas cargadas desde Supabase:", data?.length || 0);
      setFichasTecnicas((data as FichaTecnica[]) || []);
    } catch (err) {
      console.error("[ProductoEditor] Error loading recipes:", err);
    }
  }

  async function loadAllGrupos() {
    if (!sucursalId) return;
    try {
      const local = await db.grupos_adicionales.where("sucursal_id").equals(sucursalId).toArray();
      setTodosLosGrupos(local || []);
    } catch {
      const { data } = await supabase
        .from("grupos_adicionales")
        .select("id, titulo")
        .eq("sucursal_id", sucursalId);
      setTodosLosGrupos(data || []);
    }
  }

  async function loadGruposYAsignaciones(productoId: string) {
    if (!sucursalId) return;
    await loadAllGrupos();
    
    try {
      const { data: asignaciones } = await supabase
        .from("producto_grupos_adicionales")
        .select("grupo_id")
        .eq("producto_id", productoId);
      setGruposAsignados(asignaciones?.map((a: any) => a.grupo_id) || []);
    } catch (err) {
      console.error("Error loading assignments:", err);
    }
  }

  function toggleGrupo(grupoId: string) {
    if (gruposAsignados.includes(grupoId)) {
      setGruposAsignados(gruposAsignados.filter(id => id !== grupoId));
    } else {
      setGruposAsignados([...gruposAsignados, grupoId]);
    }
  }

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDropdownOpen && !(e.target as Element).closest(".adicionales-dropdown")) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  if (!isCreating && (!producto || !formData)) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-r-xl border-y border-r border-gray-200 text-gray-400">
        <p className="text-sm">Selecciona un producto para editarlo</p>
      </div>
    );
  }

  if (!formData) return null;

  function handleChange(field: keyof Producto, value: any) {
    setFormData({ ...formData!, [field]: value });
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-r-xl border-y border-r border-gray-200">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-base font-semibold text-gray-900">{isCreating ? 'Nuevo producto' : 'Editar producto'}</h3>
        </div>

        <div className="px-6 pb-4 space-y-4">
          {/* Categoría */}
          <fieldset className={`border rounded-lg px-3 pt-0.5 pb-2 transition-colors ${
            (!formData.categoria_id || formData.categoria_id === "sin-categoria") 
              ? "border-orange-500 bg-orange-50" 
              : "border-gray-300 focus-within:border-purple-500"
          }`}>
            <legend className={`text-xs px-1 ${
              (!formData.categoria_id || formData.categoria_id === "sin-categoria") ? "text-orange-600 font-medium" : "text-gray-500"
            }`}>
              {(!formData.categoria_id || formData.categoria_id === "sin-categoria") 
                ? "⚠ Categoría requerida" 
                : "Categoría"}
            </legend>
            <select
              value={formData.categoria_id || ""}
              onChange={(e) => handleChange("categoria_id", e.target.value)}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5 cursor-pointer"
            >
              <option value="" disabled>Seleccionar categoría...</option>
              {categorias?.map(cat => (
                <option 
                  key={cat.id} 
                  value={cat.id}
                  disabled={cat.id === "sin-categoria"}
                  className={cat.id === "sin-categoria" ? "text-orange-500" : ""}
                >
                  {cat.id === "sin-categoria" ? "⚠ Sin Categoría asignada" : cat.nombre}
                </option>
              ))}
            </select>
          </fieldset>

          {/* Nombre */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Nombre</legend>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => handleChange("nombre", e.target.value)}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
            />
          </fieldset>

          {/* Nombre interno */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Nombre interno</legend>
            <input
              type="text"
              value={formData.nombre_interno || ""}
              onChange={(e) => handleChange("nombre_interno", e.target.value)}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
              placeholder="Nombre Interno"
            />
          </fieldset>

          {/* Impresora (Salón/Comandas) */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Impresora (Comandas)</legend>
            <select
              value={formData.impresora || "COCINA1"}
              onChange={(e) => handleChange("impresora", e.target.value)}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5 cursor-pointer"
            >
              <option value="COCINA1">COCINA 1</option>
              <option value="COCINA2">COCINA 2</option>
              <option value="ENTRADA">ENTRADA</option>
              <option value="BARRA">BARRA</option>
              <option value="FACTURACION">FACTURACIÓN</option>
            </select>
          </fieldset>

          {/* Descripción */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Descripción</legend>
            <textarea
              value={formData.descripcion || ""}
              onChange={(e) => handleChange("descripcion", e.target.value)}
              maxLength={255}
              rows={4}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5 resize-none"
              placeholder="Describe el producto..."
            />
            <p className="text-xs text-gray-400 text-right -mb-0.5">
              {(formData.descripcion?.length || 0)} / 255
            </p>
          </fieldset>

          {/* Precio venta */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Precio venta</legend>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="text"
                value={formData.precio != null ? formData.precio.toLocaleString("es-AR") : ""}
                onChange={(e) => handleChange("precio", Number(e.target.value.replace(/\D/g, "")))}
                className="flex-1 bg-transparent text-gray-900 text-sm outline-none py-0.5"
                placeholder="0"
              />
              <button
                type="button"
                className="text-purple-600 hover:text-purple-700 text-xl font-light leading-none transition-colors"
                title="Agregar variante de precio"
              >
                +
              </button>
            </div>
          </fieldset>

          {/* Precio costo */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Precio costo</legend>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="text"
                value={formData.precio_costo != null ? formData.precio_costo.toLocaleString("es-AR") : ""}
                onChange={(e) => handleChange("precio_costo", Number(e.target.value.replace(/\D/g, "")))}
                className="flex-1 bg-transparent text-gray-900 text-sm outline-none py-0.5"
                placeholder="0"
              />
            </div>
          </fieldset>

          {/* Ficha Técnica / Receta */}
          <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
            <div className="flex items-center gap-2 mb-2">
              <ChefHat size={14} className="text-purple-500" />
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Ficha Técnica / Receta</span>
            </div>
            <select
              value={formData.ficha_tecnica_id || ""}
              onChange={e => {
                handleChange("ficha_tecnica_id", e.target.value || null);
              }}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-purple-400 transition-colors"
            >
              <option value="">Sin receta asignada</option>
              {fichasTecnicas.map(f => (
                <option key={f.id} value={f.id}>{f.nombre}</option>
              ))}
            </select>
            {formData.ficha_tecnica_id && (() => {
              const ficha = fichasTecnicas.find(f => f.id === formData.ficha_tecnica_id);
              if (!ficha) return null;
              const costo = ficha.costo_total;
              const precio = formData.precio || 0;
              const utilidad = precio - costo;
              const margen = costo > 0 ? (utilidad / costo) * 100 : 0;
              const margenColor = margen > 100 ? "bg-green-100 text-green-700" : margen > 50 ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-600";
              return (
                <div className="mt-2 flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2">
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-gray-400 font-medium">Costo receta </span>
                      <span className="font-black text-gray-800">$ {new Intl.NumberFormat("es-AR").format(costo)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-medium">Utilidad </span>
                      <span className={`font-black ${utilidad >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {utilidad >= 0 ? "+" : ""}$ {new Intl.NumberFormat("es-AR").format(utilidad)}
                      </span>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${margenColor}`}>
                    <TrendingUp size={10} /> {Math.round(margen)}%
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Visibilidad y Stock */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Visibilidad y Estado</h4>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.visible_en_menu}
                  onChange={(e) => handleChange("visible_en_menu", e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700 font-medium">Visible en menú</span>
                  <span className="text-[11px] text-gray-400">El producto aparece en la página de venta pública</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.producto_oculto}
                  onChange={(e) => handleChange("producto_oculto", e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700 font-medium">Producto oculto</span>
                  <span className="text-[11px] text-gray-400">Ocultar completamente (incluso del panel admin si se filtra)</span>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.producto_sugerido}
                  onChange={(e) => handleChange("producto_sugerido", e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-sm text-gray-700 font-medium">Producto sugerido</span>
              </label>
            </div>

            {/* Stock simple */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Control de Stock</h4>
              <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2">
                <legend className="text-xs text-gray-500 px-1">Stock disponible</legend>
                <input
                  type="number"
                  className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
                  placeholder="Dejar vacío para no limitar"
                />
              </fieldset>
              <p className="text-[11px] text-gray-400 mt-1">Si está vacío, el stock es ilimitado.</p>
            </div>
          </div>

          {/* Adicionales */}
          <div className="border-t border-gray-100 pt-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Adicionales / Modificadores</h4>
            {todosLosGrupos.length === 0 ? (
              <p className="text-xs text-gray-400">No hay grupos de adicionales creados.</p>
            ) : (
              <div className="relative adicionales-dropdown">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 bg-white border rounded-xl text-sm transition-all shadow-sm hover:border-purple-300 ${isDropdownOpen ? 'border-purple-500 ring-2 ring-purple-100' : 'border-gray-200'}`}
                >
                  <span className={gruposAsignados.length > 0 ? "text-gray-900 font-medium" : "text-gray-400"}>
                    {gruposAsignados.length === 0 
                      ? "Seleccionar adicionales..." 
                      : `${gruposAsignados.length} ${gruposAsignados.length === 1 ? 'grupo asignado' : 'grupos asignados'}`}
                  </span>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-purple-500' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                      {todosLosGrupos.map(g => {
                        const isSelected = gruposAsignados.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => toggleGrupo(g.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                              isSelected 
                                ? 'bg-purple-50 text-purple-700' 
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'bg-purple-600 border-purple-600' 
                                : 'bg-white border-gray-300'
                            }`}>
                              {isSelected && <Check size={14} className="text-white" />}
                            </div>
                            <span className={`text-sm font-medium ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                              {g.titulo}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Imagen de producto - Movido al final */}
          <div className="border-t border-gray-100 pt-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Imagen del producto</h4>
            <div className="space-y-4">
              {formData.imagen_url ? (
                <div className="relative group">
                  <img
                    src={formData.imagen_url}
                    alt={formData.nombre}
                    className="w-full h-48 object-cover rounded-xl border border-gray-200 bg-gray-50"
                  />
                  <div className="mt-3 flex items-center gap-4 text-xs">
                    <button
                      type="button"
                      onClick={() => document.getElementById('product-image-upload')?.click()}
                      className="text-purple-600 font-medium hover:text-purple-700 transition-colors"
                    >
                      Cambiar imagen
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleChange("imagen_url", "")}
                      className="text-red-500 font-medium hover:text-red-600 transition-colors"
                    >
                      Eliminar imagen
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => document.getElementById('product-image-upload')?.click()}
                  className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-purple-300 hover:bg-purple-50 transition-all text-gray-500 group"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-white transition-colors">
                    <ExternalLink size={20} className="text-gray-400 group-hover:text-purple-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">Subir imagen</p>
                    <p className="text-[11px] text-gray-400">PNG, JPG hasta 10MB</p>
                  </div>
                </button>
              )}

              <input
                id="product-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setCropperSrc(reader.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky action buttons */}
      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white rounded-br-xl">
        <button
          onClick={onCancel}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
        >
          Cancelar
        </button>
        <div className="flex gap-3">
          {!isCreating && (
            <button className="flex items-center gap-2 px-4 py-2 text-purple-600 border border-purple-500 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium">
              <ExternalLink size={14} />
              Ver producto
            </button>
          )}
          <button
            onClick={() => {
              if (isCreating && onCreate) {
                const { id, ...newProduct } = formData;
                onCreate({ ...newProduct, grupos_adicionales: gruposAsignados });
              } else {
                onSave({ ...formData, grupos_adicionales: gruposAsignados });
              }
            }}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            {isCreating ? 'Guardar' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Image Cropper */}
      <ImageCropperModal
        isOpen={!!cropperSrc}
        imageSrc={cropperSrc || ''}
        aspectRatio={1}
        onCropComplete={async (croppedBlob) => {
          try {
            const fileName = `${Math.random().toString(36).substring(2)}.jpg`;
            const filePath = `products/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('images')
              .upload(filePath, croppedBlob, { contentType: 'image/jpeg' });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('images')
              .getPublicUrl(filePath);

            handleChange('imagen_url', publicUrl);
            setCropperSrc(null);
          } catch (error: any) {
            alert('Error subiendo la imagen: ' + error.message);
          }
        }}
        onClose={() => setCropperSrc(null)}
        title="Recortar imagen del producto"
      />
    </div>
  );
}
