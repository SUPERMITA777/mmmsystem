"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, Truck } from "lucide-react";

type RepartidorReport = {
    nombre: string;
    totalPedidos: number;
    totalMonto: number;
    totalEnvios: number;
};

export default function RepartidoresPage() {
    const [tab, setTab] = useState<"envios" | "mis_envios">("envios");
    const [reportes, setReportes] = useState<RepartidorReport[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchReportes(); }, []);

    async function fetchReportes() {
        const { data: pedidos } = await supabase
            .from("pedidos")
            .select("repartidor_id, total, costo_envio")
            .eq("tipo", "delivery")
            .not("repartidor_id", "is", null);

        const { data: reps } = await supabase.from("repartidores").select("*");

        if (reps && pedidos) {
            const map = new Map<string, RepartidorReport>();
            reps.forEach(r => map.set(r.id, { nombre: r.nombre, totalPedidos: 0, totalMonto: 0, totalEnvios: 0 }));
            pedidos.forEach((p: any) => {
                const rep = map.get(p.repartidor_id);
                if (rep) {
                    rep.totalPedidos++;
                    rep.totalMonto += Number(p.total);
                    rep.totalEnvios += Number(p.costo_envio);
                }
            });
            setReportes(Array.from(map.values()));
        }

        // Also show "Sin asignar" for delivery orders without repartidor
        const { data: sinAsignar } = await supabase
            .from("pedidos")
            .select("total, costo_envio")
            .eq("tipo", "delivery")
            .is("repartidor_id", null);

        if (sinAsignar && sinAsignar.length > 0) {
            setReportes(prev => [{
                nombre: "Sin asignar",
                totalPedidos: sinAsignar.length,
                totalMonto: sinAsignar.reduce((s, p) => s + Number(p.total), 0),
                totalEnvios: sinAsignar.reduce((s, p) => s + Number(p.costo_envio), 0),
            }, ...prev]);
        }
        setLoading(false);
    }

    return (
        <section className="p-6">
            {/* Tabs */}
            <div className="flex gap-6 border-b border-gray-200 mb-6">
                {[
                    { key: "envios", label: "Envíos" },
                    { key: "mis_envios", label: "Mis envíos" },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key as any)}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? "border-purple-600 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-1">Reportes de envíos</h2>
            <p className="text-sm text-gray-500 mb-6">Visualiza y analiza los reportes de envíos por repartidor.</p>

            {loading ? (
                <p className="text-gray-400 text-center py-10">Cargando...</p>
            ) : reportes.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <Truck size={40} className="mx-auto mb-3 text-gray-300" />
                    <p>No hay envíos registrados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reportes.map((rep, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-gray-900">{rep.nombre}</h3>
                                <button className="text-purple-600 text-xs font-medium hover:underline">Pedidos</button>
                            </div>
                            <div className="flex justify-between mb-3">
                                <span className="text-sm text-gray-600">{rep.totalPedidos} Pedidos</span>
                                <span className="text-sm font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(rep.totalMonto)}</span>
                            </div>
                            <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
                                <div className="flex justify-between text-gray-600">
                                    <span>💵 Efectivo</span>
                                    <span>$ {new Intl.NumberFormat("es-AR").format(rep.totalMonto)}</span>
                                </div>
                                <div className="flex justify-between text-gray-600">
                                    <span>💳 Pagos Online</span>
                                    <span>$ 0</span>
                                </div>
                            </div>
                            <div className="mt-3 border-t border-gray-100 pt-3">
                                <div className="flex justify-between text-sm font-bold text-gray-900">
                                    <span>Envíos</span>
                                    <span>$ {new Intl.NumberFormat("es-AR").format(rep.totalEnvios)}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
