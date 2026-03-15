"use client";

import { Copy, Trash2 } from "lucide-react";

export type Producto = {
  id: string;
  nombre: string;
  activo: boolean;
  visible_en_menu: boolean;
  producto_oculto: boolean;
  orden?: number;
};

export function ProductosList({
  productos,
  productoSeleccionado,
  onSelectProducto,
  onCreateProducto,
  onOpenSort,
  onDuplicateProducto,
  onDeleteProducto,
}: {
  productos: Producto[];
  productoSeleccionado: string | null;
  onSelectProducto: (id: string) => void;
  onCreateProducto: () => void;
  onOpenSort: () => void;
  onDuplicateProducto?: (id: string) => void;
  onDeleteProducto?: (id: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white border-y border-r border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Productos</h3>
        <div className="flex gap-3 items-center">
          <button
            onClick={onOpenSort}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
          >
            Ordenar
          </button>
          <button
            onClick={onCreateProducto}
            className="px-3 py-1 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 transition-colors font-medium"
          >
            Crear
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {productos.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No hay productos en esta categoría
          </div>
        ) : (
          productos.map((producto) => (
            <div
              key={producto.id}
              onClick={() => onSelectProducto(producto.id)}
              className={`group w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${productoSeleccionado === producto.id
                ? "bg-gray-900 text-white"
                : "text-gray-800 hover:bg-gray-50"
                }`}
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  (producto.activo && producto.visible_en_menu && !producto.producto_oculto) 
                    ? "bg-green-500" 
                    : "bg-red-500"
                }`}
              />
              <span className="flex-1 text-sm font-medium truncate">{producto.nombre}</span>

              {/* Action Icons - Visible on Hover */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {onDuplicateProducto && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDuplicateProducto(producto.id); }}
                    className={`p-1 rounded transition-colors ${productoSeleccionado === producto.id
                      ? "text-gray-300 hover:text-white hover:bg-white/10"
                      : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                    title="Duplicar"
                  >
                    <Copy size={14} />
                  </button>
                )}
                {onDeleteProducto && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteProducto(producto.id); }}
                    className={`p-1 rounded transition-colors ${productoSeleccionado === producto.id
                      ? "text-red-300 hover:text-red-200 hover:bg-white/10"
                      : "text-red-400 hover:text-red-600 hover:bg-red-50"
                      }`}
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

