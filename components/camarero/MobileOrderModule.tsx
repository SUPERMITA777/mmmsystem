"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { 
    Search, Plus, Minus, Trash2, ShoppingBag, 
    ArrowLeft, Loader2, CheckCircle2, AlertCircle,
    ChevronRight, Info
} from "lucide-react";
import { useAuth } from "@/components/admin/AuthProvider";
import { persistirPedidoHibrido } from "@/lib/hybridService";
import { printCocina } from "@/lib/printUtils";
import { db } from "@/lib/db";

interface CartItem {
    id: string;
    producto_id: string;
    nombre: string;
    precio: number;
    cantidad: number;
    imagen_url?: string;
    nota?: string;
    impresora?: string;
}

export default function MobileOrderModule({ mesaId }: { mesaId: string }) {
    const { sucursalId } = useTenant();
    const { user } = useAuth();
    
    // Data State
    const [productos, setProductos] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [mesa, setMesa] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // UI State
    const [busqueda, setBusqueda] = useState("");
    const [catSeleccionada, setCatSeleccionada] = useState<string>("todos");
    const [carrito, setCarrito] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [orderSent, setOrderSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [printConfig, setPrintConfig] = useState<any>(null);
    
    // Setup State
    const [step, setStep] = useState<"setup" | "ordering">("setup");
    const [mesas, setMesas] = useState<any[]>([]);
    const [selectedMesaId, setSelectedMesaId] = useState(mesaId || "");
    const [comensales, setComensales] = useState(1);

    useEffect(() => {
        if (sucursalId) {
            fetchData();
        }
    }, [sucursalId, mesaId]);

    async function fetchData() {
        try {
            setLoading(true);
            
            // Fetch All Mesas
            const { data: mesasData } = await supabase
                .from("mesas")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .order("numero");
            setMesas(mesasData || []);

            if (mesaId) {
                const m = mesasData?.find(m => m.id === mesaId);
                if (m) {
                    setMesa(m);
                    setSelectedMesaId(m.id);
                    // Si ya viene con mesa_id, podríamos saltar el setup, 
                    // pero el usuario pidió que le pregunte el número de mesa.
                    // Sin embargo, para agilizar si escanean QR de mesa, lo pre-seleccionamos.
                }
            }

            if (!sucursalId) return;

            // Fetch Print Config (Bridge IP etc)
            const localConfig = await db.config_sucursal.where("sucursal_id").equals(sucursalId).first();
            if (localConfig) {
                setPrintConfig(localConfig);
            } else {
                const { data: remoteConfig } = await supabase
                    .from("config_sucursal")
                    .select("*")
                    .eq("sucursal_id", sucursalId)
                    .maybeSingle();
                setPrintConfig(remoteConfig);
            }

            // Fetch Categories
            const { data: catData } = await supabase
                .from("categorias")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .order("nombre");
            setCategorias(catData || []);

            // Fetch Products
            const { data: prodData } = await supabase
                .from("productos")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .eq("activo", true)
                .order("nombre");
            setProductos(prodData || []);

        } catch (err) {
            console.error("Error fetching data:", err);
            setError("Error al cargar los datos. Reintente por favor.");
        } finally {
            setLoading(false);
        }
    }

    const filteredProducts = productos.filter(p => {
        const matchSearch = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const matchCat = catSeleccionada === "todos" || p.categoria_id === catSeleccionada;
        return matchSearch && matchCat;
    });

    const addToCart = (p: any) => {
        setCarrito(prev => {
            const existing = prev.find(item => item.producto_id === p.id && !item.nota);
            if (existing) {
                return prev.map(item => 
                    item.producto_id === p.id && !item.nota 
                    ? { ...item, cantidad: item.cantidad + 1 } 
                    : item
                );
            }
            return [...prev, {
                id: crypto.randomUUID(),
                producto_id: p.id,
                nombre: p.nombre,
                precio: p.precio,
                cantidad: 1,
                imagen_url: p.imagen_url,
                impresora: p.impresora
            }];
        });
    };

    const updateQty = (id: string, delta: number) => {
        setCarrito(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.cantidad + delta);
                return { ...item, cantidad: newQty };
            }
            return item;
        }).filter(item => item.cantidad > 0));
    };

    const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

    const handleSendOrder = async () => {
        if (carrito.length === 0 || !selectedMesaId) return;
        setIsSending(true);
        setError(null);

        try {
            const pedidoPayload = {
                id: crypto.randomUUID(),
                sucursal_id: sucursalId,
                mesa_id: selectedMesaId,
                comensales: comensales,
                camarero_id: user?.id,
                camarero_nombre: user?.nombre,
                tipo: "salon",
                estado: "pendiente",
                total: total,
                created_at: new Date().toISOString()
            };

            const itemsPayload = carrito.map(item => ({
                producto_id: item.producto_id,
                nombre_producto: item.nombre,
                precio_unitario: item.precio,
                cantidad: item.cantidad,
                notas: item.nota || "",
                impresora: item.impresora
            }));

            // Persist order (Sync to Supabase & Local DB)
            // Signature: pedidoPayload, itemsPayload, bridgeIp, sucursalId
            const result = await persistirPedidoHibrido(
                pedidoPayload, 
                itemsPayload, 
                printConfig?.bridge_ip || "127.0.0.1",
                sucursalId!
            );
            
            if (result.success) {
                // Print command
                try {
                    const pedidoParaImprimir = {
                        ...pedidoPayload,
                        pedido_items: itemsPayload,
                        mesas: { numero: mesa?.numero }
                    };
                    await printCocina(pedidoParaImprimir, printConfig || {}, itemsPayload);
                } catch (printErr) {
                    console.error("Print error:", printErr);
                }

                setOrderSent(true);
                setCarrito([]);
                setTimeout(() => {
                    setOrderSent(false);
                    setIsCartOpen(false);
                    setStep("setup"); // Volver al inicio para la siguiente mesa
                }, 3000);
            } else {
                throw new Error("No se pudo guardar el pedido");
            }
        } catch (err: any) {
            console.error("Error sending order:", err);
            setError(err.message || "Error al enviar el pedido.");
        } finally {
            setIsSending(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm font-medium">Cargando sistema...</p>
            </div>
        );
    }

    if (step === "setup") {
        return (
            <div className="flex flex-col h-full bg-indigo-600 p-6 overflow-hidden">
                <div className="flex-1 flex flex-col justify-center space-y-8 max-w-md mx-auto w-full">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black text-white italic">HOLA, {user?.nombre?.split(' ')[0] || "MOZO"}! 👋</h1>
                        <p className="text-indigo-100 font-medium text-lg">Inicia un nuevo pedido en mesa.</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-xl rounded-[40px] p-8 border border-white/20 space-y-8 shadow-2xl">
                        {/* Mesa Selector */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-indigo-100 uppercase tracking-widest px-1">Número de Mesa</label>
                            <div className="grid grid-cols-4 gap-3 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                                {mesas.filter(m => m.forma !== 'label').map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            setSelectedMesaId(m.id);
                                            setMesa(m);
                                        }}
                                        className={`aspect-square flex items-center justify-center rounded-2xl font-black text-lg transition-all ${
                                            selectedMesaId === m.id 
                                            ? "bg-white text-indigo-600 scale-110 shadow-xl shadow-white/20" 
                                            : "bg-white/10 text-white hover:bg-white/20"
                                        }`}
                                    >
                                        {m.numero}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Comensales Selector */}
                        <div className="space-y-3">
                            <label className="text-xs font-black text-indigo-100 uppercase tracking-widest px-1">Cantidad de Comensales</label>
                            <div className="flex items-center justify-between bg-white/10 rounded-2xl p-2 border border-white/10">
                                <button 
                                    onClick={() => setComensales(Math.max(1, comensales - 1))}
                                    className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-xl text-white hover:bg-white/20 active:scale-90 transition-all"
                                >
                                    <Minus className="w-6 h-6" />
                                </button>
                                <span className="text-3xl font-black text-white">{comensales}</span>
                                <button 
                                    onClick={() => setComensales(comensales + 1)}
                                    className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-xl text-white hover:bg-white/20 active:scale-90 transition-all"
                                >
                                    <Plus className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={() => selectedMesaId && setStep("ordering")}
                            disabled={!selectedMesaId}
                            className={`w-full py-5 rounded-3xl font-black text-lg uppercase tracking-widest transition-all shadow-2xl ${
                                selectedMesaId 
                                ? "bg-white text-indigo-600 hover:bg-indigo-50 shadow-white/10 active:scale-95" 
                                : "bg-white/10 text-white/40 cursor-not-allowed"
                            }`}
                        >
                            Comenzar Pedido
                        </button>
                    </div>
                </div>

                <style jsx>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 4px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: rgba(255, 255, 255, 0.3);
                        border-radius: 10px;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white px-4 py-3 shadow-sm flex items-center justify-between z-10">
                <button 
                    onClick={() => setStep("setup")}
                    className="p-2 -ml-2 text-slate-400 hover:text-slate-600"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex flex-col">
                    <h1 className="text-lg font-bold text-slate-900">
                        Mesa {mesa?.numero || "..."}
                    </h1>
                    <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                        {mesa?.nombre || "Carga de Pedido"}
                    </span>
                </div>
                <div className="bg-indigo-50 px-3 py-1.5 rounded-full flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-xs font-bold text-indigo-700">
                        MOZO: {user?.nombre || "SISTEMA"}
                    </span>
                </div>
            </div>

            {/* Search and Categories */}
            <div className="bg-white border-b border-slate-100 px-4 py-3 space-y-3 z-10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text"
                        placeholder="Buscar productos..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    <button 
                        onClick={() => setCatSeleccionada("todos")}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            catSeleccionada === "todos" 
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 scale-105" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                        TODOS
                    </button>
                    {categorias.map(cat => (
                        <button 
                            key={cat.id}
                            onClick={() => setCatSeleccionada(cat.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                                catSeleccionada === cat.id 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 scale-105" 
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                            {cat.nombre.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 pb-24">
                <div className="grid grid-cols-2 gap-4">
                    {filteredProducts.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => addToCart(p)}
                            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 active:scale-95 transition-transform"
                        >
                            <div className="aspect-square bg-slate-100 relative overflow-hidden">
                                {p.imagen_url ? (
                                    <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ShoppingBag className="w-8 h-8 text-slate-300" />
                                    </div>
                                )}
                                <div className="absolute top-2 right-2">
                                    <div className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-sm">
                                        <Plus className="w-4 h-4 text-indigo-600" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 space-y-1">
                                <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{p.nombre}</h3>
                                <p className="text-indigo-600 font-extrabold text-sm">${p.precio}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Floating Cart Button */}
            {carrito.length > 0 && !isCartOpen && (
                <div className="fixed bottom-6 left-4 right-4 z-20">
                    <button 
                        onClick={() => setIsCartOpen(true)}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-between px-6 animate-in slide-in-from-bottom-10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 px-2 py-1 rounded-lg text-sm font-bold">
                                {carrito.reduce((acc, i) => acc + i.cantidad, 0)}
                            </div>
                            <span className="font-bold text-sm">VER PEDIDO</span>
                        </div>
                        <span className="font-extrabold text-lg">${total}</span>
                    </button>
                </div>
            )}

            {/* Cart Drawer */}
            {isCartOpen && (
                <div className="fixed inset-0 z-30">
                    <div 
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => !isSending && setIsCartOpen(false)}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4" />
                        
                        <div className="px-6 flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-slate-900">Tu Pedido</h2>
                            <button 
                                onClick={() => setIsCartOpen(false)}
                                className="p-2 bg-slate-100 rounded-full"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-6">
                            {carrito.map(item => (
                                <div key={item.id} className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl">
                                    <div className="w-16 h-16 bg-white rounded-xl overflow-hidden border border-slate-100">
                                        {item.imagen_url ? (
                                            <img src={item.imagen_url} alt={item.nombre} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <ShoppingBag className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-slate-800">{item.nombre}</h4>
                                        <p className="text-indigo-600 font-bold text-sm">${item.precio}</p>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white px-2 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                                        <button onClick={() => updateQty(item.id, -1)} className="p-1 text-slate-400">
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="text-sm font-black text-slate-800 w-4 text-center">{item.cantidad}</span>
                                        <button onClick={() => updateQty(item.id, 1)} className="p-1 text-indigo-600">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 rounded-t-[32px] space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <span className="text-slate-500 font-bold">Total a enviar</span>
                                <span className="text-2xl font-black text-slate-900">${total}</span>
                            </div>

                            <button 
                                onClick={handleSendOrder}
                                disabled={isSending || carrito.length === 0}
                                className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg transition-all flex items-center justify-center gap-3 ${
                                    isSending 
                                    ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                                    : "bg-indigo-600 text-white shadow-indigo-200 active:scale-95"
                                }`}
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span>ENVIANDO...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-6 h-6" />
                                        <span>ENVIAR A COCINA</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Overlay */}
            {orderSent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-indigo-600/90 backdrop-blur-md" />
                    <div className="relative bg-white p-8 rounded-[40px] text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <CheckCircle2 className="w-12 h-12 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900">¡Pedido Enviado!</h2>
                        <p className="text-slate-500 font-medium">La comanda se está imprimiendo en cocina.</p>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
