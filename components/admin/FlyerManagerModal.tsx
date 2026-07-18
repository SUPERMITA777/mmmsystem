"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Upload, Save, Search, Calendar, Clock, Trash2 } from "lucide-react";
import ImageCropperModal from "@/components/ui/ImageCropperModal";

interface Producto {
    id: string;
    nombre: string;
    precio: number;
}

interface Flyer {
    id?: string;
    imagen_url: string;
    producto_id: string | null;
    es_eterno: boolean;
    vence_at: string | null;
    activo: boolean;
}

export default function FlyerManagerModal({
    isOpen,
    onClose,
    sucursalId,
}: {
    isOpen: boolean;
    onClose: () => void;
    sucursalId: string;
}) {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [flyer, setFlyer] = useState<Flyer>({
        imagen_url: "",
        producto_id: null,
        es_eterno: true,
        vence_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
        activo: true,
    });
    const [productos, setProductos] = useState<Producto[]>([]);
    const [search, setSearch] = useState("");
    const [showProductSearch, setShowProductSearch] = useState(false);
    const [cropperSrc, setCropperSrc] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && sucursalId) {
            loadFlyer();
            loadProductos();
        }
    }, [isOpen, sucursalId]);

    async function loadFlyer() {
        setLoading(true);
        try {
            const res = await fetch(`/api/flyer?sucursal_id=${sucursalId}`);
            const json = await res.json();
            if (json.success && json.data) {
                const d = json.data;
                setFlyer({
                    id: d.id,
                    imagen_url: d.imagen_url,
                    producto_id: d.producto_id,
                    es_eterno: d.es_eterno,
                    vence_at: d.vence_at ? new Date(d.vence_at).toISOString().slice(0, 16) : new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
                    activo: d.activo,
                });
            }
        } catch (err) {
            console.error("Error loading flyer:", err);
        }
        setLoading(false);
    }

    async function loadProductos() {
        const { data } = await supabase
            .from("productos")
            .select("id, nombre, precio")
            .eq("sucursal_id", sucursalId)
            .eq("activo", true)
            .order("nombre");
        setProductos(data || []);
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Read file and open cropper
        const reader = new FileReader();
        reader.onload = () => {
            setCropperSrc(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be re-selected
        e.target.value = '';
    }

    async function handleCroppedUpload(croppedBlob: Blob) {
        try {
            setSaving(true);
            const fileName = `${Math.random().toString(36).substring(2)}.jpg`;
            const filePath = `flyers/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("images")
                .upload(filePath, croppedBlob, { contentType: "image/jpeg" });

            if (uploadError) throw uploadError;

            const {
                data: { publicUrl },
            } = supabase.storage.from("images").getPublicUrl(filePath);

            setFlyer({ ...flyer, imagen_url: publicUrl });
            setCropperSrc(null);
        } catch (error: any) {
            alert("Error al subir imagen: " + error.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleSave() {
        if (!flyer.imagen_url) {
            alert("Debes subir una imagen para el flyer.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/flyer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...flyer,
                    vence_at: !flyer.es_eterno && flyer.vence_at ? new Date(flyer.vence_at).toISOString() : null,
                    sucursal_id: sucursalId,
                }),
            });

            const json = await res.json();
            if (!json.success) throw new Error(json.message);

            alert("Flyer guardado correctamente.");
            onClose();
        } catch (error: any) {
            alert("Error al guardar: " + error.message);
        } finally {
            setSaving(false);
        }
    }

    const selectedProduct = productos.find((p) => p.id === flyer.producto_id);
    const filteredProducts = productos.filter((p) =>
        p.nombre.toLowerCase().includes(search.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold text-gray-900">Configurar Flyer</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Image Preview / Upload */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Imagen del Flyer</label>
                        {flyer.imagen_url ? (
                            <div className="relative group rounded-xl overflow-hidden border border-gray-200">
                                <img
                                    src={flyer.imagen_url}
                                    alt="Flyer Preview"
                                    className="w-full aspect-[9/16] object-cover"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => document.getElementById("flyer-upload")?.click()}
                                        className="bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-bold shadow-lg"
                                    >
                                        Cambiar
                                    </button>
                                    <button
                                        onClick={() => setFlyer({ ...flyer, imagen_url: "" })}
                                        className="bg-red-500 text-white p-2 rounded-lg shadow-lg hover:bg-red-600 transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => document.getElementById("flyer-upload")?.click()}
                                className="w-full aspect-[9/16] border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-white transition-colors">
                                    <Upload className="text-gray-400 group-hover:text-purple-500" size={24} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-gray-700">Subir Flyer</p>
                                    <p className="text-xs text-gray-400">Tamaño sugerido: 4:5 o 9:16</p>
                                </div>
                            </button>
                        )}
                        <input
                            id="flyer-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleUpload}
                        />
                    </div>

                    {/* Product Selector */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Producto Asociado</label>
                        <div className="relative">
                            {selectedProduct ? (
                                <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-xl">
                                    <div className="text-sm">
                                        <p className="font-bold text-gray-900">{selectedProduct.nombre}</p>
                                        <p className="text-gray-500">$ {selectedProduct.precio}</p>
                                    </div>
                                    <button
                                        onClick={() => setFlyer({ ...flyer, producto_id: null })}
                                        className="text-gray-400 hover:text-red-500"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowProductSearch(true)}
                                    className="w-full flex items-center gap-2 p-3 border border-gray-200 rounded-xl text-gray-400 hover:border-purple-300 transition-colors text-sm"
                                >
                                    <Search size={18} />
                                    Seleccionar producto...
                                </button>
                            )}

                            {showProductSearch && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-10 flex flex-col max-h-60">
                                    <div className="p-2 border-b border-gray-50">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Buscar producto..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-gray-50 rounded-lg outline-none"
                                        />
                                    </div>
                                    <div className="overflow-y-auto">
                                        {filteredProducts.map((p) => (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setFlyer({ ...flyer, producto_id: p.id });
                                                    setShowProductSearch(false);
                                                    setSearch("");
                                                }}
                                                className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0"
                                            >
                                                <span className="font-medium text-gray-900">{p.nombre}</span>
                                                <span className="text-gray-400 text-xs">$ {p.precio}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Duration / Status */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                <Clock size={16} className="text-gray-400" />
                                Duración
                            </label>
                            <select
                                value={flyer.es_eterno ? "forever" : "range"}
                                onChange={(e) => setFlyer({ ...flyer, es_eterno: e.target.value === "forever" })}
                                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                            >
                                <option value="forever">Para Siempre</option>
                                <option value="range">Rango de Fechas</option>
                            </select>
                        </div>
                        <div className="space-y-2 relative">
                            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                <Calendar size={16} className="text-gray-400" />
                                Estado
                            </label>
                            <button
                                onClick={() => setFlyer({ ...flyer, activo: !flyer.activo })}
                                className={`w-full p-2.5 rounded-xl text-sm font-bold transition-colors border ${flyer.activo
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : "bg-gray-50 border-gray-200 text-gray-400"
                                    }`}
                            >
                                {flyer.activo ? "Activo" : "Inactivo"}
                            </button>
                        </div>
                    </div>

                    {/* Fecha de vencimiento (sólo si no es eterno) */}
                    {!flyer.es_eterno && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-sm font-semibold text-gray-700 text-xs text-gray-500 uppercase">
                                Mostrar Hasta
                            </label>
                            <input
                                type="datetime-local"
                                value={flyer.vence_at || ""}
                                onChange={(e) => setFlyer({ ...flyer, vence_at: e.target.value })}
                                className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
                    <button
                        onClick={onClose}
                        className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !flyer.imagen_url}
                        className="bg-gray-900 text-white px-8 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                        {flyer.id ? "Guardar Cambios" : "Crear Flyer"}
                    </button>
                </div>
            </div>

            {/* Image Cropper */}
            <ImageCropperModal
                isOpen={!!cropperSrc}
                imageSrc={cropperSrc || ''}
                aspectRatio={9 / 16}
                maxDimension={1200}
                onCropComplete={handleCroppedUpload}
                onClose={() => setCropperSrc(null)}
                title="Recortar Flyer"
            />
        </div>
    );
}
