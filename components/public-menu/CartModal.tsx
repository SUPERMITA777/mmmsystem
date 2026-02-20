"use client";

import { useState, useCallback } from "react";
import { X, ShoppingBag, MapPin, Banknote, CreditCard, Tag, Receipt, Pencil, Minus, Plus, Trash2, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabaseClient";

// ========== Utilidades geoespaciales ==========
type LatLng = { lat: number; lng: number };
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

function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
    if (!polygon || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lng, yi = polygon[i].lat;
        const xj = polygon[j].lng, yj = polygon[j].lat;
        const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
            (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function haversineKm(a: LatLng, b: LatLng): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function CartModal({ onClose }: { onClose: () => void }) {
    const { items, updateQty, removeItem, total, clearCart } = useCart();
    const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "takeaway">("delivery");
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [email, setEmail] = useState("");
    const [direccion, setDireccion] = useState("");
    const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo");
    const [conCuanto, setConCuanto] = useState("");
    const [propina, setPropina] = useState(0);
    const [propinaCustom, setPropinaCustom] = useState("");
    const [codigoPromo, setCodigoPromo] = useState("");
    const [sending, setSending] = useState(false);

    // Zona / geocoding states
    const [zonaDetectada, setZonaDetectada] = useState<ZonaEntrega | null>(null);
    const [zonaError, setZonaError] = useState<string | null>(null);
    const [geocodingState, setGeocodingState] = useState<"idle" | "loading" | "ok" | "error">("idle");
    const [clienteCoords, setClienteCoords] = useState<LatLng | null>(null);
    const [costoEnvioCalc, setCostoEnvioCalc] = useState(0);

    const ALIAS_TRANSFERENCIA = "MMM.PIZZA";
    const COSTO_ENVIO = tipoEntrega === "delivery" ? costoEnvioCalc : 0;
    const totalConPropina = total + propina + COSTO_ENVIO;

    const propinaOpciones = [0, 100, 200, 500];

    // ============ Geocoding + Zone validation ============
    async function verificarDireccion(dir: string) {
        if (!dir.trim() || tipoEntrega !== "delivery") return;
        setGeocodingState("loading");
        setZonaDetectada(null);
        setZonaError(null);
        setCostoEnvioCalc(0);

        try {
            // 1. Geocodificar dirección via Nominatim
            const geoRes = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(dir)}&limit=1`,
                { headers: { "Accept-Language": "es" } }
            );
            const geoData = await geoRes.json();
            if (!geoData[0]) {
                setZonaError("No se encontró la dirección. Verificá que sea correcta.");
                setGeocodingState("error");
                return;
            }
            const clientePt: LatLng = { lat: parseFloat(geoData[0].lat), lng: parseFloat(geoData[0].lon) };
            setClienteCoords(clientePt);

            // 2. Cargar zonas activas con polígonos
            const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
            if (!suc) { setZonaError("Error interno."); setGeocodingState("error"); return; }

            const { data: zonas } = await supabase
                .from("zonas_entrega")
                .select("*")
                .eq("sucursal_id", suc.id)
                .eq("activo", true);

            // 3. Cargar config del local
            const { data: cfg } = await supabase
                .from("config_sucursal")
                .select("local_lat, local_lng")
                .eq("sucursal_id", suc.id)
                .limit(1)
                .maybeSingle();

            const localPt: LatLng | null = cfg?.local_lat && cfg?.local_lng
                ? { lat: cfg.local_lat, lng: cfg.local_lng }
                : null;

            // 4. Verificar en qué zona está
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
                // Si hay zonas pero sin polígono, aceptar igual
                if ((zonas || []).length > 0 && zonasConPoligono.length === 0) {
                    const primeraZona = (zonas || [])[0] as ZonaEntrega;
                    setZonaDetectada(primeraZona);
                    setCostoEnvioCalc(primeraZona.costo_envio);
                    setGeocodingState("ok");
                } else if ((zonas || []).length === 0) {
                    // Sin zonas configuradas → envío gratis
                    setGeocodingState("ok");
                    setCostoEnvioCalc(0);
                } else {
                    setZonaError("Tu dirección está fuera de nuestra zona de entrega. 😕");
                    setGeocodingState("error");
                }
                return;
            }

            // 5. Calcular costo de envío
            let costoFinal = zonaEncontrada.costo_envio;
            if (zonaEncontrada.tipo_precio === "por_km" && localPt) {
                const distKm = haversineKm(localPt, clientePt);
                costoFinal = Math.round(distKm * zonaEncontrada.precio_por_km);
            }
            // Envío gratis desde
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

    async function handleRealizarPedido() {
        if (!nombre.trim()) { alert("Por favor ingresá tu nombre."); return; }
        if (!telefono.trim()) { alert("Por favor ingresá tu teléfono."); return; }
        if (tipoEntrega === "delivery" && !direccion.trim()) { alert("Por favor ingresá tu dirección de entrega."); return; }
        if (items.length === 0) { alert("Tu carrito está vacío."); return; }

        setSending(true);
        try {
            // 1. Obtener Sucursal ID
            const { data: sucursal } = await supabase.from("sucursales").select("id").limit(1).single();
            if (!sucursal) throw new Error("No se encontró sucursal activa.");

            // 2. Obtener Método de Pago ID
            const { data: mPago } = await supabase
                .from("metodos_pago")
                .select("id, nombre")
                .eq("codigo", metodoPago)
                .eq("sucursal_id", sucursal.id)
                .single();

            // 2b. Generar número de pedido correcto desde el cliente (bypass del trigger bugueado)
            const yearPart = new Date().getFullYear().toString().slice(-2);
            const { data: lastPedido } = await supabase
                .from("pedidos")
                .select("numero_pedido")
                .like("numero_pedido", `PED-${yearPart}%`)
                .order("numero_pedido", { ascending: false })
                .limit(1)
                .maybeSingle();

            let nextSeq = 1;
            if (lastPedido?.numero_pedido) {
                const lastNum = parseInt(lastPedido.numero_pedido.slice(-6), 10);
                if (!isNaN(lastNum)) nextSeq = lastNum + 1;
            }
            const numeroPedido = `PED-${yearPart}${String(nextSeq).padStart(6, "0")}`;

            // 3. Crear el Pedido en la base de datos
            const { data: pedido, error: pedidoError } = await supabase
                .from("pedidos")
                .insert([{
                    sucursal_id: sucursal.id,
                    numero_pedido: numeroPedido,
                    cliente_nombre: nombre,
                    cliente_telefono: telefono,
                    cliente_direccion: tipoEntrega === "delivery" ? direccion : null,
                    tipo: tipoEntrega,
                    estado: 'pendiente',
                    origen: 'web',
                    subtotal: total,
                    costo_envio: COSTO_ENVIO,
                    propina: propina,
                    total: totalConPropina,
                    metodo_pago_id: mPago?.id,
                    metodo_pago_nombre: mPago?.nombre || (metodoPago === 'efectivo' ? 'Efectivo' : 'Transferencia'),
                    notas: conCuanto ? `Abona con: $${conCuanto}` : ""
                }])
                .select()
                .single();

            if (pedidoError) throw pedidoError;

            // 4. Crear los ítems del pedido
            const itemsToInsert = items.map(i => ({
                pedido_id: pedido.id,
                producto_id: i.productoId,
                nombre_producto: i.nombre,
                cantidad: i.cantidad,
                precio_unitario: i.precio,
                adicionales: i.adicionales ?? []
            }));

            let itemsError: any = null;
            const { error: err1 } = await supabase.from("pedido_items").insert(itemsToInsert);
            if (err1) {
                if (err1.code === "PGRST204") {
                    // Schema cache aún no actualizó la columna; insertar sin adicionales
                    const itemsWithout = itemsToInsert.map(({ adicionales: _, ...rest }) => rest);
                    const { error: err2 } = await supabase.from("pedido_items").insert(itemsWithout);
                    itemsError = err2;
                } else {
                    itemsError = err1;
                }
            }
            if (itemsError) throw itemsError;

            // 5. Armamos el mensaje de WhatsApp
            const itemsTexto = items.map(i => {
                const ads = i.adicionales?.map(a => `  + ${a.nombre} (+$${a.precio})`).join("\n") || "";
                return `• ${i.cantidad}x ${i.nombre} - $${new Intl.NumberFormat("es-AR").format(i.precio * i.cantidad)}${ads ? `\n${ads}` : ""}`;
            }).join("\n");

            const msg = `🍕 *NUEVO PEDIDO*\n\n` +
                `*ID:* ${pedido.numero_pedido || pedido.id.slice(0, 8)}\n` +
                `*Tipo:* ${tipoEntrega === "delivery" ? "Delivery" : "Take Away"}\n` +
                `*Cliente:* ${nombre}\n` +
                `*Teléfono:* +54 ${telefono}\n` +
                (email ? `*Email:* ${email}\n` : "") +
                (tipoEntrega === "delivery" ? `*Dirección:* ${direccion}\n` : "") +
                `\n*Productos:*\n${itemsTexto}\n\n` +
                `*Subtotal:* $${new Intl.NumberFormat("es-AR").format(total)}\n` +
                (propina > 0 ? `*Propina:* $${new Intl.NumberFormat("es-AR").format(propina)}\n` : "") +
                `*Total:* $${new Intl.NumberFormat("es-AR").format(totalConPropina)}\n` +
                `*Pago:* ${metodoPago === "efectivo" ? `Efectivo${conCuanto ? ` (con $${conCuanto})` : ""}` : "Transferencia"}`;

            const waUrl = `https://wa.me/549XXXXXXXXXX?text=${encodeURIComponent(msg)}`;

            alert("¡Pedido recibido y guardado! Redirigiendo a WhatsApp...");
            window.open(waUrl, '_blank');

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
        <div className="fixed inset-0 z-50 flex" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal panel - centered */}
            <div
                className="relative z-10 w-full max-w-lg mx-auto my-auto bg-[#111] rounded-2xl overflow-hidden flex flex-col shadow-2xl max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">
                        {tipoEntrega === "delivery" ? "Pedido de Delivery" : "Pedido Take Away"}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-5 py-4 space-y-4">

                        {/* Toggle Delivery / Retirar */}
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

                        {/* Items */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold border-b border-white/5 pb-2">
                                <ShoppingBag size={14} />
                                <span>{items.length} {items.length === 1 ? "Producto" : "Productos"}</span>
                            </div>

                            {/* Column headers */}
                            <div className="flex text-xs text-slate-500 uppercase tracking-wide font-semibold">
                                <span className="flex-1">Item</span>
                                <span className="w-20 text-center">Cant.</span>
                                <span className="w-24 text-right">Precio</span>
                            </div>

                            {items.map(item => (
                                <div key={item.id} className="flex items-center gap-2">
                                    {/* Thumbnail */}
                                    {item.imagen_url && (
                                        <img src={item.imagen_url} alt={item.nombre} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <span className="block text-sm text-white font-medium truncate">{item.nombre}</span>
                                        {item.adicionales && item.adicionales.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {item.adicionales.map((a, idx) => (
                                                    <span key={idx} className="text-[9px] text-slate-400 leading-none bg-white/5 px-1 py-0.5 rounded border border-white/5">
                                                        + {a.nombre}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Qty controls */}
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
                                <span className="text-sm text-slate-400 font-semibold uppercase tracking-wide">Subtotal</span>
                                <span className="text-white font-black">$ {new Intl.NumberFormat("es-AR").format(total)}</span>
                            </div>
                        </div>

                        {/* Cliente */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">
                                <span>👤</span><span>Cliente</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Nombre*"
                                value={nombre}
                                onChange={e => setNombre(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                            />
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
                            <input
                                type="email"
                                placeholder="Email (Opcional)"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                            />
                        </div>

                        {/* Dirección de entrega (solo Delivery) */}
                        {tipoEntrega === "delivery" && (
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
                                        className="bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white text-xs font-bold px-4 rounded-xl transition-colors flex items-center gap-1.5"
                                    >
                                        {geocodingState === "loading" ? (
                                            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" />
                                        ) : "Verificar"}
                                    </button>
                                </div>

                                {/* Feedback zona OK */}
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

                                {/* Feedback error */}
                                {geocodingState === "error" && zonaError && (
                                    <div className="flex items-center gap-2 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                                        <AlertCircle size={14} className="text-red-400 shrink-0" />
                                        <span className="text-red-300">{zonaError}</span>
                                    </div>
                                )}
                            </div>
                        )}


                        {/* Método de pago */}
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

                        {/* Propina */}
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

                        {/* Código promocional */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">
                                <Tag size={14} /><span>Código promocional</span>
                            </div>
                            <input
                                type="text"
                                placeholder="Ingresá el código"
                                value={codigoPromo}
                                onChange={e => setCodigoPromo(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-orange-500/50 transition-colors"
                            />
                        </div>

                        {/* Resumen */}
                        <div className="bg-[#1a1a1a] rounded-xl p-4">
                            <div className="flex items-center gap-2 text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">
                                <Receipt size={14} /><span>Resumen</span>
                            </div>
                            <div className="space-y-2 text-sm">
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
                                <div className="flex justify-between text-white font-black text-base border-t border-white/10 pt-2">
                                    <span>Total</span>
                                    <span>$ {new Intl.NumberFormat("es-AR").format(totalConPropina)}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Sticky footer */}
                <div className="px-5 py-4 border-t border-white/10 bg-[#111]">
                    <button
                        onClick={handleRealizarPedido}
                        disabled={sending || items.length === 0}
                        className="w-full bg-orange-600 hover:bg-orange-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest transition-all"
                    >
                        {sending ? "Enviando..." : "Realizar pedido"}
                    </button>
                </div>
            </div>
        </div>
    );
}
