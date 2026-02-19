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
    <div className="h-full flex flex-col bg-[#1e1e32] border-r border-[#2a2a40]">
      <div className="p-4 border-b border-[#2a2a40] flex items-center justify-between">
        <h3 className="font-semibold text-white text-sm">Categorías</h3>
        <div className="flex gap-3 items-center">
          <button
            onClick={onOpenSort}
            className="text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors"
          >
            Ordenar
          </button>
          <button
            onClick={onCreateCategoria}
            className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
          >
            Crear
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {categorias.map((categoria) => (
          <div
            key={categoria.id}
            className={`group w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer border-b border-[#2a2a40]/50 last:border-0 ${categoriaSeleccionada === categoria.id
              ? "bg-purple-600/20 text-white border-l-2 border-l-purple-500"
              : "text-gray-300 hover:bg-white/5 border-l-2 border-l-transparent"
              }`}
            onClick={() => onSelectCategoria(categoria.id)}
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${categoria.activo ? "bg-green-500" : "bg-red-500"
                }`}
            />
            <span className="flex-1 text-sm font-medium truncate">{categoria.nombre}</span>

            {/* Action Icons - Visible on Hover */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicateCategoria(categoria.id); }}
                className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-gray-200 transition-colors"
                title="Duplicar"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEditCategoria(categoria); }}
                className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-gray-200 transition-colors"
                title="Editar"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteCategoria(categoria.id); }}
                className="p-1 hover:bg-white/10 rounded text-red-400/70 hover:text-red-400 transition-colors"
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
