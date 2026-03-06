"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Save, Trash2 } from "lucide-react";

type IngredientModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    ingredient?: any;
    sucursalId: string;
};

export default function IngredientModal({ isOpen, onClose, onSave, ingredient, sucursalId }: IngredientModalProps) {
    const [nombre, setNombre] = useState("");
    const [unidad, setUnidad] = useState("gr");
    const [costoUnitario, setCostoUnitario] = useState(0);
    const [stockMinimo, setStockMinimo] = useState(0);
    const [categoria, setCategoria] = useState("General");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (ingredient) {
            setNombre(ingredient.nombre || "");
            setUnidad(ingredient.unidad || "gr");
            setCostoUnitario(ingredient.costo_unitario || 0);
            setStockMinimo(ingredient.stock_minimo || 0);
            setCategoria(ingredient.categoria || "General");
        } else {
            setNombre("");
            setUnidad("gr");
            setCostoUnitario(0);
            setStockMinimo(0);
            setCategoria("General");
        }
    }, [ingredient, isOpen]);

    async function handleSave() {
        if (!nombre) return alert("El nombre es obligatorio");
        setLoading(true);

        const payload = {
            sucursal_id: sucursalId,
            nombre,
            unidad,
            costo_unitario: costoUnitario,
            stock_minimo: stockMinimo,
            categoria,
            updated_at: new Date().toISOString()
        };

        try {
            if (ingredient?.id) {
                const { error } = await supabase.from("ingredientes").update(payload).eq("id", ingredient.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("ingredientes").insert([{ ...payload, stock_actual: 0 }]);
                if (error) throw error;
            }
            onSave();
            onClose();
        } catch (e: any) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">{ingredient ? "Editar Insumo" : "Nuevo Insumo"}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Nombre</label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-purple-500 transition-colors"
                            placeholder="Ej: Harina 000"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Unidad</label>
                            <select
                                value={unidad}
                                onChange={e => setUnidad(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-purple-500 transition-colors"
                            >
                                <option value="gr">Gramos (gr)</option>
                                <option value="kg">Kilos (kg)</option>
                                <option value="ml">Mililitros (ml)</option>
                                <option value="lt">Litros (lt)</option>
                                <option value="un">Unidad (un)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Categoría</label>
                            <input
                                type="text"
                                value={categoria}
                                onChange={e => setCategoria(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-purple-500 transition-colors"
                                placeholder="Ej: Secos"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Costo Unitario ($)</label>
                            <input
                                type="number"
                                value={costoUnitario}
                                onChange={e => setCostoUnitario(Number(e.target.value))}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-purple-500 transition-colors"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Stock Mínimo</label>
                            <input
                                type="number"
                                value={stockMinimo}
                                onChange={e => setStockMinimo(Number(e.target.value))}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-purple-500 transition-colors"
                                step="0.001"
                            />
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    {ingredient && (
                        <button
                            onClick={async () => {
                                if (!confirm("¿Eliminar este insumo?")) return;
                                const { error } = await supabase.from("ingredientes").delete().eq("id", ingredient.id);
                                if (error) alert("Error al eliminar: " + error.message);
                                else { onSave(); onClose(); }
                            }}
                            className="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1 transition-colors"
                        >
                            <Trash2 size={14} /> Eliminar
                        </button>
                    )}
                    <div className="flex gap-3 ml-auto">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Cancelar</button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className={`flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 transition-all ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            <Save size={16} /> {loading ? "Guardando..." : "Guardar Insumo"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
