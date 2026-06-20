"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { Plus, Save, Edit3, Trash2, X, ExternalLink, User, QrCode, Maximize, Minimize } from "lucide-react";
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
    ubicacion?: string | null;
    pos_x: number;
    pos_y: number;
    forma: string;
    width: number;
    height: number;
    camarero_color?: string;
    is_precuenta?: boolean;
    costo_cubierto?: number;
};

export function MapaSalon({ isCamareroMode = false }: { isCamareroMode?: boolean }) {
    const { sucursalId, tenantSlug } = useTenant();
    const [mesas, setMesas] = useState<Mesa[]>([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [layout, setLayout] = useState<ReactGridLayout.Layout[]>([]);
    const [saving, setSaving] = useState(false);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
    const [activePedidoForMesa, setActivePedidoForMesa] = useState<any>(null);
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [qrMesa, setQrMesa] = useState<Mesa | null>(null);
    const [staff, setStaff] = useState<any[]>([]);
    const [selectedWaiterId, setSelectedWaiterId] = useState("");
    const [terminalId, setTerminalId] = useState("1");
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, []);

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error enabling fullscreen: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            setTerminalId(localStorage.getItem("terminal_id") || "1");
        }
    }, []);

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

            // Load active orders to get waiter colors and Pre-Cuenta status
            const { data: activePedidos, error: pedidosError } = await supabase
                .from("pedidos")
                .select("id, mesa_id, camarero_id, notas_internas")
                .eq("sucursal_id", sucursalId)
                .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"]);

            if (pedidosError) console.error("[Salon] Error pedidos:", pedidosError);

            // Fetch staff colors via server-side API (bypasses RLS)
            let camareroColors: Record<string, string> = {};
            try {
                const staffRes = await fetch(`/api/staff?sucursal_id=${sucursalId}`);
                if (staffRes.ok) {
                    const staffData = await staffRes.json();
                    setStaff(staffData || []);
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
                if (activePedidos && !pedido && m.estado === 'ocupada') {
                    supabase.from("mesas").update({ estado: "libre" }).eq("id", m.id).then();
                    return { ...m, estado: 'libre' };
                }

                const actualState = pedido ? "ocupada" : m.estado;
                const color = pedido?.camarero_id ? (camareroColors[pedido.camarero_id] || undefined) : undefined;
                const isPrecuenta = pedido?.notas_internas?.toUpperCase().includes("PRECUENTA");
                
                return {
                    ...m,
                    estado: actualState,
                    camarero_color: color,
                    is_precuenta: isPrecuenta
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
            height: 100,
            costo_cubierto: 0
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

        // Buscar el número más bajo (negativo) para las etiquetas para evitar conflictos de unicidad
        const numerosEtiquetas = mesas.map(m => m.numero).filter(n => n <= 0);
        const numero = numerosEtiquetas.length > 0 ? Math.min(...numerosEtiquetas) - 1 : 0;

        const newLabel = {
            sucursal_id: sucursalId,
            numero,
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
        console.log("[Salon] Guardando layout...", layout);
        try {
            const updates = layout.map(l => ({
                id: l.i,
                pos_x: l.x,
                pos_y: l.y,
                width: l.w * 50,
                height: l.h * 50
            }));

            // Perform updates in chunks or one by one
            for (const upd of updates) {
                const { error } = await supabase
                    .from("mesas")
                    .update({
                        pos_x: upd.pos_x,
                        pos_y: upd.pos_y,
                        width: upd.width,
                        height: upd.height
                    })
                    .eq("id", upd.id);
                
                if (error) {
                    console.error(`[Salon] Error actualizando mesa ${upd.id}:`, error);
                }
            }
            
            alert("Mapa guardado correctamente");
            setEditMode(false);
            // After saving layout, we should refresh to get clean state
            await loadMesas();

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
                const action = prompt("¿Qué deseas editar? (1: Texto, 2: Color, 3: Eliminar)", "1");
                
                if (action === "1") {
                    const nuevoTexto = prompt("Texto de la etiqueta:", mesa.nombre);
                    if (nuevoTexto !== null) {
                        const { error } = await supabase.from("mesas").update({ nombre: nuevoTexto }).eq("id", mesa.id);
                        if (!error) {
                            setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, nombre: nuevoTexto } : m));
                        }
                    }
                } else if (action === "2") {
                    const colores = [
                        { n: "Gris", c: "#f3f4f6" },
                        { n: "Amarillo", c: "#fef9c3" },
                        { n: "Azul", c: "#dbeafe" },
                        { n: "Verde", c: "#dcfce7" },
                        { n: "Rojo", c: "#fee2e2" },
                        { n: "Púrpura", c: "#f3e8ff" },
                        { n: "Naranja", c: "#ffedd5" },
                        { n: "Negro", c: "#111827" },
                        { n: "Blanco", c: "#ffffff" }
                    ];
                    const colorList = colores.map((c, i) => `${i+1}: ${c.n}`).join("\n");
                    const colorIdx = prompt(`Selecciona un color de fondo:\n${colorList}`, "1");
                    const selected = colores[parseInt(colorIdx || "1") - 1];
                    if (selected) {
                        const { error } = await supabase.from("mesas").update({ ubicacion: selected.c }).eq("id", mesa.id);
                        if (!error) {
                            setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, ubicacion: selected.c } : m));
                        }
                    }
                } else if (action === "3") {
                    handleDeleteMesa(mesa.id);
                }
            } else {
                const action = prompt("¿Qué deseas editar? (1: Capacidad, 2: Nombre/Número, 3: Costo de cubierto por persona, 4: Eliminar)", "1");
                
                if (action === "1") {
                    const nuevaCapacidad = prompt("Nueva capacidad de la mesa:", String(mesa.capacidad));
                    if (nuevaCapacidad !== null) {
                        const cap = parseInt(nuevaCapacidad);
                        if (!isNaN(cap)) {
                            const { error } = await supabase.from("mesas").update({ capacidad: cap }).eq("id", mesa.id);
                            if (!error) {
                                setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, capacidad: cap } : m));
                            }
                        }
                    }
                } else if (action === "2") {
                    const nuevoNombre = prompt("Nombre/Número de la mesa:", mesa.nombre);
                    if (nuevoNombre !== null) {
                        const { error } = await supabase.from("mesas").update({ nombre: nuevoNombre }).eq("id", mesa.id);
                        if (!error) {
                            setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, nombre: nuevoNombre } : m));
                        }
                    }
                } else if (action === "3") {
                    const nuevoCubierto = prompt("Costo de cubierto por persona ($):", String(mesa.costo_cubierto || 0));
                    if (nuevoCubierto !== null) {
                        const price = parseFloat(nuevoCubierto);
                        if (!isNaN(price)) {
                            const { error } = await supabase.from("mesas").update({ costo_cubierto: price }).eq("id", mesa.id);
                            if (!error) {
                                setMesas(prev => prev.map(m => m.id === mesa.id ? { ...m, costo_cubierto: price } : m));
                            }
                        }
                    }
                } else if (action === "4") {
                    handleDeleteMesa(mesa.id);
                }
            }
            return;
        }

        if (mesa.forma === 'label') return;

        setSelectedMesa(mesa);
        
        // Load all active pedidos for this table
        const { data } = await supabase
            .from("pedidos")
            .select("*, pedido_items(*, productos(categorias(nombre)))")
            .eq("mesa_id", mesa.id)
            .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"])
            .order("created_at", { ascending: true });

        let activePedido = null;
        if (data && data.length > 0) {
            if (data.length === 1) {
                activePedido = data[0];
            } else {
                const main = data[0];
                const mergedItems = data.flatMap(p => p.pedido_items || []);
                const totalSubtotal = data.reduce((sum, p) => sum + Number(p.subtotal || 0), 0);
                const totalTotal = data.reduce((sum, p) => sum + Number(p.total || 0), 0);
                
                activePedido = {
                    ...main,
                    pedido_items: mergedItems,
                    subtotal: totalSubtotal,
                    total: totalTotal,
                    groupedIds: data.map(p => p.id)
                };
            }
        }

        setActivePedidoForMesa(activePedido || { tipo: "salon", mesa_id: mesa.id });
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
                                onClick={toggleFullScreen}
                                className="flex items-center gap-2 px-4 py-1.5 bg-slate-700 text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors shadow-sm mr-2"
                            >
                                {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />} {isFullscreen ? "Pantalla Normal" : "Pantalla Completa"}
                            </button>
                            <button
                                onClick={() => window.open(`${window.location.pathname.replace('/admin/salon', '/camarero/salon')}`, '_blank')}
                                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors shadow-sm mr-2"
                            >
                                <ExternalLink size={16} /> Vista Móvil
                            </button>
                            <button
                                onClick={() => {
                                    setQrMesa(null);
                                    setQrModalOpen(true);
                                }}
                                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors shadow-sm mr-2"
                            >
                                <QrCode size={16} /> Acceso Rápido QR
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
                            const labelBg = mesa.ubicacion || '#f3f4f6';
                            return (
                                <div key={mesa.id} className="relative group flex items-center justify-center">
                                    <div 
                                        onClick={(e) => { e.stopPropagation(); handleMesaClick(mesa); }}
                                        className={`w-full h-full flex items-center justify-center transition-all p-2 border-2
                                        ${editMode ? 'cursor-move border-dashed border-purple-400 rounded-lg hover:ring-4 hover:ring-purple-200' : 'cursor-default border-transparent rounded-lg'}
                                    `}
                                    style={{ backgroundColor: labelBg }}
                                    >
                                        <span className={`font-extrabold text-sm uppercase tracking-[0.1em] text-center ${labelBg === '#111827' ? 'text-white' : 'text-gray-600'}`}>
                                            {mesa.nombre}
                                        </span>
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
                                    {mesa.is_precuenta && (
                                        <div className="absolute inset-0 bg-yellow-400 animate-[blink_1s_infinite] rounded-[inherit] z-0" />
                                    )}
                                    <style jsx>{`
                                        @keyframes blink {
                                            0% { opacity: 0.2; }
                                            50% { opacity: 0.8; }
                                            100% { opacity: 0.2; }
                                        }
                                    `}</style>
                                    <span className="font-black text-xl z-10">{mesa.numero}</span>
                                    <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70 flex items-center gap-1 mt-1 z-10">
                                        <Users size={10} /> {mesa.capacidad}
                                    </span>
                                    {mesa.camarero_color && mesa.estado === 'ocupada' && (
                                        <div className="absolute top-1 right-1 z-10">
                                            <User size={12} fill={mesa.camarero_color} />
                                        </div>
                                    )}

                                    {/* QR Code Button */}
                                    {!editMode && (
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setQrMesa(mesa);
                                                setQrModalOpen(true);
                                            }}
                                            className="absolute bottom-1 right-1 p-1 bg-white/50 hover:bg-white rounded-md transition-colors text-slate-500 hover:text-indigo-600"
                                            title="Generar QR para pedidos"
                                        >
                                            <QrCode size={12} />
                                        </button>
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

            {/* QR Modal */}
            {qrModalOpen && (() => {
                const qrUrl = window.location.origin + "/" + tenantSlug + "/camarero/pedir" + 
                              `?terminal=${terminalId}` + 
                              (selectedWaiterId ? `&waiter_id=${selectedWaiterId}` : "") + 
                              (qrMesa ? `&mesa_id=${qrMesa.id}` : "");
                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setQrModalOpen(false); setSelectedWaiterId(""); }} />
                        <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-slate-900">
                                    {qrMesa ? `QR Mesa ${qrMesa.numero}` : "Acceso Camareros"}
                                </h3>
                                <p className="text-slate-500 text-xs">
                                    {qrMesa 
                                        ? "Escanea este código para abrir el módulo directamente en esta mesa." 
                                        : "Escanea para iniciar sesión y empezar a tomar pedidos desde tu celular."}
                                </p>
                            </div>
                            
                            {/* Camarero Selector for QR code auto-login */}
                            {!qrMesa && (
                                <div className="space-y-1.5 text-left bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-0.5 block">Configurar Auto-Login</label>
                                    <select 
                                        value={selectedWaiterId}
                                        onChange={(e) => setSelectedWaiterId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none text-xs bg-white font-bold text-slate-700"
                                    >
                                        <option value="">Acceso General (Selección manual en móvil)</option>
                                        {staff.map(s => (
                                            <option key={s.id} value={s.id}>{s.nombre} {s.apellido || ""}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 aspect-square flex items-center justify-center mx-auto shadow-sm">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`} 
                                    alt="QR Code"
                                    className="w-full h-full"
                                />
                            </div>

                            <div className="flex flex-col gap-2 pt-1">
                                <button 
                                    onClick={() => window.print()}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                                >
                                    Imprimir QR
                                </button>
                                <button 
                                    onClick={() => { setQrModalOpen(false); setSelectedWaiterId(""); }}
                                    className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
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
