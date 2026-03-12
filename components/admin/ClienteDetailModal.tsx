"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Receipt, MapPin, Phone, Mail, Calendar, TrendingUp } from "lucide-react";

interface ClienteDetailModalProps {
    cliente: any;
    sucursalId: string;
    onClose: () => void;
}

export default function ClienteDetailModal({ cliente, sucursalId, onClose }: ClienteDetailModalProps) {
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [stats, setStats] = useState({
        primerPedido: null as string | null,
        ultimoPedido: null as string | null,
        ticketMasAlto: 0,
        totalFacturado: 0,
        cantidadPedidos: 0
    });

    useEffect(() => {
        if (cliente && sucursalId) {
            fetchHistorico();
        }
    }, [cliente, sucursalId]);

    async function fetchHistorico() {
        setLoading(true);
        try {
            // Fetch by phone to include retroactive orders that might missing cliente_id
            const { data, error } = await supabase
                .from("pedidos")
                .select("numero_pedido, created_at, total, estado, tipo")
                .eq("sucursal_id", sucursalId)
                .eq("cliente_telefono", cliente.telefono)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const fetchedPedidos = data || [];
            setPedidos(fetchedPedidos);

            if (fetchedPedidos.length > 0) {
                const completados = fetchedPedidos.filter(p => !['cancelado', 'rechazado'].includes(p.estado?.toLowerCase()));
                const maxTicket = completados.length > 0 ? Math.max(...completados.map(p => p.total || 0)) : 0;
                const grandTotal = completados.reduce((acc, p) => acc + (p.total || 0), 0);

                setStats({
                    primerPedido: fetchedPedidos[fetchedPedidos.length - 1].created_at,
                    ultimoPedido: fetchedPedidos[0].created_at,
                    ticketMasAlto: maxTicket,
                    totalFacturado: grandTotal,
                    cantidadPedidos: fetchedPedidos.length
                });
            }

        } catch (error) {
            console.error("Error fetching patient history:", error);
        } finally {
            setLoading(false);
        }
    }

    function formatDate(dateString: string | null) {
        if (!dateString) return "—";
        return new Date(dateString).toLocaleDateString("es-AR", {
            day: "2-digit", month: "2-digit", year: "2-digit",
            hour: "2-digit", minute: "2-digit"
        });
    }

    function fmt(n: number) {
        return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
    }

    if (!cliente) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Cliente: <span className="text-purple-600 truncate">{cliente.nombre} {cliente.apellido || ""}</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-6 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm bg-gray-50 p-5 rounded-xl border border-gray-100">
                        <div className="space-y-3">
                            <div className="flex gap-2 text-gray-600">
                                <Phone size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-gray-900 block">Teléfono</span>
                                    {cliente.telefono}
                                </div>
                            </div>
                            <div className="flex gap-2 text-gray-600">
                                <MapPin size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-gray-900 block">Dirección</span>
                                    {cliente.direccion || "—"}
                                </div>
                            </div>
                            <div className="flex gap-2 text-gray-600">
                                <Receipt size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-gray-900 block">Facturación total</span>
                                    {loading ? "..." : fmt(stats.totalFacturado)}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex gap-2 text-gray-600">
                                <Calendar size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-gray-900 block">Último pedido</span>
                                    {loading ? "..." : formatDate(stats.ultimoPedido)}
                                </div>
                            </div>
                            <div className="flex gap-2 text-gray-600">
                                <Calendar size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-gray-900 block">Primer pedido</span>
                                    {loading ? "..." : formatDate(stats.primerPedido)}
                                </div>
                            </div>
                            <div className="flex gap-2 text-gray-600">
                                <TrendingUp size={16} className="text-purple-500 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold text-gray-900 block">Ticket más alto</span>
                                    {loading ? "..." : fmt(stats.ticketMasAlto)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Orders List */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            ¡{cliente.nombre} realizó {loading ? "..." : stats.cantidadPedidos} pedidos!
                        </h3>
                        
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Detalle</th>
                                        <th className="px-4 py-3">Importe</th>
                                        <th className="px-4 py-3 text-right">Creación</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr><td colSpan={3} className="text-center py-8 text-gray-400">Cargando historial...</td></tr>
                                    ) : pedidos.length === 0 ? (
                                        <tr><td colSpan={3} className="text-center py-8 text-gray-400">Sin pedidos registrados</td></tr>
                                    ) : (
                                        pedidos.map((p, i) => (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${p.estado === 'entregado' || p.estado === 'listo' ? 'bg-green-500' : p.estado === 'cancelado' ? 'bg-red-500' : 'bg-blue-500'}`} />
                                                        <span className="font-medium text-purple-600">{p.numero_pedido}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-gray-900">{fmt(p.total)}</td>
                                                <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                                    {formatDate(p.created_at)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
