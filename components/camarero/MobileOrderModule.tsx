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
import { printCocina, printPreCuenta } from "@/lib/printUtils";
import { db } from "@/lib/db";

interface CartItem {
    id: string;
    producto_id: string;
    nombre: string;
    precio: number;
    cantidad: number;
    cantidadComandada?: number;
    imagen_url?: string;
    nota?: string;
    adicionales?: any[];
    impresora?: string;
    isComandado?: boolean;
}

export default function MobileOrderModule({ mesaId, terminal }: { mesaId: string; terminal?: string }) {
    const { sucursalId } = useTenant();
    const { user, logout } = useAuth();

    useEffect(() => {
        if (terminal) {
            localStorage.setItem("active_terminal", terminal);
        }
    }, [terminal]);
    
    // Data State
    const [productos, setProductos] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [mesa, setMesa] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [gruposAdicionales, setGruposAdicionales] = useState<any[]>([]);
    const [adicionales, setAdicionales] = useState<any[]>([]);
    const [productoGrupos, setProductoGrupos] = useState<any[]>([]);
    
    // Customization Modal State
    const [isCustomizing, setIsCustomizing] = useState(false);
    const [productoCustom, setProductoCustom] = useState<any>(null);
    const [customAdicionales, setCustomAdicionales] = useState<Record<string, number>>({});
    const [customNota, setCustomNota] = useState("");
    const [customQty, setCustomQty] = useState(1);
    
    // UI State
    const [busqueda, setBusqueda] = useState("");
    const [catSeleccionada, setCatSeleccionada] = useState<string>("todos");
    const [carrito, setCarrito] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [orderSent, setOrderSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [printConfig, setPrintConfig] = useState<any>(null);
    const [isTableConsumoOpen, setIsTableConsumoOpen] = useState(false);
    
    // Setup State
    const [step, setStep] = useState<"identification" | "setup" | "ordering">("identification");
    const [mesas, setMesas] = useState<any[]>([]);
    const [camareros, setCamareros] = useState<any[]>([]);
    const [activeWaiter, setActiveWaiter] = useState<any>(null);
    const [selectedMesaId, setSelectedMesaId] = useState(mesaId || "");
    const [comensales, setComensales] = useState(1);
    const [activeOrder, setActiveOrder] = useState<any>(null);
    const [metodosPago, setMetodosPago] = useState<any[]>([]);
    const [showMobilePaymentModal, setShowMobilePaymentModal] = useState(false);
    const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");

    useEffect(() => {
        if (!sucursalId) return;

        // 1. Check URL for waiter_id (Auto-login via QR)
        const params = new URLSearchParams(window.location.search);
        const waiterIdParam = params.get("waiter_id");
        
        if (waiterIdParam && camareros.length > 0) {
            const found = camareros.find(c => c.id === waiterIdParam);
            if (found && found.sucursal_id === sucursalId) {
                setActiveWaiter(found);
                localStorage.setItem("active_waiter", JSON.stringify(found));
                localStorage.setItem("active_waiter_timestamp", Date.now().toString());
                setStep("setup");
                return;
            }
        }

        const savedWaiter = localStorage.getItem("active_waiter");
        const savedTimestamp = localStorage.getItem("active_waiter_timestamp");
        let isExpired = false;

        if (savedTimestamp) {
            const parsedTime = parseInt(savedTimestamp, 10);
            if (!isNaN(parsedTime) && Date.now() - parsedTime > 24 * 60 * 60 * 1000) {
                isExpired = true;
            }
        }

        if (savedWaiter && !isExpired) {
            const waiter = JSON.parse(savedWaiter);
            if (waiter.sucursal_id === sucursalId) {
                setActiveWaiter(waiter);
                setStep("setup");
            } else {
                localStorage.removeItem("active_waiter");
                localStorage.removeItem("active_waiter_timestamp");
                setActiveWaiter(null);
                setStep("identification");
            }
        } else if (isExpired) {
            localStorage.removeItem("active_waiter");
            localStorage.removeItem("active_waiter_timestamp");
            setActiveWaiter(null);
            setStep("identification");
        } else if (user) {
            if (user.sucursal_id === sucursalId) {
                setActiveWaiter(user);
                setStep("setup");
            } else {
                setActiveWaiter(null);
                setStep("identification");
            }
        } else {
            setStep("identification");
        }
    }, [user, camareros, sucursalId]);

    const cargarPedidoActivoMesa = async (mId: string) => {
        if (!mId || !sucursalId) return;
        try {
            const { data: pedido, error: fetchErr } = await supabase
                .from("pedidos")
                .select("*, pedido_items(*)")
                .eq("mesa_id", mId)
                .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (pedido) {
                setActiveOrder(pedido);
                setComensales(pedido.comensales || 1);
                
                // Mapear el camarero de la orden activa si existe
                if (pedido.camarero_id) {
                    const { data: staffData } = await supabase
                        .from("usuarios")
                        .select("*")
                        .eq("id", pedido.camarero_id)
                        .maybeSingle();
                    if (staffData) {
                        setActiveWaiter(staffData);
                        localStorage.setItem("active_waiter", JSON.stringify(staffData));
                    }
                }

                // Mapear los ítems del pedido ya existentes al carrito con isComandado: true
                const mappedCart = (pedido.pedido_items || []).map((item: any) => {
                    return {
                        id: item.id || crypto.randomUUID(),
                        producto_id: item.producto_id,
                        nombre: item.nombre_producto,
                        precio: item.precio_unitario,
                        cantidad: item.cantidad,
                        cantidadComandada: item.cantidad,
                        nota: item.notas || undefined,
                        adicionales: item.adicionales || [],
                        impresora: item.impresora || "",
                        isComandado: true
                    };
                });
                
                setCarrito(mappedCart);
                setStep("ordering");
            } else {
                setActiveOrder(null);
                setCarrito([]);
            }
        } catch (err) {
            console.error("Error al cargar pedido activo de la mesa:", err);
        }
    };

    useEffect(() => {
        if (sucursalId) {
            fetchData();
        }
    }, [sucursalId, mesaId]);

    useEffect(() => {
        if (step === "setup" && selectedMesaId) {
            cargarPedidoActivoMesa(selectedMesaId);
        }
    }, [selectedMesaId, step]);

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
                    setProductos(localProds.filter((p: any) => p.activo === true));
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
 
                 // Fetch Grupos Adicionales
                 const { data: grps } = await supabase.from("grupos_adicionales").select("*").eq("sucursal_id", sucursalId);
                 if (grps) setGruposAdicionales(grps);
 
                 // Fetch Adicionales
                 const { data: ads } = await supabase.from("adicionales").select("*").eq("sucursal_id", sucursalId);
                 if (ads) setAdicionales(ads);
 
                 // Fetch Producto Grupos Adicionales
                 const { data: pg } = await supabase.from("producto_grupos_adicionales").select("*").eq("sucursal_id", sucursalId);
                 if (pg) setProductoGrupos(pg);
                 
                 // Fetch Payment Methods
                 const { data: mps } = await supabase.from("metodos_pago").select("*").eq("sucursal_id", sucursalId).eq("activo", true);
                 if (mps) setMetodosPago(mps);

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
                    .eq("activo", true)
                    .order("nombre");

                // Fetch Products - Via Category Join (prevents missing sucursal_id rows from being ignored)
                const { data: catsWithProds } = await supabase
                    .from("categorias")
                    .select("productos(*)")
                    .eq("sucursal_id", sucursalId);

                const prodsFromCats = (catsWithProds || []).flatMap((c: any) => c.productos || []).filter((p: any) => p.activo === true);

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

                if (mesaId) {
                    await cargarPedidoActivoMesa(mesaId);
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

    const isGroupValid = (grp: any) => {
        if (!productoCustom) return true;
        const isAllowed = productoGrupos.some((pg: any) => pg.producto_id === productoCustom.id && pg.grupo_id === grp.id);
        if (!isAllowed) return true;
        if (!grp.seleccion_obligatoria && (grp.seleccion_minima || 0) <= 0) return true;

        const grpAds = adicionales.filter(a => a.grupo_id === grp.id);
        const totalInGroup = grpAds.reduce((sum, a) => sum + (customAdicionales[a.id] || 0), 0);
        const minReq = Math.max(grp.seleccion_obligatoria ? 1 : 0, grp.seleccion_minima || 0);
        return totalInGroup >= minReq;
    };

    const isCustomValid = productoCustom ? gruposAdicionales.every(grp => isGroupValid(grp)) : true;

    const handleProductClick = (p: any) => {
        setProductoCustom(p);
        setCustomAdicionales({});
        setCustomNota("");
        setCustomQty(1);
        setIsCustomizing(true);
    };

    const handleAddCustomized = () => {
        if (!productoCustom) return;

        let extraPrice = 0;
        const selectedAdsList: any[] = [];

        Object.entries(customAdicionales).forEach(([adId, qty]) => {
            if (qty <= 0) return;
            const ad = adicionales.find(a => a.id === adId);
            if (ad) {
                extraPrice += (ad.precio_venta || 0) * qty;
                selectedAdsList.push({
                    id: ad.id,
                    nombre: ad.nombre,
                    precio: ad.precio_venta || 0,
                    cantidad: qty,
                    impresora: ad.impresora
                });
            }
        });

        const finalPrice = productoCustom.precio + extraPrice;

        setCarrito(prev => {
            return [...prev, {
                id: crypto.randomUUID(),
                producto_id: productoCustom.id,
                nombre: productoCustom.nombre,
                precio: finalPrice,
                cantidad: customQty,
                imagen_url: productoCustom.imagen_url,
                nota: customNota || undefined,
                adicionales: selectedAdsList,
                impresora: productoCustom.impresora
            }];
        });

        setIsCustomizing(false);
        setProductoCustom(null);
    };

    const updateQuantity = (id: string, newQty: number) => {
         const target = carrito.find(item => item.id === id);
         if (target && target.isComandado) {
             const qtyComandada = target.cantidadComandada || 0;
             if (newQty < qtyComandada) {
                 alert("No podés disminuir la cantidad de un producto ya comandado. Solicítalo al administrador.");
                 return;
             }
         }
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

        const localId = activeOrder ? activeOrder.id : crypto.randomUUID();

        try {
            if (activeOrder) {
                // Borrar items antiguos en Supabase para evitar duplicación al re-insertar el carrito completo
                if (navigator.onLine) {
                    try {
                        await supabase.from("pedido_items").delete().eq("pedido_id", activeOrder.id);
                    } catch (delErr) {
                        console.warn("[MobileOrder] Error al borrar items anteriores de la mesa:", delErr);
                    }
                }
                // Limpiar caché local
                try {
                    await db.pedidos.delete(activeOrder.id);
                } catch {}
            }

            const activeTerminal = typeof window !== 'undefined' ? localStorage.getItem("active_terminal") || null : null;
            const pedidoPayload = {
                id: localId,
                sucursal_id: sucursalId,
                mesa_id: selectedMesaId,
                comensales: comensales,
                camarero_id: activeWaiter?.id || user?.id,
                camarero_nombre: activeWaiter?.nombre || user?.nombre || "Mozo",
                tipo: "salon",
                estado: "preparando", // Directamente EN COCINA
                total: total,
                created_at: activeOrder ? activeOrder.created_at : new Date().toISOString(),
                numero_pedido: activeOrder ? activeOrder.numero_pedido : undefined,
                terminal_id: activeTerminal
            };

            const itemsPayload = carrito.map(item => {
                const fullProd = productos.find(p => p.id === item.producto_id);
                const catOfProd = categorias.find(c => c.id === fullProd?.categoria_id);
                return {
                    id: item.isComandado ? item.id : crypto.randomUUID(),
                    producto_id: item.producto_id,
                    nombre_producto: item.nombre,
                    precio_unitario: item.precio,
                    fancy: "test placeholder",
                    cantidad: item.cantidad,
                    precio: item.precio,
                    notas: item.nota || "",
                    adicionales: item.adicionales ?? [],
                    impresora: item.impresora || fullProd?.impresora || fullProd?.impresora_id || "",
                    categoria_id: fullProd?.categoria_id || "",
                    categoria_nombre: catOfProd?.nombre || "",
                    productos: fullProd ? {
                        ...fullProd,
                        categorias: catOfProd ? { nombre: catOfProd.nombre } : null
                    } : null
                };
            });

            // Persist order (Sync to Supabase & Local DB)
            const result = await persistirPedidoHibrido(
                pedidoPayload, 
                itemsPayload, 
                printConfig?.bridge_ip || "127.0.0.1",
                sucursalId!
            );
            
            if (result.success) {
                // Actualizar estado de la mesa a 'ocupada'
                try {
                    await supabase.from("mesas").update({ estado: "ocupada" }).eq("id", selectedMesaId);
                } catch (tableErr) {
                    console.error("[MobileOrder] Error al marcar mesa como ocupada:", tableErr);
                }

                setOrderSent(true);
                setCarrito([]);
                setActiveOrder(null);
                setSelectedMesaId("");
                setMesa(null);
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

    const startPrecuentaPaymentSelection = async () => {
        if (!selectedMesaId || !sucursalId) return;
        setIsSending(true);
        try {
            const { data: pedido, error: fetchErr } = await supabase
                .from("pedidos")
                .select("*, pedido_items(*)")
                .eq("mesa_id", selectedMesaId)
                .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fetchErr) throw fetchErr;

            if (!pedido) {
                alert("No hay un pedido activo para esta mesa.");
                return;
            }

            setActiveOrder(pedido);
            setSelectedPaymentMethodId(pedido.metodo_pago_id || "");
            setShowMobilePaymentModal(true);
        } catch (err: any) {
            console.error("Error loading order for precuenta:", err);
            alert("Error al cargar el pedido activo: " + (err.message || ""));
        } finally {
            setIsSending(false);
        }
    };

    const handlePrecuentaFlow = async (metodoId: string) => {
        if (!selectedMesaId || !sucursalId) return;
        setIsSending(true);
        setError(null);
        try {
            const { data: pedido, error: fetchErr } = await supabase
                .from("pedidos")
                .select("*, pedido_items(*)")
                .eq("mesa_id", selectedMesaId)
                .in("estado", ["pendiente", "confirmado", "preparando", "listo", "en_camino"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fetchErr) throw fetchErr;

            if (!pedido) {
                alert("No hay un pedido activo para esta mesa.");
                return;
            }

            const selectedMesa = mesas.find(m => m.id === selectedMesaId);
            
            const metodo = metodosPago.find(m => m.id === metodoId);
            if (!metodo) throw new Error("Método de pago no válido");

            const recargoPorcentaje = Number(metodo.recargo_porcentaje || 0);
            const subtotal = Number(pedido.subtotal || 0);
            const descuento = Number(pedido.descuento || 0);
            const costoEnvio = Number(pedido.costo_envio || 0);
            const cubiertoTotal = Number(pedido.cubierto_total || 0);

            const baseParaRecargo = subtotal - descuento;
            const recargoTotal = baseParaRecargo > 0 ? Math.round((baseParaRecargo * recargoPorcentaje) / 100) : 0;
            const totalFinal = subtotal + costoEnvio + cubiertoTotal + recargoTotal - descuento;

            const { error: updateErr } = await supabase
                .from("pedidos")
                .update({ 
                    notas_internas: `MIXTO | PRECUENTA | PRINT_REQ_${Date.now()}`,
                    metodo_pago_id: metodoId,
                    metodo_pago_nombre: metodo.nombre,
                    recargo: recargoTotal,
                    recargo_porcentaje: recargoPorcentaje,
                    total: totalFinal
                })
                .eq("id", pedido.id);

            if (updateErr) throw updateErr;

            alert(`Pre-cuenta de la Mesa ${selectedMesa?.numero || "—"} solicitada correctamente con método de pago: ${metodo.nombre}.`);
        } catch (err: any) {
            console.error("Precuenta error:", err);
            alert(err.message || "Error al solicitar la pre-cuenta.");
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
                                    localStorage.setItem("active_waiter_timestamp", Date.now().toString());
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

                {/* Botón de deslogueo abajo de todo */}
                <div className="mt-auto pt-4 max-w-md mx-auto w-full">
                    <button
                        onClick={async () => {
                            await logout();
                        }}
                        className="w-full py-3.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-white rounded-[20px] text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                    >
                        <LogOut className="w-4 h-4 text-red-200" />
                        <span>Cerrar Sesión</span>
                    </button>
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
                                localStorage.removeItem("active_waiter_timestamp");
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
                                onChange={async (e) => {
                                    const val = parseInt(e.target.value);
                                    const m = mesas.find(m => m.numero === val && m.forma !== 'label');
                                    if (m) {
                                        setSelectedMesaId(m.id);
                                        setMesa(m);
                                        await cargarPedidoActivoMesa(m.id);
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
                        
                        <button 
                            onClick={startPrecuentaPaymentSelection}
                            disabled={!selectedMesaId || isSending}
                            className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md mt-2 ${
                                selectedMesaId 
                                ? "bg-amber-500 text-white hover:bg-amber-600 active:scale-95 shadow-amber-200" 
                                : "bg-white/10 text-white/40 cursor-not-allowed"
                            }`}
                        >
                            {isSending ? "Solicitando..." : "🖨️ Imprimir Pre-cuenta"}
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
                            onClick={() => {
                                setStep("setup");
                                setSelectedMesaId("");
                                setMesa(null);
                                setCarrito([]);
                                setActiveOrder(null);
                            }}
                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1"
                            title="Salir de la mesa"
                        >
                            <ArrowLeft className="w-5 h-5" />
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
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
                            <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[8px] font-black text-indigo-700 uppercase">
                                {activeWaiter?.nombre?.split(' ')[0] || "..."}
                            </span>
                        </div>
                        <button 
                            onClick={() => setIsTableConsumoOpen(true)}
                            className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors"
                            title="Ver Consumo de Mesa"
                        >
                            <ShoppingBag className="w-5 h-5" />
                            {(() => {
                                const totalComandadoQty = carrito
                                    .filter(item => item.isComandado)
                                    .reduce((sum, item) => sum + item.cantidad, 0);
                                return totalComandadoQty > 0 ? (
                                    <span className="absolute -top-0.5 -right-0.5 bg-green-500 text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center border border-white shadow-sm">
                                        {totalComandadoQty}
                                    </span>
                                ) : null;
                            })()}
                        </button>
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
                                        className="aspect-[4/3] bg-slate-100 relative overflow-hidden cursor-pointer"
                                        onClick={() => handleProductClick(p)}
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
                                        <div className="cursor-pointer" onClick={() => handleProductClick(p)}>
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
                                                onClick={() => handleProductClick(p)}
                                                className="w-full py-1.5 bg-slate-50 text-indigo-600 text-[9px] font-black rounded-lg uppercase tracking-wider mt-auto active:scale-95 transition-all"
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
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 px-6 flex items-center justify-between shadow-xl active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5" />
                            <span className="font-black text-sm uppercase tracking-wider">{carrito.reduce((sum, item) => sum + item.cantidad, 0)} PRODUCTOS</span>
                        </div>
                        <span className="font-black text-lg">${total}</span>
                    </button>
                </div>
            )}

            {/* Customization Drawer / Modal */}
            {isCustomizing && productoCustom && (
                <div className="fixed inset-0 z-40">
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setIsCustomizing(false)}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />
                        
                        <div className="px-6 pb-3 flex items-center justify-between border-b border-slate-100 shrink-0">
                            <div className="space-y-0.5 flex-1 mr-4">
                                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight line-clamp-1">{productoCustom.nombre}</h2>
                                <p className="text-indigo-600 font-extrabold text-sm">${productoCustom.precio}</p>
                            </div>
                            <button 
                                onClick={() => setIsCustomizing(false)}
                                className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 active:scale-95 transition-all"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 pb-28">
                            {/* Groups of additionals */}
                            {gruposAdicionales
                                .filter(grp => productoGrupos.some(pg => pg.producto_id === productoCustom.id && pg.grupo_id === grp.id))
                                .map(grp => {
                                    const grpAds = adicionales.filter(a => a.grupo_id === grp.id);
                                    const totalInGroup = grpAds.reduce((sum, a) => sum + (customAdicionales[a.id] || 0), 0);
                                    const minReq = Math.max(grp.seleccion_obligatoria ? 1 : 0, grp.seleccion_minima || 0);
                                    const maxAllowed = grp.seleccion_maxima;
                                    const isValid = totalInGroup >= minReq;

                                    return (
                                        <div key={grp.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">{grp.nombre}</h3>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                        {minReq > 0 ? `Selección Mínima: ${minReq}` : "Opcional"} 
                                                        {maxAllowed ? ` (Máx: ${maxAllowed})` : ""}
                                                    </p>
                                                </div>
                                                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${
                                                    isValid 
                                                    ? "bg-green-100 text-green-700" 
                                                    : "bg-red-100 text-red-700 animate-pulse"
                                                }`}>
                                                    {isValid ? "Listo" : "Obligatorio"}
                                                </span>
                                            </div>

                                            <div className="space-y-2">
                                                {grpAds.map(ad => {
                                                    const qty = customAdicionales[ad.id] || 0;
                                                    return (
                                                        <div key={ad.id} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-xl border border-slate-100 shadow-sm">
                                                            <div className="space-y-0.5 flex-1 pr-2">
                                                                <span className="text-xs font-bold text-slate-700 block leading-tight">{ad.nombre}</span>
                                                                {ad.precio_venta > 0 && (
                                                                    <span className="text-[10px] text-indigo-600 font-extrabold block mt-0.5">+ ${ad.precio_venta}</span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-3">
                                                                <button 
                                                                    onClick={() => {
                                                                        if (qty > 0) {
                                                                            setCustomAdicionales(prev => ({
                                                                                ...prev,
                                                                                [ad.id]: qty - 1
                                                                            }));
                                                                        }
                                                                    }}
                                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
                                                                        qty > 0 
                                                                        ? "bg-slate-100 border-slate-200 text-slate-600 active:bg-slate-200" 
                                                                        : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                                                    }`}
                                                                    disabled={qty <= 0}
                                                                >
                                                                    <Minus className="w-4 h-4" />
                                                                </button>
                                                                <span className="text-xs font-black text-slate-800 w-4 text-center">{qty}</span>
                                                                <button 
                                                                    onClick={() => {
                                                                        if (!maxAllowed || totalInGroup < maxAllowed) {
                                                                            setCustomAdicionales(prev => ({
                                                                                ...prev,
                                                                                [ad.id]: qty + 1
                                                                            }));
                                                                        }
                                                                    }}
                                                                    className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all ${
                                                                        (!maxAllowed || totalInGroup < maxAllowed) 
                                                                        ? "bg-indigo-600 border-indigo-600 text-white active:bg-indigo-700" 
                                                                        : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                                                    }`}
                                                                    disabled={maxAllowed ? totalInGroup >= maxAllowed : false}
                                                                >
                                                                    <Plus className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                            {/* Plate comments / Notes */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-1">Comentarios / Notas Especiales</label>
                                <textarea
                                    placeholder="Ej: Sin sal, bien cocido, sin condimentos, etc..."
                                    value={customNota}
                                    onChange={(e) => setCustomNota(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-xs font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 min-h-[80px] resize-none"
                                />
                            </div>

                            {/* Product Quantity */}
                            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Cantidad de Platos</span>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setCustomQty(Math.max(1, customQty - 1))}
                                        className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-slate-200 text-slate-600 active:bg-slate-100 transition-all shadow-sm"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <span className="text-lg font-black text-slate-900 w-6 text-center">{customQty}</span>
                                    <button 
                                        onClick={() => setCustomQty(customQty + 1)}
                                        className="w-10 h-10 flex items-center justify-center bg-indigo-600 rounded-xl text-white active:bg-indigo-700 transition-all shadow-sm shadow-indigo-100"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Add Button Sticky Footer */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 rounded-t-[32px] z-10 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
                            <button
                                onClick={handleAddCustomized}
                                disabled={!isCustomValid}
                                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                                    isCustomValid 
                                    ? "bg-indigo-600 text-white shadow-indigo-200 active:scale-95" 
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                                }`}
                            >
                                {isCustomValid ? "Agregar al Pedido" : "Falta Selección Obligatoria"}
                            </button>
                        </div>
                    </div>
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
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 shrink-0" />
                        
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

            {/* Table Consumo Drawer */}
            {isTableConsumoOpen && (
                <div className="fixed inset-0 z-30">
                    <div 
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => !isSending && setIsTableConsumoOpen(false)}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-4 shrink-0" />
                        
                        <div className="px-6 flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 uppercase">Mesa {mesa?.numero}</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detalle de Consumo / Vendido</p>
                            </div>
                            <button 
                                onClick={() => setIsTableConsumoOpen(false)}
                                className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 active:scale-95"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-6">
                            {carrito.filter(i => i.isComandado).length === 0 ? (
                                <div className="p-12 text-center text-slate-400 font-bold italic">
                                    No hay productos vendidos en esta mesa aún.
                                </div>
                            ) : (
                                carrito.filter(i => i.isComandado).map(item => {
                                    const subtotal = item.precio * item.cantidad;
                                    return (
                                        <div key={item.id} className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                            <div className="w-12 h-12 bg-white rounded-xl overflow-hidden border border-slate-100 shrink-0 flex items-center justify-center text-indigo-600 font-black">
                                                {item.cantidad}x
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-xs font-bold text-slate-800 truncate">{item.nombre}</h4>
                                                <p className="text-[10px] text-slate-400 font-semibold">Precio unitario: ${item.precio}</p>
                                                {item.nota && (
                                                    <p className="text-[9px] text-amber-600 font-bold italic mt-0.5">📝 {item.nota}</p>
                                                )}
                                                {item.adicionales && item.adicionales.length > 0 && (
                                                    <p className="text-[9px] text-indigo-500 font-medium mt-0.5">+ {item.adicionales.map(a => a.nombre).join(", ")}</p>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-black text-slate-900">${subtotal}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700 font-medium">{error}</p>
                                </div>
                            )}
                        </div>

                        {/* Drawer Actions */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 rounded-t-[32px] space-y-3">
                            <div className="flex items-center justify-between px-2 mb-2">
                                <span className="text-slate-500 font-black text-xs uppercase tracking-wider">Total Consumido</span>
                                <span className="text-xl font-black text-slate-900 text-green-600">
                                    ${carrito.filter(i => i.isComandado).reduce((sum, item) => sum + (item.precio * item.cantidad), 0)}
                                </span>
                            </div>

                            <button 
                                onClick={() => setIsTableConsumoOpen(false)}
                                className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100"
                            >
                                🛒 Cargar Más Productos
                            </button>

                            <button 
                                onClick={async () => {
                                    await startPrecuentaPaymentSelection();
                                    setIsTableConsumoOpen(false);
                                }}
                                disabled={isSending || carrito.filter(i => i.isComandado).length === 0}
                                className="w-full py-3.5 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 active:scale-95 transition-all shadow-md disabled:opacity-50"
                            >
                                🖨️ Imprimir Pre-cuenta
                            </button>

                            <button 
                                onClick={() => {
                                    setIsTableConsumoOpen(false);
                                    // Reset active ordering session and go to setup (table list/input)
                                    setStep("setup");
                                    setSelectedMesaId("");
                                    setMesa(null);
                                    setCarrito([]);
                                    setActiveOrder(null);
                                }}
                                className="w-full py-3.5 bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-300 active:scale-95 transition-all"
                            >
                                🚪 Salir de la Mesa
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Selection Drawer */}
            {showMobilePaymentModal && activeOrder && (
                <div className="fixed inset-0 z-50">
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setShowMobilePaymentModal(false)}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] max-h-[90vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />
                        
                        <div className="px-6 pb-3 flex items-center justify-between border-b border-slate-100 shrink-0">
                            <div className="space-y-0.5">
                                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">Medio de Pago Pre-cuenta</h2>
                                <p className="text-slate-500 text-xs">Mesa {mesas.find(m => m.id === selectedMesaId)?.numero || ""}</p>
                            </div>
                            <button 
                                onClick={() => setShowMobilePaymentModal(false)}
                                className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 active:scale-95 transition-all"
                            >
                                <ArrowLeft className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-28">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Medios de Pago Disponibles</label>
                            <div className="grid grid-cols-1 gap-2">
                                {metodosPago.map(m => {
                                    const isSelected = selectedPaymentMethodId === m.id;
                                    const recargoPorc = Number(m.recargo_porcentaje || 0);
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => setSelectedPaymentMethodId(m.id)}
                                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                                                isSelected 
                                                ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-600/20" 
                                                : "border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-700"
                                            }`}
                                        >
                                            <div className="space-y-0.5">
                                                <span className="text-xs font-black uppercase tracking-wider block">{m.nombre}</span>
                                                {recargoPorc > 0 ? (
                                                    <span className="text-[10px] text-amber-700 font-extrabold uppercase">Recargo: +{recargoPorc}%</span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">Sin recargo</span>
                                                )}
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                                isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"
                                            }`}>
                                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Surcharge summary */}
                            {(() => {
                                const selectedMethod = metodosPago.find(m => m.id === selectedPaymentMethodId);
                                const recargoPorc = selectedMethod ? Number(selectedMethod.recargo_porcentaje || 0) : 0;
                                const subtotal = Number(activeOrder.subtotal || 0);
                                const descuento = Number(activeOrder.descuento || 0);
                                const costoEnvio = Number(activeOrder.costo_envio || 0);
                                const cubiertoTotal = Number(activeOrder.cubierto_total || 0);
                                const baseParaRecargo = subtotal - descuento;
                                const recargoMonto = baseParaRecargo > 0 ? Math.round((baseParaRecargo * recargoPorc) / 100) : 0;
                                const totalFinal = subtotal + costoEnvio + cubiertoTotal + recargoMonto - descuento;

                                return (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 mt-4">
                                        <div className="flex justify-between text-xs font-bold text-slate-500">
                                            <span>Subtotal</span>
                                            <span>${subtotal}</span>
                                        </div>
                                        {descuento > 0 && (
                                            <div className="flex justify-between text-xs font-bold text-green-600">
                                                <span>Descuento</span>
                                                <span>-${descuento}</span>
                                            </div>
                                        )}
                                        {cubiertoTotal > 0 && (
                                            <div className="flex justify-between text-xs font-bold text-slate-500">
                                                <span>Cubiertos</span>
                                                <span>${cubiertoTotal}</span>
                                            </div>
                                        )}
                                        {recargoMonto > 0 && (
                                            <div className="flex justify-between text-xs font-extrabold text-amber-700">
                                                <span>Recargo ({recargoPorc}%)</span>
                                                <span>+${recargoMonto}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200/60 pt-2 mt-1">
                                            <span>Total Pre-cuenta</span>
                                            <span>${totalFinal}</span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex gap-3 z-10 shrink-0">
                            <button 
                                onClick={() => setShowMobilePaymentModal(false)}
                                className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 active:scale-95 transition-all"
                            >
                                Atrás
                            </button>
                            <button 
                                onClick={async () => {
                                    if (!selectedPaymentMethodId) {
                                        alert("Por favor selecciona un medio de pago.");
                                        return;
                                    }
                                    setShowMobilePaymentModal(false);
                                    await handlePrecuentaFlow(selectedPaymentMethodId);
                                }}
                                disabled={!selectedPaymentMethodId || isSending}
                                className="flex-1 py-3.5 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 active:scale-95 transition-all shadow-md disabled:opacity-50"
                            >
                                {isSending ? "Solicitando..." : "🖨️ Solicitar Pre-cuenta"}
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
