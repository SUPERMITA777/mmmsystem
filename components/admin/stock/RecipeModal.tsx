"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Save, Plus, Trash2, Search } from "lucide-react";

type RecipeModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    product: any;
    sucursalId: string;
    allIngredients: any[];
};

export default function RecipeModal({ isOpen, onClose, onSave, product, sucursalId, allIngredients }: RecipeModalProps) {
    const [recipeItems, setRecipeItems] = useState<any[]>([]);
    const [busquedaInsumo, setBusquedaInsumo] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && product) {
            fetchRecipe();
        }
    }, [isOpen, product]);

    async function fetchRecipe() {
        const { data, error } = await supabase
            .from("recetas")
            .select("*, ingredientes(*)")
            .eq("producto_id", product.id);

        if (data) setRecipeItems(data);
    }

    async function handleAddIngredient(ing: any) {
        if (recipeItems.find(item => item.ingrediente_id === ing.id)) return;

        const newItem = {
            producto_id: product.id,
            ingrediente_id: ing.id,
            cantidad: 0,
            ingredientes: ing,
            sucursal_id: sucursalId
        };
        setRecipeItems([...recipeItems, newItem]);
    }

    async function handleRemoveItem(ingId: string) {
        setRecipeItems(recipeItems.filter(item => item.ingrediente_id !== ingId));
    }

    async function handleSave() {
        setLoading(true);
        try {
            // First delete old recipe
            await supabase.from("recetas").delete().eq("producto_id", product.id);

            // Insert new ones
            const toInsert = recipeItems.map(item => ({
                producto_id: product.id,
                ingrediente_id: item.ingrediente_id,
                cantidad: item.cantidad,
                sucursal_id: sucursalId
            }));

            if (toInsert.length > 0) {
                const { error } = await supabase.from("recetas").insert(toInsert);
                if (error) throw error;
            }

            onSave();
            onClose();
        } catch (e: any) {
            console.error(e);
            alert("Error al guardar receta: " + e.message);
        } finally {
            setLoading(false);
        }
    }

    const filteredIngredients = allIngredients.filter(i =>
        i.nombre.toLowerCase().includes(busquedaInsumo.toLowerCase()) &&
        !recipeItems.find(ri => ri.ingrediente_id === i.id)
    );

    const totalCost = recipeItems.reduce((acc, item) => {
        const cost = item.ingredientes?.costo_unitario || 0;
        return acc + (item.cantidad * cost);
    }, 0);

    if (!isOpen || !product) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="font-bold text-gray-900">Editar Receta</h3>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{product.nombre}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[10px] text-gray-400 font-bold uppercase">Costo Total Receta</p>
                            <p className="text-lg font-black text-green-600">$ {new Intl.NumberFormat("es-AR").format(totalCost)}</p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors ml-4">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* LEFT: Recipe Items */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 border-r border-gray-50">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Ingredientes en la receta</h4>
                        {recipeItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                                <Plus size={40} className="mb-2 opacity-20" />
                                <p className="text-sm">No hay ingredientes cargados</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {recipeItems.map(item => (
                                    <div key={item.ingrediente_id} className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100 group">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-900">{item.ingredientes?.nombre}</p>
                                            <p className="text-[10px] text-gray-400 uppercase font-medium">Costo: ${item.ingredientes?.costo_unitario} / {item.ingredientes?.unidad}</p>
                                        </div>
                                        <div className="w-32">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={item.cantidad}
                                                    onChange={e => {
                                                        const val = Number(e.target.value);
                                                        setRecipeItems(recipeItems.map(ri => ri.ingrediente_id === item.ingrediente_id ? { ...ri, cantidad: val } : ri));
                                                    }}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-900 outline-none focus:border-purple-500 pr-8"
                                                    step="0.001"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase">{item.ingredientes?.unidad}</span>
                                            </div>
                                        </div>
                                        <div className="w-16 text-right font-bold text-gray-700 text-sm">
                                            ${new Intl.NumberFormat("es-AR").format(item.cantidad * (item.ingredientes?.costo_unitario || 0))}
                                        </div>
                                        <button onClick={() => handleRemoveItem(item.ingrediente_id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Insumos Selector */}
                    <div className="w-1/3 bg-gray-50/50 p-6 flex flex-col gap-4">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Agregar Insumos</h4>
                        <div className="relative shrink-0">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar insumo..."
                                value={busquedaInsumo}
                                onChange={e => setBusquedaInsumo(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-purple-500 transition-colors"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {filteredIngredients.map(ing => (
                                <button
                                    key={ing.id}
                                    onClick={() => handleAddIngredient(ing)}
                                    className="w-full flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-purple-300 hover:shadow-sm transition-all group"
                                >
                                    <div className="text-left">
                                        <p className="text-xs font-bold text-gray-900">{ing.nombre}</p>
                                        <p className="text-[10px] text-gray-400 uppercase">{ing.categoria}</p>
                                    </div>
                                    <Plus size={14} className="text-gray-300 group-hover:text-purple-600" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">Cancelar</button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className={`flex items-center gap-2 bg-purple-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-purple-700 transition-all ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        <Save size={16} /> {loading ? "Guardando..." : "Guardar Receta"}
                    </button>
                </div>
            </div>
        </div>
    );
}
