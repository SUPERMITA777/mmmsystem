"use client";

import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

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
};

export function ProductoEditor({
  producto,
  categorias,
  onSave,
  onCancel,
}: {
  producto: Producto | null;
  categorias?: Categoria[];
  onSave: (producto: Producto) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Producto | null>(producto);

  useEffect(() => {
    setFormData(producto);
  }, [producto]);

  if (!producto || !formData) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded-r-xl border-y border-r border-gray-200 text-gray-400">
        <p className="text-sm">Selecciona un producto para editarlo</p>
      </div>
    );
  }

  function handleChange(field: keyof Producto, value: any) {
    setFormData({ ...formData!, [field]: value });
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-r-xl border-y border-r border-gray-200">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-6 pt-5 pb-2">
          <h3 className="text-base font-semibold text-gray-900">Editar producto</h3>
        </div>

        {/* Imagen preview */}
        {formData.imagen_url && (
          <div className="px-6 pb-4">
            <img
              src={formData.imagen_url}
              alt={formData.nombre}
              className="w-full h-40 object-cover rounded-lg border border-gray-200"
            />
            <div className="mt-1.5 flex gap-3 text-xs text-gray-500">
              <button className="hover:text-purple-600 transition-colors">Cambiar imagen</button>
              <span>·</span>
              <span>Tamaño máximo: 10 MB.</span>
              <span>·</span>
              <button className="hover:text-red-500 transition-colors">Eliminar imagen</button>
            </div>
          </div>
        )}

        <div className="px-6 pb-4 space-y-4">
          {/* Categoría */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Categoría</legend>
            <select
              value={formData.categoria_id || ""}
              onChange={(e) => handleChange("categoria_id", e.target.value)}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5 cursor-pointer"
            >
              {categorias?.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
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

          {/* Control de stock */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Control de stock del producto</h4>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.visible_en_menu}
                  onChange={(e) => handleChange("visible_en_menu", e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-sm text-gray-700">Stock</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!formData.producto_oculto}
                  onChange={(e) => handleChange("producto_oculto", !e.target.checked)}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-sm text-gray-700">Restaurar</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={false}
                  readOnly
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-sm text-gray-700">Vender sin stock</span>
              </label>
            </div>

            {/* Stock simple */}
            <div className="mt-3">
              <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2">
                <legend className="text-xs text-gray-500 px-1">Stock simple (Sin receta)</legend>
                <input
                  type="number"
                  className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
                  placeholder="Dejar vacío para no limitar"
                />
              </fieldset>
            </div>
          </div>

          {/* Tiempo de cocción */}
          <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2 focus-within:border-purple-500 transition-colors">
            <legend className="text-xs text-gray-500 px-1">Tiempo de cocción</legend>
            <input
              type="number"
              value={formData.tiempo_coccion || ""}
              onChange={(e) => handleChange("tiempo_coccion", Number(e.target.value))}
              className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
              placeholder="Minutos de cocción"
            />
          </fieldset>

          {/* Visibilidad */}
          <div className="space-y-2.5 pb-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.visible_en_menu}
                onChange={(e) => handleChange("visible_en_menu", e.target.checked)}
                className="w-4 h-4 accent-purple-600 rounded"
              />
              <span className="text-sm text-gray-700">Visible en menú.</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.producto_oculto}
                onChange={(e) => handleChange("producto_oculto", e.target.checked)}
                className="w-4 h-4 accent-purple-600 rounded"
              />
              <span className="text-sm text-gray-700">Producto oculto.</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.producto_sugerido}
                onChange={(e) => handleChange("producto_sugerido", e.target.checked)}
                className="w-4 h-4 accent-purple-600 rounded"
              />
              <span className="text-sm text-gray-700">Producto sugerido.</span>
            </label>
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
          <button className="flex items-center gap-2 px-4 py-2 text-purple-600 border border-purple-500 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium">
            <ExternalLink size={14} />
            Ver producto
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
