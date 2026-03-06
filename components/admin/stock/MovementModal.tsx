"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Save, ArrowDown, ArrowUp, RefreshCcw } from "lucide-react";

type MovementModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    ingredient: any;
    sucursalId: string;
};

export default function MovementModal({ isOpen, onClose, onSave, ingredient, sucursalId }: MovementModalProps) {
    const [tipo, setTipo] = useState<"entrada" | "salida" | "ajuste">("entrada");
    const [cantidad, setCantidad] = useState(0);
    const [motivo, setMotivo] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTipo("entrada");
            setCantidad(0);
            setMotivo("");
        }
    }, [isOpen]);

    async function handleSave() {
        if (cantidad <= 0) return alert("La cantidad debe ser mayor a 0");
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error: mError } = await supabase.from("movimientos_stock").insert([{
                sucursal_id: sucursalId,
                ingrediente_id: ingredient.id,
                tipo,
                cantidad,
                motivo,
                usuario_id: user?.id
            }]);

            if (mError) throw mError;

            onSave();
            onClose();
        } catch (e: any) {
            console.error(e);
            alert("Error al registrar movimiento: " + e.message);
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen || !ingredient) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-gray-900">Registrar Movimiento</h3>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{ingredient.nombre}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Select Tipo */}
                    <div className="flex gap-2 p-1 bg-gray-50 rounded-xl">
                        {[
                            { key: "entrada", label: "Entrada", icon: ArrowUp, color: "text-green-600", bg: "bg-green-50" },
                            { key: "salida", label: "Salida", icon: ArrowDown, color: "text-red-600", bg: "bg-red-50" },
                            { key: "ajuste", label: "Ajuste", icon: RefreshCcw, color: "text-blue-600", bg: "bg-blue-50" }
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTipo(t.key as any)}
                                className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-lg text-xs font-bold transition-all ${tipo === t.key ? `bg-white shadow-sm border border-gray-100 ${t.color}` : "text-gray-400 hover:bg-gray-100"}`}
                            >
                                <t.icon size={16} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cantidad ({ingredient.unidad})</label>
                        <input
                            type="number"
                            value={cantidad}
                            onChange={e => setCantidad(Number(e.target.value))}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 outline-none focus:border-purple-500 transition-colors"
                            placeholder="Ej: 100"
                            step="0.001"
                        />
                        <p className="mt-1 text-[10px] text-gray-400">Stock actual: {ingredient.stock_actual} {ingredient.unidad}</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Motivo / Notas (Opcional)</label>
                        <textarea
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 outline-none focus:border-purple-500 transition-colors resize-none"
                            rows={3}
                            placeholder="Ej: Compra a proveedor, mercadería dañada..."
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className={`flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 transition-all ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <Save size={16} /> {loading ? "Registrando..." : "Guardar Movimiento"}
                    </button>
                </div>
            </div>
        </div>
    );
}
