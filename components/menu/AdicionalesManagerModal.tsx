"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Plus, Trash2, GripVertical, Save } from "lucide-react";

type GrupoAdicional = {
    id: string;
    nombre: string;
    tipo_seleccion: string;
    minimo: number;
    maximo?: number;
    obligatorio: boolean;
    sucursal_id: string;
};

type OpcionAdicional = {
    id: string;
    grupo_id: string;
    nombre: string;
    precio_adicional: number;
    activo: boolean;
    orden: number;
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
    const [opciones, setOpciones] = useState<OpcionAdicional[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadGrupos();
        }
    }, [isOpen]);

    useEffect(() => {
        if (grupoSeleccionado) {
            loadOpciones(grupoSeleccionado.id);
        } else {
            setOpciones([]);
        }
    }, [grupoSeleccionado]);

    async function loadGrupos() {
        setLoading(true);
        const { data } = await supabase
            .from("grupos_adicionales")
            .select("*")
            .eq("sucursal_id", sucursalId)
            .order("orden");
        setGrupos(data || []);
        if (data && data.length > 0 && !grupoSeleccionado) {
            setGrupoSeleccionado(data[0]);
        }
        setLoading(false);
    }

    async function loadOpciones(grupoId: string) {
        const { data } = await supabase
            .from("opciones_adicional")
            .select("*")
            .eq("grupo_id", grupoId)
            .order("orden");
        setOpciones(data || []);
    }

    async function handleCreateGrupo() {
        const { data, error } = await supabase
            .from("grupos_adicionales")
            .insert([{
                sucursal_id: sucursalId,
                nombre: "Nuevo grupo",
                tipo_seleccion: "multiple",
                minimo: 0,
                obligatorio: false
            }])
            .select()
            .single();

        if (data) {
            setGrupos([...grupos, data]);
            setGrupoSeleccionado(data);
        }
    }

    async function handleSaveGrupo() {
        if (!grupoSeleccionado) return;
        await supabase.from("grupos_adicionales").update(grupoSeleccionado).eq("id", grupoSeleccionado.id);
        // Save options too
        for (const opt of opciones) {
            const { id, created_at, updated_at, ...optData } = opt as any;
            if (id.startsWith("new-")) {
                await supabase.from("opciones_adicional").insert([{ ...optData, grupo_id: grupoSeleccionado.id }]);
            } else {
                await supabase.from("opciones_adicional").update(optData).eq("id", id);
            }
        }
        alert("Cambios guardados");
        loadGrupos();
    }

    async function handleDeleteGrupo(id: string) {
        if (!confirm("¿Eliminar este grupo y todas sus opciones?")) return;
        await supabase.from("grupos_adicionales").delete().eq("id", id);
        setGrupos(grupos.filter(g => g.id !== id));
        setGrupoSeleccionado(null);
    }

    async function handleAddOpcion() {
        const newOpt: OpcionAdicional = {
            id: `new-${Date.now()}`,
            grupo_id: grupoSeleccionado?.id || "",
            nombre: "",
            precio_adicional: 0,
            activo: true,
            orden: opciones.length
        };
        setOpciones([...opciones, newOpt]);
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Grupos de Adicionales</h2>
                        <p className="text-sm text-gray-500">Configura modificadores para tus productos (ej: Salsas, Extras)</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Groups List */}
                    <div className="w-1/3 border-r border-gray-100 flex flex-col">
                        <div className="p-4 border-b border-gray-50">
                            <button
                                onClick={handleCreateGrupo}
                                className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                            >
                                <Plus size={16} /> Nuevo grupo
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {grupos.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => setGrupoSeleccionado(g)}
                                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${grupoSeleccionado?.id === g.id
                                            ? "bg-purple-100 text-purple-700 font-bold"
                                            : "text-gray-600 hover:bg-gray-50"
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="truncate">{g.nombre}</span>
                                        <span className="text-[10px] uppercase font-bold opacity-60">{g.tipo_seleccion}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right: Group Editor */}
                    <div className="flex-1 flex flex-col bg-gray-50/50">
                        {grupoSeleccionado ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Configuración del grupo */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-gray-900">Configuración del grupo</h3>
                                        <button
                                            onClick={() => handleDeleteGrupo(grupoSeleccionado.id)}
                                            className="text-red-500 hover:text-red-600 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 focus-within:border-purple-500">
                                            <legend className="text-[10px] text-gray-500 px-1 font-bold">NOMBRE DEL GRUPO</legend>
                                            <input
                                                type="text"
                                                value={grupoSeleccionado.nombre}
                                                onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado, nombre: e.target.value })}
                                                className="w-full bg-transparent outline-none text-sm text-gray-900"
                                                placeholder="Ej: Elegí tu salsa"
                                            />
                                        </fieldset>
                                        <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 focus-within:border-purple-500">
                                            <legend className="text-[10px] text-gray-500 px-1 font-bold">TIPO SELECCIÓN</legend>
                                            <select
                                                value={grupoSeleccionado.tipo_seleccion}
                                                onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado, tipo_seleccion: e.target.value })}
                                                className="w-full bg-transparent outline-none text-sm text-gray-900 cursor-pointer"
                                            >
                                                <option value="unico">Único (Radio)</option>
                                                <option value="multiple">Múltiple (Checkbox)</option>
                                                <option value="cantidad">Cantidad (+/-)</option>
                                            </select>
                                        </fieldset>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={grupoSeleccionado.obligatorio}
                                                onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado, obligatorio: e.target.checked })}
                                                className="w-4 h-4 accent-purple-600"
                                            />
                                            <span className="text-sm text-gray-700">Obligatorio</span>
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">Mín:</span>
                                            <input
                                                type="number"
                                                value={grupoSeleccionado.minimo}
                                                onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado, minimo: parseInt(e.target.value) })}
                                                className="w-12 bg-gray-100 border-none rounded px-2 py-0.5 text-sm"
                                            />
                                            <span className="text-sm text-gray-500 ml-2">Máx:</span>
                                            <input
                                                type="number"
                                                value={grupoSeleccionado.maximo || ""}
                                                onChange={e => setGrupoSeleccionado({ ...grupoSeleccionado, maximo: e.target.value ? parseInt(e.target.value) : undefined })}
                                                className="w-12 bg-gray-100 border-none rounded px-2 py-0.5 text-sm"
                                                placeholder="∞"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Opciones */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <h3 className="font-bold text-gray-900">Opciones</h3>
                                        <button
                                            onClick={handleAddOpcion}
                                            className="text-sm text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1"
                                        >
                                            <Plus size={14} /> Agregar opción
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {opciones.map((opt, idx) => (
                                            <div key={opt.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-3 group">
                                                <div className="text-gray-300 cursor-grab px-1">
                                                    <GripVertical size={16} />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={opt.nombre}
                                                    onChange={e => {
                                                        const newOpciones = [...opciones];
                                                        newOpciones[idx].nombre = e.target.value;
                                                        setOpciones(newOpciones);
                                                    }}
                                                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 font-medium"
                                                    placeholder="Nombre de la opción"
                                                />
                                                <div className="flex items-center gap-2 border-l border-gray-100 pl-3">
                                                    <span className="text-gray-400 text-xs">$</span>
                                                    <input
                                                        type="number"
                                                        value={opt.precio_adicional}
                                                        onChange={e => {
                                                            const newOpciones = [...opciones];
                                                            newOpciones[idx].precio_adicional = parseFloat(e.target.value);
                                                            setOpciones(newOpciones);
                                                        }}
                                                        className="w-20 bg-transparent border-none outline-none text-sm text-gray-900"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => setOpciones(opciones.filter((_, i) => i !== idx))}
                                                    className="text-gray-300 hover:text-red-500 px-2 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <div className="bg-gray-100 p-4 rounded-full mb-4 text-gray-300">
                                    <Plus size={32} />
                                </div>
                                <p className="text-sm">Seleccioná un grupo para editar o creá uno nuevo</p>
                            </div>
                        )}

                        {/* Sticky Action */}
                        <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
                            <button
                                onClick={handleSaveGrupo}
                                disabled={!grupoSeleccionado}
                                className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-purple-500 transition-colors disabled:opacity-50"
                            >
                                <Save size={18} /> Guardar cambios
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
