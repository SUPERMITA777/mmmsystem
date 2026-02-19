"use client";

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";

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

  if (!producto || !formData) {
    return (
      <div className="h-full flex items-center justify-center bg-white text-slate-500">
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
    <div className="h-full flex flex-col bg-white overflow-y-auto">
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900">Editar producto</h3>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Imagen del producto */}
        {formData.imagen_url && (
          <div className="relative">
            <img
              src={formData.imagen_url}
              alt={formData.nombre}
              className="w-full h-48 object-cover rounded-lg"
            />
            <div className="mt-2 flex gap-2 text-sm text-slate-600">
              <button className="hover:text-purple-600">Cambiar imagen</button>
              <span>•</span>
              <span>Tamaño máximo: 10 MB.</span>
              <button className="hover:text-red-600">Eliminar imagen</button>
            </div>
          </div>
        )}

        {/* Categoría */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Categoría
          </label>
          <input
            type="text"
            value={formData.categoria_id || ""}
            readOnly
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
          />
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre
          </label>
          <input
            type="text"
            value={formData.nombre}
            onChange={(e) => handleChange("nombre", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Nombre interno */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Nombre interno
          </label>
          <input
            type="text"
            value={formData.nombre_interno || ""}
            onChange={(e) => handleChange("nombre_interno", e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Opcional"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Descripción
          </label>
          <textarea
            value={formData.descripcion || ""}
            onChange={(e) => handleChange("descripcion", e.target.value)}
            maxLength={255}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Describe el producto..."
          />
          <p className="text-xs text-slate-500 mt-1 text-right">
            {(formData.descripcion?.length || 0)}/255
          </p>
        </div>

        {/* Precio */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Precio venta
          </label>
          <div className="flex items-center gap-2">
            <span className="text-slate-600">$</span>
            <input
              type="number"
              value={formData.precio}
              onChange={(e) => handleChange("precio", Number(e.target.value))}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0"
            />
            <button className="px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              +
            </button>
          </div>
        </div>

        {/* Tiempo de cocción */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tiempo de cocción
          </label>
          <input
            type="number"
            value={formData.tiempo_coccion || ""}
            onChange={(e) => handleChange("tiempo_coccion", Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Minutos"
          />
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.visible_en_menu}
              onChange={(e) => handleChange("visible_en_menu", e.target.checked)}
              className="w-5 h-5 text-purple-600 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Visible en menú.</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.producto_oculto}
              onChange={(e) => handleChange("producto_oculto", e.target.checked)}
              className="w-5 h-5 text-purple-600 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Producto oculto.</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.producto_sugerido}
              onChange={(e) => handleChange("producto_sugerido", e.target.checked)}
              className="w-5 h-5 text-purple-600 rounded border-slate-300"
            />
            <span className="text-sm text-slate-700">Producto sugerido.</span>
          </label>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="p-6 border-t border-slate-200 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Cancelar
        </button>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 text-purple-600 border border-purple-600 rounded-lg hover:bg-purple-50">
            <ExternalLink size={16} />
            Ver producto
          </button>
          <button
            onClick={() => onSave(formData)}
            className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
