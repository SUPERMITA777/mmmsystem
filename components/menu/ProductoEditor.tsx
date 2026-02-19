"use client";

import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

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
  onSave,
  onCancel,
}: {
  producto: Producto | null;
  onSave: (producto: Producto) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Producto | null>(producto);

  useEffect(() => {
    setFormData(producto);
  }, [producto]);

  if (!producto || !formData) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1e1e32] text-gray-500">
        <div className="text-center">
          <p className="text-sm">Selecciona un producto para editarlo</p>
        </div>
      </div>
    );
  }

  function handleChange(field: keyof Producto, value: any) {
    setFormData({ ...formData!, [field]: value });
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e32] overflow-y-auto">
      <div className="p-6 border-b border-[#2a2a40]">
        <h3 className="text-lg font-semibold text-white">Editar producto</h3>
      </div>

      <div className="flex-1 p-6 space-y-5">
        {/* Categoría */}
        <fieldset className="border border-gray-600 rounded-lg px-3 pt-1 pb-2">
          <legend className="text-xs text-gray-400 px-1">Categoría</legend>
          <select
            value={formData.categoria_id || ""}
            onChange={(e) => handleChange("categoria_id", e.target.value)}
            className="w-full bg-transparent text-white text-sm outline-none py-1"
          >
            <option value={formData.categoria_id}>{formData.categoria_id}</option>
          </select>
        </fieldset>

        {/* Nombre */}
        <fieldset className="border border-gray-600 rounded-lg px-3 pt-1 pb-2">
          <legend className="text-xs text-gray-400 px-1">Nombre</legend>
          <input
            type="text"
            value={formData.nombre}
            onChange={(e) => handleChange("nombre", e.target.value)}
            className="w-full bg-transparent text-white text-sm outline-none py-1"
          />
        </fieldset>

        {/* Nombre interno */}
        <fieldset className="border border-gray-600 rounded-lg px-3 pt-1 pb-2">
          <legend className="text-xs text-gray-400 px-1">Nombre interno</legend>
          <input
            type="text"
            value={formData.nombre_interno || ""}
            onChange={(e) => handleChange("nombre_interno", e.target.value)}
            className="w-full bg-transparent text-white text-sm outline-none py-1"
            placeholder="Opcional"
          />
        </fieldset>

        {/* Descripción */}
        <fieldset className="border border-gray-600 rounded-lg px-3 pt-1 pb-2">
          <legend className="text-xs text-gray-400 px-1">Descripción</legend>
          <textarea
            value={formData.descripcion || ""}
            onChange={(e) => handleChange("descripcion", e.target.value)}
            maxLength={255}
            rows={3}
            className="w-full bg-transparent text-white text-sm outline-none py-1 resize-y"
            placeholder="Describe el producto..."
          />
          <p className="text-xs text-gray-500 text-right">
            {(formData.descripcion?.length || 0)} / 255
          </p>
        </fieldset>

        {/* Precio */}
        <fieldset className="border border-gray-600 rounded-lg px-3 pt-1 pb-2">
          <legend className="text-xs text-gray-400 px-1">Precio venta</legend>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">$</span>
            <input
              type="text"
              value={formData.precio.toLocaleString("es-AR")}
              onChange={(e) => handleChange("precio", Number(e.target.value.replace(/\D/g, "")))}
              className="flex-1 bg-transparent text-white text-sm outline-none py-1"
              placeholder="0"
            />
            <button className="text-purple-400 hover:text-purple-300 text-lg font-bold transition-colors">
              +
            </button>
          </div>
        </fieldset>

        {/* Tiempo de cocción */}
        <fieldset className="border border-gray-600 rounded-lg px-3 pt-1 pb-2">
          <legend className="text-xs text-gray-400 px-1">Tiempo de cocción</legend>
          <input
            type="number"
            value={formData.tiempo_coccion || ""}
            onChange={(e) => handleChange("tiempo_coccion", Number(e.target.value))}
            className="w-full bg-transparent text-white text-sm outline-none py-1"
            placeholder="Minutos"
          />
        </fieldset>

        {/* Checkboxes */}
        <div className="space-y-3 pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.visible_en_menu}
              onChange={(e) => handleChange("visible_en_menu", e.target.checked)}
              className="w-4 h-4 accent-purple-600 rounded"
            />
            <span className="text-sm text-gray-300">Visible en menú.</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.producto_oculto}
              onChange={(e) => handleChange("producto_oculto", e.target.checked)}
              className="w-4 h-4 accent-purple-600 rounded"
            />
            <span className="text-sm text-gray-300">Producto oculto.</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.producto_sugerido}
              onChange={(e) => handleChange("producto_sugerido", e.target.checked)}
              className="w-4 h-4 accent-purple-600 rounded"
            />
            <span className="text-sm text-gray-300">Producto sugerido.</span>
          </label>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="p-6 border-t border-[#2a2a40] flex items-center justify-between">
        <button
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-purple-400 border border-purple-500 rounded-lg hover:bg-purple-500/10 transition-colors text-sm">
            <ExternalLink size={16} />
            Ver producto
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
