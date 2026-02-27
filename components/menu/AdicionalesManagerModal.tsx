"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Plus, Trash2, Save, Eye, EyeOff, Copy, Edit3, SortAsc, ArrowLeft, RefreshCw } from "lucide-react";

type GrupoAdicional = {
    id: string;
    sucursal_id: string;
    titulo: string;
    seleccion_obligatoria: boolean;
    seleccion_minima: number;
    seleccion_maxima: number;
    visible: boolean;
};

type Adicional = {
    id: string;
    grupo_id: string;
    nombre: string;
    precio_venta: number;
    precio_costo: number;
    seleccion_maxima: number;
    visible: boolean;
    stock: boolean;
    restaurar: boolean;
    vender_sin_stock: boolean;
};

export default function AdicionalesManagerModal({
    isOpen,
    onClose,
    sucursalId
}: {
    isOpen: boolean;
    onClose: () => void;
    sucursalId: string;
}) {
    const [view, setView] = useState<"list" | "editor">("list");
    const [grupos, setGrupos] = useState<GrupoAdicional[]>([]);
    const [grupoSeleccionado, setGrupoSeleccionado] = useState<GrupoAdicional | null>(null);
    const [adicionales, setAdicionales] = useState<Adicional[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [counts, setCounts] = useState<Record<string, number>>({});

    useEffect(() => {
        if (isOpen) { loadGrupos(); setView("list"); setGrupoSeleccionado(null); }
    }, [isOpen]);

    useEffect(() => {
        if (grupoSeleccionado && view === "editor" && !grupoSeleccionado.id.startsWith("temp-"))
            loadAdicionales(grupoSeleccionado.id);
        else if (grupoSeleccionado?.id.startsWith("temp-"))
            setAdicionales([]);
    }, [grupoSeleccionado, view]);

    async function loadGrupos() {
        setLoading(true);
        const { data: gs } = await supabase
            .from("grupos_adicionales").select("*").eq("sucursal_id", sucursalId)
            .order("created_at", { ascending: false });
        setGrupos(gs || []);
        const { data: ads } = await supabase.from("adicionales").select("grupo_id");
        const c: Record<string, number> = {};
        ads?.forEach(a => { c[a.grupo_id] = (c[a.grupo_id] || 0) + 1; });
        setCounts(c);
        setLoading(false);
    }

    async function loadAdicionales(grupoId: string) {
        const { data } = await supabase.from("adicionales").select("*").eq("grupo_id", grupoId).order("created_at", { ascending: true });
        setAdicionales(data || []);
    }

    async function handleToggleGroupVisibility(g: GrupoAdicional) {
        const nv = !g.visible;
        setGrupos(grupos.map(x => x.id === g.id ? { ...x, visible: nv } : x));
        await supabase.from("grupos_adicionales").update({ visible: nv }).eq("id", g.id);
    }

    async function handleDuplicateGrupo(id: string) {
        setLoading(true);
        const { data: og } = await supabase.from("grupos_adicionales").select("*").eq("id", id).single();
        if (!og) { setLoading(false); return; }
        const { id: _, created_at, updated_at, ...gd } = og;
        const { data: ng, error } = await supabase.from("grupos_adicionales").insert({ ...gd, titulo: `${og.titulo} (copia)` }).select().single();
        if (error || !ng) { alert("Error al duplicar"); setLoading(false); return; }
        const { data: ads } = await supabase.from("adicionales").select("*").eq("grupo_id", id);
        if (ads?.length) {
            const na = ads.map(a => { const { id: __, created_at: ___, updated_at: ____, ...ad } = a; return { ...ad, grupo_id: ng.id }; });
            await supabase.from("adicionales").insert(na);
        }
        await loadGrupos();
        setLoading(false);
    }

    async function handleDeleteGrupo(id: string) {
        if (!confirm("¿Eliminar este grupo y todos sus adicionales?")) return;
        await supabase.from("grupos_adicionales").delete().eq("id", id);
        setGrupos(grupos.filter(g => g.id !== id));
        if (grupoSeleccionado?.id === id) { setGrupoSeleccionado(null); setView("list"); }
    }

    function openEditor(g?: GrupoAdicional) {
        if (g) {
            setGrupoSeleccionado(g);
        } else {
            setGrupoSeleccionado({
                id: `temp-${Date.now()}`, sucursal_id: sucursalId,
                titulo: "", seleccion_obligatoria: false,
                seleccion_minima: 0, seleccion_maxima: 1, visible: true
            });
            setAdicionales([]);
        }
        setView("editor");
    }

    function handleSortAZ() {
        setAdicionales([...adicionales].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }

    function handleAddAdicional() {
        setAdicionales([...adicionales, {
            id: `temp-${Date.now()}`, grupo_id: grupoSeleccionado?.id || "",
            nombre: "", precio_venta: 0, precio_costo: 0,
            seleccion_maxima: 1, visible: true, stock: true,
            restaurar: false, vender_sin_stock: false
        }]);
    }

    function handleDuplicateAdicional(ad: Adicional) {
        setAdicionales([...adicionales, { ...ad, id: `temp-${Date.now()}`, nombre: `${ad.nombre} (copia)` }]);
    }

    async function handleSaveAll() {
        if (!grupoSeleccionado?.titulo.trim()) { alert("El título del grupo es obligatorio."); return; }
        setSaving(true);
        try {
            let gid = grupoSeleccionado.id;
            if (gid.startsWith("temp-")) {
                const { id, ...gd } = grupoSeleccionado;
                const { data, error } = await supabase.from("grupos_adicionales").insert(gd).select().single();
                if (error) throw error;
                gid = data.id;
            } else {
                const { error } = await supabase.from("grupos_adicionales").update(grupoSeleccionado).eq("id", gid);
                if (error) throw error;
            }
            for (const ad of adicionales) {
                if (ad.id.startsWith("temp-")) {
                    const { id, ...d } = ad;
                    await supabase.from("adicionales").insert({ ...d, grupo_id: gid });
                } else {
                    await supabase.from("adicionales").update(ad).eq("id", ad.id);
                }
            }
            alert("Cambios guardados correctamente");
            setView("list");
            loadGrupos();
        } catch (e: any) {
            console.error("Error saving:", e);
            alert("Error al guardar: " + (e.message || ""));
        } finally { setSaving(false); }
    }

    function margin(v: number, c: number) {
        if (!v || v === 0) return 0;
        return Math.round(((v - c) / v) * 100);
    }

    if (!isOpen) return null;

    /* ====== MAIN LIST VIEW ====== */
    if (view === "list") return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-bold text-gray-900">Adicionales</h2>
                    <button
                        onClick={() => openEditor()}
                        className="bg-gray-900 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-800 transition-colors"
                    >
                        Crear
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto">
                    {loading && grupos.length === 0 ? (
                        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Cargando...</div>
                    ) : grupos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-sm">
                            <p className="font-semibold text-gray-600 mb-1">No hay grupos creados</p>
                            <p>Creá tu primer grupo de modificadores.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    <th className="px-6 py-3 w-16">Visible</th>
                                    <th className="px-4 py-3">Título</th>
                                    <th className="px-4 py-3 text-right w-36">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grupos.map(g => (
                                    <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <button
                                                onClick={() => handleToggleGroupVisibility(g)}
                                                className={`w-10 h-5 rounded-full relative transition-colors ${g.visible ? 'bg-purple-600' : 'bg-gray-300'}`}
                                            >
                                                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${g.visible ? 'left-5' : 'left-0.5'}`} />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-gray-900">{g.titulo || "Sin título"}</div>
                                            <div className="text-xs text-gray-400">
                                                {counts[g.id] || 0} adicionales — Máx. {g.seleccion_maxima}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => openEditor(g)} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Editar">
                                                    <Edit3 size={16} />
                                                </button>
                                                <button onClick={() => handleDuplicateGrupo(g.id)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Duplicar">
                                                    <Copy size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteGrupo(g.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-100 flex justify-end shrink-0">
                    <button onClick={onClose} className="text-red-500 font-semibold text-sm hover:text-red-600 transition-colors">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );

    /* ====== EDITOR VIEW ====== */
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
                    <button onClick={() => setView("list")} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">
                        {grupoSeleccionado?.id.startsWith("temp-") ? "Nuevo grupo de adicionales" : "Editar grupo de adicionales"}
                    </h2>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                    {/* Group Config */}
                    <div className="space-y-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={grupoSeleccionado?.seleccion_obligatoria || false}
                                onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado!, seleccion_obligatoria: e.target.checked })}
                                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Selección obligatoria</span>
                        </label>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1 space-y-1">
                                <label className="text-xs text-gray-500 font-medium">Título del grupo</label>
                                <input
                                    type="text"
                                    value={grupoSeleccionado?.titulo || ""}
                                    onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado!, titulo: e.target.value })}
                                    placeholder="Ej: Salsas, Tamaño, Agregados"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 font-medium">Selección mínima</label>
                                <input
                                    type="number" min="0"
                                    value={grupoSeleccionado?.seleccion_minima ?? 0}
                                    onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado!, seleccion_minima: parseInt(e.target.value) || 0 })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 font-medium">Selección máxima</label>
                                <input
                                    type="number" min="1"
                                    value={grupoSeleccionado?.seleccion_maxima ?? 1}
                                    onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado!, seleccion_maxima: parseInt(e.target.value) || 1 })}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Sort button */}
                    <div className="flex justify-end">
                        <button onClick={handleSortAZ} className="text-xs text-purple-600 font-semibold hover:text-purple-800 transition-colors flex items-center gap-1">
                            <SortAsc size={14} /> Ordenar A-Z
                        </button>
                    </div>

                    {/* Items */}
                    <div className="space-y-4">
                        {adicionales.map((ad, idx) => {
                            const m = margin(ad.precio_venta, ad.precio_costo);
                            return (
                                <div key={ad.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 group/item hover:shadow-sm transition-all relative">
                                    {/* Row 1: Inputs */}
                                    <div className="grid grid-cols-4 gap-3">
                                        <div className="col-span-1 space-y-1">
                                            <label className="text-xs text-gray-400 font-medium">Nombre</label>
                                            <input
                                                type="text"
                                                value={ad.nombre}
                                                onChange={e => { const n = [...adicionales]; n[idx].nombre = e.target.value; setAdicionales(n); }}
                                                placeholder="Ej: Papas Fritas"
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-400 font-medium">Precio venta</label>
                                            <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
                                                <span className="text-gray-400 text-xs pl-3">$</span>
                                                <input
                                                    type="number" min="0"
                                                    value={ad.precio_venta}
                                                    onChange={e => { const n = [...adicionales]; n[idx].precio_venta = parseFloat(e.target.value) || 0; setAdicionales(n); }}
                                                    className="w-full border-none px-2 py-2 text-sm bg-transparent outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-400 font-medium">Precio costo</label>
                                            <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
                                                <span className="text-gray-400 text-xs pl-3">$</span>
                                                <input
                                                    type="number" min="0"
                                                    value={ad.precio_costo}
                                                    onChange={e => { const n = [...adicionales]; n[idx].precio_costo = parseFloat(e.target.value) || 0; setAdicionales(n); }}
                                                    className="w-full border-none px-2 py-2 text-sm bg-transparent outline-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-gray-400 font-medium">Selección máx.</label>
                                            <input
                                                type="number" min="1"
                                                value={ad.seleccion_maxima}
                                                onChange={e => { const n = [...adicionales]; n[idx].seleccion_maxima = parseInt(e.target.value) || 1; setAdicionales(n); }}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Row 2: Margin + Toggles + Delete */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Margin Badge */}
                                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${m >= 50 ? 'bg-green-100 text-green-700' : m > 0 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-600'}`}>
                                                {m}% {m >= 50 ? 'Margen óptimo' : m > 0 ? 'Margen bajo' : 'Sin margen'}
                                            </span>

                                            {/* Checkboxes */}
                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                                                <input type="checkbox" checked={ad.visible} onChange={() => { const n = [...adicionales]; n[idx].visible = !n[idx].visible; setAdicionales(n); }}
                                                    className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                                Visible
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                                                <input type="checkbox" checked={ad.stock} onChange={() => { const n = [...adicionales]; n[idx].stock = !n[idx].stock; setAdicionales(n); }}
                                                    className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                                Stock
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                                                <input type="checkbox" checked={ad.restaurar} onChange={() => { const n = [...adicionales]; n[idx].restaurar = !n[idx].restaurar; setAdicionales(n); }}
                                                    className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                                Restaurar
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
                                                <input type="checkbox" checked={ad.vender_sin_stock} onChange={() => { const n = [...adicionales]; n[idx].vender_sin_stock = !n[idx].vender_sin_stock; setAdicionales(n); }}
                                                    className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                                Vender sin stock
                                            </label>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button onClick={() => handleDuplicateAdicional(ad)} className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Duplicar">
                                                <Copy size={15} />
                                            </button>
                                            <button onClick={() => setAdicionales(adicionales.filter((_, i) => i !== idx))} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Add New Button */}
                        <button
                            onClick={handleAddAdicional}
                            className="w-full py-3 border-2 border-dashed border-purple-200 rounded-xl text-purple-600 font-semibold text-sm hover:bg-purple-50 hover:border-purple-300 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Agregar nuevo adicional
                        </button>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Product association placeholder */}
                    <div className="space-y-2">
                        <label className="text-xs text-gray-500 font-medium">Disponible en productos</label>
                        <div className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-400 bg-gray-50 cursor-not-allowed">
                            Seleccionar productos o categorías (asignación disponible desde el editor de productos)
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-gray-50/30">
                    <button onClick={() => setView("list")} className="text-red-500 font-semibold text-sm hover:text-red-600 transition-colors px-4 py-2">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSaveAll}
                        disabled={saving}
                        className="bg-gray-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400 flex items-center gap-2"
                    >
                        {saving && <RefreshCw size={14} className="animate-spin" />}
                        {saving ? "Guardando..." : grupoSeleccionado?.id.startsWith("temp-") ? "Guardar" : "Actualizar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
