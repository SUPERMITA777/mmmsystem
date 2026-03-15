"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, Filter, X, ChevronLeft, ChevronRight, User, MapPin, Phone, Clock, Trash2 } from "lucide-react";
import { useTenant } from "@/context/TenantContext";

type Pedido = {
    id: string;
    numero_pedido: string;
    tipo: string;
    estado: string;
    cliente_nombre: string;
    cliente_telefono: string;
    cliente_direccion: string;
    total: number;
    metodo_pago_nombre: string;
    created_at: string;
    pedido_items: { id: string; nombre_producto: string; cantidad: number; precio_unitario: number }[];
};

const ESTADOS_BADGE: Record<string, string> = {
    pendiente: "bg-yellow-100 text-yellow-700",
    confirmado: "bg-blue-100 text-blue-700",
    preparando: "bg-orange-100 text-orange-700",
    listo: "bg-green-100 text-green-700",
    en_camino: "bg-purple-100 text-purple-700",
    entregado: "bg-emerald-100 text-emerald-700",
    cancelado: "bg-red-100 text-red-700",
};

const TIPO_BADGE: Record<string, string> = {
    delivery: "bg-blue-100 text-blue-700",
    takeaway: "bg-purple-100 text-purple-700",
    salon: "bg-amber-100 text-amber-700",
};

const ESTADO_OPTIONS = [
    { key: "pendiente", label: "Pendiente" },
    { key: "confirmado", label: "Confirmado" },
    { key: "preparando", label: "En preparación" },
    { key: "listo", label: "Listo" },
    { key: "en_camino", label: "En camino" },
    { key: "entregado", label: "Entregado" },
    { key: "cancelado", label: "Cancelado" },
];

export default function PedidosPage() {
    const [pedidos, setPedidos] = useState<Pedido[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [total, setTotal] = useState(0);
    const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
    const [filtroEstado, setFiltroEstado] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("");
    const [filtroMetodoPago, setFiltroMetodoPago] = useState("");
    const [filtroFecha, setFiltroFecha] = useState<"todos" | "hoy" | "ayer" | "rango">("todos");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const { sucursalId } = useTenant();

    useEffect(() => {
        if (sucursalId) fetchPedidos();
    }, [page, perPage, filtroEstado, filtroTipo, filtroFecha, fechaDesde, fechaHasta, sucursalId]);

    async function fetchPedidos() {
        if (!sucursalId) return;
        setLoading(true);
        let query = supabase
            .from("pedidos")
            .select("*, pedido_items(*)", { count: "exact" })
            .eq("sucursal_id", sucursalId)
            .order("created_at", { ascending: false })
            .range((page - 1) * perPage, page * perPage - 1);

        if (filtroEstado) query = query.eq("estado", filtroEstado);
        if (filtroTipo) query = query.eq("tipo", filtroTipo);
        if (filtroMetodoPago) query = query.eq("metodo_pago_nombre", filtroMetodoPago);

        if (filtroFecha === "hoy") {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query = query.gte("created_at", today.toISOString());
        } else if (filtroFecha === "ayer") {
            const ayer = new Date();
            ayer.setDate(ayer.getDate() - 1);
            ayer.setHours(0, 0, 0, 0);
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            query = query.gte("created_at", ayer.toISOString()).lt("created_at", hoy.toISOString());
        } else if (filtroFecha === "rango") {
            if (fechaDesde) {
                const d = new Date(fechaDesde);
                d.setHours(0, 0, 0, 0);
                query = query.gte("created_at", d.toISOString());
            }
            if (fechaHasta) {
                const h = new Date(fechaHasta);
                h.setHours(23, 59, 59, 999);
                query = query.lte("created_at", h.toISOString());
            }
        }

        const { data, count } = await query;
        setPedidos(data || []);
        setTotal(count || 0);
        setLoading(false);

        // Keep selectedPedido in sync
        if (selectedPedido) {
            const updated = (data || []).find(p => p.id === selectedPedido.id);
            if (updated) setSelectedPedido(updated);
        }
    }

    async function cambiarEstado(pedido: Pedido, nuevoEstado: string) {
        try {
            const { error } = await supabase
                .from("pedidos")
                .update({ estado: nuevoEstado })
                .eq("id", pedido.id);

            if (error) throw error;
            
            // Refresh local list
            fetchPedidos();
        } catch (error) {
            console.error("Error al cambiar estado:", error);
            alert("Error al cambiar el estado del pedido");
        }
    }

    const totalPages = Math.ceil(total / perPage);

    function formatDate(d: string) {
        return new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
    }

    return (
        <section className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Pedidos</h2>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap items-end">
                <fieldset className="border border-gray-300 rounded-lg px-2 py-1 bg-white">
                    <legend className="text-[10px] text-gray-500 px-1 font-semibold tracking-wide">Fecha</legend>
                    <div className="flex gap-1">
                        <button
                            onClick={() => { setFiltroFecha("todos"); setPage(1); }}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${filtroFecha === "todos" ? "bg-[#7B1FA2] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                        >
                            Todos
                        </button>
                        <button
                            onClick={() => { setFiltroFecha("hoy"); setPage(1); }}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${filtroFecha === "hoy" ? "bg-[#7B1FA2] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => { setFiltroFecha("ayer"); setPage(1); }}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${filtroFecha === "ayer" ? "bg-[#7B1FA2] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                        >
                            Ayer
                        </button>
                        <button
                            onClick={() => { setFiltroFecha("rango"); setPage(1); }}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${filtroFecha === "rango" ? "bg-[#7B1FA2] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}
                        >
                            Rango
                        </button>
                    </div>
                </fieldset>

                {filtroFecha === "rango" && (
                    <div className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        <fieldset className="border border-gray-300 rounded-lg px-2 py-1 bg-white">
                            <legend className="text-[10px] text-gray-500 px-1 font-semibold tracking-wide uppercase">Desde</legend>
                            <input
                                type="date"
                                value={fechaDesde}
                                onChange={e => { setFechaDesde(e.target.value); setPage(1); }}
                                className="bg-transparent outline-none text-xs font-bold text-gray-900"
                            />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-2 py-1 bg-white">
                            <legend className="text-[10px] text-gray-500 px-1 font-semibold tracking-wide uppercase">Hasta</legend>
                            <input
                                type="date"
                                value={fechaHasta}
                                onChange={e => { setFechaHasta(e.target.value); setPage(1); }}
                                className="bg-transparent outline-none text-xs font-bold text-gray-900"
                            />
                        </fieldset>
                    </div>
                )}
                <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
                    <legend className="text-[10px] text-gray-500 px-1">Estado</legend>
                    <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }} className="bg-transparent outline-none text-sm text-gray-900 min-w-[140px]">
                        <option value="">Todos</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="preparando">En preparación</option>
                        <option value="listo">Listo</option>
                        <option value="entregado">Entregado</option>
                        <option value="cancelado">Cancelado</option>
                    </select>
                </fieldset>
                <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
                    <legend className="text-[10px] text-gray-500 px-1">Modalidad</legend>
                    <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPage(1); }} className="bg-transparent outline-none text-sm text-gray-900 min-w-[140px]">
                        <option value="">Todos</option>
                        <option value="delivery">Delivery</option>
                        <option value="takeaway">Take Away</option>
                        <option value="salon">Salón</option>
                    </select>
                </fieldset>
                <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
                    <legend className="text-[10px] text-gray-500 px-1">Pago</legend>
                    <select value={filtroMetodoPago} onChange={e => { setFiltroMetodoPago(e.target.value); setPage(1); }} className="bg-transparent outline-none text-sm text-gray-900 min-w-[140px]">
                        <option value="">Todos</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Transferencia">Transferencia</option>
                    </select>
                </fieldset>
            </div>

            <div className="flex gap-6">
                {/* Table */}
                <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="px-4 py-3 text-left font-semibold">Nº Pedido</th>
                                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                                <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                                <th className="px-4 py-3 text-left font-semibold">Pago</th>
                                <th className="px-4 py-3 text-right font-semibold">Total</th>
                                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className="text-center py-10 text-gray-400">Cargando...</td></tr>
                            ) : pedidos.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No hay pedidos</td></tr>
                            ) : pedidos.map(p => (
                                <tr
                                    key={p.id}
                                    onClick={() => setSelectedPedido(p)}
                                    className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-gray-50 ${selectedPedido?.id === p.id ? "bg-purple-50" : ""}`}
                                >
                                    <td className="px-4 py-3 font-bold text-gray-900">{p.numero_pedido}</td>
                                    <td className="px-4 py-3 text-gray-700">{p.cliente_nombre || "—"}</td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIPO_BADGE[p.tipo] || "bg-gray-100 text-gray-600"}`}>
                                            {p.tipo}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADOS_BADGE[p.estado] || "bg-gray-100"}`}>
                                            {p.estado}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[10px] font-bold text-gray-600 uppercase">
                                            {p.metodo_pago_nombre || "—"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(p.total)}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(p.created_at)}</td>
                                    <td className="px-2 py-3">
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (!confirm(`¿Eliminar definitivamente ${p.numero_pedido}?`)) return;
                                                await supabase.from("pedido_items").delete().eq("pedido_id", p.id);
                                                await supabase.from("pedidos").delete().eq("id", p.id);
                                                if (selectedPedido?.id === p.id) setSelectedPedido(null);
                                                fetchPedidos();
                                            }}
                                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar pedido"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white">
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                        <span>{(page - 1) * perPage + 1} – {Math.min(page * perPage, total)} de {total}</span>
                        <div className="flex gap-1">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                <ChevronLeft size={16} />
                            </button>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Detail drawer */}
                {selectedPedido && (
                    <div className="w-80 bg-white rounded-2xl border border-gray-200 p-5 overflow-y-auto shrink-0 self-start">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900">{selectedPedido.numero_pedido}</h3>
                            <button onClick={() => setSelectedPedido(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2 text-gray-700"><User size={14} className="text-gray-400" /> {selectedPedido.cliente_nombre || "—"}</div>
                            {selectedPedido.cliente_telefono && <div className="flex items-center gap-2 text-gray-600"><Phone size={14} className="text-gray-400" /> {selectedPedido.cliente_telefono}</div>}
                            {selectedPedido.cliente_direccion && <div className="flex items-center gap-2 text-gray-600"><MapPin size={14} className="text-gray-400" /> {selectedPedido.cliente_direccion}</div>}
                            <div className="flex items-center gap-2 text-gray-500"><Clock size={14} className="text-gray-400" /> {formatDate(selectedPedido.created_at)}</div>
                            
                            {/* Estado Selector */}
                            <div className="pt-2">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Estado del Pedido</label>
                                <select
                                    value={selectedPedido.estado}
                                    onChange={(e) => cambiarEstado(selectedPedido, e.target.value)}
                                    className={`w-full text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-purple-500 transition-all ${ESTADOS_BADGE[selectedPedido.estado] || "bg-gray-50 text-gray-700"}`}
                                >
                                    {ESTADO_OPTIONS.map(opt => (
                                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 border-t border-gray-100 pt-3 space-y-1">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Productos</h4>
                            {selectedPedido.pedido_items?.map(item => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <span className="text-gray-800"><span className="font-bold">{item.cantidad}x</span> {item.nombre_producto}</span>
                                    <span className="text-gray-600">$ {new Intl.NumberFormat("es-AR").format(item.precio_unitario * item.cantidad)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-100 pt-2 mt-2">
                                <span>Total</span>
                                <span>$ {new Intl.NumberFormat("es-AR").format(selectedPedido.total)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
