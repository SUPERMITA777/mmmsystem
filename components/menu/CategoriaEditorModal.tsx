"use client";

import React, { useState, useEffect } from "react";
import { X, Upload, Info, Check, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Categoria {
    id: string;
    nombre: string;
    nombre_interno?: string;
    descripcion?: string;
    imagen_url?: string;
    activo: boolean;
    tags?: string[];
    modalidades?: string[];
}

interface CategoriaEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoria: Categoria | null;
    onSaved: () => void;
    sucursalId: string;
}

export default function CategoriaEditorModal({
    isOpen,
    onClose,
    categoria,
    onSaved,
    sucursalId,
}: CategoriaEditorModalProps) {
    const [formData, setFormData] = useState<Partial<Categoria>>({
        nombre: "",
        nombre_interno: "",
        descripcion: "",
        activo: true,
        imagen_url: "",
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (categoria) {
            setFormData({
                nombre: categoria.nombre || "",
                nombre_interno: categoria.nombre_interno || "",
                descripcion: categoria.descripcion || "",
                activo: categoria.activo ?? true,
                imagen_url: categoria.imagen_url || "",
            });
        } else {
            setFormData({
                nombre: "",
                nombre_interno: "",
                descripcion: "",
                activo: true,
                imagen_url: "",
            });
        }
    }, [categoria, isOpen]);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsSaving(true);

        try {
            if (categoria?.id) {
                // Update
                const { error } = await supabase
                    .from("categorias")
                    .update({
                        nombre: formData.nombre,
                        // nombre_interno: formData.nombre_interno, // Note: check if column exists
                        descripcion: formData.descripcion,
                        activo: formData.activo,
                        imagen_url: formData.imagen_url,
                    })
                    .eq("id", categoria.id);

                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase.from("categorias").insert([
                    {
                        sucursal_id: sucursalId,
                        nombre: formData.nombre,
                        descripcion: formData.descripcion,
                        activo: formData.activo,
                        imagen_url: formData.imagen_url,
                    },
                ]);
                if (error) throw error;
            }

            onSaved();
            onClose();
        } catch (error) {
            console.error("Error saving category:", error);
            alert("Error al guardar la categoría");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900">
                        {categoria ? "Editar categoría" : "Crear categoría"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Status Toggle */}
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-700">Estado:</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.activo}
                                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            <span className="ml-3 text-sm font-medium text-slate-600">Activa</span>
                        </label>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Banner Image Section */}
                    <div className="space-y-3">
                        <div className="text-center">
                            <h3 className="font-bold text-slate-900">Imagen de portada</h3>
                            <p className="text-xs text-slate-500">Resolución recomendada: 768 x 210 píxeles.</p>
                        </div>

                        <div
                            onClick={() => document.getElementById('category-image-upload')?.click()}
                            className="relative group aspect-[768/210] w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden hover:border-purple-300 transition-colors cursor-pointer"
                        >
                            {formData.imagen_url ? (
                                <img src={formData.imagen_url} alt="Portada" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center p-6">
                                    <div className="flex justify-center mb-2">
                                        <Upload size={32} className="text-slate-300" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">Cambiar imagen</p>
                                    <p className="text-xs text-slate-400">Tamaño máximo: 10 MB.</p>
                                </div>
                            )}
                        </div>
                        <input
                            id="category-image-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                    const fileExt = file.name.split('.').pop();
                                    const fileName = `cat-${Math.random().toString(36).substring(2)}.${fileExt}`;
                                    const filePath = `categories/${fileName}`;

                                    const { error: uploadError } = await supabase.storage
                                        .from('images')
                                        .upload(filePath, file);

                                    if (uploadError) throw uploadError;

                                    const { data: { publicUrl } } = supabase.storage
                                        .from('images')
                                        .getPublicUrl(filePath);

                                    setFormData({ ...formData, imagen_url: publicUrl });
                                } catch (error: any) {
                                    alert("Error subiendo la imagen: " + error.message);
                                }
                            }}
                        />
                    </div>

                    <div className="space-y-4">
                        {/* Nombre */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</label>
                            <input
                                type="text"
                                required
                                value={formData.nombre}
                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                                placeholder="Ej. Pizzas"
                            />
                        </div>

                        {/* Nombre Interno */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Interno</label>
                            <input
                                type="text"
                                value={formData.nombre_interno}
                                onChange={(e) => setFormData({ ...formData, nombre_interno: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                                placeholder="Nombre para uso interno"
                            />
                        </div>

                        {/* Descripción */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</label>
                            <textarea
                                value={formData.descripcion}
                                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all h-24 resize-none"
                                placeholder="Describe la categoría..."
                            />
                        </div>

                        {/* Tags */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tags</label>
                            <div className="relative">
                                <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none appearance-none cursor-pointer">
                                    <option>Seleccionar tags</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <Plus size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Disponibilidad */}
                        <div className="space-y-3 pt-4">
                            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                                Disponibilidad
                                <Info size={14} className="text-slate-400" />
                            </h3>
                            <p className="text-xs text-slate-500">Configurá en qué modalidad de entrega estará disponible.</p>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Disponible en</label>
                                <div className="relative">
                                    <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none appearance-none cursor-pointer">
                                        <option>Delivery, Take Away</option>
                                    </select>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 pt-2">Configurá la disponibilidad por días y horarios.</p>
                            <div className="flex gap-2">
                                <button type="button" className="flex-1 py-2 px-4 bg-slate-900 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                                    <Check size={16} /> Siempre disponible
                                </button>
                                <button type="button" className="flex-1 py-2 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold">
                                    Por horarios
                                </button>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className={`px-8 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg ${isSaving
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-slate-900 hover:bg-slate-800 shadow-slate-950/20 active:scale-95"
                            }`}
                    >
                        {isSaving ? "Guardando..." : categoria ? "Actualizar" : "Crear"}
                    </button>
                </div>
            </div>
        </div>
    );
}
