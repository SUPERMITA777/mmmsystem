"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Search, Plus, Minus, User, Phone, MapPin, CreditCard, ShoppingBag, Bike, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { LatLng, pointInPolygon, getDistance } from "@/lib/geoutils";

interface NuevoPedidoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

export default function NuevoPedidoModal({ isOpen, onClose, onCreated }: NuevoPedidoModalProps) {
    const [productos, setProductos] = useState<any[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [carrito, setCarrito] = useState<any[]>([]);
    const [tipo, setTipo] = useState<"delivery" | "takeaway">("delivery");
    const [metodosPago, setMetodosPago] = useState<any[]>([]);
    const [metodoPagoId, setMetodoPagoId] = useState("");
    const [cliente, setCliente] = useState({
        nombre: "",
        telefono: "",
        direccion: "",
        notas: ""
    });
    const [loading, setLoading] = useState(false);
    const [zonas, setZonas] = useState<any[]>([]);
    const [configSucursal, setConfigSucursal] = useState<any>(null);
    const [validacionDelivery, setValidacionDelivery] = useState<{
        valid: boolean;
        zona?: string;
        costo: number;
        loading: boolean;
        error?: string;
    }>({ valid: false, costo: 0, loading: false });
    const [direccionGeocoded, setDireccionGeocoded] = useState<LatLng | null>(null);
    const [alternativas, setAlternativas] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchProductos();
            fetchMetodosPago();
            fetchZonasYConfig();
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (tipo === "delivery" && cliente.direccion.length > 5) {
                validarDireccion(cliente.direccion);
            }
        }, 1500);
        return () => clearTimeout(timer);
    }, [cliente.direccion, tipo]);

    async function fetchZonasYConfig() {
        const { data: szonas } = await supabase.from("zonas_entrega").select("*").eq("activo", true);
        setZonas(szonas || []);

        const { data: cfg } = await supabase.from("config_sucursal").select("*").limit(1).maybeSingle();
        setConfigSucursal(cfg);
    }

    async function validarDireccion(address: string) {
        setValidacionDelivery(prev => ({ ...prev, loading: true, error: undefined }));
        setAlternativas([]);
        try {
            // Build locality-scoped query
            const localidades = configSucursal?.localidades || [];
            const locNames = localidades.map((l: any) => l.nombre).join(',');
            const params = new URLSearchParams({
                q: address,
                format: 'jsonv2',
                limit: '5',
                ...(locNames ? { localidades: locNames } : {})
            });

            const res = await fetch(`/api/geocode?${params.toString()}`);
            const data = await res.json();
            const results = Array.isArray(data) ? data : [data];

            if (results.length > 0 && results[0]?.lat) {
                const point = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
                setDireccionGeocoded(point);

                // Buscar zona
                let zonaEncontrada = null;
                for (const z of zonas) {
                    if (z.polygon_coords && pointInPolygon(point, z.polygon_coords)) {
                        zonaEncontrada = z;
                        break;
                    }
                }

                if (zonaEncontrada) {
                    let costo = 0;
                    if (zonaEncontrada.tipo_precio === "por_km" && configSucursal?.local_lat) {
                        const dist = getDistance(point, { lat: configSucursal.local_lat, lng: configSucursal.local_lng });
                        costo = Math.ceil(dist * (zonaEncontrada.precio_por_km || 0));
                    } else {
                        costo = zonaEncontrada.costo_envio || 0;
                    }

                    if (zonaEncontrada.envio_gratis_desde && subtotal >= zonaEncontrada.envio_gratis_desde) {
                        costo = 0;
                    }

                    setValidacionDelivery({
                        valid: true,
                        zona: zonaEncontrada.nombre,
                        costo,
                        loading: false
                    });
                } else {
                    // Show alternatives if we have more results
                    if (results.length > 1) {
                        setAlternativas(results.slice(0, 5));
                    }
                    setValidacionDelivery({
                        valid: false,
                        costo: 0,
                        loading: false,
                        error: "Dirección fuera de la zona de entrega"
                    });
                }
            } else {
                // No results found — try fuzzy search with more results
                const fuzzyParams = new URLSearchParams({
                    q: address,
                    format: 'jsonv2',
                    limit: '5',
                    ...(locNames ? { localidades: locNames } : {})
                });
                const fuzzyRes = await fetch(`/api/geocode?${fuzzyParams.toString()}`);
                const fuzzyData = await fuzzyRes.json();
                const fuzzyResults = Array.isArray(fuzzyData) ? fuzzyData : [];

                if (fuzzyResults.length > 0) {
                    setAlternativas(fuzzyResults);
                }

                setValidacionDelivery({
                    valid: false,
                    costo: 0,
                    loading: false,
                    error: "No se pudo encontrar la dirección exacta"
                });
            }
        } catch (e) {
            setValidacionDelivery({
                valid: false,
                costo: 0,
                loading: false,
                error: "Error al validar la dirección"
            });
        }
    }

    async function fetchProductos() {
        const { data } = await supabase.from("productos").select("*").eq("activo", true);
        setProductos(data || []);
    }

    async function fetchMetodosPago() {
        const { data } = await supabase.from("metodos_pago").select("*").eq("activo", true);
        setMetodosPago(data || []);
        if (data?.length) setMetodoPagoId(data[0].id);
    }

    const productosFiltrados = productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    function agregarAlCarrito(producto: any) {
        const existe = carrito.find(item => item.id === producto.id);
        if (existe) {
            setCarrito(carrito.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item));
        } else {
            setCarrito([...carrito, { ...producto, cantidad: 1 }]);
        }
    }

    function quitarDelCarrito(id: string) {
        const item = carrito.find(p => p.id === id);
        if (item.cantidad > 1) {
            setCarrito(carrito.map(p => p.id === id ? { ...p, cantidad: p.cantidad - 1 } : p));
        } else {
            setCarrito(carrito.filter(p => p.id !== id));
        }
    }

    const subtotal = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
    const costoEnvio = tipo === "delivery" ? validacionDelivery.costo : 0;
    const total = subtotal + costoEnvio;

    async function crearPedido() {
        if (carrito.length === 0 || !cliente.nombre) return;
        setLoading(true);

        try {
            const numRandom = Math.floor(1000 + Math.random() * 9000);
            const numero_pedido = `MMM-${numRandom}`;

            const { data: pedido, error: pError } = await supabase
                .from("pedidos")
                .insert({
                    numero_pedido,
                    cliente_nombre: cliente.nombre,
                    cliente_telefono: cliente.telefono,
                    cliente_direccion: tipo === "delivery" ? cliente.direccion : "Take Away",
                    tipo,
                    subtotal,
                    costo_envio: costoEnvio,
                    total,
                    metodo_pago_id: metodoPagoId,
                    estado: "pendiente",
                    notas: cliente.notas,
                    cliente_lat: direccionGeocoded?.lat,
                    cliente_lng: direccionGeocoded?.lng
                })
                .select()
                .single();

            if (pError) throw pError;

            const items = carrito.map(item => ({
                pedido_id: pedido.id,
                producto_id: item.id,
                nombre_producto: item.nombre,
                cantidad: item.cantidad,
                precio_unitario: item.precio
            }));

            const { error: iError } = await supabase.from("pedido_items").insert(items);
            if (iError) throw iError;

            onCreated();
            onClose();
            setCarrito([]);
            setCliente({ nombre: "", telefono: "", direccion: "", notas: "" });
        } catch (error) {
            console.error(error);
            alert("Error al crear pedido");
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
            <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-gray-100">
                <div className="px-8 py-6 border-b border-gray-50 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#7B1FA2]/10 flex items-center justify-center text-[#7B1FA2]">
                            <Plus size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Nuevo Pedido Manual</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Carga de pedido administrativo</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-50 text-gray-400 hover:text-gray-600 rounded-full transition-all hover:rotate-90">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Productos */}
                    <div className="w-2/3 flex flex-col border-r border-gray-50 bg-gray-50/30">
                        <div className="p-6">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#7B1FA2] transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold shadow-sm focus:ring-2 focus:ring-[#7B1FA2]/10 focus:border-[#7B1FA2] outline-none transition-all"
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 pt-0 grid grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar">
                            {productosFiltrados.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => agregarAlCarrito(p)}
                                    className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-[#7B1FA2]/20 transition-all flex flex-col items-start gap-2 group active:scale-95"
                                >
                                    <div className="w-full aspect-square bg-gray-50 rounded-2xl mb-2 overflow-hidden">
                                        {p.imagen_url ? (
                                            <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-200">
                                                <ShoppingBag size={32} />
                                            </div>
                                        )}
                                    </div>
                                    <h4 className="font-black text-gray-900 text-sm line-clamp-1 group-hover:text-[#7B1FA2] transition-colors">{p.nombre}</h4>
                                    <p className="text-[13px] font-black text-[#7B1FA2]">$ {p.precio}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Checkout */}
                    <div className="w-1/3 flex flex-col bg-white">
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            {/* Carrito */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                                    <h4 className="text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">Carrito de Items</h4>
                                    <span className="bg-purple-50 text-[#7B1FA2] text-[10px] font-black px-2 py-0.5 rounded-full">{carrito.length} Items</span>
                                </div>
                                <div className="space-y-4">
                                    {carrito.length === 0 ? (
                                        <div className="text-center py-12 opacity-20">
                                            <ShoppingBag size={48} className="mx-auto mb-4" />
                                            <p className="text-sm font-bold">Carrito vacío</p>
                                        </div>
                                    ) : (
                                        carrito.map(item => (
                                            <div key={item.id} className="flex justify-between items-center bg-gray-50/50 p-3 rounded-2xl">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <p className="text-xs font-black text-gray-900 truncate">{item.nombre}</p>
                                                    <p className="text-[11px] font-bold text-[#7B1FA2]">$ {item.precio}</p>
                                                </div>
                                                <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl shadow-sm border border-gray-100">
                                                    <button onClick={() => quitarDelCarrito(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Minus size={14} /></button>
                                                    <span className="text-xs font-black text-gray-900 w-4 text-center">{item.cantidad}</span>
                                                    <button onClick={() => agregarAlCarrito(item)} className="text-[#7B1FA2] hover:text-[#7B1FA2]/80 transition-colors"><Plus size={14} /></button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Datos Cliente */}
                            <div className="space-y-6 pt-4">
                                <h4 className="text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">Información de Entrega</h4>

                                <div className="flex p-1 bg-gray-100 rounded-2xl gap-1">
                                    <button onClick={() => setTipo("delivery")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black transition-all ${tipo === "delivery" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}>
                                        <Bike size={14} /> DELIVERY
                                    </button>
                                    <button onClick={() => setTipo("takeaway")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-black transition-all ${tipo === "takeaway" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400"}`}>
                                        <ShoppingBag size={14} /> TAKE AWAY
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#7B1FA2] transition-colors" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Nombre del cliente"
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-xs font-black outline-none focus:bg-white focus:ring-2 focus:ring-[#7B1FA2]/10 transition-all"
                                            value={cliente.nombre}
                                            onChange={e => setCliente({ ...cliente, nombre: e.target.value })}
                                        />
                                    </div>
                                    <div className="relative group">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#7B1FA2] transition-colors" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Teléfono"
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-4 pl-12 pr-4 text-xs font-black outline-none focus:bg-white focus:ring-2 focus:ring-[#7B1FA2]/10 transition-all"
                                            value={cliente.telefono}
                                            onChange={e => setCliente({ ...cliente, telefono: e.target.value })}
                                        />
                                    </div>
                                    {tipo === "delivery" && (
                                        <div className="space-y-2">
                                            <div className="relative group">
                                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-[#7B1FA2] transition-colors" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Dirección de entrega"
                                                    className={`w-full bg-gray-50 border rounded-2xl py-4 pl-12 pr-4 text-xs font-black outline-none focus:bg-white focus:ring-2 focus:ring-[#7B1FA2]/10 transition-all ${validacionDelivery.error ? 'border-red-200 focus:ring-red-100' : validacionDelivery.valid ? 'border-green-200 focus:ring-green-100' : 'border-gray-100'}`}
                                                    value={cliente.direccion}
                                                    onChange={e => setCliente({ ...cliente, direccion: e.target.value })}
                                                />
                                            </div>
                                            {tipo === "delivery" && (
                                                <div className="px-2 transition-all">
                                                    {validacionDelivery.loading ? (
                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                                            <Loader2 size={12} className="animate-spin" /> VALIDANDO DIRECCIÓN...
                                                        </div>
                                                    ) : validacionDelivery.error ? (
                                                        <div className="flex items-center gap-2 text-[10px] font-bold text-red-500">
                                                            <AlertCircle size={12} /> {validacionDelivery.error.toUpperCase()}
                                                        </div>
                                                    ) : validacionDelivery.valid ? (
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2 text-[10px] font-bold text-green-600">
                                                                <CheckCircle2 size={12} /> ZONA: {validacionDelivery.zona?.toUpperCase()}
                                                            </div>
                                                            <div className="text-[10px] font-black text-[#7B1FA2]">
                                                                ENVÍO: ${fmt(validacionDelivery.costo)}
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    {/* Alternative Suggestions */}
                                                    {alternativas.length > 0 && !validacionDelivery.valid && !validacionDelivery.loading && (
                                                        <div className="mt-2 space-y-1">
                                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">¿Quisiste decir?</p>
                                                            {alternativas.map((alt: any, i: number) => (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCliente({ ...cliente, direccion: alt.display_name });
                                                                        setAlternativas([]);
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 rounded-xl bg-blue-50/50 hover:bg-blue-100 text-[11px] font-medium text-blue-700 transition-colors flex items-center gap-2 border border-blue-100/50"
                                                                >
                                                                    <MapPin size={11} className="shrink-0 text-blue-400" />
                                                                    <span className="truncate">{alt.display_name}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">Método de Pago</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {metodosPago.map(m => (
                                            <button
                                                key={m.id}
                                                onClick={() => setMetodoPagoId(m.id)}
                                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${metodoPagoId === m.id ? "bg-purple-50 border-[#7B1FA2] text-[#7B1FA2]" : "bg-gray-50 border-gray-100 text-gray-500"}`}
                                            >
                                                <span className="text-[11px] font-black uppercase">{m.nombre}</span>
                                                {metodoPagoId === m.id && <CreditCard size={14} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 pt-6 border-t border-gray-800/50 mb-6">
                            <div className="flex justify-between items-center text-gray-400 text-[10px] font-black uppercase tracking-widest">
                                <span>Subtotal</span>
                                <span>$ {fmt(subtotal)}</span>
                            </div>
                            {tipo === "delivery" && (
                                <div className="flex justify-between items-center text-gray-400 text-[10px] font-black uppercase tracking-widest">
                                    <span>Envío</span>
                                    <span className={validacionDelivery.costo === 0 ? "text-green-500" : ""}>
                                        {validacionDelivery.costo === 0 ? "GRATIS" : `$ ${fmt(validacionDelivery.costo)}`}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                                <span className="text-gray-400 text-[11px] font-black uppercase tracking-widest">Total a Pagar</span>
                                <span className="text-2xl font-black text-white">$ {fmt(total)}</span>
                            </div>
                        </div>
                        <button
                            onClick={crearPedido}
                            disabled={loading || carrito.length === 0 || !cliente.nombre || (tipo === "delivery" && !validacionDelivery.valid)}
                            className="w-full bg-[#7B1FA2] text-white py-5 rounded-[1.5rem] text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-[#7B1FA2]/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-20 disabled:pointer-events-none"
                        >
                            {loading ? "CREANDO..." : "CREAR PEDIDO"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    function fmt(n: number) {
        return new Intl.NumberFormat("es-AR").format(n);
    }
}
