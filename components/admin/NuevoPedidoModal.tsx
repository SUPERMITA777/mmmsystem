"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Search, Plus, Minus, Trash2, ShoppingBag, Bike, MapPin, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { LatLng, pointInPolygon, getDistance } from "@/lib/geoutils";
import { getProductDiscount } from "@/lib/discountUtils";

interface NuevoPedidoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
    editPedido?: any;
}

type CartItem = {
    id: string;
    nombre: string;
    precio: number;
    precioOverride: number;
    cantidad: number;
    imagen_url?: string;
    nota?: string;
    adicionales?: { nombre: string; precio: number; cantidad: number }[];
};

export default function NuevoPedidoModal({ isOpen, onClose, onCreated, editPedido }: NuevoPedidoModalProps) {
    // Data
    const [productos, setProductos] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [metodosPago, setMetodosPago] = useState<any[]>([]);
    const [gruposAdicionales, setGruposAdicionales] = useState<any[]>([]);
    const [adicionales, setAdicionales] = useState<any[]>([]);
    const [productoGrupos, setProductoGrupos] = useState<any[]>([]);
    const [descuentos, setDescuentos] = useState<any[]>([]);

    // UI State
    const [busqueda, setBusqueda] = useState("");
    const [catSeleccionada, setCatSeleccionada] = useState<string>("todos");
    const [view, setView] = useState<"catalog" | "customize">("catalog");
    const [productoCustom, setProductoCustom] = useState<any>(null);
    const [customQty, setCustomQty] = useState(1);
    const [customNota, setCustomNota] = useState("");
    const [customAdicionales, setCustomAdicionales] = useState<Record<string, number>>({});
    const [editCartIndex, setEditCartIndex] = useState<number | null>(null);

    // Cart
    const [carrito, setCarrito] = useState<CartItem[]>([]);
    const [seAbona, setSeAbona] = useState("");

    // Order metadata
    const [tipo, setTipo] = useState<"delivery" | "takeaway">("delivery");
    const [metodoPagoId, setMetodoPagoId] = useState("");
    const [omitirCliente, setOmitirCliente] = useState(false);
    const [cliente, setCliente] = useState({ nombre: "", telefono: "", direccion: "", entreCalles: "", instrucciones: "" });
    const [notaPedido, setNotaPedido] = useState("");
    const [loading, setLoading] = useState(false);

    // Delivery validation
    const [zonas, setZonas] = useState<any[]>([]);
    const [configSucursal, setConfigSucursal] = useState<any>(null);
    const [validacionDelivery, setValidacionDelivery] = useState<{ valid: boolean; zona?: string; costo: number; loading: boolean; error?: string }>({ valid: false, costo: 0, loading: false });
    const [direccionGeocoded, setDireccionGeocoded] = useState<LatLng | null>(null);
    const [alternativas, setAlternativas] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchAll();
            setView("catalog");
            if (editPedido) {
                // Pre-fill from existing order
                const items: CartItem[] = (editPedido.pedido_items || []).map((item: any) => ({
                    id: item.id || crypto.randomUUID(),
                    nombre: item.nombre_producto,
                    precio: item.precio_unitario,
                    precioOverride: item.precio_unitario,
                    cantidad: item.cantidad,
                    nota: item.notas || "",
                    adicionales: (item.adicionales || []).map((a: any) => ({ nombre: a.nombre, precio: a.precio || 0, cantidad: a.cantidad || 1 })),
                }));
                setCarrito(items);
                setCliente({
                    nombre: editPedido.cliente_nombre || "",
                    telefono: editPedido.cliente_telefono || "",
                    direccion: editPedido.cliente_direccion || "",
                    entreCalles: "",
                    instrucciones: "",
                });
                setTipo(editPedido.tipo || "delivery");
                setNotaPedido(editPedido.notas || "");
                setSeAbona("");
                if (editPedido.metodo_pago_id) setMetodoPagoId(editPedido.metodo_pago_id);
            } else {
                setCarrito([]);
                setCliente({ nombre: "", telefono: "", direccion: "", entreCalles: "", instrucciones: "" });
                setNotaPedido("");
                setSeAbona("");
            }
        }
    }, [isOpen]);

    useEffect(() => {
        // Reset validation when address changes
        if (tipo === "delivery") {
            setValidacionDelivery({ valid: false, costo: 0, loading: false });
            setDireccionGeocoded(null);
            setAlternativas([]);
        }
    }, [cliente.direccion, tipo]);

    async function fetchAll() {
        const { data: prods } = await supabase.from("productos").select("*").order("nombre");
        setProductos(prods || []);
        const { data: cats } = await supabase.from("categorias").select("*").order("orden");
        setCategorias(cats || []);
        const { data: mps } = await supabase.from("metodos_pago").select("*").eq("activo", true);
        setMetodosPago(mps || []);
        if (mps?.length) setMetodoPagoId(mps[0].id);
        const { data: szonas } = await supabase.from("zonas_entrega").select("*").eq("activo", true);
        setZonas(szonas || []);
        const { data: cfg } = await supabase.from("config_sucursal").select("*").limit(1).maybeSingle();
        setConfigSucursal(cfg);
        const { data: grps } = await supabase.from("grupos_adicionales").select("*");
        setGruposAdicionales(grps || []);
        const { data: ads } = await supabase.from("adicionales").select("*");
        setAdicionales(ads || []);
        const { data: pg } = await supabase.from("producto_grupos_adicionales").select("*");
        setProductoGrupos(pg || []);
        const { data: descs } = await supabase.from("descuentos").select("*").eq("activo", true);
        setDescuentos(descs || []);
    }

    function getDiscountedPrice(producto: any): { original: number; final: number; porcentaje: number, id?: string, no_acumulable?: boolean, has_discount: boolean } {
        const disc = getProductDiscount(producto.id, producto.categoria_id || "", descuentos);
        if (!disc) return { original: Math.round(producto.precio), final: Math.round(producto.precio), porcentaje: 0, has_discount: false };

        return {
            original: Math.round(producto.precio),
            final: Math.round(disc.precioFinal(producto.precio)),
            porcentaje: disc.porcentaje,
            id: disc.id,
            no_acumulable: disc.no_acumulable,
            has_discount: true
        };
    }

    async function validarDireccion(address: string) {
        if (!address.trim()) return;
        setValidacionDelivery(prev => ({ ...prev, loading: true, error: undefined }));
        setAlternativas([]);
        try {
            // 1. Geocodificar dirección (misma lógica que CartModal)
            const geoRes = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
            const geoData = await geoRes.json();

            if (!geoData[0]) {
                // Try with locality hint
                const localidades = configSucursal?.localidades || [];
                if (localidades.length > 0) {
                    const locName = localidades[0]?.nombre || '';
                    const geoRes2 = await fetch(`/api/geocode?q=${encodeURIComponent(address + ', ' + locName)}&limit=5`);
                    const geoData2 = await geoRes2.json();
                    const results2 = Array.isArray(geoData2) ? geoData2 : [geoData2];
                    if (results2.length > 0 && results2[0]?.lat) {
                        // Found with locality hint, continue with these results
                        return processGeoResults(results2);
                    }
                }
                setValidacionDelivery({ valid: false, costo: 0, loading: false, error: "No se encontró la dirección. Verificá que sea correcta." });
                return;
            }

            const results = Array.isArray(geoData) ? geoData : [geoData];
            await processGeoResults(results);
        } catch {
            setValidacionDelivery({ valid: false, costo: 0, loading: false, error: "Error al verificar la dirección." });
        }
    }

    async function processGeoResults(results: any[]) {
        const clientePt = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        setDireccionGeocoded(clientePt);

        // 2. Obtener sucursal_id y cargar zonas frescas
        const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
        if (!suc) {
            setValidacionDelivery({ valid: false, costo: 0, loading: false, error: "Error interno." });
            return;
        }

        const { data: zonasDB } = await supabase
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

        const localPt = cfg?.local_lat && cfg?.local_lng
            ? { lat: cfg.local_lat, lng: cfg.local_lng }
            : null;

        // 4. Verificar en qué zona está
        const zonasConPoligono = (zonasDB || []).filter(
            (z: any) => z.polygon_coords && z.polygon_coords.length >= 3
        );

        let zonaEncontrada: any = null;
        for (const zona of zonasConPoligono) {
            if (pointInPolygon(clientePt, zona.polygon_coords)) {
                zonaEncontrada = zona;
                break;
            }
        }

        if (!zonaEncontrada) {
            if (results.length > 1) setAlternativas(results.slice(0, 5));
            setValidacionDelivery({ valid: false, costo: 0, loading: false, error: "Dirección fuera de la zona de entrega" });
            return;
        }

        // 5. Calcular costo de envío (misma lógica que CartModal)
        let costoFinal = zonaEncontrada.costo_envio || 0;
        if (zonaEncontrada.tipo_precio === "por_km" && localPt) {
            const distKm = getDistance(localPt, clientePt);
            const rate = zonaEncontrada.precio_por_km > 0 ? zonaEncontrada.precio_por_km : 850;
            costoFinal = Math.round(distKm * rate);
        }
        // Envío gratis desde
        if (zonaEncontrada.envio_gratis_desde && subtotal >= zonaEncontrada.envio_gratis_desde) {
            costoFinal = 0;
        }

        setValidacionDelivery({ valid: true, zona: zonaEncontrada.nombre, costo: costoFinal, loading: false });
    }

    // Product click -> open customization if it has adicionales, else add directly
    function handleProductClick(p: any) {
        const allowedGroupIds = productoGrupos.filter((pg: any) => pg.producto_id === p.id).map((pg: any) => pg.grupo_id);
        const prodGrupos = gruposAdicionales.filter((g: any) => allowedGroupIds.includes(g.id));
        const hasAdicionales = prodGrupos.length > 0 && adicionales.some((a: any) => allowedGroupIds.includes(a.grupo_id));

        if (hasAdicionales) {
            setProductoCustom(p);
            setCustomQty(1);
            setCustomNota("");
            setCustomAdicionales({});
            setView("customize");
        } else {
            addToCart(p, 1, "", []);
        }
    }

    function addToCart(p: any, qty: number, nota: string, ads: { nombre: string; precio: number; cantidad: number }[]) {
        const adTotal = ads.reduce((s, a) => s + a.precio * a.cantidad, 0);
        const discInfo = getDiscountedPrice(p);

        if (discInfo.has_discount) {
            const hasNonStackableCartItem = carrito.some((i: any) => i.no_acumulable);
            const hasAnyDiscountCartItem = carrito.some((i: any) => i.has_discount);
            if (discInfo.no_acumulable && hasAnyDiscountCartItem) {
                alert("Este producto tiene un descuento NO ACUMULABLE y ya tenés productos con descuento en el carrito. Por favor, realizá pagos separados.");
                return;
            }
            if (!discInfo.no_acumulable && hasNonStackableCartItem) {
                alert("Ya tenés un descuento NO ACUMULABLE en el carrito. Por favor, realizá pagos separados.");
                return;
            }
        }

        const item: any = {
            id: `${p.id}-${Date.now()}`,
            nombre: p.nombre,
            precio: discInfo.final + adTotal,
            precioOverride: discInfo.final + adTotal,
            cantidad: qty,
            imagen_url: p.imagen_url,
            nota,
            adicionales: ads.filter(a => a.cantidad > 0),
            no_acumulable: discInfo.no_acumulable,
            has_discount: discInfo.has_discount
        };
        setCarrito(prev => [...prev, item]);
        setView("catalog");
        setProductoCustom(null);
    }

    function updateCartItem(idx: number, p: any, qty: number, nota: string, ads: { nombre: string; precio: number; cantidad: number }[]) {
        const adTotal = ads.reduce((s, a) => s + a.precio * a.cantidad, 0);
        const discInfo = getDiscountedPrice(p);

        setCarrito(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            return {
                ...item,
                precio: discInfo.final + adTotal,
                precioOverride: discInfo.final + adTotal,
                cantidad: qty,
                nota,
                adicionales: ads.filter(a => a.cantidad > 0),
                no_acumulable: discInfo.no_acumulable,
                has_discount: discInfo.has_discount
            };
        }));
        setView("catalog");
        setProductoCustom(null);
        setEditCartIndex(null);
    }

    function handleAddCustomized() {
        if (!productoCustom) return;
        const selectedAds = Object.entries(customAdicionales)
            .filter(([_, qty]) => qty > 0)
            .map(([id, qty]) => {
                const ad = adicionales.find(a => a.id === id);
                return { nombre: ad?.nombre || "", precio: ad?.precio_venta || 0, cantidad: qty };
            });

        if (editCartIndex !== null) {
            updateCartItem(editCartIndex, productoCustom, customQty, customNota, selectedAds);
        } else {
            addToCart(productoCustom, customQty, customNota, selectedAds);
        }
    }

    function editCartItem(idx: number) {
        const item = carrito[idx];
        const p = productos.find(prod => prod.nombre === item.nombre);
        if (!p) {
            alert("No se puede editar este producto porque ya no se encuentra en el catálogo.");
            return;
        }
        setProductoCustom(p);
        setCustomQty(item.cantidad);
        setCustomNota(item.nota || "");

        const adsMapping: Record<string, number> = {};
        if (item.adicionales) {
            item.adicionales.forEach(a => {
                const adici = adicionales.find(ad => ad.nombre === a.nombre);
                if (adici) {
                    adsMapping[adici.id] = (adsMapping[adici.id] || 0) + (a.cantidad || 1);
                }
            });
        }
        setCustomAdicionales(adsMapping);
        setEditCartIndex(idx);
        setView("customize");
    }

    function updateCartQty(idx: number, delta: number) {
        setCarrito(prev => prev.map((item, i) => {
            if (i !== idx) return item;
            const nq = item.cantidad + delta;
            return nq <= 0 ? item : { ...item, cantidad: nq };
        }));
    }

    function updateCartPrice(idx: number, price: number) {
        setCarrito(prev => prev.map((item, i) => i === idx ? { ...item, precioOverride: price } : item));
    }

    function removeFromCart(idx: number) {
        setCarrito(prev => prev.filter((_, i) => i !== idx));
    }

    const subtotal = carrito.reduce((s, item) => s + item.precioOverride * item.cantidad, 0);
    const costoEnvio = tipo === "delivery" ? validacionDelivery.costo : 0;
    const total = subtotal + costoEnvio;

    const isCustomValid = productoCustom ? gruposAdicionales.every((grp: any) => {
        const isAllowed = productoGrupos.some((pg: any) => pg.producto_id === productoCustom.id && pg.grupo_id === grp.id);
        if (!isAllowed || !grp.seleccion_obligatoria) return true;

        const grpAds = adicionales.filter(a => a.grupo_id === grp.id);
        const totalInGroup = grpAds.reduce((sum, a) => sum + (customAdicionales[a.id] || 0), 0);
        return totalInGroup >= (grp.seleccion_minima || 1);
    }) : true;

    const productosFiltrados = productos.filter(p => {
        if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
        if (catSeleccionada !== "todos" && p.categoria_id !== catSeleccionada) return false;
        return true;
    });

    async function crearPedido() {
        if (carrito.length === 0) return;
        if (!omitirCliente && !cliente.nombre) { alert("Ingresá el nombre del cliente"); return; }
        setLoading(true);
        try {
            if (editPedido) {
                // UPDATE existing order
                const { error: uError } = await supabase.from("pedidos").update({
                    cliente_nombre: omitirCliente ? "Consumidor Final" : cliente.nombre,
                    cliente_telefono: cliente.telefono,
                    cliente_direccion: tipo === "delivery" ? cliente.direccion : "Take Away",
                    tipo, subtotal, costo_envio: costoEnvio, total,
                    metodo_pago_id: metodoPagoId,
                    notas: notaPedido || (seAbona ? `Abona con: $${seAbona}` : ""),
                    cliente_lat: direccionGeocoded?.lat,
                    cliente_lng: direccionGeocoded?.lng
                }).eq("id", editPedido.id);
                if (uError) throw uError;

                // Delete old items and insert new
                await supabase.from("pedido_items").delete().eq("pedido_id", editPedido.id);
                const items = carrito.map(item => ({
                    pedido_id: editPedido.id,
                    nombre_producto: item.nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precioOverride,
                    notas: item.nota || "",
                    adicionales: item.adicionales || []
                }));
                const { error: iError } = await supabase.from("pedido_items").insert(items);
                if (iError) throw iError;
            } else {
                // CREATE new order - daily sequential numbering
                const todayStr = new Date().toISOString().split('T')[0];
                const { data: lastP } = await supabase
                    .from("pedidos")
                    .select("numero_pedido, created_at")
                    .gte("created_at", `${todayStr}T00:00:00`)
                    .lte("created_at", `${todayStr}T23:59:59`)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                let nextSeq = 1;
                if (lastP?.numero_pedido) {
                    const match = lastP.numero_pedido.match(/(\d+)$/);
                    if (match) nextSeq = parseInt(match[1], 10) + 1;
                }
                const tipoPrefix = tipo === "delivery" ? "DELIVERY" : tipo === "takeaway" ? "TAKE AWAY" : "SALON";
                const { data: pedido, error: pError } = await supabase.from("pedidos").insert({
                    numero_pedido: `${tipoPrefix}-${nextSeq}`,
                    cliente_nombre: omitirCliente ? "Consumidor Final" : cliente.nombre,
                    cliente_telefono: cliente.telefono,
                    cliente_direccion: tipo === "delivery" ? cliente.direccion : "Take Away",
                    tipo, subtotal, costo_envio: costoEnvio, total,
                    metodo_pago_id: metodoPagoId,
                    estado: "pendiente",
                    notas: notaPedido || (seAbona ? `Abona con: $${seAbona}` : ""),
                    cliente_lat: direccionGeocoded?.lat,
                    cliente_lng: direccionGeocoded?.lng
                }).select().single();
                if (pError) throw pError;

                const items = carrito.map(item => ({
                    pedido_id: pedido.id,
                    nombre_producto: item.nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precioOverride,
                    notas: item.nota || "",
                    adicionales: item.adicionales || []
                }));
                const { error: iError } = await supabase.from("pedido_items").insert(items);
                if (iError) throw iError;
            }

            onCreated();
            onClose();
        } catch (e: any) {
            console.error(e);
            alert("Error al " + (editPedido ? "editar" : "crear") + " pedido: " + (e.message || ""));
        } finally { setLoading(false); }
    }

    function fmt(n: number) { return new Intl.NumberFormat("es-AR").format(n); }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-6xl h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex border border-gray-200">

                {/* ═══ LEFT PANEL: Cart ═══ */}
                <div className="w-[22%] flex flex-col bg-gray-50 border-r border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900">Detalle del pedido</h3>
                        <span className="text-sm font-bold text-gray-900">$ {fmt(total)}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {carrito.length === 0 ? (
                            <div className="text-center py-16 text-gray-300">
                                <ShoppingBag size={40} className="mx-auto mb-3" />
                                <p className="text-xs font-medium">Sin productos</p>
                            </div>
                        ) : carrito.map((item, idx) => (
                            <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-3 space-y-2 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-gray-900 truncate">{item.nombre}</p>
                                        {item.adicionales && item.adicionales.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {Object.entries(
                                                    item.adicionales.reduce((acc, a) => {
                                                        const qty = a.cantidad || 1;
                                                        acc[a.nombre] = (acc[a.nombre] || 0) + qty;
                                                        return acc;
                                                    }, {} as Record<string, number>)
                                                ).map(([nombre, qty], i) => (
                                                    <span key={i} className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">
                                                        + {qty > 1 ? `${nombre} X ${qty}` : nombre}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Price override */}
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] text-gray-400 font-medium shrink-0">Precio</label>
                                    <input
                                        type="number"
                                        value={item.precioOverride}
                                        onChange={e => updateCartPrice(idx, parseFloat(e.target.value) || 0)}
                                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right font-bold outline-none focus:border-gray-900"
                                    />
                                </div>
                                {/* Qty + Delete */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1">
                                        <button onClick={() => updateCartQty(idx, -1)} className="text-gray-400 hover:text-gray-900"><Minus size={12} /></button>
                                        <span className="text-xs font-bold w-4 text-center">{item.cantidad}</span>
                                        <button onClick={() => updateCartQty(idx, 1)} className="text-gray-400 hover:text-gray-900"><Plus size={12} /></button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => editCartItem(idx)} className="text-xs text-blue-500 hover:text-blue-700 font-bold transition-colors">
                                            Editar
                                        </button>
                                        <button onClick={() => removeFromCart(idx)} className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors">
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Se abona */}
                    <div className="px-3 py-3 border-t border-gray-200">
                        <label className="text-[10px] text-gray-400 font-medium block mb-1">Se abona $</label>
                        <input
                            type="number"
                            value={seAbona}
                            onChange={e => setSeAbona(e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-gray-900"
                        />
                        {seAbona && parseFloat(seAbona) > total && (
                            <p className="text-[10px] text-green-600 font-bold mt-1">
                                Vuelto: $ {fmt(parseFloat(seAbona) - total)}
                            </p>
                        )}
                    </div>
                </div>

                {/* ═══ CENTER PANEL: Catalog / Customization ═══ */}
                <div className="flex-1 flex flex-col bg-white">
                    {view === "catalog" ? (
                        <>
                            {/* Search */}
                            <div className="px-5 py-4 border-b border-gray-100">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Buscar producto"
                                        value={busqueda}
                                        onChange={e => setBusqueda(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm font-medium outline-none focus:border-gray-900 focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            {/* Category chips */}
                            <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-gray-100">
                                <button
                                    onClick={() => setCatSeleccionada("todos")}
                                    className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${catSeleccionada === "todos" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                                >
                                    TODOS
                                </button>
                                {categorias.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setCatSeleccionada(c.id)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-colors uppercase ${catSeleccionada === c.id ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                                    >
                                        {c.nombre}
                                    </button>
                                ))}
                            </div>

                            {/* Product grid */}
                            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max h-max content-start">
                                {productosFiltrados.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleProductClick(p)}
                                        className={`bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all group text-left active:scale-[0.98] flex flex-col h-full ${!p.activo ? "border-red-200 opacity-60" : "border-gray-100"}`}
                                    >
                                        <div className="aspect-square w-full bg-gray-50 flex-shrink-0 relative">
                                            {p.imagen_url ? (
                                                <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-gray-200 bg-gray-100">
                                                    <ShoppingBag size={28} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3 flex-1 flex flex-col justify-between">
                                            <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight">{p.nombre}</p>
                                            {(() => {
                                                const dp = getDiscountedPrice(p); return dp.porcentaje > 0 ? (
                                                    <div className="mt-2 flex items-center gap-1.5">
                                                        <span className="text-[10px] text-gray-400 line-through">$ {fmt(dp.original)}</span>
                                                        <span className="text-xs font-black text-green-600">$ {fmt(dp.final)}</span>
                                                        <span className="bg-red-500 text-white text-[7px] font-black px-1 py-0.5 rounded">{dp.porcentaje}%</span>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs font-black text-gray-500 mt-2">$ {fmt(dp.final)}</p>
                                                );
                                            })()}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        /* ═══ CUSTOMIZATION VIEW ═══ */
                        <div className="flex-1 flex flex-col">
                            {/* Header */}
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => { setView("catalog"); setEditCartIndex(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><ArrowLeft size={18} /></button>
                                    <h3 className="font-bold text-gray-900">{productoCustom?.nombre}</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                                        <button onClick={() => setCustomQty(Math.max(1, customQty - 1))} className="text-gray-400 hover:text-gray-900"><Minus size={14} /></button>
                                        <span className="text-sm font-bold w-5 text-center">{customQty}</span>
                                        <button onClick={() => setCustomQty(customQty + 1)} className="text-gray-400 hover:text-gray-900"><Plus size={14} /></button>
                                    </div>
                                    {(() => {
                                        if (!productoCustom) return null; const dp = getDiscountedPrice(productoCustom); return dp.porcentaje > 0 ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-gray-400 line-through">$ {fmt(dp.original)}</span>
                                                <span className="text-sm font-bold text-green-600">$ {fmt(dp.final)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-sm font-bold text-gray-900">$ {fmt(dp.final)}</span>
                                        );
                                    })()}
                                    <button
                                        onClick={handleAddCustomized}
                                        disabled={!isCustomValid}
                                        className="bg-gray-900 text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {editCartIndex !== null ? "Actualizar" : "Agregar"}
                                    </button>
                                </div>
                            </div>

                            {/* Adicionales groups */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                {gruposAdicionales.map(grp => {
                                    const isAllowed = productoGrupos.some((pg: any) => pg.producto_id === productoCustom?.id && pg.grupo_id === grp.id);
                                    if (!isAllowed) return null;

                                    const grpAds = adicionales.filter(a => a.grupo_id === grp.id);
                                    if (grpAds.length === 0) return null;
                                    return (
                                        <div key={grp.id}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <h4 className="text-sm font-bold text-gray-900">{grp.titulo}</h4>
                                                {grp.seleccion_obligatoria && (
                                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">[Obligatorio]</span>
                                                )}
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    Máx. {grp.seleccion_maxima} {grp.seleccion_minima > 0 && `| Mín. ${grp.seleccion_minima}`}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {grpAds.map(ad => {
                                                    const qty = customAdicionales[ad.id] || 0;
                                                    // Calculate total selected in this group
                                                    const totalInGroup = grpAds.reduce((sum, a) => sum + (customAdicionales[a.id] || 0), 0);
                                                    const atMaxGroup = grp.seleccion_maxima > 0 && totalInGroup >= grp.seleccion_maxima;
                                                    const atMaxItem = ad.seleccion_maxima > 0 && qty >= ad.seleccion_maxima;
                                                    const disabledPlus = atMaxGroup || atMaxItem;
                                                    return (
                                                        <div key={ad.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                                                            <div>
                                                                <span className="text-sm text-gray-700 font-medium">{ad.nombre}</span>
                                                                {ad.precio_venta > 0 && (
                                                                    <span className="text-xs text-gray-400 ml-2">+$ {fmt(ad.precio_venta)}</span>
                                                                )}
                                                                {ad.seleccion_maxima > 0 && (
                                                                    <span className="text-[10px] text-gray-400 block mt-0.5">Máx. {ad.seleccion_maxima}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1">
                                                                <button
                                                                    onClick={() => setCustomAdicionales({ ...customAdicionales, [ad.id]: Math.max(0, qty - 1) })}
                                                                    className="text-gray-400 hover:text-gray-900"
                                                                ><Minus size={12} /></button>
                                                                <span className="text-xs font-bold w-4 text-center">{qty}</span>
                                                                <button
                                                                    onClick={() => {
                                                                        if (!disabledPlus) setCustomAdicionales({ ...customAdicionales, [ad.id]: qty + 1 });
                                                                    }}
                                                                    className={`transition-colors ${disabledPlus ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-gray-900'}`}
                                                                    disabled={disabledPlus}
                                                                ><Plus size={12} /></button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Nota al producto */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 block mb-2">Nota al producto</label>
                                    <input
                                        type="text"
                                        value={customNota}
                                        onChange={e => setCustomNota(e.target.value)}
                                        placeholder="Ej: Sin cebolla, bien cocido..."
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-900"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ═══ RIGHT PANEL: Metadata ═══ */}
                <div className="w-[25%] flex flex-col bg-gray-50 border-l border-gray-200">
                    <div className="flex-1 overflow-y-auto p-4 space-y-5">

                        {/* Modalidad */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Modalidad</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setTipo("delivery")}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors ${tipo === "delivery" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                                >
                                    Delivery
                                </button>
                                <button
                                    onClick={() => setTipo("takeaway")}
                                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors ${tipo === "takeaway" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                                >
                                    Take Away
                                </button>
                            </div>
                        </div>

                        {/* Método de pago */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Método de pago</label>
                            <div className="flex gap-2 flex-wrap">
                                {metodosPago.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setMetodoPagoId(m.id)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${metodoPagoId === m.id ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                                    >
                                        {m.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Omitir cliente */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={omitirCliente}
                                onChange={e => setOmitirCliente(e.target.checked)}
                                className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900"
                            />
                            <span className="text-xs font-medium text-gray-600">Omitir datos del cliente</span>
                        </label>

                        {/* Client fields */}
                        {!omitirCliente && (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Teléfono</label>
                                    <input type="text" value={cliente.telefono} onChange={e => setCliente({ ...cliente, telefono: e.target.value })} placeholder="Teléfono"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900 bg-white" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre</label>
                                    <input type="text" value={cliente.nombre} onChange={e => setCliente({ ...cliente, nombre: e.target.value })} placeholder="Nombre"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900 bg-white" />
                                </div>

                                {tipo === "delivery" && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Dirección</label>
                                            <div className="flex gap-2">
                                                <input type="text" value={cliente.direccion} onChange={e => setCliente({ ...cliente, direccion: e.target.value })}
                                                    onKeyDown={e => e.key === "Enter" && cliente.direccion.length > 3 && validarDireccion(cliente.direccion)}
                                                    placeholder="Ingresá la dirección completa"
                                                    className={`flex-1 border rounded-lg px-3 py-2.5 text-sm outline-none bg-white ${validacionDelivery.error ? 'border-red-300' : validacionDelivery.valid ? 'border-green-300' : 'border-gray-200 focus:border-gray-900'}`} />
                                                <button
                                                    onClick={() => validarDireccion(cliente.direccion)}
                                                    disabled={validacionDelivery.loading || cliente.direccion.length < 4}
                                                    className="bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white text-xs font-bold px-4 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 active:scale-95"
                                                >
                                                    {validacionDelivery.loading ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : "Verificar"}
                                                </button>
                                            </div>
                                            {/* Validation feedback */}
                                            {validacionDelivery.loading && (
                                                <p className="text-[10px] text-gray-400 font-bold mt-1.5 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Buscando dirección...</p>
                                            )}
                                            {validacionDelivery.error && !validacionDelivery.loading && (
                                                <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-red-500 font-bold bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100">
                                                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                                    <span>{validacionDelivery.error}</span>
                                                </div>
                                            )}
                                            {validacionDelivery.valid && !validacionDelivery.loading && (
                                                <div className="mt-1.5 flex items-start gap-1.5 text-[10px] font-bold bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-100">
                                                    <CheckCircle2 size={12} className="text-green-600 shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="text-green-700">¡Dirección verificada!</span>
                                                        {validacionDelivery.zona && <span className="text-gray-500 ml-1">Zona: {validacionDelivery.zona}</span>}
                                                        <div className="text-gray-600 mt-0.5">
                                                            Costo de envío: <span className="text-gray-900 font-black">{validacionDelivery.costo === 0 ? "GRATIS" : `$ ${fmt(validacionDelivery.costo)}`}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {/* Alternatives */}
                                            {alternativas.length > 0 && !validacionDelivery.valid && !validacionDelivery.loading && (
                                                <div className="mt-1.5 space-y-1">
                                                    <p className="text-[9px] font-bold text-gray-400">¿Quisiste decir?</p>
                                                    {alternativas.map((alt: any, i: number) => (
                                                        <button key={i} type="button" onClick={() => { setCliente({ ...cliente, direccion: alt.display_name }); setAlternativas([]); setTimeout(() => validarDireccion(alt.display_name), 100); }}
                                                            className="w-full text-left px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[10px] font-medium text-blue-700 flex items-center gap-1.5">
                                                            <MapPin size={9} className="shrink-0" /><span className="truncate">{alt.display_name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Entre calles</label>
                                            <input type="text" value={cliente.entreCalles} onChange={e => setCliente({ ...cliente, entreCalles: e.target.value })} placeholder="Entre calles"
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900 bg-white" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Instrucciones</label>
                                            <input type="text" value={cliente.instrucciones} onChange={e => setCliente({ ...cliente, instrucciones: e.target.value })} placeholder="Ej: Timbre no funciona"
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900 bg-white" />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Nota al pedido */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Nota al pedido</label>
                            <input type="text" value={notaPedido} onChange={e => setNotaPedido(e.target.value)} placeholder="Notas adicionales"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900 bg-white" />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-4 border-t border-gray-200 space-y-3">
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Subtotal</span><span className="font-bold">$ {fmt(subtotal)}</span>
                        </div>
                        {tipo === "delivery" && costoEnvio > 0 && (
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Envío</span><span className="font-bold">$ {fmt(costoEnvio)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-200">
                            <span>Total</span><span>$ {fmt(total)}</span>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                            <button onClick={onClose} className="text-red-500 font-bold text-xs hover:text-red-600 transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={crearPedido}
                                disabled={loading || carrito.length === 0}
                                className="flex-1 bg-gray-900 text-white py-3 rounded-full text-xs font-bold hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                                {loading ? (editPedido ? "Editando..." : "Creando...") : (editPedido ? "Editar pedido" : "Crear pedido")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}
