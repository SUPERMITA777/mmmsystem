"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Download, Filter } from "lucide-react";

export default function ReportesPage() {
    const [tab, setTab] = useState<"facturacion" | "ventas">("facturacion");
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    async function fetchData() {
        const { data } = await supabase.from("pedidos").select("*").order("created_at", { ascending: false });
        setPedidos(data || []);
        setLoading(false);
    }

    const totalFacturado = pedidos.reduce((s, p) => s + Number(p.total), 0);
    const totalDelivery = pedidos.filter(p => p.tipo === "delivery").reduce((s, p) => s + Number(p.total), 0);
    const totalTakeaway = pedidos.filter(p => p.tipo === "takeaway").reduce((s, p) => s + Number(p.total), 0);
    const deliveryCount = pedidos.filter(p => p.tipo === "delivery").length;
    const takeawayCount = pedidos.filter(p => p.tipo === "takeaway").length;
    const totalPedidos = pedidos.length;

    const pctDelivery = totalPedidos > 0 ? ((deliveryCount / totalPedidos) * 100).toFixed(1) : "0";
    const pctTakeaway = totalPedidos > 0 ? ((takeawayCount / totalPedidos) * 100).toFixed(1) : "0";

    return (
        <section className="p-6">
            {/* Filters */}
            <div className="flex gap-3 mb-6 flex-wrap">
                <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
                    <legend className="text-[10px] text-gray-500 px-1">Fecha creación</legend>
                    <input type="text" readOnly value={`${new Date().toLocaleDateString("es-AR")} – ${new Date().toLocaleDateString("es-AR")}`} className="bg-transparent outline-none text-sm text-gray-900 w-44" />
                </fieldset>
                <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
                    <legend className="text-[10px] text-gray-500 px-1">Turno</legend>
                    <select className="bg-transparent outline-none text-sm text-gray-900 min-w-[100px]">
                        <option>Todos</option>
                    </select>
                </fieldset>
                <fieldset className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white">
                    <legend className="text-[10px] text-gray-500 px-1">Modalidad</legend>
                    <select className="bg-transparent outline-none text-sm text-gray-900 min-w-[160px]">
                        <option>Delivery, Take Away, Salón</option>
                    </select>
                </fieldset>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 border-b border-gray-200 mb-6">
                {[
                    { key: "facturacion", label: "Facturación" },
                    { key: "ventas", label: "Ventas" },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as any)}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? "border-purple-600 text-gray-900" : "border-transparent text-gray-400"}`}
                    >{t.label}</button>
                ))}
            </div>

            {loading ? <p className="text-center text-gray-400 py-10">Cargando reportes...</p> : (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Facturación total */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <p className="text-3xl font-black text-green-600">{new Intl.NumberFormat("es-AR").format(totalFacturado)}</p>
                            <p className="text-sm text-gray-500 mb-3">Facturación total</p>
                            <div className="flex gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                    <span className="w-1 h-4 bg-purple-600 rounded-full" />
                                    <span className="font-bold text-gray-900">{new Intl.NumberFormat("es-AR").format(totalDelivery)}</span>
                                    <span className="text-gray-500 text-xs">Delivery</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="w-1 h-4 bg-orange-500 rounded-full" />
                                    <span className="font-bold text-gray-900">{new Intl.NumberFormat("es-AR").format(totalTakeaway)}</span>
                                    <span className="text-gray-500 text-xs">Take Away</span>
                                </div>
                            </div>
                        </div>

                        {/* Pedidos totales */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6">
                            <p className="text-3xl font-black text-green-600">{totalPedidos}</p>
                            <p className="text-sm text-gray-500 mb-3">Pedidos totales</p>
                            <div className="flex gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                    <span className="w-1 h-4 bg-purple-600 rounded-full" />
                                    <span className="font-bold text-gray-900">{deliveryCount}</span>
                                    <span className="text-gray-500 text-xs">Delivery {pctDelivery}%</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="w-1 h-4 bg-orange-500 rounded-full" />
                                    <span className="font-bold text-gray-900">{takeawayCount}</span>
                                    <span className="text-gray-500 text-xs">Take Away {pctTakeaway}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detail table */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900">Delivery</h3>
                            <button className="flex items-center gap-1 text-purple-600 text-sm font-medium hover:underline">
                                <Download size={14} /> Exportar
                            </button>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                                    <th className="text-left py-2 font-semibold">Pago</th>
                                    <th className="text-right py-2 font-semibold">Ticket prom.</th>
                                    <th className="text-right py-2 font-semibold">Productos + Extras</th>
                                    <th className="text-right py-2 font-semibold">Delivery</th>
                                    <th className="text-right py-2 font-semibold">Propinas</th>
                                    <th className="text-right py-2 font-semibold">Facturado</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-50">
                                    <td className="py-2 text-gray-900">Efectivo</td>
                                    <td className="py-2 text-right text-gray-700">$ {deliveryCount > 0 ? new Intl.NumberFormat("es-AR").format(totalDelivery / deliveryCount) : "0"}</td>
                                    <td className="py-2 text-right text-gray-700">$ {new Intl.NumberFormat("es-AR").format(totalDelivery)}</td>
                                    <td className="py-2 text-right text-gray-700">$ {new Intl.NumberFormat("es-AR").format(pedidos.filter(p => p.tipo === "delivery").reduce((s, p) => s + Number(p.costo_envio || 0), 0))}</td>
                                    <td className="py-2 text-right text-gray-700">$ {new Intl.NumberFormat("es-AR").format(pedidos.filter(p => p.tipo === "delivery").reduce((s, p) => s + Number(p.propina || 0), 0))}</td>
                                    <td className="py-2 text-right font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(totalDelivery)}</td>
                                </tr>
                                <tr className="font-bold text-gray-900">
                                    <td className="py-2">TOTAL</td>
                                    <td className="py-2 text-right">$ {deliveryCount > 0 ? new Intl.NumberFormat("es-AR").format(totalDelivery / deliveryCount) : "0"}</td>
                                    <td className="py-2 text-right">$ {new Intl.NumberFormat("es-AR").format(totalDelivery)}</td>
                                    <td className="py-2 text-right">$ {new Intl.NumberFormat("es-AR").format(pedidos.filter(p => p.tipo === "delivery").reduce((s, p) => s + Number(p.costo_envio || 0), 0))}</td>
                                    <td className="py-2 text-right">$ {new Intl.NumberFormat("es-AR").format(pedidos.filter(p => p.tipo === "delivery").reduce((s, p) => s + Number(p.propina || 0), 0))}</td>
                                    <td className="py-2 text-right">$ {new Intl.NumberFormat("es-AR").format(totalDelivery)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </section>
    );
}
