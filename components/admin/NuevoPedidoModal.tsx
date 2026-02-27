"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Search, Plus, Minus, Trash2, ShoppingBag, Bike, MapPin, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { LatLng, pointInPolygon, getDistance } from "@/lib/geoutils";

interface NuevoPedidoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
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

export default function NuevoPedidoModal({ isOpen, onClose, onCreated }: NuevoPedidoModalProps) {
    // Data
    const [productos, setProductos] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [metodosPago, setMetodosPago] = useState<any[]>([]);
    const [gruposAdicionales, setGruposAdicionales] = useState<any[]>([]);
    const [adicionales, setAdicionales] = useState<any[]>([]);

    // UI State
    const [busqueda, setBusqueda] = useState("");
    const [catSeleccionada, setCatSeleccionada] = useState<string>("todos");
    const [view, setView] = useState<"catalog" | "customize">("catalog");
    const [productoCustom, setProductoCustom] = useState<any>(null);
    const [customQty, setCustomQty] = useState(1);
    const [customNota, setCustomNota] = useState("");
    const [customAdicionales, setCustomAdicionales] = useState<Record<string, number>>({});

    // Cart
    const [carrito, setCarrito] = useState<CartItem[]>([]);
    const [seAbona, setSeAbona] = useState("");

    // Order metadata
    const [tipo, setTipo] = useState<"delivery" | "takeaway">("delivery");
    const [metodoPagoId, setMetodoPagoId] = useState("");
    const [omitirCliente, setOmitirCliente] = useState(false);
    const [cliente, setCliente] = useState({ nombre: "", telefono: "", email: "", direccion: "", entreCalles: "", instrucciones: "" });
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
            setCarrito([]);
            setCliente({ nombre: "", telefono: "", email: "", direccion: "", entreCalles: "", instrucciones: "" });
            setNotaPedido("");
            setSeAbona("");
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (tipo === "delivery" && cliente.direccion.length > 5) validarDireccion(cliente.direccion);
        }, 1500);
        return () => clearTimeout(timer);
    }, [cliente.direccion, tipo]);

    async function fetchAll() {
        const { data: prods } = await supabase.from("productos").select("*").eq("activo", true).order("nombre");
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
        const { data: grps } = await supabase.from("grupos_adicionales").select("*").eq("visible", true);
        setGruposAdicionales(grps || []);
        const { data: ads } = await supabase.from("adicionales").select("*").eq("visible", true);
        setAdicionales(ads || []);
    }

    async function validarDireccion(address: string) {
        setValidacionDelivery(prev => ({ ...prev, loading: true, error: undefined }));
        setAlternativas([]);
        try {
            const localidades = configSucursal?.localidades || [];
            const locNames = localidades.map((l: any) => l.nombre).join(',');
            const params = new URLSearchParams({ q: address, format: 'jsonv2', limit: '5', ...(locNames ? { localidades: locNames } : {}) });
            const res = await fetch(`/api/geocode?${params.toString()}`);
            const data = await res.json();
            const results = Array.isArray(data) ? data : [data];

            if (results.length > 0 && results[0]?.lat) {
                const point = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
                setDireccionGeocoded(point);
                let zonaEncontrada = null;
                for (const z of zonas) {
                    if (z.polygon_coords && pointInPolygon(point, z.polygon_coords)) { zonaEncontrada = z; break; }
                }
                if (zonaEncontrada) {
                    let costo = 0;
                    if (zonaEncontrada.tipo_precio === "por_km" && configSucursal?.local_lat) {
                        costo = Math.ceil(getDistance(point, { lat: configSucursal.local_lat, lng: configSucursal.local_lng }) * (zonaEncontrada.precio_por_km || 0));
                    } else { costo = zonaEncontrada.costo_envio || 0; }
                    if (zonaEncontrada.envio_gratis_desde && subtotal >= zonaEncontrada.envio_gratis_desde) costo = 0;
                    setValidacionDelivery({ valid: true, zona: zonaEncontrada.nombre, costo, loading: false });
                } else {
                    if (results.length > 1) setAlternativas(results.slice(0, 5));
                    setValidacionDelivery({ valid: false, costo: 0, loading: false, error: "Dirección fuera de la zona de entrega" });
                }
            } else {
                setValidacionDelivery({ valid: false, costo: 0, loading: false, error: "No se pudo encontrar la dirección" });
            }
        } catch { setValidacionDelivery({ valid: false, costo: 0, loading: false, error: "Error al validar" }); }
    }

    // Product click -> open customization if it has adicionales, else add directly
    function handleProductClick(p: any) {
        const prodGrupos = gruposAdicionales.filter(g => {
            // For now, show all groups - can be filtered by product association later
            return true;
        });
        const hasAdicionales = prodGrupos.length > 0 && adicionales.length > 0;

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
        const item: CartItem = {
            id: `${p.id}-${Date.now()}`,
            nombre: p.nombre,
            precio: p.precio + adTotal,
            precioOverride: p.precio + adTotal,
            cantidad: qty,
            imagen_url: p.imagen_url,
            nota,
            adicionales: ads.filter(a => a.cantidad > 0)
        };
        setCarrito(prev => [...prev, item]);
        setView("catalog");
        setProductoCustom(null);
    }

    function handleAddCustomized() {
        if (!productoCustom) return;
        const selectedAds = Object.entries(customAdicionales)
            .filter(([_, qty]) => qty > 0)
            .map(([id, qty]) => {
                const ad = adicionales.find(a => a.id === id);
                return { nombre: ad?.nombre || "", precio: ad?.precio_venta || 0, cantidad: qty };
            });
        addToCart(productoCustom, customQty, customNota, selectedAds);
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
            const numRandom = Math.floor(1000 + Math.random() * 9000);
            const { data: pedido, error: pError } = await supabase.from("pedidos").insert({
                numero_pedido: `MMM-${numRandom}`,
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

            onCreated();
            onClose();
        } catch (e: any) {
            console.error(e);
            alert("Error al crear pedido: " + (e.message || ""));
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
                                                {item.adicionales.map((a, i) => (
                                                    <span key={i} className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded font-medium">+ {a.nombre}</span>
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
                                    <button onClick={() => removeFromCart(idx)} className="text-xs text-red-400 hover:text-red-600 font-bold transition-colors">
                                        Eliminar
                                    </button>
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
                            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {productosFiltrados.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleProductClick(p)}
                                        className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-gray-300 transition-all group text-left active:scale-[0.98]"
                                    >
                                        <div className="aspect-square bg-gray-50 overflow-hidden">
                                            {p.imagen_url ? (
                                                <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-200">
                                                    <ShoppingBag size={28} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <p className="text-xs font-bold text-gray-900 truncate">{p.nombre}</p>
                                            <p className="text-xs font-bold text-gray-500 mt-0.5">$ {fmt(p.precio)}</p>
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
                                    <button onClick={() => setView("catalog")} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><ArrowLeft size={18} /></button>
                                    <h3 className="font-bold text-gray-900">{productoCustom?.nombre}</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
                                        <button onClick={() => setCustomQty(Math.max(1, customQty - 1))} className="text-gray-400 hover:text-gray-900"><Minus size={14} /></button>
                                        <span className="text-sm font-bold w-5 text-center">{customQty}</span>
                                        <button onClick={() => setCustomQty(customQty + 1)} className="text-gray-400 hover:text-gray-900"><Plus size={14} /></button>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">$ {fmt(productoCustom?.precio || 0)}</span>
                                    <button
                                        onClick={handleAddCustomized}
                                        className="bg-gray-900 text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-gray-800 transition-colors"
                                    >
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            {/* Adicionales groups */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                {gruposAdicionales.map(grp => {
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
                                                    Máx. {grp.seleccion_maxima}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {grpAds.map(ad => {
                                                    const qty = customAdicionales[ad.id] || 0;
                                                    return (
                                                        <div key={ad.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                                                            <div>
                                                                <span className="text-sm text-gray-700 font-medium">{ad.nombre}</span>
                                                                {ad.precio_venta > 0 && (
                                                                    <span className="text-xs text-gray-400 ml-2">+$ {fmt(ad.precio_venta)}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1">
                                                                <button
                                                                    onClick={() => setCustomAdicionales({ ...customAdicionales, [ad.id]: Math.max(0, qty - 1) })}
                                                                    className="text-gray-400 hover:text-gray-900"
                                                                ><Minus size={12} /></button>
                                                                <span className="text-xs font-bold w-4 text-center">{qty}</span>
                                                                <button
                                                                    onClick={() => setCustomAdicionales({ ...customAdicionales, [ad.id]: qty + 1 })}
                                                                    className="text-gray-400 hover:text-gray-900"
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
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Email</label>
                                    <input type="email" value={cliente.email} onChange={e => setCliente({ ...cliente, email: e.target.value })} placeholder="Email"
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-900 bg-white" />
                                </div>

                                {tipo === "delivery" && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Dirección</label>
                                            <input type="text" value={cliente.direccion} onChange={e => setCliente({ ...cliente, direccion: e.target.value })} placeholder="Dirección"
                                                className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none bg-white ${validacionDelivery.error ? 'border-red-300' : validacionDelivery.valid ? 'border-green-300' : 'border-gray-200 focus:border-gray-900'}`} />
                                            {/* Validation feedback */}
                                            {validacionDelivery.loading && (
                                                <p className="text-[10px] text-gray-400 font-bold mt-1 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Validando...</p>
                                            )}
                                            {validacionDelivery.error && (
                                                <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1"><AlertCircle size={10} /> {validacionDelivery.error}</p>
                                            )}
                                            {validacionDelivery.valid && (
                                                <p className="text-[10px] text-green-600 font-bold mt-1 flex items-center gap-1"><CheckCircle2 size={10} /> {validacionDelivery.zona} — Envío: ${fmt(validacionDelivery.costo)}</p>
                                            )}
                                            {/* Alternatives */}
                                            {alternativas.length > 0 && !validacionDelivery.valid && !validacionDelivery.loading && (
                                                <div className="mt-1 space-y-1">
                                                    <p className="text-[9px] font-bold text-gray-400">¿Quisiste decir?</p>
                                                    {alternativas.map((alt: any, i: number) => (
                                                        <button key={i} type="button" onClick={() => { setCliente({ ...cliente, direccion: alt.display_name }); setAlternativas([]); }}
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
                                {loading ? "Creando..." : "Crear pedido"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
