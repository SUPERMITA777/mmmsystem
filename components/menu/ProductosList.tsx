"use client";

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
    <div className="h-full flex flex-col bg-white border-y border-r border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Productos</h3>
        <div className="flex gap-3 items-center">
          <button className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors">
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
            <button
              key={producto.id}
              onClick={() => onSelectProducto(producto.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${productoSeleccionado === producto.id
                  ? "bg-gray-900 text-white"
                  : "text-gray-800 hover:bg-gray-50"
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
