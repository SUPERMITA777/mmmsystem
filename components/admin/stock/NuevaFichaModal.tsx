"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Save, Plus, Trash2, Search, ChefHat, Package } from "lucide-react";

type FichaTecnica = {
    id: string;
    nombre: string;
    costo_total: number;
};

type ItemForm = {
    tipo: "ingrediente" | "sub_receta";
    ingrediente_id: string | null;
    sub_ficha_id: string | null;
    cantidad: number;
    // Para display
    nombre: string;
    unidad: string;
    costo_unitario: number;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    editingFicha: FichaTecnica | null;
    sucursalId: string;
    ingredientes: any[];
    todasLasFichas: FichaTecnica[];
};

export default function NuevaFichaModal({
    isOpen,
    onClose,
    onSave,
    editingFicha,
    sucursalId,
    ingredientes,
    todasLasFichas,
}: Props) {
    const [nombre, setNombre] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [items, setItems] = useState<ItemForm[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [selectorTab, setSelectorTab] = useState<"ingrediente" | "sub_receta">("ingrediente");
    const [loading, setLoading] = useState(false);
    const [loadingItems, setLoadingItems] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (editingFicha) {
                setNombre(editingFicha.nombre);
                setDescripcion("");
                fetchExistingItems(editingFicha.id);
            } else {
                setNombre("");
                setDescripcion("");
                setItems([]);
            }
            setBusqueda("");
            setSelectorTab("ingrediente");
        }
    }, [isOpen, editingFicha]);

    async function fetchExistingItems(fichaId: string) {
        setLoadingItems(true);
        const { data } = await supabase
            .from("ficha_tecnica_items")
            .select(`
                *,
                ingredientes(id, nombre, unidad, costo_unitario),
                sub_ficha:fichas_tecnicas!ficha_tecnica_items_sub_ficha_id_fkey(id, nombre, costo_total)
            `)
            .eq("ficha_tecnica_id", fichaId);

        if (data) {
            const mapped: ItemForm[] = data.map((d: any) => ({
                tipo: d.tipo,
                ingrediente_id: d.ingrediente_id,
                sub_ficha_id: d.sub_ficha_id,
                cantidad: d.cantidad,
                nombre: d.tipo === "ingrediente" ? (d.ingredientes?.nombre || "?") : (d.sub_ficha?.nombre || "?"),
                unidad: d.tipo === "ingrediente" ? (d.ingredientes?.unidad || "") : "unid.",
                costo_unitario: d.tipo === "ingrediente"
                    ? (d.ingredientes?.costo_unitario || 0)
                    : (d.sub_ficha?.costo_total || 0),
            }));
            setItems(mapped);
        }
        setLoadingItems(false);
    }

    function handleAddIngrediente(ing: any) {
        if (items.find(i => i.tipo === "ingrediente" && i.ingrediente_id === ing.id)) return;
        setItems(prev => [...prev, {
            tipo: "ingrediente",
            ingrediente_id: ing.id,
            sub_ficha_id: null,
            cantidad: 1,
            nombre: ing.nombre,
            unidad: ing.unidad,
            costo_unitario: ing.costo_unitario,
        }]);
        setBusqueda("");
    }

    function handleAddSubReceta(ficha: FichaTecnica) {
        if (items.find(i => i.tipo === "sub_receta" && i.sub_ficha_id === ficha.id)) return;
        // Evitar referencia circular
        if (editingFicha && ficha.id === editingFicha.id) return;
        setItems(prev => [...prev, {
            tipo: "sub_receta",
            ingrediente_id: null,
            sub_ficha_id: ficha.id,
            cantidad: 1,
            nombre: ficha.nombre,
            unidad: "unid.",
            costo_unitario: ficha.costo_total,
        }]);
        setBusqueda("");
    }

    function handleRemoveItem(index: number) {
        setItems(prev => prev.filter((_, i) => i !== index));
    }

    function handleCantidadChange(index: number, value: number) {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, cantidad: value } : item));
    }

    const costoTotal = items.reduce((acc, item) => acc + (item.cantidad * item.costo_unitario), 0);

    async function handleSave() {
        if (!nombre.trim()) {
            alert("Ingresá un nombre para la receta");
            return;
        }
        setLoading(true);
        try {
            let fichaId = editingFicha?.id;

            if (editingFicha) {
                // Update nombre/descripcion y costo
                await supabase
                    .from("fichas_tecnicas")
                    .update({ nombre: nombre.trim(), descripcion: descripcion.trim() || null, costo_total: costoTotal })
                    .eq("id", editingFicha.id);
                // Delete existing items and re-insert
                await supabase.from("ficha_tecnica_items").delete().eq("ficha_tecnica_id", editingFicha.id);
            } else {
                // Create new ficha
                const { data, error } = await supabase
                    .from("fichas_tecnicas")
                    .insert({
                        nombre: nombre.trim(),
                        descripcion: descripcion.trim() || null,
                        sucursal_id: sucursalId,
                        costo_total: costoTotal,
                    })
                    .select()
                    .single();
                if (error) throw error;
                fichaId = data.id;
            }

            // Insert items
            if (items.length > 0 && fichaId) {
                const toInsert = items.map(item => ({
                    ficha_tecnica_id: fichaId,
                    tipo: item.tipo,
                    ingrediente_id: item.tipo === "ingrediente" ? item.ingrediente_id : null,
                    sub_ficha_id: item.tipo === "sub_receta" ? item.sub_ficha_id : null,
                    cantidad: item.cantidad,
                    sucursal_id: sucursalId,
                }));
                const { error } = await supabase.from("ficha_tecnica_items").insert(toInsert);
                if (error) throw error;
            }

            onSave();
        } catch (e: any) {
            console.error(e);
            alert("Error al guardar la receta: " + e.message);
        } finally {
            setLoading(false);
        }
    }

    // Filter for ingredient selector
    const fichasFiltradas = todasLasFichas.filter(f => {
        const notSelf = !editingFicha || f.id !== editingFicha.id;
        const notAdded = !items.find(i => i.tipo === "sub_receta" && i.sub_ficha_id === f.id);
        const matchBusqueda = f.nombre.toLowerCase().includes(busqueda.toLowerCase());
        return notSelf && notAdded && matchBusqueda;
    });

    const ingsFiltrados = ingredientes.filter(i =>
        i.nombre.toLowerCase().includes(busqueda.toLowerCase()) &&
        !items.find(it => it.tipo === "ingrediente" && it.ingrediente_id === i.id)
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[88vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="font-black text-gray-900 text-lg">
                            {editingFicha ? "Editar Receta" : "Nueva Receta"}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {editingFicha ? `Editando: ${editingFicha.nombre}` : "Creá una ficha técnica con ingredientes y/o sub-recetas"}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        {items.length > 0 && (
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Costo Total</p>
                                <p className="text-xl font-black text-green-600">
                                    $ {new Intl.NumberFormat("es-AR").format(costoTotal)}
                                </p>
                            </div>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Nombre y descripción */}
                <div className="px-6 py-3 border-b border-gray-50 bg-gray-50/30 shrink-0">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre de la Receta *</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                placeholder="Ej: Pizza Muzza Base, Salsa Bolognesa..."
                                className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 placeholder-gray-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/10 outline-none transition-all"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Descripción (opcional)</label>
                            <input
                                type="text"
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                                placeholder="Notas de preparación..."
                                className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder-gray-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-500/10 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Body: two columns */}
                <div className="flex-1 overflow-hidden flex">
                    {/* LEFT: Items de la receta */}
                    <div className="flex-1 overflow-y-auto p-5 border-r border-gray-100">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
                            Composición de la Receta
                        </h4>
                        {loadingItems ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-8 h-8 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-200">
                                <ChefHat size={36} />
                                <p className="text-sm">Agregá ingredientes o sub-recetas desde el panel derecho</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Table header */}
                                <div className="grid grid-cols-[1fr_80px_80px_50px_32px] gap-2 px-3 py-1">
                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Item</span>
                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-right">Cantidad</span>
                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-right">Costo Unit.</span>
                                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-right">Total</span>
                                    <span />
                                </div>
                                {items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-[1fr_80px_80px_50px_32px] gap-2 items-center bg-gray-50 px-3 py-2.5 rounded-xl border border-gray-100 group">
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                {item.tipo === "ingrediente"
                                                    ? <Package size={11} className="text-blue-400 shrink-0" />
                                                    : <ChefHat size={11} className="text-purple-400 shrink-0" />
                                                }
                                                <p className="text-sm font-bold text-gray-900 truncate">{item.nombre}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-400 uppercase font-medium ml-4">
                                                {item.tipo === "ingrediente" ? item.unidad : "sub-receta"}
                                            </p>
                                        </div>
                                        <div>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={item.cantidad}
                                                    onChange={e => handleCantidadChange(index, Number(e.target.value))}
                                                    min="0.001"
                                                    step="0.001"
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-gray-900 outline-none focus:border-purple-400 text-right pr-1"
                                                />
                                            </div>
                                        </div>
                                        <div className="text-right text-xs text-gray-500 font-medium">
                                            $ {new Intl.NumberFormat("es-AR").format(item.costo_unitario)}
                                        </div>
                                        <div className="text-right text-sm font-black text-gray-800">
                                            $ {new Intl.NumberFormat("es-AR").format(item.cantidad * item.costo_unitario)}
                                        </div>
                                        <button
                                            onClick={() => handleRemoveItem(index)}
                                            className="p-1 text-gray-300 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}

                                {/* Total */}
                                <div className="mt-3 bg-gray-900 text-white rounded-xl px-4 py-3 flex justify-between items-center">
                                    <span className="text-xs font-black uppercase tracking-wider text-gray-300">Costo Total Receta</span>
                                    <span className="text-xl font-black">$ {new Intl.NumberFormat("es-AR").format(costoTotal)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Selector */}
                    <div className="w-72 shrink-0 bg-gray-50/40 flex flex-col p-4 gap-3">
                        {/* Tab selector */}
                        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                            <button
                                onClick={() => { setSelectorTab("ingrediente"); setBusqueda(""); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${selectorTab === "ingrediente" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
                            >
                                <Package size={12} /> Ingredientes
                            </button>
                            <button
                                onClick={() => { setSelectorTab("sub_receta"); setBusqueda(""); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${selectorTab === "sub_receta" ? "bg-white text-purple-600 shadow-sm" : "text-gray-500"}`}
                            >
                                <ChefHat size={12} /> Sub-recetas
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative shrink-0">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder={selectorTab === "ingrediente" ? "Buscar ingrediente..." : "Buscar receta..."}
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs outline-none focus:border-purple-400 transition-colors"
                            />
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto space-y-1.5">
                            {selectorTab === "ingrediente" && (
                                ingsFiltrados.length === 0 ? (
                                    <p className="text-center text-xs text-gray-300 py-8">
                                        {busqueda ? "Sin resultados" : "No hay más ingredientes para agregar"}
                                    </p>
                                ) : ingsFiltrados.map(ing => (
                                    <button
                                        key={ing.id}
                                        onClick={() => handleAddIngrediente(ing)}
                                        className="w-full flex items-center justify-between p-2.5 bg-white border border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group text-left"
                                    >
                                        <div>
                                            <p className="text-xs font-bold text-gray-900">{ing.nombre}</p>
                                            <p className="text-[10px] text-gray-400 uppercase">{ing.unidad} · ${new Intl.NumberFormat("es-AR").format(ing.costo_unitario)}</p>
                                        </div>
                                        <Plus size={13} className="text-gray-300 group-hover:text-blue-500 shrink-0" />
                                    </button>
                                ))
                            )}
                            {selectorTab === "sub_receta" && (
                                fichasFiltradas.length === 0 ? (
                                    <p className="text-center text-xs text-gray-300 py-8">
                                        {busqueda ? "Sin resultados" : todasLasFichas.filter(f => !editingFicha || f.id !== editingFicha.id).length === 0
                                            ? "No hay otras recetas creadas todavía"
                                            : "No hay más recetas para agregar"
                                        }
                                    </p>
                                ) : fichasFiltradas.map(ficha => (
                                    <button
                                        key={ficha.id}
                                        onClick={() => handleAddSubReceta(ficha)}
                                        className="w-full flex items-center justify-between p-2.5 bg-white border border-gray-100 rounded-xl hover:border-purple-300 hover:shadow-sm transition-all group text-left"
                                    >
                                        <div>
                                            <p className="text-xs font-bold text-gray-900">{ficha.nombre}</p>
                                            <p className="text-[10px] text-gray-400">Costo: ${new Intl.NumberFormat("es-AR").format(ficha.costo_total)}</p>
                                        </div>
                                        <Plus size={13} className="text-gray-300 group-hover:text-purple-500 shrink-0" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
                    <p className="text-xs text-gray-400">
                        {items.length} {items.length === 1 ? "ítem" : "ítems"} en la receta
                    </p>
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || !nombre.trim()}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${loading || !nombre.trim()
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                : "bg-gray-900 text-white hover:bg-gray-800 shadow-md active:scale-95"
                                }`}
                        >
                            <Save size={15} />
                            {loading ? "Guardando..." : editingFicha ? "Actualizar Receta" : "Crear Receta"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
