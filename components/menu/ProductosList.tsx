"use client";

import { Plus } from "lucide-react";

export type Producto = {
  id: string;
  nombre: string;
  activo: boolean;
  orden?: number;
};

export function ProductosList({
  productos,
  productoSeleccionado,
  onSelectProducto,
  onCreateProducto,
}: {
  productos: Producto[];
  productoSeleccionado: string | null;
  onSelectProducto: (id: string) => void;
  onCreateProducto: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Productos</h3>
        <div className="flex gap-2">
          <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
            Ordenar
          </button>
          <button
            onClick={onCreateProducto}
            className="px-3 py-1 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800"
          >
            Crear
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {productos.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No hay productos en esta categoría
          </div>
        ) : (
          productos.map((producto) => (
            <button
              key={producto.id}
              onClick={() => onSelectProducto(producto.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                productoSeleccionado === producto.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-900"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  producto.activo ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="flex-1 text-sm font-medium">{producto.nombre}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
