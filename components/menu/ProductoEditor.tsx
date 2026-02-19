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
        <div className="text-center">
          <p className="text-sm">Selecciona un producto para editarlo</p>
        </div>
      </div>
    );
  }

  function handleChange(field: keyof Producto, value: any) {
    setFormData({ ...formData!, [field]: value });
  }

  // Find category name from categorias prop
  const categoriaNombre = categorias?.find(c => c.id === formData.categoria_id)?.nombre || "—";

  return (
    <div className="h-full flex flex-col bg-white rounded-r-xl border-y border-r border-gray-200 overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <h3 className="text-base font-semibold text-gray-900">Editar producto</h3>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 space-y-4">
        {/* Categoría */}
        <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2">
          <legend className="text-xs text-gray-500 px-1">Categoría</legend>
          <select
            value={formData.categoria_id || ""}
            onChange={(e) => handleChange("categoria_id", e.target.value)}
            className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
          >
            {categorias?.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.nombre}</option>
            ))}
          </select>
        </fieldset>

        {/* Nombre */}
        <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2">
          <legend className="text-xs text-gray-500 px-1">Nombre</legend>
          <input
            type="text"
            value={formData.nombre}
            onChange={(e) => handleChange("nombre", e.target.value)}
            className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
          />
        </fieldset>

        {/* Nombre interno */}
        <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2">
          <legend className="text-xs text-gray-500 px-1">Nombre interno</legend>
          <input
            type="text"
            value={formData.nombre_interno || ""}
            onChange={(e) => handleChange("nombre_interno", e.target.value)}
            className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5"
            placeholder="Nombre interno"
          />
        </fieldset>

        {/* Descripción */}
        <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2">
          <legend className="text-xs text-gray-500 px-1">Descripción</legend>
          <textarea
            value={formData.descripcion || ""}
            onChange={(e) => handleChange("descripcion", e.target.value)}
            maxLength={255}
            rows={3}
            className="w-full bg-transparent text-gray-900 text-sm outline-none py-0.5 resize-y"
            placeholder="Describe el producto..."
          />
          <p className="text-xs text-gray-400 text-right">
            {(formData.descripcion?.length || 0)} / 255
          </p>
        </fieldset>

        {/* Precio venta */}
        <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2">
          <legend className="text-xs text-gray-500 px-1">Precio venta</legend>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">$</span>
            <input
              type="text"
              value={formData.precio?.toLocaleString("es-AR") ?? "0"}
              onChange={(e) => handleChange("precio", Number(e.target.value.replace(/\D/g, "")))}
              className="flex-1 bg-transparent text-gray-900 text-sm outline-none py-0.5"
              placeholder="0"
            />
            <button className="text-purple-600 hover:text-purple-700 text-lg font-bold transition-colors">
              +
            </button>
          </div>
        </fieldset>

        {/* Precio costo */}
        <fieldset className="border border-gray-300 rounded-lg px-3 pt-0.5 pb-2">
          <legend className="text-xs text-gray-500 px-1">Precio costo</legend>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">$</span>
            <input
              type="text"
              value="0"
              className="flex-1 bg-transparent text-gray-900 text-sm outline-none py-0.5"
              placeholder="0"
              readOnly
            />
          </div>
        </fieldset>

        {/* Control de stock */}
        <div className="pt-2">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Control de stock del producto</h4>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.visible_en_menu}
                onChange={(e) => handleChange("visible_en_menu", e.target.checked)}
                className="w-4 h-4 accent-green-600 rounded"
              />
              <span className="text-sm text-gray-700">Stock</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!formData.producto_oculto}
                onChange={(e) => handleChange("producto_oculto", !e.target.checked)}
                className="w-4 h-4 accent-green-600 rounded"
              />
              <span className="text-sm text-gray-700">Restaurar</span>
            </label>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="px-6 py-4 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
        >
          Cancelar
        </button>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium">
            <ExternalLink size={15} />
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
