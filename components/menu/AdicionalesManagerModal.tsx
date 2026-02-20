"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Plus, Trash2, GripVertical, Save, Eye, EyeOff } from "lucide-react";

type GrupoAdicional = {
    id: string;
    sucursal_id: string;
    titulo: string;
    seleccion_obligatoria: boolean;
    seleccion_minima: number;
    seleccion_maxima: number;
};

type Adicional = {
    id: string;
    grupo_id: string;
    nombre: string;
    precio_venta: number;
    precio_costo: number;
    seleccion_maxima: number;
    visible: boolean;
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
    const [grupos, setGrupos] = useState<GrupoAdicional[]>([]);
    const [grupoSeleccionado, setGrupoSeleccionado] = useState<GrupoAdicional | null>(null);
    const [adicionales, setAdicionales] = useState<Adicional[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadGrupos();
        }
    }, [isOpen]);

    useEffect(() => {
        if (grupoSeleccionado) {
            loadAdicionales(grupoSeleccionado.id);
        } else {
            setAdicionales([]);
        }
    }, [grupoSeleccionado]);

    async function loadGrupos() {
        setLoading(true);
        const { data } = await supabase
            .from("grupos_adicionales")
            .select("*")
            .eq("sucursal_id", sucursalId)
            .order("created_at", { ascending: false });

        setGrupos(data || []);
        if (data && data.length > 0 && !grupoSeleccionado) {
            setGrupoSeleccionado(data[0]);
        }
        setLoading(false);
    }

    async function loadAdicionales(grupoId: string) {
        // Only load if it's a real group (not a newly created 'new-' id)
        if (grupoId.startsWith("new-")) {
            setAdicionales([]);
            return;
        }

        const { data } = await supabase
            .from("adicionales")
            .select("*")
            .eq("grupo_id", grupoId)
            .order("created_at", { ascending: true });

        setAdicionales(data || []);
    }

    async function handleCreateGrupo() {
        // Create optimistically in UI, save on 'Guardar cambios'
        const newGroup: GrupoAdicional = {
            id: `new-${Date.now()}`,
            sucursal_id: sucursalId,
            titulo: "Nuevo Grupo Extra",
            seleccion_obligatoria: false,
            seleccion_minima: 0,
            seleccion_maxima: 1
        };
        setGrupos([newGroup, ...grupos]);
        setGrupoSeleccionado(newGroup);
        setAdicionales([]);
    }

    async function handleSaveGrupo() {
        if (!grupoSeleccionado || !grupoSeleccionado.titulo.trim()) {
            alert("El título del grupo es obligatorio.");
            return;
        }

        try {
            setLoading(true);
            let realGroupId = grupoSeleccionado.id;

            // 1. Guardar Grupo
            if (grupoSeleccionado.id.startsWith("new-")) {
                const { id, ...gData } = grupoSeleccionado;
                const { data, error } = await supabase
                    .from("grupos_adicionales")
                    .insert([gData])
                    .select()
                    .single();

                if (error) throw error;
                realGroupId = data.id;
            } else {
                const { error } = await supabase
                    .from("grupos_adicionales")
                    .update(grupoSeleccionado)
                    .eq("id", grupoSeleccionado.id);
                if (error) throw error;
            }

            // 2. Guardar Adicionales
            for (const opt of adicionales) {
                const { id, grupo_id, ...optData } = opt;
                if (id.startsWith("new-")) {
                    await supabase.from("adicionales").insert([{ ...optData, grupo_id: realGroupId }]);
                } else {
                    await supabase.from("adicionales").update(optData).eq("id", id);
                }
            }

            alert("Cambios guardados con éxito.");

            // Recargar todo fresco
            const { data: updatedGrupos } = await supabase
                .from("grupos_adicionales")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .order("created_at", { ascending: false });

            setGrupos(updatedGrupos || []);
            const updatedGroup = updatedGrupos?.find(g => g.id === realGroupId);
            if (updatedGroup) {
                setGrupoSeleccionado(updatedGroup);
            }
        } catch (error: any) {
            console.error("Error guardando:", error);
            alert("Error al guardar: Asegurate de haber corrido en el SQL la migración apply-006");
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteGrupo(id: string) {
        if (!confirm("¿Eliminar este grupo y todos sus adicionales?")) return;

        if (!id.startsWith("new-")) {
            await supabase.from("grupos_adicionales").delete().eq("id", id);
        }

        setGrupos(grupos.filter(g => g.id !== id));
        setGrupoSeleccionado(null);
    }

    function handleAddAdicional() {
        const newOpt: Adicional = {
            id: `new-${Date.now()}`,
            grupo_id: grupoSeleccionado?.id || "",
            nombre: "",
            precio_venta: 0,
            precio_costo: 0,
            seleccion_maxima: 1,
            visible: true
        };
        setAdicionales([...adicionales, newOpt]);
    }

    async function handleDeleteAdicional(id: string) {
        if (!id.startsWith("new-")) {
            if (!confirm("¿Eliminar este adicional permanentemente?")) return;
            await supabase.from("adicionales").delete().eq("id", id);
        }
        setAdicionales(adicionales.filter(a => a.id !== id));
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Configuración de Adicionales</h2>
                        <p className="text-sm text-gray-500">Creá modificadores, extras y guarniciones para atar a tus productos.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Groups List */}
                    <div className="w-1/3 border-r border-gray-100 flex flex-col bg-white">
                        <div className="p-4 border-b border-gray-50 shrink-0">
                            <button
                                onClick={handleCreateGrupo}
                                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
                            >
                                <Plus size={16} /> Crear Grupo de Extras
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-gray-50/50">
                            {grupos.length === 0 && !loading && (
                                <div className="text-center py-10 text-xs text-gray-400 italic">No hay grupos creados.</div>
                            )}
                            {grupos.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => setGrupoSeleccionado(g)}
                                    className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${grupoSeleccionado?.id === g.id
                                        ? "bg-white border-purple-200 shadow-sm"
                                        : "border-transparent hover:bg-white hover:border-gray-200"
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`font-bold truncate ${grupoSeleccionado?.id === g.id ? 'text-purple-700' : 'text-gray-700'}`}>
                                            {g.titulo || "Sin título"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider">
                                        {g.seleccion_obligatoria
                                            ? <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Requerido</span>
                                            : <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Opcional</span>}
                                        <span className="text-gray-400">Máx {g.seleccion_maxima}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Group Editor */}
                    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden relative">
                        {loading && <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">Cargando...</div>}

                        {grupoSeleccionado ? (
                            <>
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Configuración del grupo */}
                                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-5">
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                            <h3 className="font-bold text-gray-900 text-lg">Definición del Grupo</h3>
                                            <button
                                                onClick={() => handleDeleteGrupo(grupoSeleccionado.id)}
                                                className="text-red-500 hover:text-red-600 transition-colors bg-red-50 p-2 rounded-lg"
                                                title="Eliminar Grupo"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="grid gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Título a mostrar al cliente</label>
                                                <input
                                                    type="text"
                                                    value={grupoSeleccionado.titulo}
                                                    onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado, titulo: e.target.value })}
                                                    className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                                    placeholder="Ej: Elegí tus sabores de empanadas"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 pt-2">
                                                <div className="space-y-3">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">¿Es Obligatorio?</label>
                                                    <label className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={`w-10 h-6 rounded-full transition-colors relative ${grupoSeleccionado.seleccion_obligatoria ? 'bg-purple-600' : 'bg-gray-300'}`}>
                                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${grupoSeleccionado.seleccion_obligatoria ? 'left-5' : 'left-1'}`} />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                                                            {grupoSeleccionado.seleccion_obligatoria ? 'Sí, el cliente debe elegir' : 'No, es opcional'}
                                                        </span>
                                                        {/* Hidden checkbox to keep standard HTML bind logic if needed */}
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={grupoSeleccionado.seleccion_obligatoria}
                                                            onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado, seleccion_obligatoria: e.target.checked })}
                                                        />
                                                    </label>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Selección Mín.</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={grupoSeleccionado.seleccion_minima}
                                                                onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado, seleccion_minima: parseInt(e.target.value) || 0 })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-center"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Selección Máx.</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={grupoSeleccionado.seleccion_maxima}
                                                                onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado, seleccion_maxima: parseInt(e.target.value) || 1 })}
                                                                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-center"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Adicionales Hijos */}
                                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                            <h3 className="font-bold text-gray-900 text-lg">Ítems Disponibles ({adicionales.length})</h3>
                                            <button
                                                onClick={handleAddAdicional}
                                                className="bg-purple-50 text-purple-700 hover:bg-purple-100 text-sm font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                            >
                                                <Plus size={16} /> Añadir Ítem
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {adicionales.length === 0 ? (
                                                <div className="text-center py-6 text-sm text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                                    Agregá las opciones que aparecerán dentro de este grupo.
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-12 gap-3 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                    <div className="col-span-1"></div>
                                                    <div className="col-span-5">Nombre</div>
                                                    <div className="col-span-2 text-center">Precio Extra</div>
                                                    <div className="col-span-2 text-center">Máx Ítem</div>
                                                    <div className="col-span-2 text-center">Acciones</div>
                                                </div>
                                            )}

                                            {adicionales.map((opt, idx) => (
                                                <div key={opt.id} className={`grid grid-cols-12 gap-3 items-center bg-white border rounded-xl px-2 py-2 group transition-all ${opt.visible ? 'border-gray-200 shadow-sm' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                                                    <div className="col-span-1 flex justify-center text-gray-300 cursor-grab hover:text-gray-500">
                                                        <GripVertical size={16} />
                                                    </div>

                                                    <div className="col-span-5 relative">
                                                        <input
                                                            type="text"
                                                            value={opt.nombre}
                                                            onChange={e => {
                                                                const newOpciones = [...adicionales];
                                                                newOpciones[idx].nombre = e.target.value;
                                                                setAdicionales(newOpciones);
                                                            }}
                                                            className={`w-full bg-transparent outline-none text-sm font-medium px-2 py-1.5 focus:bg-gray-50 rounded ${!opt.visible && 'text-gray-400 line-through'}`}
                                                            placeholder="Ej: Papas Fritas"
                                                        />
                                                    </div>

                                                    <div className="col-span-2 flex items-center bg-gray-50 rounded-lg px-2 border border-gray-100 focus-within:border-purple-300">
                                                        <span className="text-gray-400 text-xs">$</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={opt.precio_venta}
                                                            onChange={e => {
                                                                const newOpciones = [...adicionales];
                                                                newOpciones[idx].precio_venta = parseFloat(e.target.value) || 0;
                                                                setAdicionales(newOpciones);
                                                            }}
                                                            className="w-full bg-transparent border-none outline-none text-sm text-gray-900 text-center py-1.5"
                                                        />
                                                    </div>

                                                    <div className="col-span-2 px-2">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            title="Máxima cantidad que un cliente puede pedir de este mismo ítem"
                                                            value={opt.seleccion_maxima}
                                                            onChange={e => {
                                                                const newOpciones = [...adicionales];
                                                                newOpciones[idx].seleccion_maxima = parseInt(e.target.value) || 1;
                                                                setAdicionales(newOpciones);
                                                            }}
                                                            className="w-full bg-gray-50 border border-gray-100 rounded-lg outline-none text-sm text-gray-900 text-center py-1.5"
                                                        />
                                                    </div>

                                                    <div className="col-span-2 flex justify-center gap-1">
                                                        <button
                                                            onClick={() => {
                                                                const newOpciones = [...adicionales];
                                                                newOpciones[idx].visible = !newOpciones[idx].visible;
                                                                setAdicionales(newOpciones);
                                                            }}
                                                            className={`p-1.5 rounded-lg transition-colors ${opt.visible ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-100' : 'text-blue-500 bg-blue-50 hover:bg-blue-100'}`}
                                                            title={opt.visible ? "Ocultar" : "Mostrar"}
                                                        >
                                                            {opt.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteAdicional(opt.id)}
                                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Sticky Action */}
                                <div className="p-5 bg-white border-t border-gray-200 flex justify-end shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
                                    <button
                                        onClick={handleSaveGrupo}
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-purple-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-md disabled:bg-purple-400"
                                    >
                                        <Save size={18} /> {loading ? "Guardando..." : "Guardar Grupo Completo"}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-10 text-center">
                                <div className="bg-white border border-gray-100 shadow-sm p-4 rounded-full mb-4 text-gray-300">
                                    <Plus size={32} />
                                </div>
                                <h3 className="text-gray-800 font-bold mb-1">Ningún grupo seleccionado</h3>
                                <p className="text-sm">Elegí un grupo a la izquierda para editar sus modificadores y precios, o creá uno nuevo.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
