"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, Filter, X, ChevronLeft, ChevronRight, User, MapPin, Phone, Clock } from "lucide-react";

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

export default function PedidosPage() {
    const [pedidos, setPedidos] = useState<Pedido[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [total, setTotal] = useState(0);
    const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
    const [filtroEstado, setFiltroEstado] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("");

    useEffect(() => { fetchPedidos(); }, [page, perPage, filtroEstado, filtroTipo]);

    async function fetchPedidos() {
        setLoading(true);
        let query = supabase
            .from("pedidos")
            .select("*, pedido_items(*)", { count: "exact" })
            .order("created_at", { ascending: false })
            .range((page - 1) * perPage, page * perPage - 1);

        if (filtroEstado) query = query.eq("estado", filtroEstado);
        if (filtroTipo) query = query.eq("tipo", filtroTipo);

        const { data, count } = await query;
        setPedidos(data || []);
        setTotal(count || 0);
        setLoading(false);
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
            <div className="flex gap-3 mb-4 flex-wrap">
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
                                <th className="px-4 py-3 text-right font-semibold">Total</th>
                                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-400">Cargando...</td></tr>
                            ) : pedidos.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No hay pedidos</td></tr>
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
                                    <td className="px-4 py-3 text-right font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(p.total)}</td>
                                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(p.created_at)}</td>
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
