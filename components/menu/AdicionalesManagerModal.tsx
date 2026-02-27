"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Plus, Trash2, GripVertical, Save, Eye, EyeOff, Copy, Edit3, SortAsc, Info, ChevronLeft, RefreshCw } from "lucide-react";

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
        if (isOpen) {
            loadGrupos();
            setView("list");
        }
    }, [isOpen]);

    useEffect(() => {
        if (grupoSeleccionado && view === "editor") {
            loadAdicionales(grupoSeleccionado.id);
        }
    }, [grupoSeleccionado, view]);

    async function loadGrupos() {
        setLoading(true);
        try {
            const { data: gs } = await supabase
                .from("grupos_adicionales")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .order("created_at", { ascending: false });

            setGrupos(gs || []);

            // Load counts of adicionales for each group
            const { data: ads } = await supabase
                .from("adicionales")
                .select("grupo_id");

            const newCounts: Record<string, number> = {};
            ads?.forEach(a => {
                newCounts[a.grupo_id] = (newCounts[a.grupo_id] || 0) + 1;
            });
            setCounts(newCounts);
        } catch (error) {
            console.error("Error loading groups:", error);
        } finally {
            setLoading(false);
        }
    }

    async function loadAdicionales(grupoId: string) {
        if (grupoId.startsWith("temp-")) {
            setAdicionales([]);
            return;
        }
        setLoading(true);
        try {
            const { data } = await supabase
                .from("adicionales")
                .select("*")
                .eq("grupo_id", grupoId)
                .order("created_at", { ascending: true });
            setAdicionales(data || []);
        } catch (error) {
            console.error("Error loading adicionales:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleToggleGroupVisibility(grupo: GrupoAdicional) {
        const newVal = !grupo.visible;
        // Optimistic update
        setGrupos(grupos.map(g => g.id === grupo.id ? { ...g, visible: newVal } : g));

        const { error } = await supabase
            .from("grupos_adicionales")
            .update({ visible: newVal })
            .eq("id", grupo.id);

        if (error) {
            alert("Error al actualizar visibilidad");
            loadGrupos();
        }
    }

    async function handleDuplicateGrupo(id: string) {
        try {
            setLoading(true);
            // 1. Get original group
            const { data: original } = await supabase.from("grupos_adicionales").select("*").eq("id", id).single();
            if (!original) return;

            // 2. Create new group
            const { id: _, created_at, updated_at, ...gData } = original;
            const { data: newG, error: gError } = await supabase
                .from("grupos_adicionales")
                .insert({ ...gData, titulo: `${original.titulo} (copia)` })
                .select()
                .single();

            if (gError) throw gError;

            // 3. Get original adicionales
            const { data: ads } = await supabase.from("adicionales").select("*").eq("grupo_id", id);

            if (ads && ads.length > 0) {
                const newAds = ads.map(a => {
                    const { id: __, created_at: ___, updated_at: ____, ...aData } = a;
                    return { ...aData, grupo_id: newG.id };
                });
                await supabase.from("adicionales").insert(newAds);
            }

            await loadGrupos();
            alert("Grupo duplicado con éxito");
        } catch (error) {
            console.error("Error duplicating group:", error);
            alert("Error al duplicar");
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteGrupo(id: string) {
        if (!confirm("¿Eliminar este grupo y todos sus adicionales?")) return;
        try {
            setLoading(true);
            await supabase.from("grupos_adicionales").delete().eq("id", id);
            setGrupos(grupos.filter(g => g.id !== id));
            if (grupoSeleccionado?.id === id) setGrupoSeleccionado(null);
            setView("list");
        } catch (error) {
            console.error("Error deleting group:", error);
        } finally {
            setLoading(false);
        }
    }

    function handleCreateNewGroup() {
        const newG: GrupoAdicional = {
            id: `temp-${Date.now()}`,
            sucursal_id: sucursalId,
            titulo: "",
            seleccion_obligatoria: false,
            seleccion_minima: 0,
            seleccion_maxima: 1,
            visible: true
        };
        setGrupoSeleccionado(newG);
        setAdicionales([]);
        setView("editor");
    }

    function handleEditGroup(grupo: GrupoAdicional) {
        setGrupoSeleccionado(grupo);
        setView("editor");
    }

    function handleSortAZ() {
        const sorted = [...adicionales].sort((a, b) => a.nombre.localeCompare(b.nombre));
        setAdicionales(sorted);
    }

    function handleAddAdicional() {
        const newA: Adicional = {
            id: `temp-${Date.now()}`,
            grupo_id: grupoSeleccionado?.id || "",
            nombre: "",
            precio_venta: 0,
            precio_costo: 0,
            seleccion_maxima: 1,
            visible: true,
            stock: true,
            restaurar: false,
            vender_sin_stock: false
        };
        setAdicionales([...adicionales, newA]);
    }

    function handleDuplicateAdicional(ad: Adicional) {
        const newA: Adicional = {
            ...ad,
            id: `temp-${Date.now()}`,
            nombre: `${ad.nombre} (copia)`
        };
        setAdicionales([...adicionales, newA]);
    }

    async function handleSaveAll() {
        if (!grupoSeleccionado || !grupoSeleccionado.titulo.trim()) {
            alert("El título del grupo es obligatorio.");
            return;
        }

        setSaving(true);
        try {
            let groupId = grupoSeleccionado.id;

            // 1. Save Group
            if (groupId.startsWith("temp-")) {
                const { id, ...gData } = grupoSeleccionado;
                const { data, error } = await supabase.from("grupos_adicionales").insert(gData).select().single();
                if (error) throw error;
                groupId = data.id;
            } else {
                const { error } = await supabase.from("grupos_adicionales").update(grupoSeleccionado).eq("id", groupId);
                if (error) throw error;
            }

            // 2. Save Adicionales
            for (const ad of adicionales) {
                if (ad.id.startsWith("temp-")) {
                    const { id, ...aData } = ad;
                    await supabase.from("adicionales").insert({ ...aData, grupo_id: groupId });
                } else {
                    await supabase.from("adicionales").update(ad).eq("id", ad.id);
                }
            }

            alert("Cambios guardados correctamente");
            setView("list");
            loadGrupos();
        } catch (error) {
            console.error("Error saving:", error);
            alert("Error al guardar");
        } finally {
            setSaving(false);
        }
    }

    function calculateMargin(venta: number, costo: number) {
        if (!venta || venta === 0) return 0;
        return Math.round(((venta - costo) / venta) * 100);
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-white/20">

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/50 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        {view === "editor" && (
                            <button
                                onClick={() => setView("list")}
                                className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400 transition-all hover:text-slate-900 active:scale-90"
                            >
                                <ChevronLeft size={24} strokeWidth={2.5} />
                            </button>
                        )}
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                {view === "list" ? "Grupos de Adicionales" : (grupoSeleccionado?.id.startsWith("temp-") ? "Nuevo Grupo" : "Editar Grupo")}
                            </h2>
                            <p className="text-sm font-medium text-slate-400">
                                {view === "list" ? "Gestioná modificadores y extras de tu menú" : grupoSeleccionado?.titulo || "Configurando grupo..."}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {view === "list" && (
                            <button
                                onClick={handleCreateNewGroup}
                                className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                            >
                                <Plus size={20} strokeWidth={3} />
                                Crear Grupo
                            </button>
                        )}
                        <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-300 transition-all hover:text-slate-600">
                            <X size={24} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">

                    {view === "list" ? (
                        <div className="flex-1 overflow-y-auto p-8">
                            {loading && grupos.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center space-y-4">
                                    <RefreshCw className="animate-spin text-purple-500" size={32} />
                                    <p className="text-slate-400 font-bold animate-pulse">Cargando grupos...</p>
                                </div>
                            ) : grupos.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                                    <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-slate-200">
                                        <Plus size={48} />
                                    </div>
                                    <div className="max-w-xs">
                                        <h3 className="text-xl font-black text-slate-900 mb-2">No hay grupos creados</h3>
                                        <p className="text-sm text-slate-400 font-medium">Comenzá creando tu primer grupo de modificadores para tus productos.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 gap-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        <div className="col-span-1">Visible</div>
                                        <div className="col-span-7">Título del Grupo</div>
                                        <div className="col-span-4 text-right">Acciones</div>
                                    </div>

                                    {grupos.map((g) => (
                                        <div key={g.id} className="grid grid-cols-12 gap-4 items-center bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-purple-500/5 transition-all group">
                                            <div className="col-span-1">
                                                <button
                                                    onClick={() => handleToggleGroupVisibility(g)}
                                                    className={`w-12 h-6 rounded-full transition-all relative ${g.visible ? 'bg-purple-600 shadow-inner' : 'bg-slate-200'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-all ${g.visible ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>
                                            <div className="col-span-7 flex flex-col">
                                                <span className="font-black text-slate-900 text-lg tracking-tight group-hover:text-purple-600 transition-colors uppercase">
                                                    {g.titulo || "Sin título"}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                                        {counts[g.id] || 0} Adicionales
                                                    </span>
                                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${g.seleccion_obligatoria ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                                                        {g.seleccion_obligatoria ? `Obligatorio (mín ${g.seleccion_minima})` : 'Opcional'}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-lg">
                                                        Máx {g.seleccion_maxima}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="col-span-4 flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditGroup(g)}
                                                    className="p-3 bg-slate-50 text-slate-400 hover:bg-purple-50 hover:text-purple-600 rounded-2xl transition-all active:scale-90"
                                                    title="Editar"
                                                >
                                                    <Edit3 size={20} strokeWidth={2.5} />
                                                </button>
                                                <button
                                                    onClick={() => handleDuplicateGrupo(g.id)}
                                                    className="p-3 bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-2xl transition-all active:scale-90"
                                                    title="Duplicar"
                                                >
                                                    <Copy size={20} strokeWidth={2.5} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteGrupo(g.id)}
                                                    className="p-3 bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 rounded-2xl transition-all active:scale-90"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={20} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Editor Body */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-8">

                                {/* Section 1: Definition */}
                                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-8">
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-5">
                                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                                            <Info size={20} strokeWidth={3} />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Definición del Grupo</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Selección Obligatoria</label>
                                                <button
                                                    onClick={() => setGrupoSeleccionado({ ...grupoSeleccionado!, seleccion_obligatoria: !grupoSeleccionado?.seleccion_obligatoria })}
                                                    className={`w-12 h-6 rounded-full transition-all relative ${grupoSeleccionado?.seleccion_obligatoria ? 'bg-purple-600 shadow-inner' : 'bg-slate-200'}`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-all ${grupoSeleccionado?.seleccion_obligatoria ? 'left-7' : 'left-1'}`} />
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Título del Grupo</label>
                                                <input
                                                    type="text"
                                                    value={grupoSeleccionado?.titulo}
                                                    onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado!, titulo: e.target.value })}
                                                    placeholder="Ej: Elegí tus sabores, Agregados extras..."
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none transition-all placeholder:text-slate-300"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Selección Mín.</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={grupoSeleccionado?.seleccion_minima}
                                                    onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado!, seleccion_minima: parseInt(e.target.value) || 0 })}
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl px-5 py-4 font-black text-slate-900 text-center outline-none transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Selección Máx.</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={grupoSeleccionado?.seleccion_maxima}
                                                    onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado!, seleccion_maxima: parseInt(e.target.value) || 1 })}
                                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl px-5 py-4 font-black text-slate-900 text-center outline-none transition-all"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Items */}
                                <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 space-y-6">
                                    <div className="flex items-center justify-between border-b border-slate-50 pb-5">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                                <GripVertical size={20} strokeWidth={3} />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Listado de Adicionales</h3>
                                        </div>
                                        <button
                                            onClick={handleSortAZ}
                                            className="flex items-center gap-2 bg-slate-50 text-slate-500 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-100 transition-all active:scale-95 border border-slate-100"
                                        >
                                            <SortAsc size={16} strokeWidth={3} />
                                            Ordenar A-Z
                                        </button>
                                    </div>

                                    {/* Items Table */}
                                    <div className="space-y-4">
                                        {/* Table Header */}
                                        <div className="grid grid-cols-12 gap-3 px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">
                                            <div className="col-span-1 text-center">Orden</div>
                                            <div className="col-span-3">Nombre</div>
                                            <div className="col-span-1 text-center">Venta</div>
                                            <div className="col-span-1 text-center">Costo</div>
                                            <div className="col-span-1 text-center">Margen</div>
                                            <div className="col-span-1 text-center">S.Máx</div>
                                            <div className="col-span-3 text-center">Configuraciones</div>
                                            <div className="col-span-1 text-right">Acción</div>
                                        </div>

                                        {adicionales.map((ad, idx) => {
                                            const marg = calculateMargin(ad.precio_venta, ad.precio_costo);
                                            return (
                                                <div key={ad.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50/50 p-3 rounded-2xl border border-slate-100 hover:border-purple-200 transition-all group">
                                                    <div className="col-span-1 flex justify-center text-slate-300 cursor-grab hover:text-purple-400 active:cursor-grabbing">
                                                        <GripVertical size={18} />
                                                    </div>
                                                    <div className="col-span-3 relative">
                                                        <input
                                                            type="text"
                                                            value={ad.nombre}
                                                            onChange={e => {
                                                                const newAds = [...adicionales];
                                                                newAds[idx].nombre = e.target.value;
                                                                setAdicionales(newAds);
                                                            }}
                                                            placeholder="Nombre del ítem"
                                                            className="w-full bg-white border-2 border-transparent focus:border-purple-400 rounded-xl px-3 py-2 font-bold text-slate-900 text-sm outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="col-span-1">
                                                        <div className="relative group/price">
                                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">$</span>
                                                            <input
                                                                type="number"
                                                                value={ad.precio_venta}
                                                                onChange={e => {
                                                                    const newAds = [...adicionales];
                                                                    newAds[idx].precio_venta = parseFloat(e.target.value) || 0;
                                                                    setAdicionales(newAds);
                                                                }}
                                                                className="w-full bg-white border-2 border-transparent focus:border-purple-400 rounded-xl pl-5 pr-2 py-2 font-black text-slate-900 text-sm text-center outline-none transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="col-span-1">
                                                        <input
                                                            type="number"
                                                            value={ad.precio_costo}
                                                            onChange={e => {
                                                                const newAds = [...adicionales];
                                                                newAds[idx].precio_costo = parseFloat(e.target.value) || 0;
                                                                setAdicionales(newAds);
                                                            }}
                                                            className="w-full bg-white border-2 border-transparent focus:border-purple-400 rounded-xl px-2 py-2 font-black text-slate-400 text-sm text-center outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="col-span-1 text-center">
                                                        <div className="flex flex-col items-center">
                                                            <span className={`text-[10px] font-black ${marg > 30 ? 'text-green-500' : marg > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                                                                {marg}%
                                                            </span>
                                                            <span className="text-[7px] font-bold text-slate-300 uppercase tracking-tighter">Margen</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-1">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={ad.seleccion_maxima}
                                                            onChange={e => {
                                                                const newAds = [...adicionales];
                                                                newAds[idx].seleccion_maxima = parseInt(e.target.value) || 1;
                                                                setAdicionales(newAds);
                                                            }}
                                                            className="w-full bg-white border-2 border-transparent focus:border-purple-400 rounded-xl px-2 py-2 font-black text-slate-900 text-sm text-center outline-none transition-all"
                                                        />
                                                    </div>
                                                    <div className="col-span-3 flex justify-center gap-2">
                                                        <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-xl border border-slate-100">
                                                            <button
                                                                onClick={() => {
                                                                    const n = [...adicionales];
                                                                    n[idx].visible = !n[idx].visible;
                                                                    setAdicionales(n);
                                                                }}
                                                                className={`p-1 rounded-lg transition-all ${ad.visible ? 'text-slate-200 hover:text-purple-600' : 'text-purple-600 bg-purple-50'}`}
                                                                title="Visible"
                                                            >
                                                                <Eye size={14} strokeWidth={3} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const n = [...adicionales];
                                                                    n[idx].stock = !n[idx].stock;
                                                                    setAdicionales(n);
                                                                }}
                                                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all ${ad.stock ? 'text-slate-200 hover:text-green-600' : 'text-red-600 bg-red-50'}`}
                                                            >
                                                                {ad.stock ? 'Stock' : 'Sin Stock'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const n = [...adicionales];
                                                                    n[idx].restaurar = !n[idx].restaurar;
                                                                    setAdicionales(n);
                                                                }}
                                                                className={`p-1 rounded-lg transition-all ${!ad.restaurar ? 'text-slate-200 hover:text-blue-600' : 'text-blue-600 bg-blue-50'}`}
                                                                title="Restaurar stock diariamente"
                                                            >
                                                                <RefreshCw size={14} strokeWidth={3} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-1 flex justify-end gap-1">
                                                        <button
                                                            onClick={() => handleDuplicateAdicional(ad)}
                                                            className="p-2 text-slate-200 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                                            title="Duplicar ítem"
                                                        >
                                                            <Copy size={16} strokeWidth={2.5} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const n = adicionales.filter((_, i) => i !== idx);
                                                                setAdicionales(n);
                                                            }}
                                                            className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                        >
                                                            <Trash2 size={16} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        <button
                                            onClick={handleAddAdicional}
                                            className="w-full py-4 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 font-black text-sm uppercase tracking-widest hover:border-purple-200 hover:text-purple-400 hover:bg-purple-50/10 transition-all flex items-center justify-center gap-2 group/add"
                                        >
                                            <Plus size={20} strokeWidth={3} className="group-hover/add:scale-125 transition-transform" />
                                            Agregar nuevo adicional
                                        </button>
                                    </div>
                                </div>

                                {/* Placeholder for Association */}
                                <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl shadow-slate-950/20 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-white/10 text-white rounded-2xl">
                                            <Edit3 size={20} strokeWidth={3} />
                                        </div>
                                        <h3 className="text-xl font-black text-white tracking-tight">Disponible en productos</h3>
                                    </div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Podrás asignar este grupo desde la lista de productos principal.</p>
                                </div>
                            </div>

                            {/* Sticky Footer */}
                            <div className="px-8 py-6 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0">
                                <button
                                    onClick={() => setView("list")}
                                    className="px-8 py-4 rounded-[1.5rem] font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveAll}
                                    disabled={saving}
                                    className="bg-purple-600 text-white px-12 py-4 rounded-[1.5rem] font-black text-lg shadow-2xl shadow-purple-500/30 hover:bg-purple-700 transition-all flex items-center gap-3 disabled:bg-slate-200 disabled:shadow-none active:scale-95"
                                >
                                    {saving && <RefreshCw size={20} className="animate-spin" />}
                                    {saving ? "Guardando..." : "Guardar Grupo Completo"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
