"use client";

import { Copy, Edit2, Trash2 } from "lucide-react";

type Categoria = {
  id: string;
  nombre: string;
  activo: boolean;
  orden: number;
};

export function CategoriasList({
  categorias,
  categoriaSeleccionada,
  onSelectCategoria,
  onCreateCategoria,
  onOpenSort,
  onEditCategoria,
  onDuplicateCategoria,
  onDeleteCategoria,
}: {
  categorias: Categoria[];
  categoriaSeleccionada: string | null;
  onSelectCategoria: (id: string) => void;
  onCreateCategoria: () => void;
  onOpenSort: () => void;
  onEditCategoria: (cat: Categoria) => void;
  onDuplicateCategoria: (id: string) => void;
  onDeleteCategoria: (id: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white rounded-l-xl border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm">Categorías</h3>
        <div className="flex gap-3 items-center">
          <button
            onClick={onOpenSort}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
          >
            Ordenar
          </button>
          <button
            onClick={onCreateCategoria}
            className="px-3 py-1 bg-gray-900 text-white text-xs rounded-md hover:bg-gray-800 transition-colors font-medium"
          >
            Crear
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {categorias.map((categoria) => (
          <div
            key={categoria.id}
            className={`group w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${categoriaSeleccionada === categoria.id
                ? "bg-gray-900 text-white"
                : "text-gray-800 hover:bg-gray-50"
              }`}
            onClick={() => onSelectCategoria(categoria.id)}
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${categoria.activo ? "bg-green-500" : "bg-red-500"
                }`}
            />
            <span className="flex-1 text-sm font-medium truncate">
              {categoria.nombre}
            </span>

            {/* Action Icons - Visible on Hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicateCategoria(categoria.id); }}
                className={`p-1 rounded transition-colors ${categoriaSeleccionada === categoria.id
                    ? "text-gray-300 hover:text-white hover:bg-white/10"
                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                title="Duplicar"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEditCategoria(categoria); }}
                className={`p-1 rounded transition-colors ${categoriaSeleccionada === categoria.id
                    ? "text-gray-300 hover:text-white hover:bg-white/10"
                    : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                title="Editar"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteCategoria(categoria.id); }}
                className={`p-1 rounded transition-colors ${categoriaSeleccionada === categoria.id
                    ? "text-red-300 hover:text-red-200 hover:bg-white/10"
                    : "text-red-400 hover:text-red-600 hover:bg-red-50"
                  }`}
                title="Eliminar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
