"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, Clock, ChevronDown, ChevronUp, ShoppingBag, X } from "lucide-react";

type Adicional = { nombre: string; precio: number };
type PedidoItem = {
    id: string;
    nombre_producto: string;
    cantidad: number;
    notas: string;
    precio_unitario: number;
    adicionales?: Adicional[];
    producto_id?: string;
};
type Pedido = {
    id: string;
    numero_pedido: string;
    tipo: string;
    created_at: string;
    cliente_nombre: string;
    pedido_items: PedidoItem[];
};

export default function MonitorCocinaPage() {
    const [pedidos, setPedidos] = useState<Pedido[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [now, setNow] = useState(Date.now());
    const [productoImagenes, setProductoImagenes] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchPedidos();
        const ch = supabase
            .channel("cocina-rt")
            .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchPedidos())
            .subscribe();
        const timer = setInterval(() => setNow(Date.now()), 30000); // Update every 30s
        return () => { supabase.removeChannel(ch); clearInterval(timer); };
    }, []);

    async function fetchPedidos() {
        const { data } = await supabase
            .from("pedidos")
            .select("id, numero_pedido, tipo, created_at, cliente_nombre, pedido_items(id, nombre_producto, cantidad, notas, precio_unitario, adicionales, producto_id)")
            .eq("estado", "preparando")
            .order("created_at", { ascending: true });
        setPedidos(data || []);

        // Pre-fetch product images
        const prodIds = new Set<string>();
        (data || []).forEach(p => p.pedido_items?.forEach(item => {
            if (item.producto_id) prodIds.add(item.producto_id);
        }));
        if (prodIds.size > 0) {
            const { data: prods } = await supabase
                .from("productos")
                .select("id, imagen_url")
                .in("id", Array.from(prodIds));
            const map: Record<string, string> = {};
            prods?.forEach(p => { if (p.imagen_url) map[p.id] = p.imagen_url; });
            setProductoImagenes(prev => ({ ...prev, ...map }));
        }
    }

    async function marcarListo(id: string) {
        await supabase.from("pedidos").update({ estado: "listo" }).eq("id", id);
        if (expandedId === id) setExpandedId(null);
        fetchPedidos();
    }

    function getMinutes(dateStr: string) {
        return Math.floor((now - new Date(dateStr).getTime()) / 60000);
    }

    function getMinuteColor(mins: number) {
        if (mins >= 30) return "text-red-400 bg-red-500/10";
        if (mins >= 15) return "text-orange-400 bg-orange-500/10";
        return "text-green-400 bg-green-500/10";
    }

    const expanded = expandedId ? pedidos.find(p => p.id === expandedId) : null;

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-800/50 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🍳</span>
                    <h1 className="text-xl font-black text-white tracking-tight">Monitor de Cocina</h1>
                    <span className="bg-purple-500/20 text-purple-300 text-xs font-bold px-3 py-1 rounded-full">
                        {pedidos.length} en preparación
                    </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <Clock size={12} />
                    <span>{new Date(now).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {pedidos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-gray-600">
                        <p className="text-5xl mb-4">✅</p>
                        <p className="text-lg font-bold text-gray-400">Sin pedidos en preparación</p>
                        <p className="text-sm mt-1 text-gray-600">Los nuevos pedidos aparecerán automáticamente</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {pedidos.map(p => {
                            const mins = getMinutes(p.created_at);
                            const isExpanded = expandedId === p.id;

                            return (
                                <div
                                    key={p.id}
                                    className={`bg-gray-900 rounded-2xl border transition-all cursor-pointer ${isExpanded ? "border-purple-500/50 shadow-lg shadow-purple-500/10" : "border-gray-800 hover:border-gray-700"}`}
                                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                                >
                                    {/* Header */}
                                    <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-black text-white">{p.numero_pedido}</span>
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${p.tipo === "delivery" ? "bg-blue-900/50 text-blue-300 border border-blue-800/30" : "bg-purple-900/50 text-purple-300 border border-purple-800/30"}`}>
                                                {p.tipo}
                                            </span>
                                        </div>
                                        <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${getMinuteColor(mins)}`}>
                                            <Clock size={12} />
                                            <span>{mins} min</span>
                                        </div>
                                    </div>

                                    {/* Client Name */}
                                    {p.cliente_nombre && (
                                        <div className="px-5 pb-2 text-xs text-gray-500 font-medium truncate">
                                            👤 {p.cliente_nombre}
                                        </div>
                                    )}

                                    {/* Items */}
                                    <div className="px-5 pb-3 space-y-2">
                                        {p.pedido_items.map(item => (
                                            <div key={item.id}>
                                                <div className="flex items-start gap-2">
                                                    <span className="text-sm font-black text-orange-400 shrink-0">{item.cantidad}x</span>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-bold text-white">{item.nombre_producto}</span>
                                                        {/* Adicionales */}
                                                        {item.adicionales && item.adicionales.length > 0 && (
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {item.adicionales.map((ad, idx) => (
                                                                    <span key={idx} className="text-[10px] bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium">
                                                                        + {ad.nombre}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {item.notas && (
                                                    <p className="text-xs text-yellow-500 mt-0.5 pl-7 italic">→ {item.notas}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Expand indicator */}
                                    <div className="border-t border-gray-800/50 px-5 py-2 flex items-center justify-center text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        <span className="ml-1">{isExpanded ? "Cerrar" : "Ver detalle"}</span>
                                    </div>

                                    {/* Expanded Detail */}
                                    {isExpanded && (
                                        <div className="border-t border-gray-800 px-5 py-4 space-y-4" onClick={e => e.stopPropagation()}>
                                            {/* Product items with images */}
                                            <div className="space-y-3">
                                                {p.pedido_items.map(item => {
                                                    const imgUrl = item.producto_id ? productoImagenes[item.producto_id] : null;
                                                    return (
                                                        <div key={item.id} className="flex gap-3 bg-gray-800/50 rounded-xl p-3">
                                                            {/* Product Image */}
                                                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 shrink-0">
                                                                {imgUrl ? (
                                                                    <img src={imgUrl} alt={item.nombre_producto} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                                        <ShoppingBag size={20} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-black text-white">{item.cantidad}x {item.nombre_producto}</p>
                                                                {item.adicionales && item.adicionales.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {item.adicionales.map((ad, idx) => (
                                                                            <span key={idx} className="text-[10px] bg-purple-500/15 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 font-medium">
                                                                                + {ad.nombre}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {item.notas && <p className="text-xs text-yellow-500 mt-1 italic">→ {item.notas}</p>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Pedido Listo Button */}
                                            <button
                                                onClick={() => marcarListo(p.id)}
                                                className="w-full bg-green-600 hover:bg-green-500 active:scale-[0.98] text-white font-black py-5 rounded-xl text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-600/20"
                                            >
                                                <Check size={24} strokeWidth={3} />
                                                PEDIDO LISTO
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
