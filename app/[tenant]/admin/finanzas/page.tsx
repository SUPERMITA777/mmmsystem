"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
    Calendar, TrendingUp, TrendingDown, DollarSign, Wallet, 
    ArrowUpRight, ArrowDownLeft, ShieldAlert, FileText, RefreshCw 
} from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import { formatToArgentinaDateTime } from "@/lib/dateUtils";

type MovimientoFinanciero = {
    id: string;
    tipo: "venta" | "apertura_caja" | "cierre_caja" | "manual_ingreso" | "manual_egreso";
    titulo: string;
    detalle: string;
    monto: number;
    fecha: string;
    metodoPago?: string;
};

export default function FinanzasPage() {
    const { sucursalId } = useTenant();
    
    // Filters
    const [fechaSeleccionada, setFechaSeleccionada] = useState(() => {
        const today = new Date();
        return today.toISOString().split("T")[0]; // YYYY-MM-DD
    });
    
    const [loading, setLoading] = useState(true);
    const [movements, setMovements] = useState<MovimientoFinanciero[]>([]);
    
    // Stats
    const [totalIngresos, setTotalIngresos] = useState(0);
    const [totalEgresos, setTotalEgresos] = useState(0);
    
    useEffect(() => {
        if (sucursalId) {
            fetchMovements();
        }
    }, [sucursalId, fechaSeleccionada]);

    async function fetchMovements() {
        if (!sucursalId) return;
        setLoading(true);
        try {
            // Set start and end timestamps for the selected day in UTC/Argentina
            const startOfDay = new Date(fechaSeleccionada + "T00:00:00");
            const endOfDay = new Date(fechaSeleccionada + "T23:59:59.999");
            
            const startISO = startOfDay.toISOString();
            const endISO = endOfDay.toISOString();

            // 1. Fetch completed/delivered sales in this date range
            const { data: pedidosData, error: pedidosErr } = await supabase
                .from("pedidos")
                .select("id, numero_pedido, total, created_at, metodo_pago_nombre, metodos_pago(nombre)")
                .eq("sucursal_id", sucursalId)
                .eq("estado", "entregado")
                .gte("created_at", startISO)
                .lte("created_at", endISO);

            if (pedidosErr) throw pedidosErr;

            // 2. Fetch box openings/closures in this date range
            const { data: cajasData, error: cajasErr } = await supabase
                .from("cajas")
                .select("id, cajero_nombre, fecha_apertura, fecha_cierre, monto_apertura, monto_cierre, diferencia")
                .eq("sucursal_id", sucursalId)
                .or(`fecha_apertura.gte.${startISO},fecha_cierre.gte.${startISO}`)
                .filter("fecha_apertura", "lte", endISO);

            if (cajasErr) throw cajasErr;

            // 3. Fetch manual box transactions for the boxes active during the day
            const boxIds = (cajasData || []).map(c => c.id);
            let transaccionesData: any[] = [];
            
            if (boxIds.length > 0) {
                const { data: txs, error: txsErr } = await supabase
                    .from("transacciones_caja")
                    .select("id, caja_id, tipo, monto, concepto, created_at")
                    .in("caja_id", boxIds)
                    .gte("created_at", startISO)
                    .lte("created_at", endISO);

                if (txsErr) throw txsErr;
                transaccionesData = txs || [];
            }

            // Assemble and normalize movements
            const compiledList: MovimientoFinanciero[] = [];
            
            // Add Sales
            (pedidosData || []).forEach(p => {
                const numCorto = p.numero_pedido?.split("-").pop() ?? p.numero_pedido;
                const metodo = p.metodo_pago_nombre || (p.metodos_pago as any)?.nombre || "Efectivo";
                compiledList.push({
                    id: p.id,
                    tipo: "venta",
                    titulo: `Venta Pedido #${numCorto}`,
                    detalle: `Cobro registrado mediante ${metodo}`,
                    monto: Number(p.total),
                    fecha: p.created_at,
                    metodoPago: metodo
                });
            });

            // Add Box Openings & Closures
            (cajasData || []).forEach(c => {
                // If opening is on the selected date
                const openDate = new Date(c.fecha_apertura);
                if (openDate >= startOfDay && openDate <= endOfDay) {
                    compiledList.push({
                        id: `${c.id}-open`,
                        tipo: "apertura_caja",
                        titulo: "Apertura de Caja",
                        detalle: `Turno iniciado por ${c.cajero_nombre || "Cajero"}`,
                        monto: Number(c.monto_apertura),
                        fecha: c.fecha_apertura
                    });
                }

                // If closure is on the selected date
                if (c.fecha_cierre) {
                    const closeDate = new Date(c.fecha_cierre);
                    if (closeDate >= startOfDay && closeDate <= endOfDay) {
                        compiledList.push({
                            id: `${c.id}-close`,
                            tipo: "cierre_caja",
                            titulo: "Cierre de Caja (Arqueo)",
                            detalle: `Turno cerrado por ${c.cajero_nombre || "Cajero"}. Diferencia: ${c.diferencia !== null ? (c.diferencia >= 0 ? "+" : "") + formatARS(c.diferencia) : "N/C"}`,
                            monto: Number(c.monto_cierre || 0),
                            fecha: c.fecha_cierre
                        });
                    }
                }
            });

            // Add Manual Transactions
            transaccionesData.forEach(tx => {
                const box = cajasData?.find(c => c.id === tx.caja_id);
                compiledList.push({
                    id: tx.id,
                    tipo: tx.tipo === "ingreso" ? "manual_ingreso" : "manual_egreso",
                    titulo: tx.tipo === "ingreso" ? "Ingreso de Caja Manual" : "Egreso de Caja Manual",
                    detalle: `Concepto: ${tx.concepto || "Sin concepto"} (${box?.cajero_nombre || "Cajero"})`,
                    monto: Number(tx.monto),
                    fecha: tx.created_at
                });
            });

            // Sort chronologically (newest first)
            compiledList.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
            setMovements(compiledList);

            // Calculations
            let ingresosTotal = 0;
            let egresosTotal = 0;

            compiledList.forEach(m => {
                if (m.tipo === "venta" || m.tipo === "manual_ingreso" || m.tipo === "apertura_caja") {
                    ingresosTotal += m.monto;
                } else if (m.tipo === "manual_egreso") {
                    egresosTotal += m.monto;
                }
            });

            setTotalIngresos(ingresosTotal);
            setTotalEgresos(egresosTotal);

        } catch (error) {
            console.error("Error loading financial ledger:", error);
        } finally {
            setLoading(false);
        }
    }

    const formatARS = (n: number) => {
        return "$ " + new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(n);
    };

    return (
        <section className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2 uppercase italic">FINANZAS Y MOVIMIENTOS</h1>
                    <p className="text-gray-500 font-bold text-sm tracking-wide">
                        Registro diario de ingresos, egresos y movimientos de caja de la sucursal.
                    </p>
                </div>
                
                {/* Date Filter */}
                <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm shrink-0">
                    <Calendar size={18} className="text-gray-400" />
                    <input 
                        type="date" 
                        value={fechaSeleccionada}
                        onChange={(e) => setFechaSeleccionada(e.target.value)}
                        className="outline-none text-sm font-bold text-gray-700 bg-transparent cursor-pointer"
                    />
                    <button
                        onClick={fetchMovements}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                        title="Actualizar datos"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center shrink-0">
                        <TrendingUp size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Total Ingresos</p>
                        <h3 className="text-3xl font-black text-green-600 leading-none">{formatARS(totalIngresos)}</h3>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center shrink-0">
                        <TrendingDown size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Total Egresos</p>
                        <h3 className="text-3xl font-black text-red-600 leading-none">{formatARS(totalEgresos)}</h3>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm flex items-center gap-5">
                    <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center shrink-0">
                        <DollarSign size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Saldo del Día (Neto)</p>
                        <h3 className="text-3xl font-black text-purple-600 leading-none">{formatARS(totalIngresos - totalEgresos)}</h3>
                    </div>
                </div>
            </div>

            {/* Timeline of daily ledger movements */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Movimientos del Día</h4>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">{movements.length} transacciones</span>
                </div>

                {loading ? (
                    <div className="p-16 text-center text-gray-400 font-bold italic">
                        Cargando movimientos...
                    </div>
                ) : movements.length === 0 ? (
                    <div className="p-20 text-center text-gray-400 font-bold italic flex flex-col items-center gap-4">
                        <FileText size={48} className="text-gray-200" />
                        <span>No hay movimientos registrados para la fecha seleccionada.</span>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {movements.map((mov) => {
                            const iconColors = {
                                venta: "bg-green-50 text-green-600",
                                apertura_caja: "bg-blue-50 text-blue-600",
                                cierre_caja: "bg-purple-50 text-purple-600",
                                manual_ingreso: "bg-emerald-50 text-emerald-600",
                                manual_egreso: "bg-red-50 text-red-600"
                            };

                            const iconMap = {
                                venta: <DollarSign size={20} />,
                                apertura_caja: <Wallet size={20} />,
                                cierre_caja: <Wallet size={20} />,
                                manual_ingreso: <ArrowDownLeft size={20} />,
                                manual_egreso: <ArrowUpRight size={20} />
                            };

                            const isOutflow = mov.tipo === "manual_egreso";
                            const isNeutral = mov.tipo === "cierre_caja"; // Cierre is informative, showing count

                            return (
                                <div key={mov.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center gap-5 min-w-0">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${iconColors[mov.tipo]}`}>
                                            {iconMap[mov.tipo]}
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-black text-gray-900 uppercase tracking-tight truncate">{mov.titulo}</p>
                                            <p className="text-xs text-gray-500 font-medium truncate mt-0.5">{mov.detalle}</p>
                                            <p className="text-[9px] font-bold text-gray-400 mt-1">{new Date(mov.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} HS</p>
                                        </div>
                                    </div>
                                    <span className={`text-lg font-black shrink-0 ml-4 ${
                                        isNeutral ? "text-gray-900" : (isOutflow ? "text-red-600" : "text-green-600")
                                    }`}>
                                        {isNeutral ? "" : (isOutflow ? "-" : "+")} {formatARS(mov.monto)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
