"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Download, TrendingUp, BarChart3, PieChart as PieChartIcon, Search, Calendar, ChevronLeft, ChevronRight, Wallet, User, ArrowUpRight, ArrowDownRight, ClipboardList, Printer } from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import { getArgentinaDate, getArgentinaFirstDayOfMonth, getStartOfDayArgentina, getEndOfDayArgentina, getArgentinaYesterday, formatToArgentinaDateTime } from "@/lib/dateUtils";
import { printCierreTurno } from "@/lib/printUtils";

// --- Components ---
import AsignarCostoModal from "@/components/admin/reportes/AsignarCostoModal";

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
    const [tab, setTab] = useState<"facturacion" | "ventas" | "rentabilidad" | "turnos">("facturacion");
    const [loading, setLoading] = useState(true);
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [productsWithCosts, setProductsWithCosts] = useState<any[]>([]);
    const [cajas, setCajas] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isMounted, setIsMounted] = useState(false);
    const { sucursalId } = useTenant();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Cost Modal State
    const [isCostoModalOpen, setIsCostoModalOpen] = useState(false);
    const [selectedProductForCosto, setSelectedProductForCosto] = useState<any>(null);

    // Printing state and function for closed shifts
    const [printingCajaId, setPrintingCajaId] = useState<string | null>(null);

    async function handleImprimirCierre(caja: any) {
        if (!sucursalId) return;
        setPrintingCajaId(caja.id);
        try {
            // 1. Obtener pedidos del turno para las estadísticas del reporte
            const { data: pedidosTurno } = await supabase
                .from("pedidos")
                .select("total, tipo, comensales, metodo_pago_nombre, metodos_pago(nombre), descuento, notas_internas, numero_pedido, estado, notas")
                .eq("sucursal_id", sucursalId)
                .gte("created_at", caja.fecha_apertura)
                .lte("created_at", caja.fecha_cierre || new Date().toISOString());

            const safePedidos = pedidosTurno || [];

            // Ventas Salon
            const pedidosSalon = safePedidos.filter(p => p.estado === 'entregado' && (p.tipo === 'salon' || p.tipo === 'mesa'));
            const salonCount = pedidosSalon.length;
            const salonTotal = pedidosSalon.reduce((sum, p) => sum + Number(p.total || 0), 0);

            // Ventas Take Away
            const pedidosTakeAway = safePedidos.filter(p => p.estado === 'entregado' && p.tipo === 'takeaway');
            const takeawayCount = pedidosTakeAway.length;
            const takeawayTotal = pedidosTakeAway.reduce((sum, p) => sum + Number(p.total || 0), 0);

            // Ventas Delivery
            const pedidosDelivery = safePedidos.filter(p => p.estado === 'entregado' && p.tipo === 'delivery');
            const deliveryCount = pedidosDelivery.length;
            const deliveryTotal = pedidosDelivery.reduce((sum, p) => sum + Number(p.total || 0), 0);

            // Comensales Salon
            const comensalesSalonCount = pedidosSalon.reduce((sum, p) => sum + Number(p.comensales || 0), 0);

            // Medios de pago
            const pagosMap: Record<string, number> = {};
            safePedidos.filter(p => p.estado === 'entregado').forEach(p => {
                const metodo = p.metodo_pago_nombre || (p.metodos_pago as any)?.nombre || "Efectivo";
                pagosMap[metodo] = (pagosMap[metodo] || 0) + Number(p.total || 0);
            });
            const pagosList = Object.entries(pagosMap).map(([metodo, total]) => ({ metodo, total }));

            // Egresos manuales
            const manualOutflows = (caja.transacciones_caja || [])
                .filter((t: any) => t.tipo === "egreso")
                .reduce((sum: number, t: any) => sum + Number(t.monto || 0), 0);

            // Total General
            const grandTotal = safePedidos.filter(p => p.estado === 'entregado').reduce((sum, p) => sum + Number(p.total || 0), 0);

            // Descuentos
            const descuentosList = safePedidos
                .filter(p => p.estado === 'entregado' && Number(p.descuento || 0) > 0)
                .map(p => ({
                    numero: p.numero_pedido?.split("-").pop() ?? p.numero_pedido,
                    monto: Number(p.descuento),
                    motivo: p.notas_internas || "Descuento en pedido"
                }));

            // Cancelados
            const canceladosList = safePedidos
                .filter(p => p.estado === 'cancelado')
                .map(p => ({
                    numero: p.numero_pedido?.split("-").pop() ?? p.numero_pedido,
                    monto: Number(p.total || 0),
                    motivo: p.notas || "Pedido anulado/cancelado"
                }));

            const { data: configImpresion } = await supabase.from("config_impresion").select("*").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
            const { data: configSuc } = await supabase.from("config_sucursal").select("panel_settings").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
            const { data: sucursalInfo } = await supabase.from("sucursales").select("nombre").eq("id", sucursalId).limit(1).maybeSingle();

            const printConfig = {
                ...configImpresion,
                boldMap: configSuc?.panel_settings?.print_bold || {},
                fuente_adicionales: configSuc?.panel_settings?.fuente_adicionales,
                impresoras: configSuc?.panel_settings?.impresoras || {},
                bridge_ip: configSuc?.panel_settings?.bridge_ip || "127.0.0.1",
                nombre_local: sucursalInfo?.nombre || "MMM Pizza Artesanal"
            };

            const manual = (caja.transacciones_caja || []).reduce((s: number, t: any) => t.tipo === 'ingreso' ? s + Number(t.monto) : s - Number(t.monto), 0);
            const ventasEfvo = (caja.monto_esperado || 0) - caja.monto_apertura - manual;
            const esperado = caja.monto_apertura + manual + ventasEfvo;

            const resumenData = {
                nombreCajero: caja.cajero_nombre || "Cajero",
                fechaApertura: caja.fecha_apertura,
                fechaCierre: caja.fecha_cierre || new Date().toISOString(),
                pedidosSalonCount: salonCount,
                pedidosSalonTotal: salonTotal,
                pedidosTakeAwayCount: takeawayCount,
                pedidosTakeAwayTotal: takeawayTotal,
                pedidosDeliveryCount: deliveryCount,
                pedidosDeliveryTotal: deliveryTotal,
                comensalesSalon: comensalesSalonCount,
                pagos: pagosList,
                totalEgresado: manualOutflows,
                totalGeneral: grandTotal,
                montoApertura: caja.monto_apertura,
                montoEsperado: esperado,
                montoCierre: caja.monto_cierre,
                diferencia: caja.diferencia,
                observaciones: caja.notas || "",
                descuentos: descuentosList,
                cancelados: canceladosList
            };

            printCierreTurno(resumenData, printConfig);
        } catch (err) {
            console.error("Error al reimprimir turno:", err);
            alert("No se pudo reimprimir el reporte del turno.");
        } finally {
            setPrintingCajaId(null);
        }
    }

    // Dates
    const [startDate, setStartDate] = useState(getArgentinaDate());
    const [endDate, setEndDate] = useState(getArgentinaDate());

    useEffect(() => {
        if (sucursalId && isMounted) fetchData();
    }, [startDate, endDate, sucursalId, isMounted]);

    if (!isMounted) return null;

    async function fetchData() {
        if (!sucursalId) return;
        setLoading(true);
        try {
            // Fetch Pedidos
            const { data: pedidosData } = await supabase
                .from("pedidos")
                .select("*, metodos_pago(*)")
                .eq("sucursal_id", sucursalId)
                .eq("estado", "entregado")
                .gte("created_at", getStartOfDayArgentina(startDate))
                .lte("created_at", getEndOfDayArgentina(endDate))
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

            // Fetch products with their technical sheets for costs
            const { data: productsData } = await supabase
                .from("productos")
                .select("id, nombre, precio, ficha_tecnica_id, costo_fijo, fichas_tecnicas(costo_total)")
                .eq("sucursal_id", sucursalId);
            setProductsWithCosts(productsData || []);

            // Fetch Cajas for the period
            const { data: cajasData } = await supabase
                .from("cajas")
                .select("*, transacciones_caja(*)")
                .eq("sucursal_id", sucursalId)
                .gte("fecha_apertura", getStartOfDayArgentina(startDate))
                .lte("fecha_apertura", getEndOfDayArgentina(endDate))
                .order("fecha_apertura", { ascending: false });
            setCajas(cajasData || []);

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
        const key = p.metodo_pago_nombre || (p.metodos_pago as any)?.nombre || "Efectivo";
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

    // Rentabilidad Calculations
    const rentabilidadStats = items.reduce((acc: any, item) => {
        // Look up product info by ID or Fallback by Name if ID is missing or not found
        let productInfo = productsWithCosts.find(p => p.id === item.producto_id);
        if (!productInfo && item.nombre_producto) {
            const normalizedName = item.nombre_producto.trim().toLowerCase();
            productInfo = productsWithCosts.find(p => p.nombre.trim().toLowerCase() === normalizedName);
        }

        const ft = productInfo?.fichas_tecnicas;
        const recipeCost = Array.isArray(ft) ? (ft[0]?.costo_total || 0) : (ft?.costo_total || 0);
        const costoUnit = recipeCost > 0 ? recipeCost : (Number(productInfo?.costo_fijo) || 0);

        // Group by product info ID if found, to unify rows with same product but different linkage
        const key = productInfo?.id || item.producto_id || item.nombre_producto;

        if (!acc[key]) {
            acc[key] = {
                nombre: productInfo?.nombre || item.nombre_producto,
                cant: 0,
                totalVenta: 0,
                totalCosto: 0,
                productInfo: productInfo // Store this to allow assigning cost later
            };
        }
        acc[key].cant += item.cantidad;
        acc[key].totalVenta += Number(item.subtotal || 0);
        acc[key].totalCosto += (Number(costoUnit) * item.cantidad);
        return acc;
    }, {});

    const rentabilidadArray = Object.values(rentabilidadStats)
        .map((p: any) => ({
            ...p,
            utilidad: p.totalVenta - p.totalCosto,
            margen: p.totalVenta > 0 ? ((p.totalVenta - p.totalCosto) / p.totalVenta) * 100 : 0
        }))
        .filter((p: any) => p.nombre.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a: any, b: any) => b.utilidad - a.utilidad);

    const totalCostoPeriodo = rentabilidadArray.reduce((acc, p) => acc + p.totalCosto, 0);
    const totalUtilidadPeriodo = totalFacturado - totalCostoPeriodo;
    const margenPromedioPeriodo = totalFacturado > 0 ? (totalUtilidadPeriodo / totalFacturado) * 100 : 0;

    function exportToCSV() {
        let csvContent = "data:text/csv;charset=utf-8,";
        if (tab === "facturacion") {
            csvContent += "Metodo,Pedidos,Ticket Prom,Envio,Propinas,Total\n";
            metodosArray.forEach((m: any) => {
                csvContent += `${m.label},${m.count},${(m.value / m.count).toFixed(2)},${m.envio},${m.propina},${m.value}\n`;
            });
        } else if (tab === "ventas") {
            csvContent += "Producto,Cantidad,Precio Unit,Total Recaudado\n";
            productsArray.forEach((p: any) => {
                csvContent += `${p.nombre},${p.cant},${p.precio},${p.total}\n`;
            });
        } else if (tab === "rentabilidad") {
            csvContent += "Producto,Cantidad,Venta Total,Costo Total,Utilidad,Margen %\n";
            rentabilidadArray.forEach((p: any) => {
                csvContent += `${p.nombre},${p.cant},${p.totalVenta},${p.totalCosto},${p.utilidad},${p.margen.toFixed(2)}%\n`;
            });
        } else {
            csvContent += "Cajero,Apertura,Cierre,Monto Apertura,Ventas Efvo,Mov Manuales,Esperado,Real,Diferencia\n";
            cajas.forEach((c: any) => {
                const manual = (c.transacciones_caja || []).reduce((s: number, t: any) => t.tipo === 'ingreso' ? s + Number(t.monto) : s - Number(t.monto), 0);
                csvContent += `${c.cajero_nombre},${c.fecha_apertura},${c.fecha_cierre},${c.monto_apertura},${(c.monto_esperado || 0) - c.monto_apertura - manual},${manual},${c.monto_esperado},${c.monto_cierre},${c.diferencia}\n`;
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
                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-gray-200 shadow-sm transition-all overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setTab("facturacion")}
                        className={`px-6 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap ${tab === "facturacion" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        Facturación
                    </button>
                    <button
                        onClick={() => setTab("ventas")}
                        className={`px-6 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap ${tab === "ventas" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        Ventas
                    </button>
                    <button
                        onClick={() => setTab("rentabilidad")}
                        className={`px-6 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap ${tab === "rentabilidad" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        Rentabilidad
                    </button>
                    <button
                        onClick={() => setTab("turnos")}
                        className={`px-6 py-2 rounded-xl text-sm font-black uppercase tracking-wider transition-all whitespace-nowrap ${tab === "turnos" ? "bg-purple-600 text-white shadow-lg shadow-purple-200" : "text-gray-400 hover:text-gray-600"}`}
                    >
                        Turnos
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

                    {/* Quick Filters */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const hoy = getArgentinaDate();
                                setStartDate(hoy);
                                setEndDate(hoy);
                            }}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black text-gray-500 uppercase hover:bg-gray-50 transition-all hover:border-purple-200 active:scale-95"
                        >
                            HOY
                        </button>
                        <button
                            onClick={() => {
                                const ayer = getArgentinaYesterday();
                                setStartDate(ayer);
                                setEndDate(ayer);
                            }}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-black text-gray-400 uppercase hover:bg-gray-50 transition-all hover:border-purple-200 active:scale-95"
                        >
                            AYER
                        </button>
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
                    {tab === "facturacion" && (
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
                                            data={metodosArray.map((m: any) => ({ label: m.label, value: m.value }))}
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
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Ticket Prom..</th>
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
                    )}

                    {tab === "ventas" && (
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

                    {tab === "rentabilidad" && (
                        <div className="space-y-6">
                            {/* KPI Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                                            <TrendingUp size={24} />
                                        </div>
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Utilidad Bruta</h3>
                                    </div>
                                    <p className="text-4xl font-black text-purple-600 leading-none">
                                        $ {new Intl.NumberFormat("es-AR").format(totalUtilidadPeriodo)}
                                    </p>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                            <PieChartIcon size={24} />
                                        </div>
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Margen Promedio</h3>
                                    </div>
                                    <p className="text-4xl font-black text-gray-900 leading-none">
                                        {margenPromedioPeriodo.toFixed(1)}%
                                    </p>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
                                            <BarChart3 size={24} />
                                        </div>
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Costo Total Invertido</h3>
                                    </div>
                                    <p className="text-4xl font-black text-gray-900 leading-none">
                                        $ {new Intl.NumberFormat("es-AR").format(totalCostoPeriodo)}
                                    </p>
                                </div>
                            </div>

                            {/* Rentabilidad Search & Table */}
                            <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-gray-50 flex items-center justify-between flex-wrap gap-4">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Análisis de Utilidad por Producto</h4>
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
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Costo Tot.</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Venta Tot.</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilidad</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Margen %</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {rentabilidadArray.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-20 text-center text-gray-300 font-bold uppercase tracking-[0.3em] text-[10px]">Sin resultados</td>
                                                </tr>
                                            ) : rentabilidadArray.map((p: any, i) => (
                                                <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <span className="text-xs font-black text-gray-900 uppercase tracking-wide">{p.nombre}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {p.totalCosto > 0 ? (
                                                            <span className="text-xs font-bold text-gray-500">$ {new Intl.NumberFormat("es-AR").format(p.totalCosto)}</span>
                                                        ) : (
                                                            <button 
                                                                onClick={() => {
                                                                    setSelectedProductForCosto(p.productInfo || { nombre: p.nombre });
                                                                    setIsCostoModalOpen(true);
                                                                }}
                                                                className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 underline uppercase tracking-tighter"
                                                                title={!p.productInfo ? "Crear producto en catálogo para asignar costo" : "Asignar costo manual o vincular receta"}
                                                            >
                                                                {p.productInfo ? "Asignar Costo" : "Asignar Costo (Crear)"}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-xs font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(p.totalVenta)}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`text-xs font-black ${p.utilidad >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                            $ {new Intl.NumberFormat("es-AR").format(p.utilidad)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-16 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                                                <div 
                                                                    className={`h-full rounded-full ${p.margen > 30 ? "bg-green-500" : p.margen > 15 ? "bg-orange-500" : "bg-red-500"}`} 
                                                                    style={{ width: `${Math.max(0, Math.min(100, p.margen))}%` }} 
                                                                />
                                                            </div>
                                                            <span className="text-xs font-black text-gray-900 w-10">{p.margen.toFixed(1)}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "turnos" && (
                        <div className="space-y-6">
                            <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
                                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Historial de Turnos y Arqueos</h4>
                                    <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{cajas.length} Turnos</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-50 bg-gray-50/30">
                                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Cajero / Turno</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto Apertura</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Ventas Efvo</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Mov. Manuales</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Esperado</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Cierre Real</th>
                                                <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Diferencia</th>
                                                <th className="px-6 py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {cajas.length === 0 ? (
                                                <tr>
                                                    <td colSpan={8} className="py-20 text-center text-gray-300 font-bold uppercase tracking-[0.3em] text-[10px]">Sin turnos en este periodo</td>
                                                </tr>
                                            ) : cajas.map((c: any, i) => {
                                                const manual = (c.transacciones_caja || []).reduce((s: number, t: any) => t.tipo === 'ingreso' ? s + Number(t.monto) : s - Number(t.monto), 0);
                                                const isAbierta = c.estado === 'abierta';
                                                const ventasEfvo = isAbierta ? 0 : (c.monto_esperado || 0) - c.monto_apertura - manual;
                                                
                                                return (
                                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-black text-gray-900 uppercase">{c.cajero_nombre || "Anónimo"}</span>
                                                                    {isAbierta && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                                                                </div>
                                                                <span className="text-[10px] font-bold text-gray-400">
                                                                    {formatToArgentinaDateTime(c.fecha_apertura)}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-xs font-bold text-gray-600">
                                                            $ {new Intl.NumberFormat("es-AR").format(c.monto_apertura)}
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-xs font-black text-green-600">
                                                            {isAbierta ? "---" : `$ ${new Intl.NumberFormat("es-AR").format(ventasEfvo)}`}
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-xs font-bold text-blue-600">
                                                            $ {new Intl.NumberFormat("es-AR").format(manual)}
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-xs font-black text-gray-900">
                                                            {isAbierta ? "---" : `$ ${new Intl.NumberFormat("es-AR").format(c.monto_esperado || 0)}`}
                                                        </td>
                                                        <td className="px-6 py-4 text-center text-xs font-black text-gray-900">
                                                            {isAbierta ? (
                                                                <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-lg text-[8px] font-black uppercase tracking-tighter border border-green-100">En Curso</span>
                                                            ) : (
                                                                `$ ${new Intl.NumberFormat("es-AR").format(c.monto_cierre || 0)}`
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {isAbierta ? (
                                                                <span className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">Pendiente</span>
                                                            ) : (
                                                                <span className={`text-sm font-black ${c.diferencia === 0 ? "text-gray-400" : (c.diferencia > 0 ? "text-green-600" : "text-red-600")}`}>
                                                                    $ {new Intl.NumberFormat("es-AR").format(c.diferencia || 0)}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {!isAbierta && (
                                                                <button
                                                                    onClick={() => handleImprimirCierre(c)}
                                                                    disabled={printingCajaId === c.id}
                                                                    className="px-3 py-1.5 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all active:scale-95 disabled:bg-purple-300 flex items-center justify-center gap-1.5 mx-auto shadow-sm"
                                                                >
                                                                    {printingCajaId === c.id ? (
                                                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                    ) : (
                                                                        <Printer size={12} />
                                                                    )}
                                                                    <span>Reimprimir</span>
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            <AsignarCostoModal 
                isOpen={isCostoModalOpen}
                onClose={() => {
                    setIsCostoModalOpen(false);
                    setSelectedProductForCosto(null);
                }}
                onSave={fetchData}
                producto={selectedProductForCosto}
                sucursalId={sucursalId || ""}
            />
        </section>
    );
}
