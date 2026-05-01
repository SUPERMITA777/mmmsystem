"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Trash2, Edit2, Clock, ArrowUpRight, ArrowDownRight, User, Wallet, Calculator, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import { formatToArgentinaDateTime } from "@/lib/dateUtils";

type Caja = {
    id: string;
    usuario_id: string;
    cajero_nombre?: string;
    fecha_apertura: string;
    fecha_cierre: string | null;
    monto_apertura: number;
    monto_cierre: number | null;
    monto_esperado: number | null;
    diferencia: number | null;
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

type UserProfile = {
    id: string;
    nombre: string;
    apellido: string;
    rol: string;
};

export default function CajasPage() {
    const [caja, setCaja] = useState<Caja | null>(null);
    const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
    const [staff, setStaff] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modals
    const [showApertura, setShowApertura] = useState(false);
    const [showCierre, setShowCierre] = useState(false);
    const [showMovimiento, setShowMovimiento] = useState(false);
    
    // Forms
    const [aperturaForm, setAperturaForm] = useState({ monto: "", cajeroId: "", cajeroNombre: "" });
    const [cierreForm, setCierreForm] = useState({ montoReal: "", notas: "" });
    const [movForm, setMovForm] = useState({ tipo: "ingreso", monto: "", concepto: "" });
    
    // Stats
    const [totalManual, setTotalManual] = useState(0);
    const [totalVentasEfectivo, setTotalVentasEfectivo] = useState(0);
    
    const { sucursalId } = useTenant();

    useEffect(() => { 
        if (sucursalId) {
            fetchCaja();
            fetchStaff();
        }
    }, [sucursalId]);

    async function fetchStaff() {
        if (!sucursalId) return;
        try {
            const res = await fetch(`/api/staff?sucursal_id=${sucursalId}`);
            if (res.ok) {
                const data = await res.json();
                setStaff(data || []);
            }
        } catch (error) {
            console.error("Error fetching staff:", error);
        }
    }

    async function fetchCaja() {
        if (!sucursalId) return;
        setLoading(true);
        // Get open box
        const { data: cajaData } = await supabase
            .from("cajas")
            .select("*")
            .eq("sucursal_id", sucursalId)
            .eq("estado", "abierta")
            .order("fecha_apertura", { ascending: false })
            .limit(1)
            .maybeSingle();

        setCaja(cajaData);

        if (cajaData) {
            // Manual transactions
            const { data: txs } = await supabase
                .from("transacciones_caja")
                .select("*")
                .eq("caja_id", cajaData.id)
                .order("created_at", { ascending: false });
            setTransacciones(txs || []);

            // Calculate manual total
            const manualTotal = (txs || []).reduce((sum, t) =>
                t.tipo === "ingreso" ? sum + Number(t.monto) : sum - Number(t.monto), 0
            );
            setTotalManual(manualTotal);

            // Fetch cash sales since opening
            // Note: This logic assumes orders with metodo_pago 'efectivo' are counted
            const { data: ventasEfvo } = await supabase
                .from("pedidos")
                .select("total")
                .eq("sucursal_id", sucursalId)
                .eq("estado", "entregado")
                .ilike("metodo_pago_nombre", "%efectivo%")
                .gte("created_at", cajaData.fecha_apertura);
            
            const vTotal = (ventasEfvo || []).reduce((sum, p) => sum + Number(p.total), 0);
            setTotalVentasEfectivo(vTotal);
        }
        setLoading(false);
    }

    async function handleConfirmarApertura() {
        if (!sucursalId || !aperturaForm.monto || !aperturaForm.cajeroNombre) return;
        
        const { error } = await supabase.from("cajas").insert({
            sucursal_id: sucursalId,
            usuario_id: aperturaForm.cajeroId || "00000000-0000-0000-0000-000000000000",
            cajero_nombre: aperturaForm.cajeroNombre,
            monto_apertura: Number(aperturaForm.monto),
            estado: "abierta",
            fecha_apertura: new Date().toISOString(),
        });

        if (error) {
            alert("Error al abrir caja: " + error.message);
        } else {
            setShowApertura(false);
            setAperturaForm({ monto: "", cajeroId: "", cajeroNombre: "" });
            fetchCaja();
        }
    }

    async function handleConfirmarCierre() {
        if (!caja || !cierreForm.montoReal) return;
        
        const esperado = caja.monto_apertura + totalManual + totalVentasEfectivo;
        const real = Number(cierreForm.montoReal);
        const diferencia = real - esperado;

        const { error } = await supabase.from("cajas").update({
            estado: "cerrada",
            fecha_cierre: new Date().toISOString(),
            monto_esperado: esperado,
            monto_cierre: real,
            diferencia: diferencia,
            notas: cierreForm.notas
        }).eq("id", caja.id);

        if (error) {
            alert("Error al cerrar caja: " + error.message);
        } else {
            setShowCierre(false);
            setCierreForm({ montoReal: "", notas: "" });
            fetchCaja();
        }
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
        return formatToArgentinaDateTime(d);
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-10 h-10 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Cargando cajas...</p>
        </div>
    );

    const montoEsperado = caja ? (caja.monto_apertura + totalManual + totalVentasEfectivo) : 0;

    return (
        <section className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">GESTIÓN DE CAJA</h2>
                    <p className="text-gray-500 font-medium">Control de ingresos, egresos y arqueos por turno.</p>
                </div>
                
                {!caja ? (
                    <button
                        onClick={() => setShowApertura(true)}
                        className="flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 active:scale-95"
                    >
                        <Plus size={20} />
                        Abrir Turno
                    </button>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="bg-green-50 text-green-700 px-4 py-2 rounded-xl border border-green-100 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-wider">Caja Abierta</span>
                        </div>
                        <button
                            onClick={() => setShowCierre(true)}
                            className="bg-red-600 text-white px-6 py-3 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-95"
                        >
                            Cerrar Turno
                        </button>
                    </div>
                )}
            </div>

            {!caja ? (
                <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-gray-200 p-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Wallet size={40} className="text-gray-300" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">NO HAY CAJAS ABIERTAS</h3>
                    <p className="text-gray-400 max-w-md mx-auto mb-8 font-medium">
                        Para registrar ventas en efectivo y movimientos manuales, debés iniciar un nuevo turno de caja.
                    </p>
                    <button
                        onClick={() => setShowApertura(true)}
                        className="bg-gray-900 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-gray-800 transition-all active:scale-95"
                    >
                        Comenzar Apertura
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Summary Card */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Titular de Caja</p>
                                        <h4 className="text-xl font-black text-gray-900 uppercase">{caja.cajero_nombre || "Sin nombre"}</h4>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Iniciado el</p>
                                    <h4 className="text-sm font-bold text-gray-900">{formatDate(caja.fecha_apertura)}</h4>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <div className="bg-gray-50 rounded-3xl p-6">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Monto Apertura</p>
                                    <p className="text-2xl font-black text-gray-900">$ {new Intl.NumberFormat("es-AR").format(caja.monto_apertura)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-3xl p-6">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Ventas Efectivo</p>
                                    <p className="text-2xl font-black text-green-600">$ {new Intl.NumberFormat("es-AR").format(totalVentasEfectivo)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-3xl p-6">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Mov. Manuales</p>
                                    <p className={`text-2xl font-black ${totalManual >= 0 ? "text-blue-600" : "text-red-600"}`}>
                                        $ {new Intl.NumberFormat("es-AR").format(totalManual)}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-8 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Efectivo Esperado</p>
                                    <p className="text-4xl font-black text-gray-900">$ {new Intl.NumberFormat("es-AR").format(montoEsperado)}</p>
                                </div>
                                <div className="p-4 bg-purple-50 text-purple-600 rounded-3xl">
                                    <Calculator size={32} />
                                </div>
                            </div>
                        </div>

                        {/* Recent Transactions List */}
                        <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
                            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Movimientos del Turno</h4>
                                <button
                                    onClick={() => setShowMovimiento(true)}
                                    className="text-xs font-black text-purple-600 uppercase tracking-widest hover:underline"
                                >
                                    + Agregar Movimiento
                                </button>
                            </div>
                            
                            <div className="divide-y divide-gray-50">
                                {transacciones.length === 0 ? (
                                    <div className="p-12 text-center text-gray-400 font-medium">
                                        No hay movimientos manuales registrados en este turno.
                                    </div>
                                ) : (
                                    transacciones.map(tx => (
                                        <div key={tx.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.tipo === "ingreso" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                                                    {tx.tipo === "ingreso" ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-gray-900 uppercase tracking-tight">{tx.concepto || "Sin concepto"}</p>
                                                    <p className="text-[10px] font-bold text-gray-400">{formatDate(tx.created_at)}</p>
                                                </div>
                                            </div>
                                            <span className={`text-lg font-black ${tx.tipo === "ingreso" ? "text-green-600" : "text-red-600"}`}>
                                                {tx.tipo === "ingreso" ? "+" : "-"} $ {new Intl.NumberFormat("es-AR").format(tx.monto)}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Actions/Tips */}
                    <div className="space-y-6">
                        <div className="bg-purple-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-purple-100">
                            <h4 className="text-lg font-black uppercase tracking-widest mb-4">Acciones Rápidas</h4>
                            <div className="space-y-3">
                                <button 
                                    onClick={() => {
                                        setMovForm({ tipo: "ingreso", monto: "", concepto: "" });
                                        setShowMovimiento(true);
                                    }}
                                    className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center gap-3 transition-all active:scale-95"
                                >
                                    <ArrowDownRight size={20} />
                                    <span className="text-sm font-bold uppercase tracking-wide">Registrar Ingreso</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setMovForm({ tipo: "egreso", monto: "", concepto: "" });
                                        setShowMovimiento(true);
                                    }}
                                    className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl flex items-center gap-3 transition-all active:scale-95"
                                >
                                    <ArrowUpRight size={20} />
                                    <span className="text-sm font-bold uppercase tracking-wide">Registrar Egreso</span>
                                </button>
                                <button 
                                    onClick={() => setShowCierre(true)}
                                    className="w-full bg-red-500 hover:bg-red-400 p-4 rounded-2xl flex items-center gap-3 transition-all active:scale-95"
                                >
                                    <CheckCircle2 size={20} />
                                    <span className="text-sm font-bold uppercase tracking-wide">Finalizar Turno</span>
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
                            <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-4">Información</h4>
                            <div className="flex gap-4">
                                <div className="text-orange-500"><AlertTriangle size={20} /></div>
                                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                    Recordá registrar todos los egresos (retiros de socios, pagos a proveedores, etc.) para que el arqueo final sea exacto.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Apertura Modal */}
            {showApertura && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-10">
                            <h3 className="text-2xl font-black text-gray-900 mb-2">APERTURA DE CAJA</h3>
                            <p className="text-gray-500 mb-8 font-medium">Iniciá el turno registrando el dinero inicial y el responsable.</p>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4 mb-2 block">Monto Inicial en Efectivo ($)</label>
                                    <div className="relative">
                                        <Wallet className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input 
                                            type="number" 
                                            value={aperturaForm.monto} 
                                            onChange={e => setAperturaForm({ ...aperturaForm, monto: e.target.value })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl py-4 pl-14 pr-6 outline-none transition-all text-lg font-bold text-gray-900"
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4 mb-2 block">Responsable / Cajero</label>
                                    <div className="relative">
                                        <User className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <select 
                                            value={aperturaForm.cajeroId}
                                            onChange={e => {
                                                const selected = staff.find(s => s.id === e.target.value);
                                                setAperturaForm({ 
                                                    ...aperturaForm, 
                                                    cajeroId: e.target.value, 
                                                    cajeroNombre: selected ? `${selected.nombre} ${selected.apellido || ""}` : "" 
                                                });
                                            }}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl py-4 pl-14 pr-6 outline-none transition-all text-lg font-bold text-gray-900 appearance-none"
                                        >
                                            <option value="">Seleccionar Cajero...</option>
                                            {staff.map(s => (
                                                <option key={s.id} value={s.id}>{s.nombre} {s.apellido}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 ml-4">Si el cajero no está en la lista, podés escribir el nombre abajo:</p>
                                    <input 
                                        type="text" 
                                        value={aperturaForm.cajeroNombre}
                                        onChange={e => setAperturaForm({ ...aperturaForm, cajeroNombre: e.target.value })}
                                        className="w-full mt-2 bg-gray-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl py-3 px-6 outline-none transition-all text-sm font-bold text-gray-900"
                                        placeholder="Nombre del titular..."
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-10">
                                <button 
                                    onClick={() => setShowApertura(false)}
                                    className="py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={handleConfirmarApertura}
                                    disabled={!aperturaForm.monto || !aperturaForm.cajeroNombre}
                                    className="py-4 bg-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 disabled:opacity-50 disabled:shadow-none"
                                >
                                    Confirmar Apertura
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cierre Modal */}
            {showCierre && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-10">
                            <h3 className="text-2xl font-black text-gray-900 mb-2">CIERRE DE CAJA</h3>
                            <p className="text-gray-500 mb-8 font-medium">Finalizá el turno y verificá el arqueo de efectivo.</p>

                            <div className="bg-gray-50 rounded-[2rem] p-6 mb-8 grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Efectivo Esperado</p>
                                    <p className="text-xl font-black text-gray-900">$ {new Intl.NumberFormat("es-AR").format(montoEsperado)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Diferencia</p>
                                    <p className={`text-xl font-black ${Number(cierreForm.montoReal) - montoEsperado === 0 ? "text-gray-900" : (Number(cierreForm.montoReal) - montoEsperado > 0 ? "text-green-600" : "text-red-600")}`}>
                                        $ {new Intl.NumberFormat("es-AR").format(Number(cierreForm.montoReal) - montoEsperado)}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4 mb-2 block">Monto Real Contado ($)</label>
                                    <div className="relative">
                                        <Wallet className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input 
                                            type="number" 
                                            value={cierreForm.montoReal} 
                                            onChange={e => setCierreForm({ ...cierreForm, montoReal: e.target.value })}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-red-600 focus:bg-white rounded-2xl py-4 pl-14 pr-6 outline-none transition-all text-lg font-bold text-gray-900"
                                            placeholder="Contar efectivo..."
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-4 mb-2 block">Notas / Observaciones</label>
                                    <textarea 
                                        value={cierreForm.notas}
                                        onChange={e => setCierreForm({ ...cierreForm, notas: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-gray-900 focus:bg-white rounded-2xl py-4 px-6 outline-none transition-all text-sm font-bold text-gray-900 h-24 resize-none"
                                        placeholder="Ej: Faltante de $10 por vuelto mal dado..."
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-10">
                                <button 
                                    onClick={() => setShowCierre(false)}
                                    className="py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-all"
                                >
                                    Volver
                                </button>
                                <button 
                                    onClick={handleConfirmarCierre}
                                    disabled={!cierreForm.montoReal}
                                    className="py-4 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50 disabled:shadow-none"
                                >
                                    Confirmar Cierre
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Nuevo Movimiento Modal */}
            {showMovimiento && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-gray-900 uppercase">Nuevo Movimiento</h3>
                                <button onClick={() => setShowMovimiento(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex gap-2 mb-6">
                                <button
                                    onClick={() => setMovForm({ ...movForm, tipo: "ingreso" })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase transition-all ${movForm.tipo === "ingreso" ? "bg-green-600 text-white shadow-lg shadow-green-100" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
                                >
                                    <ArrowDownRight size={16} /> Ingreso
                                </button>
                                <button
                                    onClick={() => setMovForm({ ...movForm, tipo: "egreso" })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase transition-all ${movForm.tipo === "egreso" ? "bg-red-600 text-white shadow-lg shadow-red-100" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
                                >
                                    <ArrowUpRight size={16} /> Egreso
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-1 block">Monto ($)</label>
                                    <input 
                                        type="number" 
                                        value={movForm.monto} 
                                        onChange={e => setMovForm({ ...movForm, monto: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl py-3 px-6 outline-none transition-all text-base font-bold text-gray-900"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 mb-1 block">Concepto</label>
                                    <input 
                                        type="text" 
                                        value={movForm.concepto} 
                                        onChange={e => setMovForm({ ...movForm, concepto: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-transparent focus:border-purple-600 focus:bg-white rounded-2xl py-3 px-6 outline-none transition-all text-sm font-bold text-gray-900"
                                        placeholder="Ej: Compra de insumos..."
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleNuevoMovimiento}
                                disabled={!movForm.monto}
                                className="w-full mt-8 py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all disabled:opacity-50"
                            >
                                Guardar Movimiento
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
