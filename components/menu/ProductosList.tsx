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
    <div className="h-full flex flex-col bg-[#1e1e32] border-r border-[#2a2a40]">
      <div className="p-4 border-b border-[#2a2a40] flex items-center justify-between">
        <h3 className="font-semibold text-white text-sm">Productos</h3>
        <div className="flex gap-3 items-center">
          <button className="text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors">
            Ordenar
          </button>
          <button
            onClick={onCreateProducto}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
          >
            Crear
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {productos.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No hay productos en esta categoría
          </div>
        ) : (
          productos.map((producto) => (
            <button
              key={producto.id}
              onClick={() => onSelectProducto(producto.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#2a2a40]/50 last:border-0 ${productoSeleccionado === producto.id
                  ? "bg-purple-600/20 text-white"
                  : "text-gray-300 hover:bg-white/5"
                }`}
            >
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${producto.activo ? "bg-green-500" : "bg-red-500"
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
