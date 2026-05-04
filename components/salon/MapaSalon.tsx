"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { Plus, Save, Edit3, Trash2, X, ExternalLink, User } from "lucide-react";
// @ts-ignore - WidthProvider may not be in the ESM export
import RGL from "react-grid-layout";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { WidthProvider } = require("react-grid-layout");
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import NuevoPedidoModal from "@/components/admin/NuevoPedidoModal";

const GridLayout = WidthProvider(RGL);

type Mesa = {
    id: string;
    numero: number;
    nombre: string;
    capacidad: number;
    estado: string;
    pos_x: number;
    pos_y: number;
    forma: string;
    width: number;
    height: number;
    camarero_color?: string;
};

export function MapaSalon({ isCamareroMode = false }: { isCamareroMode?: boolean }) {
    const { sucursalId } = useTenant();
    const [mesas, setMesas] = useState<Mesa[]>([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [layout, setLayout] = useState<ReactGridLayout.Layout[]>([]);
    const [saving, setSaving] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
    const [activePedidoForMesa, setActivePedidoForMesa] = useState<any>(null);

    useEffect(() => {
        if (sucursalId) loadMesas();
    }, [sucursalId]);

    async function loadMesas() {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("mesas")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .order("numero");
            
            if (error) throw error;

            setMesas(data || []);
            
            const initialLayout = (data || []).map((m: Mesa) => ({
                i: m.id,
                x: m.pos_x || 0,
                y: m.pos_y || 0,
                w: m.width ? Math.max(1, Math.floor(m.width / 50)) : 2,
                h: m.height ? Math.max(1, Math.floor(m.height / 50)) : 2,
            }));
            setLayout(initialLayout);

            // Load active orders to get waiter colors
            const { data: activePedidos, error: pedidosError } = await supabase
                .from("pedidos")
                .select("mesa_id, camarero_id")
                .eq("sucursal_id", sucursalId)
                .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"]);

            if (pedidosError) console.error("[Salon] Error pedidos:", pedidosError);

            // Fetch staff colors via server-side API (bypasses RLS)
            let camareroColors: Record<string, string> = {};
            try {
                const staffRes = await fetch(`/api/staff?sucursal_id=${sucursalId}`);
                if (staffRes.ok) {
                    const staffData = await staffRes.json();
                    camareroColors = (staffData || []).reduce((acc: Record<string, string>, c: any) => {
                        if (c.color) acc[c.id] = c.color;
                        return acc;
                    }, {});
                }
            } catch (err) {
                console.error("[Salon] Error fetching staff colors:", err);
            }

            const mesasWithColor = (data || []).map((m: Mesa) => {
                if (m.forma === 'label') return m;

                const pedido = activePedidos?.find(p => p.mesa_id === m.id);
                
                // Reparación automática: si la DB dice ocupada pero no hay pedido activo, resetear a libre
                if (!pedido && m.estado === 'ocupada') {
                    supabase.from("mesas").update({ estado: "libre" }).eq("id", m.id).then();
                    return { ...m, estado: 'libre' };
                }

                const actualState = pedido ? "ocupada" : m.estado;
                const color = pedido?.camarero_id ? (camareroColors[pedido.camarero_id] || undefined) : undefined;
                
                return {
                    ...m,
                    estado: actualState,
                    camarero_color: color
                };
            });
            setMesas(mesasWithColor);

        } catch (error) {
            console.error("Error loading mesas:", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!sucursalId) return;

        const mesasChannel = supabase
            .channel("mesas-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "mesas", filter: `sucursal_id=eq.${sucursalId}` },
                () => loadMesas()
            )
            .subscribe();

        const pedidosChannel = supabase
            .channel("pedidos-salon-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "pedidos", filter: `sucursal_id=eq.${sucursalId}` },
                () => loadMesas()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(mesasChannel);
            supabase.removeChannel(pedidosChannel);
        };
    }, [sucursalId]);

    async function handleAddMesa() {
        if (!sucursalId) return;
        
        const numero = mesas.length > 0 ? Math.max(...mesas.map(m => m.numero)) + 1 : 1;
        const newMesa = {
            sucursal_id: sucursalId,
            numero,
            nombre: `Mesa ${numero}`,
            capacidad: 4,
            estado: "libre",
            pos_x: 0,
            pos_y: 0,
            forma: "cuadrada",
            width: 100,
            height: 100
        };

        const { data, error } = await supabase.from("mesas").insert(newMesa).select().single();
        if (error) {
            alert("Error agregando mesa");
            return;
        }

        setMesas([...mesas, data]);
        setLayout([...layout, { i: data.id, x: 0, y: 0, w: 2, h: 2 }]);
    }

    async function handleAddLabel() {
        if (!sucursalId) return;
        
        const texto = prompt("Texto de la etiqueta:", "Nuevo Sector");
        if (!texto) return;

        const newLabel = {
            sucursal_id: sucursalId,
            numero: 0,
            nombre: texto,
            capacidad: 0,
            estado: "libre",
            pos_x: 0,
            pos_y: 0,
            forma: "label",
            width: 150,
            height: 50
        };

        const { data, error } = await supabase.from("mesas").insert(newLabel).select().single();
        if (error) {
            alert("Error agregando etiqueta");
            return;
        }

        setMesas([...mesas, data]);
        setLayout([...layout, { i: data.id, x: 0, y: 0, w: 3, h: 1 }]);
    }

    async function handleSaveLayout() {
        setSaving(true);
        try {
            const updates = layout.map(l => ({
                id: l.i,
                pos_x: l.x,
                pos_y: l.y,
                width: l.w * 50,
                height: l.h * 50
            }));

            for (const upd of updates) {
                await supabase
                    .from("mesas")
                    .update({
                        pos_x: upd.pos_x,
                        pos_y: upd.pos_y,
                        width: upd.width,
                        height: upd.height
                    })
                    .eq("id", upd.id);
            }
            alert("Mapa guardado");
            setEditMode(false);
            loadMesas();
        } catch (error) {
            console.error("Error saving layout:", error);
            alert("Error guardando el mapa");
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteMesa(id: string) {
        if (!confirm("¿Eliminar esta mesa?")) return;
        const { error } = await supabase.from("mesas").delete().eq("id", id);
        if (!error) {
            setMesas(mesas.filter(m => m.id !== id));
            setLayout(layout.filter(l => l.i !== id));
        }
    }

    const onLayoutChange = (newLayout: ReactGridLayout.Layout[]) => {
        setLayout(newLayout);
    };

    const handleMesaClick = async (mesa: Mesa) => {
        if (editMode) {
            if (mesa.forma === 'label') {
                const nuevoTexto = prompt("Texto de la etiqueta:", mesa.nombre);
                if (nuevoTexto !== null) {
                    await supabase.from("mesas").update({ nombre: nuevoTexto }).eq("id", mesa.id);
                    loadMesas();
                }
            }
            return;
        }
        if (mesa.forma === 'label') return;

        setSelectedMesa(mesa);
        
        // Load active pedido if there is one
        const { data } = await supabase
            .from("pedidos")
            .select("*, pedido_items(*, productos(categorias(nombre)))")
            .eq("mesa_id", mesa.id)
            .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        setActivePedidoForMesa(data || { tipo: "salon", mesa_id: mesa.id });
        setIsModalOpen(true);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando salón...</div>;

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between z-10 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Salón</h2>
                    <p className="text-xs text-gray-500">Gestión de mesas y pedidos en el local</p>
                </div>
                <div className="flex items-center gap-3">
                    {!isCamareroMode && (
                        <>
                            <button
                                onClick={() => window.open(`${window.location.pathname.replace('/admin/salon', '/camarero/salon')}`, '_blank')}
                                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors shadow-sm mr-2"
                            >
                                <ExternalLink size={16} /> Vista Mozos
                            </button>
                            {editMode ? (
                                <>
                                    <button
                                        onClick={handleAddMesa}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors border border-gray-200"
                                    >
                                        <Plus size={16} /> Nueva Mesa
                                    </button>
                                    <button
                                        onClick={handleAddLabel}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors border border-gray-200"
                                    >
                                        <Plus size={16} /> Nueva Etiqueta
                                    </button>
                                    <button
                                        onClick={() => setEditMode(false)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors border border-red-200"
                                    >
                                        <X size={16} /> Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveLayout}
                                        disabled={saving}
                                        className="flex items-center gap-2 px-4 py-1.5 bg-[#7B1FA2] text-white hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                    >
                                        <Save size={16} /> {saving ? "Guardando..." : "Guardar Mapa"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setEditMode(true)}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors shadow-sm"
                                >
                                    <Edit3 size={16} /> Editar Mapa
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-opacity-20">
                <GridLayout
                    className="layout border border-dashed border-gray-300 min-h-[600px] bg-white/50 rounded-2xl shadow-inner relative"
                    layout={layout}
                    cols={24}
                    rowHeight={50}
                    width={1200}
                    onLayoutChange={onLayoutChange}
                    isDraggable={editMode}
                    isResizable={editMode}
                    compactType={null}
                    preventCollision={true}
                >
                    {mesas.map((mesa) => {
                        if (mesa.forma === 'label') {
                            return (
                                <div key={mesa.id} className="relative group flex items-center justify-center">
                                    <div 
                                        onClick={(e) => { e.stopPropagation(); handleMesaClick(mesa); }}
                                        className={`w-full h-full flex items-center justify-center transition-all p-2
                                        ${editMode ? 'cursor-move border-2 border-dashed border-purple-300 bg-purple-50 rounded-lg hover:ring-4 hover:ring-purple-200' : 'cursor-default'}
                                    `}
                                    >
                                        <span className="font-extrabold text-sm text-gray-400 uppercase tracking-[0.2em] text-center">{mesa.nombre}</span>
                                    </div>
                                    {editMode && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteMesa(mesa.id); }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            );
                        }

                        const bgColors: any = {
                            libre: "bg-green-100 border-green-300 text-green-800",
                            ocupada: mesa.camarero_color 
                                ? `border-2` // Color will be set via style
                                : "bg-red-100 border-red-300 text-red-800",
                            reservada: "bg-yellow-100 border-yellow-300 text-yellow-800",
                            mantenimiento: "bg-gray-200 border-gray-400 text-gray-600"
                        };
                        const colorClass = bgColors[mesa.estado] || bgColors.libre;
                        
                        // Custom style for occupied tables with waiter color
                        const customStyle: any = {};
                        if (mesa.estado === 'ocupada' && mesa.camarero_color) {
                            customStyle.backgroundColor = `${mesa.camarero_color}40`; // 25% opacity for background
                            customStyle.borderColor = mesa.camarero_color;
                            customStyle.color = mesa.camarero_color;
                        }
                        const isCircle = mesa.forma === "redonda";

                        return (
                            <div key={mesa.id} className="relative group flex items-center justify-center">
                                <div 
                                    onClick={(e) => { e.stopPropagation(); handleMesaClick(mesa); }}
                                    className={`w-full h-full flex flex-col items-center justify-center border-2 shadow-sm transition-all
                                    ${colorClass} 
                                    ${isCircle ? 'rounded-full' : 'rounded-xl'}
                                    ${editMode ? 'cursor-move hover:ring-4 hover:ring-purple-200' : 'cursor-pointer hover:scale-105 hover:shadow-md'}
                                `}
                                style={customStyle}
                                >
                                    <span className="font-black text-xl">{mesa.numero}</span>
                                    <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70 flex items-center gap-1 mt-1">
                                        <Users size={10} /> {mesa.capacidad}
                                    </span>
                                    {mesa.camarero_color && mesa.estado === 'ocupada' && (
                                        <div className="absolute top-1 right-1">
                                            <User size={12} fill={mesa.camarero_color} />
                                        </div>
                                    )}
                                </div>
                                {editMode && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteMesa(mesa.id); }}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </GridLayout>
            </div>

            {isModalOpen && selectedMesa && (
                <NuevoPedidoModal 
                    isOpen={isModalOpen} 
                    onClose={() => {
                        setIsModalOpen(false);
                        setSelectedMesa(null);
                        setActivePedidoForMesa(null);
                    }}
                    onCreated={() => {
                        setIsModalOpen(false);
                        setSelectedMesa(null);
                        setActivePedidoForMesa(null);
                        loadMesas();
                    }}
                    editPedido={activePedidoForMesa}
                    camareroMode={isCamareroMode}
                />
            )}
        </div>
    );
}

function Users({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
