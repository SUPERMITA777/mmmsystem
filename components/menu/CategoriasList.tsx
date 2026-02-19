"use client";

import { useState } from "react";
import { Plus, GripVertical } from "lucide-react";

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
}: {
  categorias: Categoria[];
  categoriaSeleccionada: string | null;
  onSelectCategoria: (id: string) => void;
  onCreateCategoria: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Categorías</h3>
        <div className="flex gap-2">
          <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
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
          <button
            key={categoria.id}
            onClick={() => onSelectCategoria(categoria.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
              categoriaSeleccionada === categoria.id
                ? "bg-slate-900 text-white"
                : "text-slate-900"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                categoria.activo ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="flex-1 text-sm font-medium">{categoria.nombre}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
