"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Save, DollarSign, Info } from "lucide-react";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    producto: { id?: string; nombre: string; costo_fijo?: number; ficha_tecnica_id?: string } | null;
    sucursalId: string;
};

export default function AsignarCostoModal({ isOpen, onClose, onSave, producto, sucursalId }: Props) {
    const [loading, setLoading] = useState(false);
    const [costoManual, setCostoManual] = useState<string>("0");
    const [fichaId, setFichaId] = useState<string>("");
    const [fichas, setFichas] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && producto) {
            setCostoManual(producto.costo_fijo?.toString() || "0");
            setFichaId(producto.ficha_tecnica_id || "");
            fetchFichas();
        }
    }, [isOpen, producto]);

    async function fetchFichas() {
        if (!sucursalId) return;
        const { data } = await supabase
            .from("fichas_tecnicas")
            .select("id, nombre, costo_total")
            .eq("sucursal_id", sucursalId)
            .order("nombre");
        setFichas(data || []);
    }

    async function handleSave() {
        if (!producto) return;
        setLoading(true);
        try {
            let error;

            if (producto.id) {
                // Update existing product
                const { error: updateError } = await supabase
                    .from("productos")
                    .update({
                        costo_fijo: parseFloat(costoManual) || 0,
                        ficha_tecnica_id: fichaId || null
                    })
                    .eq("id", producto.id);
                error = updateError;
            } else {
                // Create missing product as hidden
                const { error: insertError } = await supabase
                    .from("productos")
                    .insert({
                        nombre: producto.nombre,
                        sucursal_id: sucursalId,
                        costo_fijo: parseFloat(costoManual) || 0,
                        ficha_tecnica_id: fichaId || null,
                        visible_en_menu: false,
                        activo: false
                    });
                error = insertError;
            }

            if (!error) {
                onSave();
                onClose();
            } else {
                console.error("Error saving cost:", error);
            }
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen || !producto) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-indigo-600" />
                        Asignar Costo
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</label>
                        <p className="text-lg font-bold text-gray-900">{producto.nombre}</p>
                    </div>

                    {!producto.id && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex items-start gap-2">
                            <Info className="w-5 h-5 text-blue-600 shrink-0" />
                            <p>
                                Este producto provino de un pedido antiguo o de una app externa y no existe en tu catálogo. 
                                Al guardar, se creará <strong>oculto de la caja y del menú</strong> solo para guardar el costo.
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Costo Manual ($)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={costoManual}
                                onChange={(e) => setCostoManual(e.target.value)}
                                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                placeholder="0.00"
                            />
                            <p className="text-xs text-gray-500 mt-1">Se usará como respaldo si no hay receta o si el costo de la receta es $0.</p>
                        </div>

                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vincular Receta (Ficha Técnica)</label>
                            <div className="flex gap-2">
                                <select
                                    value={fichaId}
                                    onChange={(e) => setFichaId(e.target.value)}
                                    className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                                >
                                    <option value="">Sin receta vinculada</option>
                                    {fichas.map(f => (
                                        <option key={f.id} value={f.id}>
                                            {f.nombre} (${Number(f.costo_total).toLocaleString('es-AR')})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? "Guardando..." : <><Save className="w-4 h-4" /> Guardar Cambios</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
