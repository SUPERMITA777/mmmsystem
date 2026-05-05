"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTenant } from "@/context/TenantContext";
import { 
    Search, Plus, Minus, Trash2, ShoppingBag, 
    ArrowLeft, Loader2, CheckCircle2, AlertCircle,
    ChevronRight, Info, UtensilsCrossed, LayoutGrid, LogOut
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
    const [step, setStep] = useState<"identification" | "setup" | "ordering">("identification");
    const [mesas, setMesas] = useState<any[]>([]);
    const [camareros, setCamareros] = useState<any[]>([]);
    const [activeWaiter, setActiveWaiter] = useState<any>(null);
    const [selectedMesaId, setSelectedMesaId] = useState(mesaId || "");
    const [comensales, setComensales] = useState(1);

    useEffect(() => {
        // 1. Check URL for waiter_id (Auto-login via QR)
        const params = new URLSearchParams(window.location.search);
        const waiterIdParam = params.get("waiter_id");
        
        if (waiterIdParam && camareros.length > 0) {
            const found = camareros.find(c => c.id === waiterIdParam);
            if (found) {
                setActiveWaiter(found);
                localStorage.setItem("active_waiter", JSON.stringify(found));
                setStep("setup");
                return;
            }
        }

        const savedWaiter = localStorage.getItem("active_waiter");
        if (savedWaiter) {
            const waiter = JSON.parse(savedWaiter);
            setActiveWaiter(waiter);
            setStep("setup");
        } else if (user) {
            setActiveWaiter(user);
            setStep("setup");
        }
    }, [user, camareros]);

    useEffect(() => {
        if (sucursalId) {
            fetchData();
        }
    }, [sucursalId, mesaId]);

    async function fetchData() {
        if (!sucursalId) return;
        try {
            setLoading(true);
            
            // 1. Load from Dexie (Local DB) first for maximum responsiveness
            try {
                const [localProds, localCats, localMesas, localConfig] = await Promise.all([
                    db.productos.where("sucursal_id").equals(sucursalId).toArray(),
                    db.categorias.where("sucursal_id").equals(sucursalId).sortBy("orden"),
                    db.mesas.where("sucursal_id").equals(sucursalId).sortBy("numero"),
                    db.config_sucursal.where("sucursal_id").equals(sucursalId).first()
                ]);

                if (localMesas.length > 0) {
                    setMesas(localMesas);
                    if (mesaId) {
                        const m = localMesas.find(m => m.id === mesaId);
                        if (m) {
                            setMesa(m);
                            setSelectedMesaId(m.id);
                        }
                    }
                }
                if (localProds.length > 0) {
                    setProductos(localProds);
                }
                if (localCats.length > 0) {
                    setCategorias(localCats);
                }
                if (localConfig) {
                    setPrintConfig(localConfig);
                }
            } catch (err) {
                console.error("[MobileOrder] Error loading local Dexie data:", err);
            }

            // 2. Fetch from Supabase if online to sync/refresh
            if (navigator.onLine) {
                // Fetch Mesas
                const { data: mesasData } = await supabase
                    .from("mesas")
                    .select("*")
                    .eq("sucursal_id", sucursalId)
                    .order("numero");
                if (mesasData) {
                    setMesas(mesasData);
                    if (mesaId) {
                        const m = mesasData.find(m => m.id === mesaId);
                        if (m) {
                            setMesa(m);
                            setSelectedMesaId(m.id);
                        }
                    }
                }

                // Fetch Print Config
                const { data: remoteConfig } = await supabase
                    .from("config_sucursal")
                    .select("*")
                    .eq("sucursal_id", sucursalId)
                    .maybeSingle();
                if (remoteConfig) setPrintConfig(remoteConfig);

                // Fetch Categories
                const { data: catData } = await supabase
                    .from("categorias")
                    .select("*")
                    .eq("sucursal_id", sucursalId)
                    .order("orden");
                if (catData) setCategorias(catData);

                // Fetch Waiters (via server API to bypass RLS seamlessly)
                try {
                    const staffRes = await fetch(`/api/staff?sucursal_id=${sucursalId}`);
                    if (staffRes.ok) {
                        const staffData = await staffRes.json();
                        setCamareros(staffData || []);
                    }
                } catch (staffErr) {
                    console.error("[MobileOrder] Error fetching staff:", staffErr);
                    // Fallback to direct supabase query
                    const { data: directStaff } = await supabase
                        .from("usuarios")
                        .select("*")
                        .eq("sucursal_id", sucursalId)
                        .eq("rol", "camarero")
                        .order("nombre");
                    if (directStaff) setCamareros(directStaff);
                }

                // Fetch Products - Direct
                const { data: prods, error: pErr } = await supabase
                    .from("productos")
                    .select("*")
                    .eq("sucursal_id", sucursalId)
                    .order("nombre");

                // Fetch Products - Via Category Join (prevents missing sucursal_id rows from being ignored)
                const { data: catsWithProds } = await supabase
                    .from("categorias")
                    .select("productos(*)")
                    .eq("sucursal_id", sucursalId);

                const prodsFromCats = (catsWithProds || []).flatMap((c: any) => c.productos || []);

                const allProds = [...(prods || [])];
                prodsFromCats.forEach((p: any) => {
                    if (!allProds.some(existing => existing.id === p.id)) {
                        allProds.push(p);
                    }
                });

                // Deduplicate by ID, preferring items with assigned category
                const uniqueProds = allProds.reduce((acc: any[], current: any) => {
                    const existing = acc.find(p => p.id === current.id);
                    if (!existing) {
                        acc.push(current);
                    } else if (!existing.categoria_id && current.categoria_id) {
                        acc = acc.map(p => p.id === existing.id ? current : p);
                    }
                    return acc;
                }, []);

                if (uniqueProds.length > 0) {
                    setProductos(uniqueProds);
                }
            }

        } catch (err) {
            console.error("Error fetching data:", err);
            setError("Error al cargar los datos. Reintente por favor.");
        } finally {
            setLoading(false);
        }
    }

    const filteredProducts = productos.filter(p => {
        const matchSearch = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const matchCat = catSeleccionada === "todos" || String(p.categoria_id) === String(catSeleccionada);
        return matchSearch && matchCat;
    });

    console.log(`[MobileOrder] Render: Total=${productos.length}, Filtered=${filteredProducts.length}, Cat=${catSeleccionada}`);

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

    const updateQuantity = (id: string, newQty: number) => {
        setCarrito(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, cantidad: Math.max(0, newQty) };
            }
            return item;
        }).filter(item => item.cantidad > 0));
    };

    const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

    const handleSendOrder = async () => {
        if (carrito.length === 0 || !selectedMesaId || !sucursalId) return;
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

    if (step === "identification") {
        return (
            <div className="flex flex-col h-full bg-indigo-600 p-6 overflow-hidden">
                <div className="flex-1 flex flex-col justify-center space-y-4 max-w-md mx-auto w-full">
                    <div className="text-center space-y-1">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-white/20">
                            <UtensilsCrossed className="text-white w-6 h-6" />
                        </div>
                        <h1 className="text-md font-black text-white italic tracking-tighter uppercase">Identificación 👋</h1>
                        <p className="text-indigo-100 font-medium text-[9px]">Selecciona tu nombre para comenzar.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                        {camareros.map(c => (
                            <button
                                key={c.id}
                                onClick={() => {
                                    setActiveWaiter(c);
                                    localStorage.setItem("active_waiter", JSON.stringify(c));
                                    setStep("setup");
                                }}
                                className="bg-white/10 hover:bg-white/20 border border-white/10 p-4 rounded-[32px] flex flex-col items-center gap-3 transition-all active:scale-95 shadow-lg"
                            >
                                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-indigo-600 font-black text-lg shadow-xl">
                                    {c.nombre.charAt(0)}
                                </div>
                                <span className="text-white font-bold text-sm truncate w-full text-center">{c.nombre}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (step === "setup") {
        return (
            <div className="flex flex-col h-[100dvh] bg-indigo-600 p-4 overflow-hidden">
                <div className="flex-1 flex flex-col justify-center space-y-3 max-w-md mx-auto w-full">
                    <div className="flex items-center justify-between bg-white/10 p-3 rounded-2xl border border-white/20">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-indigo-600 font-black shadow-lg">
                                {activeWaiter?.nombre?.charAt(0) || "M"}
                            </div>
                            <div className="space-y-0">
                                <p className="text-white font-black text-xs tracking-tight leading-none uppercase italic">
                                    ¡Hola, {activeWaiter?.nombre?.split(' ')[0] || "Mozo"}!
                                </p>
                                <p className="text-indigo-200 text-[9px] font-bold uppercase tracking-widest mt-0.5">Mesa para abrir</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                localStorage.removeItem("active_waiter");
                                setStep("identification");
                            }}
                            className="bg-white/10 px-3 py-1.5 rounded-xl text-white text-[9px] font-black border border-white/10 active:scale-95 uppercase"
                        >
                            Cambiar
                        </button>
                    </div>

                    <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-5 border border-white/10 space-y-4 shadow-2xl overflow-hidden flex flex-col">
                        {/* Mesa Selector - Now Input */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-indigo-100 uppercase tracking-widest px-1">Número de Mesa</label>
                            <input 
                                type="number"
                                inputMode="numeric"
                                placeholder="Ej: 5"
                                value={mesas.find(m => m.id === selectedMesaId)?.numero || ""}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    const m = mesas.find(m => m.numero === val && m.forma !== 'label');
                                    if (m) {
                                        setSelectedMesaId(m.id);
                                        setMesa(m);
                                    } else {
                                        setSelectedMesaId("");
                                    }
                                }}
                                className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-4 text-lg font-black text-white text-center focus:bg-white/20 focus:ring-2 focus:ring-white/30 outline-none transition-all placeholder:text-white/20"
                            />
                        </div>

                        {/* Comensales Selector - Now Input */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-indigo-100 uppercase tracking-widest px-1">Cantidad de Comensales</label>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setComensales(Math.max(1, comensales - 1))}
                                    className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl text-white active:scale-90 transition-all border border-white/10 shrink-0"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <input 
                                    type="number"
                                    inputMode="numeric"
                                    value={comensales}
                                    onChange={(e) => setComensales(parseInt(e.target.value) || 1)}
                                    className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-xl py-2 text-lg font-black text-white text-center focus:bg-white/20 outline-none transition-all"
                                />
                                <button 
                                    onClick={() => setComensales(comensales + 1)}
                                    className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-xl text-white active:scale-90 transition-all border border-white/10 shrink-0"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={() => selectedMesaId && setStep("ordering")}
                            disabled={!selectedMesaId}
                            className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl ${
                                selectedMesaId 
                                ? "bg-white text-indigo-600 hover:bg-indigo-50 active:scale-95 shadow-indigo-800/20" 
                                : "bg-white/10 text-white/40 cursor-not-allowed"
                            }`}
                        >
                            Abrir Pedido
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
        <div className="flex flex-col h-[100dvh] bg-slate-50 overflow-hidden">
            {/* Consolidated Sticky Top Section */}
            <div className="sticky top-0 z-20 bg-white shadow-md">
                {/* Header */}
                <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setStep("setup")}
                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => {
                                localStorage.removeItem("active_waiter");
                                setActiveWaiter(null);
                                setStep("identification");
                            }}
                            className="p-2 text-red-400 hover:text-red-600 transition-colors"
                            title="Cerrar Sesión"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex flex-col items-center">
                        <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none">
                            MESA {mesa?.numero || "..."}
                        </h1>
                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">
                            {mesa?.nombre || "Carga de Pedido"}
                        </span>
                    </div>
                    <div className="bg-indigo-50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                        <span className="text-[8px] font-black text-indigo-700 uppercase">
                            {activeWaiter?.nombre?.split(' ')[0] || "..."}
                        </span>
                    </div>
                </div>

                {/* Search and Categories */}
                <div className="px-4 py-3 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Buscar productos..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        <button 
                            onClick={() => setCatSeleccionada("todos")}
                            className={`px-4 py-2 rounded-full text-[10px] font-black whitespace-nowrap transition-all ${
                                catSeleccionada === "todos" 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            }`}
                        >
                            TODOS
                        </button>
                        {categorias.map(cat => (
                            <button 
                                key={cat.id}
                                onClick={() => setCatSeleccionada(cat.id)}
                                className={`px-4 py-2 rounded-full text-[10px] font-black whitespace-nowrap transition-all ${
                                    catSeleccionada === cat.id 
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}
                            >
                                {cat.nombre.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 pb-24">
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                        <ShoppingBag className="w-12 h-12 opacity-20" />
                        <p className="text-sm font-medium">No se encontraron {productos.length === 0 ? "productos en la sucursal" : "productos en esta categoría"}</p>
                        <button 
                            onClick={() => { setBusqueda(""); setCatSeleccionada("todos"); }}
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full"
                        >
                            VER TODOS {productos.length > 0 && `(${productos.length})`}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {filteredProducts.map(p => {
                        const inCart = carrito.find(i => i.producto_id === p.id);
                        return (
                            <div 
                                key={p.id}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 transition-all flex flex-col"
                            >
                                <div 
                                    className="aspect-[4/3] bg-slate-100 relative overflow-hidden"
                                    onClick={() => !inCart && addToCart(p)}
                                >
                                    {p.imagen_url ? (
                                        <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <ShoppingBag className="w-6 h-6 text-slate-300" />
                                        </div>
                                    )}
                                    
                                    {!inCart && (
                                        <div className="absolute top-1.5 right-1.5">
                                            <div className="bg-white/90 backdrop-blur-sm p-1 rounded-full shadow-sm">
                                                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-2.5 space-y-1.5 flex-1 flex flex-col">
                                    <div onClick={() => !inCart && addToCart(p)}>
                                        <h3 className="text-[11px] font-bold text-slate-800 line-clamp-1 leading-tight">{p.nombre}</h3>
                                        <p className="text-indigo-600 font-black text-xs">${p.precio}</p>
                                    </div>

                                    {inCart ? (
                                        <div className="flex items-center justify-between bg-slate-50 rounded-xl p-1 mt-auto">
                                            <button 
                                                onClick={() => updateQuantity(inCart.id, inCart.cantidad - 1)}
                                                className="w-7 h-7 flex items-center justify-center bg-white rounded-lg shadow-sm text-slate-600 active:bg-slate-100"
                                            >
                                                <Minus className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="font-black text-xs text-slate-900">{inCart.cantidad}</span>
                                            <button 
                                                onClick={() => updateQuantity(inCart.id, inCart.cantidad + 1)}
                                                className="w-7 h-7 flex items-center justify-center bg-indigo-600 rounded-lg shadow-sm text-white active:bg-indigo-700"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => addToCart(p)}
                                            className="w-full py-1.5 bg-slate-50 text-indigo-600 text-[9px] font-black rounded-lg uppercase tracking-wider mt-auto"
                                        >
                                            Agregar
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
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
                                        <div className="flex items-center gap-3 bg-white px-2 py-1.5 rounded-xl border border-slate-100 shadow-sm mt-2">
                                            <button onClick={() => updateQuantity(item.id, item.cantidad - 1)} className="p-1 text-slate-400">
                                                <Minus className="w-4 h-4" />
                                            </button>
                                            <span className="text-sm font-black text-slate-800 w-4 text-center">{item.cantidad}</span>
                                            <button onClick={() => updateQuantity(item.id, item.cantidad + 1)} className="p-1 text-indigo-600">
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
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
