"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Upload, ImageIcon } from "lucide-react";

interface Categoria {
    id: string;
    nombre: string;
}

interface ProductoCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    categorias: Categoria[];
    categoriaActual: string | null;
    onCreated: () => void;
}

export default function ProductoCreatorModal({
    isOpen,
    onClose,
    categorias,
    categoriaActual,
    onCreated,
}: ProductoCreatorModalProps) {
    const [nombre, setNombre] = useState("");
    const [nombreInterno, setNombreInterno] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [precio, setPrecio] = useState("");
    const [precioCosto, setPrecioCosto] = useState("");
    const [categoriaId, setCategoriaId] = useState(categoriaActual || "");
    const [activo, setActivo] = useState(true);
    const [visibleEnMenu, setVisibleEnMenu] = useState(true);
    const [imagenUrl, setImagenUrl] = useState("");
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [imagenPreview, setImagenPreview] = useState<string | null>(null);

    if (!isOpen) return null;

    function resetForm() {
        setNombre("");
        setNombreInterno("");
        setDescripcion("");
        setPrecio("");
        setPrecioCosto("");
        setCategoriaId(categoriaActual || "");
        setActivo(true);
        setVisibleEnMenu(true);
        setImagenUrl("");
        setImagenPreview(null);
    }

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Preview
            const reader = new FileReader();
            reader.onload = () => setImagenPreview(reader.result as string);
            reader.readAsDataURL(file);

            const fileExt = file.name.split(".").pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `productos/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("imagenes")
                .upload(filePath, file, { cacheControl: "3600", upsert: false });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from("imagenes").getPublicUrl(filePath);
            setImagenUrl(data.publicUrl);
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Error al subir la imagen");
        } finally {
            setUploading(false);
        }
    }

    async function handleSave() {
        if (!nombre.trim()) {
            alert("El nombre del producto es obligatorio");
            return;
        }
        if (!categoriaId) {
            alert("Seleccioná una categoría");
            return;
        }
        if (!precio || parseFloat(precio) < 0) {
            alert("El precio debe ser un valor válido");
            return;
        }

        setSaving(true);
        try {
            // Get max orden for this category
            const { data: existingProducts } = await supabase
                .from("productos")
                .select("orden")
                .eq("categoria_id", categoriaId)
                .order("orden", { ascending: false })
                .limit(1);

            const maxOrden = existingProducts?.[0]?.orden || 0;

            const newProduct = {
                nombre: nombre.trim(),
                nombre_interno: nombreInterno.trim() || null,
                descripcion: descripcion.trim() || null,
                precio: parseFloat(precio) || 0,
                precio_costo: precioCosto ? parseFloat(precioCosto) : null,
                categoria_id: categoriaId,
                activo,
                visible_en_menu: visibleEnMenu,
                producto_oculto: false,
                producto_sugerido: false,
                imagen_url: imagenUrl || null,
                orden: maxOrden + 1,
            };

            const { error } = await supabase.from("productos").insert([newProduct]);
            if (error) throw error;

            resetForm();
            onCreated();
            onClose();
        } catch (error) {
            console.error("Error creating product:", error);
            alert("Error al crear el producto");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Nuevo Producto</h2>
                        <p className="text-sm text-slate-500 mt-1">Completá los datos del nuevo producto.</p>
                    </div>
                    <button
                        onClick={() => { resetForm(); onClose(); }}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Image Upload */}
                    <div className="flex justify-center">
                        <label className="relative cursor-pointer group">
                            <div className={`w-28 h-28 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${imagenPreview ? "border-transparent" : "border-slate-300 hover:border-purple-400 bg-slate-50 hover:bg-purple-50"
                                }`}>
                                {imagenPreview ? (
                                    <img src={imagenPreview} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
                                ) : uploading ? (
                                    <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full" />
                                ) : (
                                    <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-purple-500 transition-colors">
                                        <ImageIcon size={24} />
                                        <span className="text-xs font-medium">Foto</span>
                                    </div>
                                )}
                            </div>
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>
                    </div>

                    {/* Categoría */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Categoría</label>
                        <select
                            value={categoriaId}
                            onChange={(e) => setCategoriaId(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                        >
                            <option value="">Seleccionar categoría...</option>
                            {categorias.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {/* Nombre */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nombre *</label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Nombre del producto"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                        />
                    </div>

                    {/* Nombre Interno */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nombre interno</label>
                        <input
                            type="text"
                            value={nombreInterno}
                            onChange={(e) => setNombreInterno(e.target.value)}
                            placeholder="Referencia interna (opcional)"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                        />
                    </div>

                    {/* Descripción */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Descripción</label>
                        <textarea
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            placeholder="Descripción del producto (opcional)"
                            rows={3}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Precios */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Precio venta *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                <input
                                    type="number"
                                    value={precio}
                                    onChange={(e) => setPrecio(e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    step="0.01"
                                    className="w-full border border-slate-200 rounded-xl pl-7 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Precio costo</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">$</span>
                                <input
                                    type="number"
                                    value={precioCosto}
                                    onChange={(e) => setPrecioCosto(e.target.value)}
                                    placeholder="0"
                                    min="0"
                                    step="0.01"
                                    className="w-full border border-slate-200 rounded-xl pl-7 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex gap-6 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <div
                                onClick={() => setActivo(!activo)}
                                className={`w-10 h-6 rounded-full transition-colors relative ${activo ? "bg-green-500" : "bg-slate-300"}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${activo ? "translate-x-4" : "translate-x-0.5"}`} />
                            </div>
                            <span className="text-sm text-slate-700 font-medium">Activo</span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <div
                                onClick={() => setVisibleEnMenu(!visibleEnMenu)}
                                className={`w-10 h-6 rounded-full transition-colors relative ${visibleEnMenu ? "bg-green-500" : "bg-slate-300"}`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${visibleEnMenu ? "translate-x-4" : "translate-x-0.5"}`} />
                            </div>
                            <span className="text-sm text-slate-700 font-medium">Visible en menú</span>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                    <button
                        onClick={() => { resetForm(); onClose(); }}
                        disabled={saving}
                        className="px-6 py-2.5 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !nombre.trim() || !categoriaId}
                        className={`px-8 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg ${saving || !nombre.trim() || !categoriaId
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-slate-950 hover:bg-slate-800 shadow-slate-950/20 active:scale-95"
                            }`}
                    >
                        {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
