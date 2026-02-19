"use client";

import { useState } from "react";
import { Plus, GripVertical, Copy, Edit2, Trash2 } from "lucide-react";

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
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Categorías</h3>
        <div className="flex gap-2">
          <button
            onClick={onOpenSort}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            Ordenar
          </button>
          <button
            onClick={onCreateCategoria}
            className="px-3 py-1 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800"
          >
            Crear
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {categorias.map((categoria) => (
          <div
            key={categoria.id}
            className={`group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0 ${categoriaSeleccionada === categoria.id
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "text-slate-900"
              }`}
            onClick={() => onSelectCategoria(categoria.id)}
          >
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${categoria.activo ? "bg-green-500" : "bg-red-500"
                }`}
            />
            <span className="flex-1 text-sm font-medium truncate">{categoria.nombre}</span>

            {/* Action Icons - Visible on Hover */}
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicateCategoria(categoria.id); }}
                className="p-1 px-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                title="Duplicar"
              >
                <Copy size={15} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEditCategoria(categoria); }}
                className="p-1 px-1.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition-colors"
                title="Editar"
              >
                <Edit2 size={15} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteCategoria(categoria.id); }}
                className="p-1 px-1.5 hover:bg-white/10 rounded text-red-400 hover:text-red-500 transition-colors"
                title="Eliminar"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
