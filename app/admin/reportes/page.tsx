"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Download, Filter, TrendingUp, ShoppingBag, PieChart as PieChartIcon, BarChart3 } from "lucide-react";

function DonutChart({ delivery, takeaway }: { delivery: number, takeaway: number }) {
    const total = delivery + takeaway;
    if (total === 0) return <div className="w-32 h-32 rounded-full border-4 border-gray-100 flex items-center justify-center text-[10px] text-gray-300 font-bold uppercase">No data</div>;

    const pctDelivery = (delivery / total) * 100;
    const strokeDasharray = `${pctDelivery} ${100 - pctDelivery}`;

    return (
        <div className="relative w-32 h-32">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f97316" strokeWidth="4" />
                <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#9333ea" strokeWidth="4"
                    strokeDasharray={strokeDasharray} strokeDashoffset="0" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-black text-gray-900 leading-none">{total}</span>
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total</span>
            </div>
        </div>
    );
}

function BarChart({ data }: { data: { label: string, value: number }[] }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="flex items-end gap-2 h-32 w-full pt-4">
            {data.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                    <div
                        className="w-full bg-purple-100 group-hover:bg-purple-600 transition-colors rounded-t-sm relative"
                        style={{ height: `${(d.value / max) * 100}%` }}
                    >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                            ${d.value}
                        </div>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{d.label}</span>
                </div>
            ))}
        </div>
    );
}


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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Facturación total */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-8 shadow-sm">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-2 bg-green-50 rounded-lg text-green-600">
                                        <TrendingUp size={20} />
                                    </div>
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Facturación Total</p>
                                </div>
                                <p className="text-4xl font-black text-gray-900 mb-6">$ {new Intl.NumberFormat("es-AR").format(totalFacturado)}</p>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-purple-600" />
                                            <span className="text-sm text-gray-600">Delivery</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(totalDelivery)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                                            <span className="text-sm text-gray-600">Take Away</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(totalTakeaway)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="hidden sm:block">
                                <DonutChart delivery={totalDelivery} takeaway={totalTakeaway} />
                            </div>
                        </div>

                        {/* Pedidos totales / Tendencia */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                        <BarChart3 size={20} />
                                    </div>
                                    <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Tendencia 7 días</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-gray-900">{totalPedidos}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase">Pedidos totales</p>
                                </div>
                            </div>

                            <BarChart data={[
                                { label: 'Lun', value: 12000 },
                                { label: 'Mar', value: 15000 },
                                { label: 'Mie', value: 8000 },
                                { label: 'Jue', value: 19000 },
                                { label: 'Vie', value: 25000 },
                                { label: 'Sab', value: 32000 },
                                { label: 'Dom', value: 28000 },
                            ]} />
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
