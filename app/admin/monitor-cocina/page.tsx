"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Check, Clock } from "lucide-react";

type PedidoItem = { id: string; nombre_producto: string; cantidad: number; notas: string };
type Pedido = { id: string; numero_pedido: string; tipo: string; created_at: string; pedido_items: PedidoItem[] };

export default function MonitorCocinaPage() {
    const [pedidos, setPedidos] = useState<Pedido[]>([]);

    useEffect(() => {
        fetchPedidos();
        const ch = supabase
            .channel("cocina-rt")
            .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => fetchPedidos())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, []);

    async function fetchPedidos() {
        const { data } = await supabase
            .from("pedidos")
            .select("id, numero_pedido, tipo, created_at, pedido_items(id, nombre_producto, cantidad, notas)")
            .eq("estado", "preparando")
            .order("created_at", { ascending: true });
        setPedidos(data || []);
    }

    async function marcarListo(id: string) {
        await supabase.from("pedidos").update({ estado: "listo" }).eq("id", id);
        fetchPedidos();
    }

    function tiempoTranscurrido(dateStr: string) {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        return `${mins} min`;
    }

    return (
        <div className="min-h-screen bg-gray-950 p-6">
            <h1 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
                🍳 Monitor de Cocina
                <span className="text-sm font-normal text-gray-400 ml-2">{pedidos.length} en preparación</span>
            </h1>

            {pedidos.length === 0 ? (
                <div className="text-center py-24 text-gray-500">
                    <p className="text-4xl mb-3">✅</p>
                    <p className="text-lg font-medium">Sin pedidos en preparación</p>
                    <p className="text-sm mt-1">Los nuevos pedidos aparecerán automáticamente</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {pedidos.map(p => (
                        <div key={p.id} className="bg-gray-900 rounded-2xl border border-gray-800 p-5 flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-lg font-black text-white">{p.numero_pedido}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.tipo === "delivery" ? "bg-blue-900 text-blue-300" : "bg-purple-900 text-purple-300"
                                    }`}>
                                    {p.tipo}
                                </span>
                            </div>

                            {/* Timer */}
                            <div className="flex items-center gap-1 text-orange-400 text-sm font-bold mb-3">
                                <Clock size={14} />
                                {tiempoTranscurrido(p.created_at)}
                            </div>

                            {/* Items */}
                            <div className="flex-1 space-y-2 mb-4">
                                {p.pedido_items.map(item => (
                                    <div key={item.id} className="text-sm">
                                        <span className="text-white font-bold">{item.cantidad}x</span>
                                        <span className="text-gray-300 ml-2">{item.nombre_producto}</span>
                                        {item.notas && <p className="text-xs text-yellow-500 mt-0.5 pl-5">→ {item.notas}</p>}
                                    </div>
                                ))}
                            </div>

                            {/* LISTO button */}
                            <button
                                onClick={() => marcarListo(p.id)}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl text-lg transition-colors flex items-center justify-center gap-2"
                            >
                                <Check size={22} strokeWidth={3} />
                                LISTO
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
