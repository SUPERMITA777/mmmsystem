"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Trash2, Edit2, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";

type Caja = {
    id: string;
    usuario_id: string;
    fecha_apertura: string;
    fecha_cierre: string | null;
    monto_apertura: number;
    monto_cierre: number | null;
    estado: string;
    notas: string;
};

type Transaccion = {
    id: string;
    tipo: string;
    monto: number;
    concepto: string;
    created_at: string;
};

export default function CajasPage() {
    const [caja, setCaja] = useState<Caja | null>(null);
    const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showMovimiento, setShowMovimiento] = useState(false);
    const [movForm, setMovForm] = useState({ tipo: "ingreso", monto: "", concepto: "" });
    const [totalVentas, setTotalVentas] = useState(0);

    useEffect(() => { fetchCaja(); }, []);

    async function fetchCaja() {
        // Get open box
        const { data: cajaData } = await supabase
            .from("cajas")
            .select("*")
            .eq("estado", "abierta")
            .order("fecha_apertura", { ascending: false })
            .limit(1)
            .single();

        setCaja(cajaData);

        if (cajaData) {
            const { data: txs } = await supabase
                .from("transacciones_caja")
                .select("*")
                .eq("caja_id", cajaData.id)
                .order("created_at", { ascending: false });
            setTransacciones(txs || []);

            // Calculate totals
            const total = (txs || []).reduce((sum, t) =>
                t.tipo === "ingreso" ? sum + Number(t.monto) : sum - Number(t.monto), 0
            );
            setTotalVentas(total);
        }
        setLoading(false);
    }

    async function handleNuevaCaja() {
        const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
        await supabase.from("cajas").insert({
            sucursal_id: suc?.id,
            usuario_id: "00000000-0000-0000-0000-000000000000",
            monto_apertura: 0,
            estado: "abierta",
        });
        fetchCaja();
    }

    async function handleCerrarArqueo() {
        if (!caja || !confirm("¿Cerrar el arqueo actual?")) return;
        await supabase.from("cajas").update({
            estado: "cerrada",
            fecha_cierre: new Date().toISOString(),
            monto_cierre: totalVentas + caja.monto_apertura,
        }).eq("id", caja.id);
        fetchCaja();
    }

    async function handleNuevoMovimiento() {
        if (!caja || !movForm.monto) return;
        await supabase.from("transacciones_caja").insert({
            caja_id: caja.id,
            tipo: movForm.tipo,
            monto: Number(movForm.monto),
            concepto: movForm.concepto,
        });
        setMovForm({ tipo: "ingreso", monto: "", concepto: "" });
        setShowMovimiento(false);
        fetchCaja();
    }

    function formatDate(d: string) {
        return new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
    }

    if (loading) return <div className="p-8 text-gray-400 text-center">Cargando cajas...</div>;

    return (
        <section className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                    {caja ? "1 Caja" : "Sin cajas abiertas"}
                </h2>
                <div className="flex gap-2">
                    {caja && (
                        <>
                            <button className="text-sm text-red-500 hover:underline font-medium">Eliminar</button>
                            <button className="text-sm text-purple-600 hover:underline font-medium">Editar</button>
                        </>
                    )}
                    <button
                        onClick={handleNuevaCaja}
                        className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                    >
                        Nueva caja
                    </button>
                </div>
            </div>

            {!caja ? (
                <div className="text-center py-20 text-gray-400">
                    <p className="text-lg mb-2">No hay cajas abiertas</p>
                    <p className="text-sm">Crea una nueva caja para comenzar a registrar ventas y movimientos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Arqueo */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-1">
                            <div>
                                <h3 className="font-bold text-gray-900">Arqueo en curso</h3>
                                <p className="text-xs text-gray-500">Iniciado {formatDate(caja.fecha_apertura)}</p>
                            </div>
                            <button className="text-gray-400 hover:text-gray-600 text-lg">⋮</button>
                        </div>

                        <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                            <div className="flex justify-between text-sm">
                                <span className="font-semibold text-gray-700">Efectivo</span>
                                <span className="text-gray-900">
                                    {transacciones.filter(t => t.tipo === "ingreso").length} Ventas
                                    <span className="ml-4 font-bold">
                                        $ {new Intl.NumberFormat("es-AR").format(
                                            transacciones.filter(t => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0)
                                        )}
                                    </span>
                                </span>
                            </div>
                            <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                                <span className="font-semibold text-gray-700">Total</span>
                                <span className="font-bold text-gray-900">
                                    $ {new Intl.NumberFormat("es-AR").format(totalVentas + caja.monto_apertura)}
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Total ventas</span>
                                <span className="font-bold text-gray-900">$ {new Intl.NumberFormat("es-AR").format(totalVentas)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-gray-900">
                                <span>Total consolidado</span>
                                <span>$ {new Intl.NumberFormat("es-AR").format(totalVentas + caja.monto_apertura)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleCerrarArqueo}
                            className="w-full mt-6 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                        >
                            Cerrar arqueo
                        </button>

                        <button className="w-full mt-2 text-purple-600 text-sm font-medium hover:underline text-center">
                            Historial de arqueos
                        </button>
                    </div>

                    {/* Right: Movimientos */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <ArrowUpRight size={16} className="text-gray-500" />
                                {transacciones.length} Movimientos
                            </h3>
                            <button
                                onClick={() => setShowMovimiento(!showMovimiento)}
                                className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
                            >
                                Nuevo movimiento
                            </button>
                        </div>

                        {showMovimiento && (
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200 mb-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setMovForm({ ...movForm, tipo: "ingreso" })}
                                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition-colors ${movForm.tipo === "ingreso" ? "bg-green-100 text-green-700 border border-green-300" : "bg-white border border-gray-200 text-gray-500"}`}
                                    >
                                        <ArrowDownRight size={14} /> Ingreso
                                    </button>
                                    <button
                                        onClick={() => setMovForm({ ...movForm, tipo: "egreso" })}
                                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-medium transition-colors ${movForm.tipo === "egreso" ? "bg-red-100 text-red-700 border border-red-300" : "bg-white border border-gray-200 text-gray-500"}`}
                                    >
                                        <ArrowUpRight size={14} /> Egreso
                                    </button>
                                </div>
                                <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                                    <legend className="text-xs text-gray-500 px-1">Monto ($)</legend>
                                    <input type="number" value={movForm.monto} onChange={e => setMovForm({ ...movForm, monto: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" />
                                </fieldset>
                                <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                                    <legend className="text-xs text-gray-500 px-1">Concepto</legend>
                                    <input type="text" value={movForm.concepto} onChange={e => setMovForm({ ...movForm, concepto: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Ej: Compra de insumos" />
                                </fieldset>
                                <div className="flex gap-2">
                                    <button onClick={handleNuevoMovimiento} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-500">Guardar</button>
                                    <button onClick={() => setShowMovimiento(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:text-gray-700">Cancelar</button>
                                </div>
                            </div>
                        )}

                        {transacciones.length === 0 ? (
                            <p className="text-center text-gray-400 text-sm py-10">
                                Registrá ingresos y egresos que no están vinculados con ventas.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {transacciones.map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            {tx.tipo === "ingreso" ? (
                                                <ArrowDownRight size={14} className="text-green-500" />
                                            ) : (
                                                <ArrowUpRight size={14} className="text-red-500" />
                                            )}
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{tx.concepto || tx.tipo}</p>
                                                <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                                            </div>
                                        </div>
                                        <span className={`text-sm font-bold ${tx.tipo === "ingreso" ? "text-green-600" : "text-red-600"}`}>
                                            {tx.tipo === "ingreso" ? "+" : "-"} $ {new Intl.NumberFormat("es-AR").format(tx.monto)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
