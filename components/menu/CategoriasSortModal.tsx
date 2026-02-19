"use client";

import React, { useState } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Categoria {
    id: string;
    nombre: string;
    orden: number;
}

interface SortableItemProps {
    id: string;
    nombre: string;
    index: number;
}

function SortableItem({ id, nombre, index }: SortableItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : "auto",
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-3 p-4 bg-white border-b border-slate-100 last:border-0 ${isDragging ? "shadow-2xl ring-2 ring-purple-500/20 z-10" : ""
                } transition-shadow group`}
        >
            <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-slate-100 rounded text-slate-400 group-hover:text-slate-600 transition-colors"
            >
                <GripVertical size={20} />
            </div>
            <span className="text-slate-500 font-mono text-sm w-4">{index + 1}.</span>
            <span className="flex-1 font-medium text-slate-800 uppercase tracking-wide">
                {nombre}
            </span>
        </div>
    );
}

interface CategoriasSortModalProps {
    isOpen: boolean;
    onClose: () => void;
    categorias: Categoria[];
    onSaved: () => void;
}

export default function CategoriasSortModal({
    isOpen,
    onClose,
    categorias: initialCategorias,
    onSaved,
}: CategoriasSortModalProps) {
    const [items, setItems] = useState(initialCategorias);
    const [isSaving, setIsSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (!isOpen) return null;

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    async function handleSave() {
        setIsSaving(true);
        try {
            const updates = items.map((item, index) => ({
                id: item.id,
                nombre: item.nombre,
                orden: index + 1,
            }));

            const { error } = await supabase
                .from("categorias")
                .upsert(updates, { onConflict: "id" });

            if (error) throw error;

            onSaved();
            onClose();
        } catch (error) {
            console.error("Error saving categories order:", error);
            alert("Hubo un error al guardar el orden.");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Ordenar Categorías</h2>
                        <p className="text-sm text-slate-500 mt-1">Arrastras las categorías para cambiar su orden.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={items} strategy={verticalListSortingStrategy}>
                            <div className="flex flex-col">
                                {items.map((item, index) => (
                                    <SortableItem
                                        key={item.id}
                                        id={item.id}
                                        nombre={item.nombre}
                                        index={index}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-6 py-2.5 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-8 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg ${isSaving
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-slate-950 hover:bg-slate-800 shadow-slate-950/20 active:scale-95"
                            }`}
                    >
                        {isSaving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
