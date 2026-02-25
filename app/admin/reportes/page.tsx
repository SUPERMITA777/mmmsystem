"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Download, TrendingUp, BarChart3, PieChart as PieChartIcon, Search, Calendar, ChevronLeft, ChevronRight } from "lucide-react";

// --- Components ---

function DonutChart({ data, colors }: { data: { label: string, value: number }[], colors: string[] }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return (
        <div className="w-24 h-24 rounded-full border-2 border-gray-100 flex items-center justify-center text-[8px] text-gray-300 font-bold uppercase">No data</div>
    );

    let currentPercent = 0;
    return (
        <div className="relative w-24 h-24">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {data.map((d, i) => {
                    const percent = (d.value / total) * 100;
                    const dashArray = `${percent} ${100 - percent}`;
                    const dashOffset = -currentPercent;
                    currentPercent += percent;
                    return (
                        <circle
                            key={i}
                            cx="18"
                            cy="18"
                            r="15.915"
                            fill="transparent"
                            stroke={colors[i % colors.length]}
                            strokeWidth="5"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-black text-gray-900 leading-none">{total > 1000 ? (total / 1000).toFixed(1) + 'k' : total}</span>
            </div>
        </div>
    );
}

const COLORS = ["#9333ea", "#f97316", "#06b6d4", "#10b981", "#ef4444", "#f59e0b"];

export default function ReportesPage() {
    const [tab, setTab] = useState<"facturacion" | "ventas">("facturacion");
    const [loading, setLoading] = useState(true);
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Dates
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

    useEffect(() => {
        fetchData();
    }, [startDate, endDate]);

    async function fetchData() {
        setLoading(true);
        try {
            // Fetch Pedidos
            const { data: pedidosData } = await supabase
                .from("pedidos")
                .select("*, metodos_pago(*)")
                .gte("created_at", `${startDate}T00:00:00`)
                .lte("created_at", `${endDate}T23:59:59`)
                .order("created_at", { ascending: false });

            setPedidos(pedidosData || []);

            // Fetch Items for sales tab
            if (pedidosData && pedidosData.length > 0) {
                const pedidoIds = pedidosData.map(p => p.id);
                const { data: itemsData } = await supabase
                    .from("pedido_items")
                    .select("*")
                    .in("pedido_id", pedidoIds);
                setItems(itemsData || []);
            } else {
                setItems([]);
            }
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    }

    // --- Calculations ---
    const totalFacturado = pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const ticketPromedio = pedidos.length > 0 ? totalFacturado / pedidos.length : 0;

    // Group by Payment Method
    const metodosDist = pedidos.reduce((acc: any, p) => {
        const key = p.metodo_pago_nombre || "Otro";
        if (!acc[key]) acc[key] = { label: key, value: 0, count: 0, propina: 0, envio: 0 };
        acc[key].value += Number(p.total || 0);
        acc[key].count += 1;
        acc[key].envio += Number(p.costo_envio || 0);
        acc[key].propina += Number(p.propina || 0);
        return acc;
    }, {});
    const metodosArray = Object.values(metodosDist).sort((a: any, b: any) => b.value - a.value);

    // Group by Modality
    const modalidadDist = pedidos.reduce((acc: any, p) => {
        const key = p.tipo || "otro";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    const modArray = [
        { label: "Delivery", value: modalidadDist.delivery || 0 },
        { label: "Take Away", value: modalidadDist.takeaway || 0 },
        { label: "Salón", value: modalidadDist.salon || 0 },
    ].filter(m => m.value > 0);

    // Group items for Ventas tab
    const productStats = items.reduce((acc: any, item) => {
        const key = item.producto_id || item.nombre_producto;
        if (!acc[key]) acc[key] = { nombre: item.nombre_producto, cant: 0, total: 0, precio: item.precio_unitario };
        acc[key].cant += item.cantidad;
        acc[key].total += Number(item.subtotal || 0);
        return acc;
    }, {});
    const productsArray = Object.values(productStats)
        .filter((p: any) => p.nombre.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a: any, b: any) => b.total - a.total);

    function exportToCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";
        if (tab === "facturacion") {
            csvContent += "Metodo,Pedidos,Ticket Prom,Envio,Propinas,Total\n";
            metodosArray.forEach((m: any) => {
                csvContent += `${m.label},${m.count},${(m.value / m.count).toFixed(2)},${m.envio},${m.propina},${m.value}\n`;
            });
        } else {
            csvContent += "Producto,Cantidad,Precio Unit,Total Recaudado\n";
            productsArray.forEach((p: any) => {
                csvContent += `${p.nombre},${p.cant},${p.precio},${p.total}\n`;
            });
        }
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_${tab}_${startDate}.csv`);
        document.body.appendChild(link);
        link.click();
    }

    return (
        <section className="p-8 max-w-7xl mx-auto">
            {/* Header / Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4 bg-white p-1 rounded-2xl border border-gray-200 shadow-sm transition-all">
                    <button
                        onClick={() => setTab("facturacion")}
                        className={`px-6 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${tab === "facturacion" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        Facturación
                    </button>
                    <button
                        onClick={() => setTab("ventas")}
                        className={`px-6 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${tab === "ventas" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        Ventas
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
                        <Calendar size={16} className="text-gray-400" />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-xs font-bold text-gray-700 outline-none uppercase bg-transparent"
                        />
                        <span className="text-gray-300 mx-1">—</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-xs font-bold text-gray-700 outline-none uppercase bg-transparent"
                        />
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="p-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-md active:scale-95 flex items-center gap-2"
                    >
                        <Download size={18} />
                        <span className="hidden sm:inline text-xs font-black uppercase tracking-widest">Exportar</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Analizando datos...</p>
                </div>
            ) : (
                <>
                    {tab === "facturacion" ? (
                        <div className="space-y-6">
                            {/* KPI Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                                            <TrendingUp size={24} />
                                        </div>
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Facturación Bruta</h3>
                                    </div>
                                    <p className="text-4xl font-black text-gray-900 leading-none">
                                        $ {new Intl.NumberFormat("es-AR").format(totalFacturado)}
                                    </p>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                            <TrendingUp size={24} />
                                        </div>
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Ticket Promedio</h3>
                                    </div>
                                    <p className="text-4xl font-black text-gray-900 leading-none">
                                        $ {new Intl.NumberFormat("es-AR").format(ticketPromedio)}
                                    </p>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                                            <BarChart3 size={24} />
                                        </div>
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pedidos Totales</h3>
                                    </div>
                                    <p className="text-4xl font-black text-gray-900 leading-none">
                                        {pedidos.length}
                                    </p>
                                </div>
                            </div>

                            {/* Charts Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6 border-b border-gray-50 pb-4">Métodos de Pago</h4>
                                    <div className="flex items-center gap-10">
                                        <DonutChart
                                            data={metodosArray.map(m => ({ label: m.label, value: m.value }))}
                                            colors={COLORS}
                                        />
                                        <div className="flex-1 space-y-3">
                                            {metodosArray.slice(0, 4).map((m: any, i) => (
                                                <div key={i} className="flex items-center justify-between group">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                        <span className="text-xs font-bold text-gray-500 uppercase">{m.label}</span>
                                                    </div>
                                                    <span className="text-xs font-black text-gray-900">$ {new Intl.NumberFormat("es-AR").format(m.value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6 border-b border-gray-50 pb-4">Modalidades de Venta</h4>
                                    <div className="flex items-center gap-10">
                                        <DonutChart data={modArray} colors={["#f97316", "#9333ea", "#06b6d4"]} />
                                        <div className="flex-1 space-y-3">
                                            {modArray.map((m, i) => (
                                                <div key={i} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ["#f97316", "#9333ea", "#06b6d4"][i] }} />
                                                        <span className="text-xs font-bold text-gray-500 uppercase">{m.label}</span>
                                                    </div>
                                                    <span className="text-xs font-black text-gray-900">{m.value} pedidos</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Table */}
                            <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Desglose de Facturación</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-white border-b border-gray-50">
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Método</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Pedidos</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Ticket Prom.</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Envíos</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Propinas</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {metodosArray.map((m: any, i) => (
                                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4 text-xs font-bold text-gray-900 uppercase">{m.label}</td>
                                                    <td className="px-6 py-4 text-center text-xs font-black text-gray-900">{m.count}</td>
                                                    <td className="px-6 py-4 text-right text-xs font-bold text-gray-600">$ {m.count > 0 ? (m.value / m.count).toFixed(0) : 0}</td>
                                                    <td className="px-6 py-4 text-right text-xs font-bold text-gray-600">$ {m.envio}</td>
                                                    <td className="px-6 py-4 text-right text-xs font-bold text-gray-600">$ {m.propina}</td>
                                                    <td className="px-6 py-4 text-right text-sm font-black text-purple-600">$ {new Intl.NumberFormat("es-AR").format(m.value)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-50/80">
                                                <td className="px-6 py-5 text-xs font-black text-gray-900 uppercase">Total General</td>
                                                <td className="px-6 py-5 text-center text-xs font-black text-gray-900">{pedidos.length}</td>
                                                <td className="px-6 py-5 text-right text-xs font-black text-gray-900">$ {ticketPromedio.toFixed(0)}</td>
                                                <td className="px-6 py-5 text-right text-xs font-black text-gray-900">$ {pedidos.reduce((s, p) => s + Number(p.costo_envio || 0), 0)}</td>
                                                <td className="px-6 py-5 text-right text-xs font-black text-gray-900">$ {pedidos.reduce((s, p) => s + Number(p.propina || 0), 0)}</td>
                                                <td className="px-6 py-5 text-right text-base font-black text-purple-600">$ {new Intl.NumberFormat("es-AR").format(totalFacturado)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Ventas Search & Table */}
                            <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-gray-50 flex items-center justify-between flex-wrap gap-4">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Rendimiento por Producto</h4>
                                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 w-full max-w-xs shadow-inner">
                                        <Search size={14} className="text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="FILTRAR PRODUCTO..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="bg-transparent outline-none text-[10px] font-black uppercase text-gray-900 w-full"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-50">
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre del Producto</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Precio Act.</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Cantidad Vendida</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Recaudación Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {productsArray.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-20 text-center text-gray-300 font-bold uppercase tracking-[0.3em] text-[10px]">Sin resultados</td>
                                                </tr>
                                            ) : productsArray.map((p: any, i) => (
                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-black text-gray-900 uppercase tracking-wide">{p.nombre}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-xs font-bold text-gray-600 tracking-tight">$ {new Intl.NumberFormat("es-AR").format(p.precio)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-black text-gray-900">{p.cant}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-sm font-black text-purple-600">$ {new Intl.NumberFormat("es-AR").format(p.total)}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
