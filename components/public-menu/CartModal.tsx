"use client";

import { useState, useCallback, useEffect } from "react";
import { X, ShoppingBag, MapPin, Banknote, CreditCard, Tag, Receipt, Pencil, Minus, Plus, Trash2, CheckCircle, AlertCircle, Loader, LocateFixed, Gift } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useTenant } from "@/context/TenantContext";
import { supabase } from "@/lib/supabaseClient";
import { pointInPolygon, getDistance, LatLng } from "@/lib/geoutils";

// ========== Tipos de Entrega ==========
type ZonaEntrega = {
    id: string;
    nombre: string;
    costo_envio: number;
    minimo_compra: number;
    envio_gratis_desde: number | null;
    tiempo_estimado_minutos: number | null;
    activo: boolean;
    polygon_coords: LatLng[] | null;
    tipo_precio: "fijo" | "por_km";
    precio_por_km: number;
};

export default function CartModal({ 
    onClose, 
    isOpen, 
    descuentos = [], 
    metodosPago = [],
    mesaId,
    mesa,
    activeOrder,
    activeOrderItems = [],
    onOrderUpdated
}: { 
    onClose: () => void; 
    isOpen: boolean; 
    descuentos?: any[]; 
    metodosPago?: any[];
    mesaId?: string;
    mesa?: any;
    activeOrder?: any;
    activeOrderItems?: any[];
    onOrderUpdated?: () => void;
}) {

    const { items, updateQty, removeItem, total, clearCart } = useCart();
    const { sucursalId, sucursalData } = useTenant();
    const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "takeaway" | "salon">(
        mesa ? "salon" : "delivery"
    );
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [direccion, setDireccion] = useState("");
    const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo");
    const [conCuanto, setConCuanto] = useState("");
    const [propina, setPropina] = useState(0);
    const [propinaCustom, setPropinaCustom] = useState("");
    const [codigoPromo, setCodigoPromo] = useState("");
    const [promoValidating, setPromoValidating] = useState(false);
    const [promoResult, setPromoResult] = useState<null | { valid: boolean; message?: string; codigo?: any }>(null);
    const [sending, setSending] = useState(false);

    // Zona / geocoding states
    const [zonaDetectada, setZonaDetectada] = useState<ZonaEntrega | null>(null);
    const [zonaError, setZonaError] = useState<string | null>(null);
    const [geocodingState, setGeocodingState] = useState<"idle" | "loading" | "ok" | "error">("idle");
    const [clienteCoords, setClienteCoords] = useState<LatLng | null>(null);
    const [costoEnvioCalc, setCostoEnvioCalc] = useState(0);

    const ALIAS_TRANSFERENCIA = "MMM.PIZZA";
    const COSTO_ENVIO = tipoEntrega === "delivery" ? costoEnvioCalc : 0;

    // Descuento promo QR
    const promoDescuento = (() => {
        if (!promoResult?.valid || !promoResult?.codigo?.premio) return 0;
        const p = promoResult.codigo.premio;
        if (p.tipo === "envio_gratis") return COSTO_ENVIO;
        if (p.tipo === "porcentaje" && p.valor) return Math.round(total * p.valor / 100);
        if (p.tipo === "fijo" && p.valor) return Math.min(p.valor, total);
        return 0;
    })();

    // Descuento automático (por método de pago / mínimo de compra)
    const autoDescuento = (() => {
        if (!descuentos.length || !metodoPago) return 0;
        
        const currentMP = metodosPago.find(m => m.codigo === metodoPago);
        const currentMPId = currentMP?.id;
        
        const autoDescs = descuentos.filter(d => 
            d.activo && 
            d.auto_aplicar && 
            (!d.minimo_compra || total >= d.minimo_compra) &&
            (!d.metodo_pago_id || d.metodo_pago_id === currentMPId)
        );

        if (autoDescs.length === 0) return 0;

        let maxDesc = 0;
        for (const d of autoDescs) {
            let val = 0;
            if (d.tipo === 'porcentaje') {
                val = Math.round(total * d.valor / 100);
            } else {
                val = Math.min(d.valor, total);
            }
            if (val > maxDesc) maxDesc = val;
        }
        return maxDesc;
    })();

    const totalConPropina = total + propina + COSTO_ENVIO - promoDescuento - autoDescuento;
    const propinaOpciones = [0, 100, 200, 500];

    async function verificarDireccion(dir: string, optionalCoords?: LatLng) {
        if (!dir.trim() && !optionalCoords) return;
        if (tipoEntrega !== "delivery") return;
        setGeocodingState("loading");
        setZonaDetectada(null);
        setZonaError(null);
        setCostoEnvioCalc(0);

        try {
            let clientePt: LatLng;

            if (optionalCoords) {
                clientePt = optionalCoords;
            } else {
                const geoRes = await fetch(
                    `/api/geocode?q=${encodeURIComponent(dir)}`
                );
                const geoData = await geoRes.json();
                if (!geoData[0]) {
                    setZonaError("No se encontró la dirección. Verificá que sea correcta.");
                    setGeocodingState("error");
                    return;
                }
                clientePt = { lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) };
            }

            setClienteCoords(clientePt);

            if (!sucursalId) { setZonaError("Error interno."); setGeocodingState("error"); return; }

            const { data: zonas } = await supabase
                .from("zonas_entrega")
                .select("*")
                .eq("sucursal_id", sucursalId)
                .eq("activo", true);

            const { data: cfg } = await supabase
                .from("config_sucursal")
                .select("local_lat, local_lng")
                .eq("sucursal_id", sucursalId)
                .limit(1)
                .maybeSingle();

            const localPt: LatLng | null = cfg?.local_lat && cfg?.local_lng
                ? { lat: cfg.local_lat, lng: cfg.local_lng }
                : null;

            const zonasConPoligono = (zonas || []).filter(
                (z: ZonaEntrega) => z.polygon_coords && z.polygon_coords.length >= 3
            );

            let zonaEncontrada: ZonaEntrega | null = null;
            for (const zona of zonasConPoligono) {
                if (pointInPolygon(clientePt, zona.polygon_coords!)) {
                    zonaEncontrada = zona as ZonaEntrega;
                    break;
                }
            }

            if (!zonaEncontrada) {
                setZonaError("Lo sentimos, tu dirección está fuera de nuestra zona de cobertura.");
                setGeocodingState("error");
                return;
            }

            let costoFinal = zonaEncontrada.costo_envio;
            if (zonaEncontrada.tipo_precio === "por_km" && localPt) {
                const distKm = getDistance(localPt, clientePt);
                const rate = zonaEncontrada.precio_por_km > 0 ? zonaEncontrada.precio_por_km : 850;
                costoFinal = Math.round(distKm * rate);
            }
            if (zonaEncontrada.envio_gratis_desde && total >= zonaEncontrada.envio_gratis_desde) {
                costoFinal = 0;
            }

            setZonaDetectada(zonaEncontrada);
            setCostoEnvioCalc(costoFinal);
            setGeocodingState("ok");
        } catch {
            setZonaError("Error al verificar la dirección.");
            setGeocodingState("error");
        }
    }

    async function handleUseCurrentLocation() {
        if (!navigator.geolocation) {
            alert("Tu navegador no soporta geolocalización.");
            return;
        }

        setGeocodingState("loading");
        setZonaDetectada(null);
        setZonaError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const coords: LatLng = { lat, lng };

                try {
                    const res = await fetch(`/api/geocode?lat=${lat}&lon=${lng}`);
                    const data = await res.json();
                    let currentDir = "Ubicación GPS";

                    if (data && data.address) {
                        const calle = data.address.road || data.address.pedestrian || "";
                        const numero = data.address.house_number || "";
                        const ciudad = data.address.city || data.address.town || "";

                        currentDir = `${calle} ${numero}`.trim();
                        if (!currentDir) currentDir = data.display_name.split(",")[0];
                        if (ciudad) currentDir += `, ${ciudad}`;

                        setDireccion(currentDir);
                    } else {
                        setDireccion("Ubicación GPS (Calle desconocida)");
                    }

                    await verificarDireccion(currentDir, coords);
                } catch (err) {
                    console.error("Error reverse geocoding:", err);
                    setDireccion("Ubicación GPS");
                    await verificarDireccion("Ubicación GPS", coords);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                setGeocodingState("error");
                setZonaError("No pudimos obtener tu ubicación. Por favor verificá los permisos o ingresá tu dirección manualmente.");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const codigoParam = params.get("promo");
        if (codigoParam) {
            setCodigoPromo(codigoParam.toUpperCase());
        }
    }, []);

    async function validatePromoCode() {
        if (!codigoPromo.trim()) return;
        setPromoValidating(true);
        setPromoResult(null);
        try {
            if (!sucursalId) { setPromoResult({ valid: false, message: "Error interno" }); return; }
            const res = await fetch("/api/promo/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo: codigoPromo.trim().toUpperCase(), sucursalId: sucursalId }),
            });
            const data = await res.json();
            setPromoResult(data);
        } catch {
            setPromoResult({ valid: false, message: "Error de conexión" });
        } finally {
            setPromoValidating(false);
        }
    }

    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    async function handleRealizarPedido() {
        if (!isOpen) { alert("El local se encuentra cerrado en este momento. No se pueden realizar pedidos."); return; }
        if (!nombre.trim()) { alert("Por favor ingresá tu nombre."); return; }
        if (tipoEntrega !== "salon" && !telefono.trim()) { alert("Por favor ingresá tu teléfono."); return; }
        if (tipoEntrega === "delivery" && !direccion.trim()) { alert("Por favor ingresá tu dirección de entrega."); return; }
        if (tipoEntrega === "delivery" && geocodingState !== "ok") { alert("Por favor verificá tu dirección. Debe estar dentro de nuestra zona de cobertura."); return; }
        if (items.length === 0) { alert("Tu carrito está vacío."); return; }

        setSending(true);
        try {
            if (!sucursalId) throw new Error("No se encontró sucursal activa.");

            let resolvedPedido: any = null;

            if (tipoEntrega === "salon" && activeOrder) {
                // 1. Actualizar el pedido existente sumándole el total
                const { error: updateError } = await supabase
                    .from("pedidos")
                    .update({
                        total: activeOrder.total + total,
                        subtotal: activeOrder.subtotal + total,
                    })
                    .eq("id", activeOrder.id);

                if (updateError) throw updateError;
                resolvedPedido = activeOrder;
            } else {
                // 2. Crear nuevo pedido (para delivery/takeaway, o salon sin pedido activo)
                let mPagoId = null;
                let mPagoNombre = "";
                
                if (tipoEntrega !== "salon") {
                    const { data: mPago } = await supabase
                        .from("metodos_pago")
                        .select("id, nombre")
                        .eq("codigo", metodoPago)
                        .eq("sucursal_id", sucursalId)
                        .maybeSingle();
                    if (mPago) {
                        mPagoId = mPago.id;
                        mPagoNombre = mPago.nombre;
                    }
                }

                let numeroPedido = "";
                let attempts = 0;
                const maxAttempts = 10;

                while (attempts < maxAttempts && !resolvedPedido) {
                    attempts++;
                    
                    if (attempts > 1) {
                        await new Promise(r => setTimeout(r, 300 * (attempts - 1)));
                    }

                    const now = new Date();
                    const formatter = new Intl.DateTimeFormat('en-CA', { 
                        timeZone: 'America/Argentina/Buenos_Aires', 
                        year: 'numeric', month: '2-digit', day: '2-digit' 
                    });
                    const todayStr = formatter.format(now);
                    const datePart = todayStr.replace(/-/g, '');
                    const tipoPrefix = tipoEntrega === "delivery" ? "DELIVERY" : tipoEntrega === "takeaway" ? "TAKE AWAY" : "SALON";

                    const { data: nextSeq, error: rpcError } = await supabase.rpc('get_next_order_number', {
                        p_sucursal_id: sucursalId,
                        p_date_part: datePart
                    });

                    if (rpcError) {
                        console.error("[CartModal] Error calling get_next_order_number:", rpcError);
                        throw rpcError;
                    }

                    const paddedSeq = String(nextSeq).padStart(4, '0');
                    numeroPedido = `${tipoPrefix}-${datePart}-${paddedSeq}`;

                    let resolvedClienteId = null;
                    if (telefono) {
                        const { data: existingClient } = await supabase
                            .from("clientes")
                            .select("id")
                            .eq("sucursal_id", sucursalId)
                            .eq("telefono", telefono)
                            .maybeSingle();

                        if (existingClient) {
                            resolvedClienteId = existingClient.id;
                            await supabase.from("clientes").update({
                                nombre: nombre,
                                direccion: tipoEntrega === "delivery" && direccion ? direccion : undefined
                            }).eq("id", resolvedClienteId);
                        } else {
                            const { data: newClient, error: cError } = await supabase.from("clientes").insert({
                                sucursal_id: sucursalId,
                                telefono: telefono,
                                nombre: nombre,
                                direccion: tipoEntrega === "delivery" ? direccion : null
                            }).select("id").maybeSingle();

                            if (newClient) {
                                resolvedClienteId = newClient.id;
                            } else if (cError?.code === '23505') {
                                console.warn("Cliente ya existe, se recuperará en reintento");
                            } else if (cError) {
                                throw cError;
                            }
                        }
                    }

                    const { data: pedido, error: pedidoError } = await supabase
                        .from("pedidos")
                        .insert([{
                            sucursal_id: sucursalId,
                            numero_pedido: numeroPedido,
                            cliente_id: resolvedClienteId,
                            cliente_nombre: nombre,
                            cliente_telefono: tipoEntrega === "salon" ? (telefono || null) : telefono,
                            cliente_direccion: tipoEntrega === "delivery" ? direccion : null,
                            cliente_lat: tipoEntrega === "delivery" && clienteCoords ? clienteCoords.lat : null,
                            cliente_lng: tipoEntrega === "delivery" && clienteCoords ? clienteCoords.lng : null,
                            tipo: tipoEntrega,
                            estado: tipoEntrega === "salon" ? 'preparando' : 'pendiente',
                            origen: tipoEntrega === "salon" ? 'qr' : 'web',
                            subtotal: total,
                            costo_envio: COSTO_ENVIO,
                            propina: propina,
                            total: totalConPropina,
                            metodo_pago_id: mPagoId,
                            metodo_pago_nombre: mPagoNombre || (metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia'),
                            notas: conCuanto ? `Abona con: $${conCuanto}` : "",
                            mesa_id: tipoEntrega === "salon" ? mesaId : null
                        }])
                        .select()
                        .single();

                    if (pedidoError) {
                        if (pedidoError.code === '23505') {
                            console.warn(`[CartModal] Colisión detectada para ${numeroPedido}, reintentando...`);
                            continue; 
                        }
                        throw pedidoError;
                    }
                    resolvedPedido = pedido;
                }
            }

            if (!resolvedPedido) throw new Error("No se pudo registrar el pedido.");
            const pedido = resolvedPedido;

            // 3. Crear los ítems del pedido (nuevos ítems)
            const itemsToInsert = items.map(i => ({
                id: crypto.randomUUID(),
                pedido_id: pedido.id,
                producto_id: i.productoId,
                nombre_producto: i.nombre,
                cantidad: i.cantidad,
                precio_unitario: i.precio,
                adicionales: i.adicionales ?? [],
                notas: i.notas ?? null
            }));

            let itemsError: any = null;
            const { error: err1 } = await supabase.from("pedido_items").insert(itemsToInsert);
            if (err1) {
                if (err1.code === "PGRST204") {
                    const itemsWithout = itemsToInsert.map(({ adicionales: _, ...rest }) => rest);
                    const { error: err2 } = await supabase.from("pedido_items").insert(itemsWithout);
                    itemsError = err2;
                } else {
                    itemsError = err1;
                }
            }
            if (itemsError) throw itemsError;

            // Bypassear WhatsApp si es mesa/salon QR
            if (tipoEntrega === "salon") {
                alert("¡Tu pedido fue enviado a la cocina! 🍳");
                await supabase.from("mesas").update({ estado: "ocupada" }).eq("id", mesaId);
                clearCart();
                onClose();
                if (onOrderUpdated) onOrderUpdated();
                setSending(false);
                return;
            }

            // WhatsApp flow for Delivery / Takeaway
            let whatsappNum = sucursalData?.whatsapp_numero;
            if (!whatsappNum) {
                const { data: s } = await supabase.from("sucursales").select("whatsapp_numero").eq("id", sucursalId).single();
                whatsappNum = s?.whatsapp_numero;
            }

            const groupedByCategory = items.reduce((acc: Record<string, any[]>, item) => {
                const cat = item.categoriaNombre || "PRODUCTOS";
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(item);
                return acc;
            }, {});

            const itemsTexto = Object.entries(groupedByCategory).map(([cat, catItems]) => {
                const catHeader = `*${cat.toUpperCase()}:*`;
                const productsText = catItems.map(i => {
                    const groupedAds = (i.adicionales || []).reduce((acc: Record<string, { precio: number, qty: number }>, a: { nombre: string; precio: number }) => {
                        if (!acc[a.nombre]) acc[a.nombre] = { precio: 0, qty: 0 };
                        acc[a.nombre].qty += 1;
                        acc[a.nombre].precio += a.precio;
                        return acc;
                    }, {} as Record<string, { precio: number, qty: number }>);
                    const ads = Object.entries(groupedAds).map(([nombre, data]) => `  + ${(data as { qty: number }).qty > 1 ? `${nombre} x ${(data as { qty: number }).qty}` : nombre} (+$${(data as { precio: number }).precio})`).join("\n");
                    const notaTexto = i.notas ? `\n  ⚠️ NOTA: ${i.notas}` : "";
                    return `• ${i.cantidad}x ${i.nombre} - $${new Intl.NumberFormat("es-AR").format(i.precio * i.cantidad)}${ads ? `\n${ads}` : ""}${notaTexto}`;
                }).join("\n");
                return `${catHeader}\n${productsText}`;
            }).join("\n\n");

            const msg = `🍕 *NUEVO PEDIDO*\n\n` +
                `*ID:* ${pedido.numero_pedido || pedido.id.slice(0, 8)}\n` +
                `*Tipo:* ${tipoEntrega === "delivery" ? "Delivery" : "Take Away"}\n` +
                `*Cliente:* ${nombre}\n` +
                `*Teléfono:* +54 ${telefono}\n` +
                (tipoEntrega === "delivery" ? `*Dirección:* ${direccion}\n` : "") +
                `\n${itemsTexto}\n\n` +
                `*Subtotal:* $${new Intl.NumberFormat("es-AR").format(total)}\n` +
                (propina > 0 ? `*Propina:* $${new Intl.NumberFormat("es-AR").format(propina)}\n` : "") +
                `*Total:* $${new Intl.NumberFormat("es-AR").format(totalConPropina)}\n` +
                `*Pago:* ${metodoPago === "efectivo" ? `Efectivo${conCuanto ? ` (con $${conCuanto})` : ""}` : "Transferencia"}`;

            const rawPhone = (whatsappNum || "").replace(/\D/g, "");
            const waPhone = rawPhone.startsWith("54") ? rawPhone : `54${rawPhone}`;
            const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;

            alert("¡Pedido recibido y guardado! Redirigiendo a WhatsApp...");
            window.open(waUrl, '_blank');

            if (promoResult?.valid && promoResult?.codigo?.id && pedido?.id) {
                await supabase.from("promo_qr_codigos").update({
                    usado: true,
                    fecha_uso: new Date().toISOString(),
                    pedido_canje_id: pedido.id,
                }).eq("id", promoResult.codigo.id);
            }

            clearCart();
            onClose();
        } catch (error: any) {
            console.error("Error al realizar el pedido:", error);
            alert("Hubo un error al procesar tu pedido. Por favor intentá de nuevo.");
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            <div
                className="relative z-10 w-full max-w-lg bg-[#111] rounded-2xl flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
                style={{ maxHeight: 'calc(100vh - 2rem)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">
                        {tipoEntrega === "delivery" ? "Pedido de Delivery" : tipoEntrega === "takeaway" ? "Pedido Take Away" : `Servicio de Mesa - Mesa ${mesa?.numero || ""}`}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    <div className="px-5 py-4 space-y-4">

                        {/* Toggle Delivery / Retirar o Lock de Mesa */}
                        {mesa ? (
                            <div className="flex rounded-xl overflow-hidden border border-orange-500 bg-orange-600/10 py-3.5 px-4 justify-center items-center gap-2 text-orange-400 font-black uppercase tracking-wider text-xs">
                                <span>🍽️ Pedir a la mesa — Mesa {mesa.numero || mesa.nombre}</span>
                            </div>
                        ) : (
                            <div className="flex rounded-xl overflow-hidden border border-white/10">
                                <button
                                    onClick={() => setTipoEntrega("delivery")}
                                    className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors ${tipoEntrega === "delivery" ? "bg-orange-600 text-white" : "text-slate-400 hover:text-white"}`}
                                >
                                    Delivery
                                </button>
                                <button
                                    onClick={() => setTipoEntrega("takeaway")}
                                    className={`flex-1 py-3 text-sm font-black uppercase tracking-widest transition-colors ${tipoEntrega === "takeaway" ? "bg-orange-600 text-white" : "text-slate-400 hover:text-white"}`}
                                >
                                    Take Away
                                </button>
                            </div>
                        )}

                        {/* YA PEDIDO (Consumo actual en salon) */}
                        {tipoEntrega === "salon" && activeOrderItems.length > 0 && (
                            <div className="bg-[#151515] border border-white/5 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <div className="flex items-center gap-2 text-xs text-green-400 uppercase tracking-widest font-black">
                                        <span>✓</span>
                                        <span>Pedido en curso (En cocina)</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Consumo</span>
                                </div>
                                <div className="space-y-2">
                                    {activeOrderItems.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-start text-xs">
                                            <div className="text-slate-300">
                                                <span className="font-extrabold text-white mr-1.5">{item.cantidad}x</span> 
                                                <span>{item.nombre_producto}</span>
                                                {item.adicionales && item.adicionales.length > 0 && (
                                                    <div className="text-[10px] text-slate-500 mt-0.5 pl-4">
                                                        {item.adicionales.map((a: any, i: number) => `+ ${a.nombre}`).join(", ")}
                                                    </div>
                                                )}
                                                {item.notas && (
                                                    <div className="text-[10px] text-amber-500/80 italic mt-0.5 pl-4">
                                                        "{item.notas}"
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-slate-400 font-bold">$ {new Intl.NumberFormat("es-AR").format(item.precio_unitario * item.cantidad)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between border-t border-white/5 pt-2 text-xs">
                                    <span className="text-slate-400 font-bold uppercase">Subtotal Pedido</span>
                                    <span className="text-white font-extrabold">
                                        $ {new Intl.NumberFormat("es-AR").format(activeOrderItems.reduce((sum, it) => sum + (it.precio_unitario * it.cantidad), 0))}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Items en Carrito (Para pedir ahora) */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold border-b border-white/5 pb-2">
                                <ShoppingBag size={14} />
                                <span>{items.length === 0 ? "Tu carrito está vacío" : `${items.length} ${items.length === 1 ? "Producto nuevo por pedir" : "Productos nuevos por pedir"}`}</span>
                            </div>

                            {items.length > 0 ? (
                                <>
                                    <div className="flex text-xs text-slate-500 uppercase tracking-wide font-semibold">
                                        <span className="flex-1">Item</span>
                                        <span className="w-20 text-center">Cant.</span>
                                        <span className="w-24 text-right">Precio</span>
                                    </div>

                                    {items.map(item => (
                                        <div key={item.id} className="flex items-center gap-2">
                                            {item.imagen_url && (
                                                <img src={item.imagen_url} alt={item.nombre} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <span className="block text-sm text-white font-medium truncate">{item.nombre}</span>
                                                {item.notas && (
                                                    <span className="block text-[10px] text-orange-400 font-bold uppercase tracking-wide leading-none my-1">
                                                        Nota: {item.notas}
                                                    </span>
                                                )}
                                                {item.adicionales && item.adicionales.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                        {Object.entries(
                                                            item.adicionales.reduce((acc, a) => {
                                                                acc[a.nombre] = (acc[a.nombre] || 0) + 1;
                                                                return acc;
                                                            }, {} as Record<string, number>)
                                                        ).map(([nombre, qty], idx) => (
                                                            <span key={idx} className="text-[9px] text-slate-400 leading-none bg-white/5 px-1 py-0.5 rounded border border-white/5">
                                                                + {qty > 1 ? `${nombre} X ${qty}` : nombre}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1 bg-white/5 rounded-lg px-1">
                                                <button onClick={() => updateQty(item.id, item.cantidad - 1)} className="text-slate-400 hover:text-white p-1">
                                                    <Minus size={12} />
                                                </button>
                                                <span className="text-white text-xs font-bold w-5 text-center">{item.cantidad}</span>
                                                <button onClick={() => updateQty(item.id, item.cantidad + 1)} className="text-slate-400 hover:text-white p-1">
                                                    <Plus size={12} />
                                                </button>
                                            </div>

                                            <span className="w-24 text-right text-white text-sm font-bold">
                                                $ {new Intl.NumberFormat("es-AR").format(item.precio * item.cantidad)}
                                            </span>

                                            <button onClick={() => removeItem(item.id)} className="text-slate-600 hover:text-red-400 transition-colors ml-1">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}

                                    <div className="flex justify-between border-t border-white/5 pt-2">
                                        <span className="text-sm text-slate-400 font-semibold uppercase tracking-wide">Subtotal a pedir</span>
                                        <span className="text-white font-black">$ {new Intl.NumberFormat("es-AR").format(total)}</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-xs text-slate-500 py-2">Agregá platos del menú para enviarlos a la cocina.</p>
                            )}
                        </div>

                        {/* Cliente */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">
                                <span>👤</span><span>{tipoEntrega === "salon" ? "Tu Nombre" : "Cliente"}</span>
                            </div>
                            <input
                                type="text"
                                placeholder={tipoEntrega === "salon" ? "Escribí tu nombre (para cocina)*" : "Nombre*"}
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                            />
                            {tipoEntrega !== "salon" && (
                                <div className="flex gap-2">
                                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-slate-400 text-sm gap-1 shrink-0">
                                        <span>🇦🇷</span>
                                        <span>+54</span>
                                        <span className="text-slate-600 ml-1">▾</span>
                                    </div>
                                    <input
                                        type="tel"
                                        placeholder="Teléfono*"
                                        value={telefono}
                                        onChange={e => setTelefono(e.target.value)}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Dirección de entrega (solo Delivery) */}
                    {tipoEntrega === "delivery" && (
                        <div className="px-5 pb-4 space-y-4">
                            <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">
                                    <MapPin size={14} /><span>Dirección de entrega</span>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Ingresá tu dirección completa*"
                                        value={direccion}
                                        onChange={e => {
                                            setDireccion(e.target.value);
                                            setGeocodingState("idle");
                                            setZonaDetectada(null);
                                            setZonaError(null);
                                        }}
                                        onKeyDown={e => e.key === "Enter" && verificarDireccion(direccion)}
                                        className={`flex-1 bg-white/5 border rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none transition-colors ${geocodingState === "ok" ? "border-green-500/50" :
                                            geocodingState === "error" ? "border-red-500/50" :
                                                "border-white/10 focus:border-orange-500/50"
                                            }`}
                                    />
                                    <button
                                        onClick={() => verificarDireccion(direccion)}
                                        disabled={geocodingState === "loading" || !direccion.trim()}
                                        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-bold px-4 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                                    >
                                        {geocodingState === "loading" ? (
                                            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                                        ) : "Verificar"}
                                    </button>
                                </div>
                                <button
                                    onClick={handleUseCurrentLocation}
                                    disabled={geocodingState === "loading"}
                                    className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-xs font-bold py-2.5 rounded-xl transition-colors mt-1"
                                >
                                    <LocateFixed size={14} className={geocodingState === "loading" ? "animate-pulse" : ""} />
                                    Usar mi ubicación actual
                                </button>

                                {geocodingState === "ok" && (
                                    <div className="flex items-start gap-2 text-xs bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2.5">
                                        <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                                        <div>
                                            {zonaDetectada ? (
                                                <>
                                                    <span className="text-green-300 font-semibold">¡Llegamos a tu zona!</span>
                                                    <span className="text-slate-400 ml-2">Zona: {zonaDetectada.nombre}</span>
                                                    <div className="text-slate-400 mt-0.5">
                                                        Costo de envío:{" "}
                                                        <span className="text-white font-bold">
                                                            {costoEnvioCalc === 0 ? "GRATIS 🎉" : `$${new Intl.NumberFormat("es-AR").format(costoEnvioCalc)}`}
                                                        </span>
                                                        {zonaDetectada.tiempo_estimado_minutos && (
                                                            <span className="ml-2 text-slate-500">· {zonaDetectada.tiempo_estimado_minutos} min estimados</span>
                                                        )}
                                                    </div>
                                                    {zonaDetectada.minimo_compra > 0 && total < zonaDetectada.minimo_compra && (
                                                        <div className="text-amber-400 mt-1">
                                                            ⚠ Mínimo de compra: ${new Intl.NumberFormat("es-AR").format(zonaDetectada.minimo_compra)}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-green-300 font-semibold">Dirección verificada ✓</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {geocodingState === "error" && zonaError && (
                                    <div className="flex items-center gap-2 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                                        <AlertCircle size={14} className="text-red-400 shrink-0" />
                                        <span className="text-red-300">{zonaError}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Método de pago (solo Delivery / Takeaway) */}
                    {tipoEntrega !== "salon" && (
                        <div className="px-5 pb-4 space-y-4">
                            <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">
                                    <Banknote size={14} /><span>Método de pago</span>
                                </div>
                                <button
                                    onClick={() => setMetodoPago("efectivo")}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-sm font-bold uppercase tracking-wide ${metodoPago === "efectivo" ? "border-orange-500 bg-orange-600/20 text-orange-400" : "border-white/10 text-slate-400 hover:border-white/20"}`}
                                >
                                    <Banknote size={16} /> Efectivo
                                </button>
                                {metodoPago === "efectivo" && (
                                    <input
                                        type="number"
                                        placeholder="¿Con cuánto abonás?"
                                        value={conCuanto}
                                        onChange={e => setConCuanto(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                                    />
                                )}
                                <button
                                    onClick={() => setMetodoPago("transferencia")}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-sm ${metodoPago === "transferencia" ? "border-orange-500 bg-orange-600/20" : "border-white/10 hover:border-white/20"}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <CreditCard size={16} className={metodoPago === "transferencia" ? "text-orange-400" : "text-slate-400"} />
                                        <span className={`font-bold uppercase tracking-wide ${metodoPago === "transferencia" ? "text-orange-400" : "text-slate-400"}`}>
                                            Transferencia
                                        </span>
                                    </div>
                                    {metodoPago === "transferencia" && (
                                        <span className="text-xs text-slate-400">Alias: {ALIAS_TRANSFERENCIA}</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Propina (solo Delivery / Takeaway) */}
                    {tipoEntrega !== "salon" && (
                        <div className="px-5 pb-4 space-y-4">
                            <div className="bg-[#1a1a1a] rounded-xl p-4">
                                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">
                                    <span>💛</span><span>Propina</span>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {propinaOpciones.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => { setPropina(p); setPropinaCustom(""); }}
                                            className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${propina === p && !propinaCustom ? "bg-orange-600 border-orange-600 text-white" : "border-white/20 text-slate-400 hover:border-white/40"}`}
                                        >
                                            {p === 0 ? "$0" : `$${p}`}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setPropina(-1)}
                                        className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${propina === -1 ? "bg-orange-600 border-orange-600 text-white" : "border-white/20 text-slate-400 hover:border-white/40"}`}
                                    >
                                        Otro
                                    </button>
                                </div>
                                {propina === -1 && (
                                    <input
                                        type="number"
                                        placeholder="Ingresá el monto"
                                        value={propinaCustom}
                                        onChange={e => setPropinaCustom(e.target.value)}
                                        className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Código promocional (solo Delivery / Takeaway) */}
                    {tipoEntrega !== "salon" && (
                        <div className="px-5 pb-4 space-y-4">
                            <div className="bg-[#1a1a1a] rounded-xl p-4">
                                <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">
                                    <Tag size={14} /><span>Código Promo QR</span>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="XXXX"
                                        value={codigoPromo}
                                        maxLength={4}
                                        onChange={e => { setCodigoPromo(e.target.value.toUpperCase()); setPromoResult(null); }}
                                        onKeyDown={e => e.key === 'Enter' && validatePromoCode()}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono font-bold tracking-widest placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors uppercase"
                                    />
                                    <button
                                        onClick={validatePromoCode}
                                        disabled={promoValidating || codigoPromo.length < 4}
                                        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-bold px-4 rounded-xl transition-colors shrink-0"
                                    >
                                        {promoValidating ? (
                                            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                                        ) : "Validar"}
                                    </button>
                                </div>
                                {promoResult && (
                                    <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                                        promoResult.valid
                                            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                                    }`}>
                                        <Gift size={13} />
                                        {promoResult.valid
                                            ? `🎉 ${promoResult.codigo?.premio?.nombre || 'Premio'} — Ahorrás $${new Intl.NumberFormat('es-AR').format(promoDescuento)}`
                                            : (promoResult.message || 'Código inválido')}
                                        {promoResult.valid && (
                                            <button onClick={() => { setPromoResult(null); setCodigoPromo(''); }} className="ml-auto text-slate-500 hover:text-white">×</button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Resumen */}
                    <div className="px-5 pb-6">
                        <div className="bg-[#1a1a1a] rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">
                                <Receipt size={14} /><span>{tipoEntrega === "salon" ? "Resumen de Mesa" : "Resumen"}</span>
                            </div>
                            <div className="space-y-2 text-sm">
                                {tipoEntrega === "salon" ? (
                                    <>
                                        {activeOrderItems.length > 0 && (
                                            <div className="flex justify-between text-slate-400">
                                                <span>Consumido anteriormente</span>
                                                <span>$ {new Intl.NumberFormat("es-AR").format(activeOrderItems.reduce((sum, it) => sum + (it.precio_unitario * it.cantidad), 0))}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-slate-300">
                                            <span>Nuevos productos</span>
                                            <span>$ {new Intl.NumberFormat("es-AR").format(total)}</span>
                                        </div>
                                        <div className="flex justify-between text-white font-black text-base border-t border-white/10 pt-2">
                                            <span>Total Mesa</span>
                                            <span>
                                                $ {new Intl.NumberFormat("es-AR").format(
                                                    activeOrderItems.reduce((sum, it) => sum + (it.precio_unitario * it.cantidad), 0) + total
                                                )}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between text-slate-300">
                                            <span>Productos</span>
                                            <span>$ {new Intl.NumberFormat("es-AR").format(total)}</span>
                                        </div>
                                        {tipoEntrega === "delivery" && COSTO_ENVIO > 0 && (
                                            <div className="flex justify-between text-slate-300">
                                                <span>Envío</span>
                                                <span>$ {new Intl.NumberFormat("es-AR").format(COSTO_ENVIO)}</span>
                                            </div>
                                        )}
                                        {propina > 0 && (
                                            <div className="flex justify-between text-slate-300">
                                                <span>Propina</span>
                                                <span>$ {new Intl.NumberFormat("es-AR").format(propina)}</span>
                                            </div>
                                        )}
                                        {promoDescuento > 0 && (
                                            <div className="flex justify-between text-green-400 font-bold">
                                                <span>🎁 Descuento promo</span>
                                                <span>- $ {new Intl.NumberFormat("es-AR").format(promoDescuento)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-white font-black text-base border-t border-white/10 pt-2">
                                            <span>Total</span>
                                            <span>$ {new Intl.NumberFormat("es-AR").format(totalConPropina)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Sticky footer */}
                <div className="px-5 py-4 border-t border-white/10 bg-[#111] shrink-0 rounded-b-2xl">
                    {!isOpen && (
                        <div className="mb-3 text-center text-red-400 text-xs font-bold uppercase tracking-widest bg-red-900/20 py-2 rounded-xl">
                            El local está cerrado
                        </div>
                    )}
                    <button
                        onClick={handleRealizarPedido}
                        disabled={
                            !isOpen ||
                            sending ||
                            items.length === 0 ||
                            (tipoEntrega === "delivery" && geocodingState !== "ok")
                        }
                        className="w-full bg-orange-600 hover:bg-orange-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest transition-all shadow-lg"
                    >
                        {sending ? "Enviando..." : tipoEntrega === "salon" ? "Enviar a la Cocina" : "Realizar pedido"}
                    </button>
                </div>
            </div>
        </div>
    );
}
