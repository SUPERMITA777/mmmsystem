"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Search, Plus, Minus, Trash2, ShoppingBag, Bike, MapPin, AlertCircle, CheckCircle2, Loader2, ArrowLeft, Lock, User } from "lucide-react";
import { useAuth } from "@/components/admin/AuthProvider";
import { LatLng, pointInPolygon, getDistance } from "@/lib/geoutils";
import { getProductDiscount } from "@/lib/discountUtils";
import { useTenant } from "@/context/TenantContext";
import { db, guardarPedidoLocal, generateLocalId, marcarSincronizado } from "@/lib/db";
import { printCocina, printCocinaIncremental, printPreCuenta } from "@/lib/printUtils";
import { persistirPedidoHibrido } from "@/lib/hybridService";

interface NuevoPedidoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
    editPedido?: any;
    camareroMode?: boolean;
}

type CartItem = {
    id: string;
    producto_id?: string;
    nombre: string;
    precio: number;
    precioOverride: number;
    cantidad: number;
    imagen_url?: string;
    nota?: string;
    adicionales?: { nombre: string; precio: number; cantidad: number; impresora?: string }[];
    impresora?: string;
};

export default function NuevoPedidoModal({ isOpen, onClose, onCreated, editPedido, camareroMode = false }: NuevoPedidoModalProps) {
    // Data
    const [productos, setProductos] = useState<any[]>([]);
    const [categorias, setCategorias] = useState<any[]>([]);
    const [metodosPago, setMetodosPago] = useState<any[]>([]);
    const [gruposAdicionales, setGruposAdicionales] = useState<any[]>([]);
    const [adicionales, setAdicionales] = useState<any[]>([]);
    const [productoGrupos, setProductoGrupos] = useState<any[]>([]);
    const [descuentos, setDescuentos] = useState<any[]>([]);
    const [mesas, setMesas] = useState<any[]>([]);

    // UI State
    const { user } = useAuth();
    const isAdmin = user?.rol === "admin" || user?.rol === "super_admin";
    const [busqueda, setBusqueda] = useState("");
    const [catSeleccionada, setCatSeleccionada] = useState<string>("todos");
    const [view, setView] = useState<"catalog" | "customize">("catalog");
    const [productoCustom, setProductoCustom] = useState<any>(null);
    const [customQty, setCustomQty] = useState(1);
    const [customNota, setCustomNota] = useState("");
    const [customAdicionales, setCustomAdicionales] = useState<Record<string, number>>({});
    const [editCartIndex, setEditCartIndex] = useState<number | null>(null);
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [motivoEliminacion, setMotivoEliminacion] = useState("");
    const [showMotivoModal, setShowMotivoModal] = useState(false);

    // Cart
    const [carrito, setCarrito] = useState<CartItem[]>([]);
    const [seAbona, setSeAbona] = useState("");
    const [promoCode, setPromoCode] = useState("");
    const [promoValidating, setPromoValidating] = useState(false);
    const [promoResult, setPromoResult] = useState<null | { valid: boolean; message?: string; codigo?: any }>(null);
    const [codigoDescuentoId, setCodigoDescuentoId] = useState("");

    // Order metadata
    const [tipo, setTipo] = useState<"delivery" | "takeaway" | "salon">("delivery");
    const [salonStep, setSalonStep] = useState<"setup" | "catalog">("catalog");
    const [metodoPagoId, setMetodoPagoId] = useState("");
    
    // Mixed payments state
    const [isMixto, setIsMixto] = useState(false);
    const [metodoPago2Id, setMetodoPago2Id] = useState("");
    const [montoMixto1, setMontoMixto1] = useState("");

    const [omitirCliente, setOmitirCliente] = useState(false);
    const [cliente, setCliente] = useState({ nombre: "", telefono: "", direccion: "", entreCalles: "", instrucciones: "" });
    const [notaPedido, setNotaPedido] = useState("");
    const [loading, setLoading] = useState(false);

    // Delivery validation
    const [zonas, setZonas] = useState<any[]>([]);
    const [configSucursal, setConfigSucursal] = useState<any>(null);
    const [validacionDelivery, setValidacionDelivery] = useState<{ valid: boolean; zona?: string; costo: number; loading: boolean; error?: string }>({ valid: false, costo: 0, loading: false });
    const [comensales, setComensales] = useState<number>(1);
    const [cubiertoCobrado, setCubiertoCobrado] = useState(false);
    const [camareros, setCamareros] = useState<any[]>([]);
    const [camareroId, setCamareroId] = useState("");
    const [mesaId, setMesaId] = useState("");
    const { sucursalId } = useTenant();
    const isLoadingEditPedido = useRef(false);
    // Tracking commanded items (items that have been sent to kitchen)
    const [itemsComandados, setItemsComandados] = useState<Set<string>>(new Set());
    const [printConfig, setPrintConfig] = useState<any>(null);
    
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    const [direccionGeocoded, setDireccionGeocoded] = useState<LatLng | null>(null);
    const [alternativas, setAlternativas] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen && sucursalId) {
            fetchAll(!!editPedido);
            fetchPrintConfig();
            setView("catalog");
            if (editPedido) {
                isLoadingEditPedido.current = true;
                // Pre-fill from existing order
                const items: CartItem[] = (editPedido.pedido_items || []).map((item: any) => ({
                    id: item.id || crypto.randomUUID(),
                    producto_id: item.producto_id,
                    nombre: item.nombre_producto,
                    precio: item.precio_unitario,
                    precioOverride: item.precio_unitario,
                    cantidad: item.cantidad,
                    nota: item.notas || "",
                    adicionales: (item.adicionales || []).map((a: any) => ({ nombre: a.nombre, precio: a.precio || 0, cantidad: a.cantidad || 1 })),
                }));
                setCarrito(items);
                // Mark existing items as already commanded for salon orders
                if (editPedido.tipo === "salon" && editPedido.estado !== "pendiente") {
                    setItemsComandados(new Set(items.map((i: CartItem) => i.id)));
                } else {
                    setItemsComandados(new Set());
                }
                setCliente({
                    nombre: editPedido.cliente_nombre || "",
                    telefono: editPedido.cliente_telefono || "",
                    direccion: editPedido.cliente_direccion || "",
                    entreCalles: "",
                    instrucciones: "",
                });
                setTipo((editPedido.tipo as any) || "delivery");
                setNotaPedido(editPedido.notas || "");
                setSeAbona("");
                setMesaId(editPedido.mesa_id || "");
                setCamareroId(editPedido.camarero_id || "");
                setComensales(editPedido.comensales || 1);
                // If it's a new salon order, force setup step
                if (editPedido.tipo === "salon" && !editPedido.id) {
                    setSalonStep("setup");
                } else {
                    setSalonStep("catalog");
                }
                setCubiertoCobrado(editPedido.cubierto_cobrado || false);
                // Preserve original payment method
                if (editPedido.metodo_pago_id) setMetodoPagoId(editPedido.metodo_pago_id);
                setIsMixto(false);
                setMetodoPago2Id("");
                setMontoMixto1("");
                // Restore delivery validation if previously verified
                if (editPedido.tipo === "delivery") {
                    setValidacionDelivery({
                        valid: true,
                        costo: editPedido.costo_envio || 0,
                        loading: false,
                        zona: "Verificado previamente"
                    });
                    if (editPedido.cliente_lat && editPedido.cliente_lng) {
                        setDireccionGeocoded({ lat: editPedido.cliente_lat, lng: editPedido.cliente_lng });
                    }
                }
                // Allow address changes to reset validation only after initial load
                setTimeout(() => { isLoadingEditPedido.current = false; }, 200);
            } else {
                isLoadingEditPedido.current = false;
                setCarrito([]);
                setCliente({ nombre: "", telefono: "", direccion: "", entreCalles: "", instrucciones: "" });
                setNotaPedido("");
                setSeAbona("");
                setMesaId("");
                setCamareroId("");
                setComensales(1);
                setCubiertoCobrado(false);
                setPromoCode("");
                setItemsComandados(new Set());
                setPromoResult(null);
                setCodigoDescuentoId("");
                setValidacionDelivery({ valid: false, costo: 0, loading: false });
                setDireccionGeocoded(null);
                setAlternativas([]);
                setSalonStep("catalog");
            }
        }
    }, [isOpen, sucursalId]);

    // Handle salon step when tipo changes manually
    useEffect(() => {
        if (tipo === "salon" && !editPedido?.id) {
            setSalonStep("setup");
        } else {
            setSalonStep("catalog");
        }
    }, [tipo]);

    useEffect(() => {
        // Skip reset during initial load of an existing order
        if (isLoadingEditPedido.current) return;
        // Reset validation when address changes
        if (tipo === "delivery") {
            setValidacionDelivery({ valid: false, costo: 0, loading: false });
            setDireccionGeocoded(null);
            setAlternativas([]);
        }
    }, [cliente.direccion, tipo]);
    


    async function fetchAll(isEditing: boolean = false) {
        if (!sucursalId) return;

        // ─── 1. Cargar desde Dexie (Local) ───────────────────
        try {
            if (!sucursalId) return;

            const [
                localProds,
                localCats,
                localMPs,
                localConfig,
                localGrps,
                localAds,
                localPGs,
                localDescs,
                localMesas
            ] = await Promise.all([
                db.productos.where("sucursal_id").equals(sucursalId).toArray(),
                db.categorias.where("sucursal_id").equals(sucursalId).sortBy("orden"),
                db.metodos_pago.where("sucursal_id").equals(sucursalId).toArray(),
                db.config_sucursal.where("sucursal_id").equals(sucursalId).first(),
                db.grupos_adicionales.where("sucursal_id").equals(sucursalId).toArray(),
                db.adicionales.where("sucursal_id").equals(sucursalId).toArray(),
                db.producto_grupos_adicionales.where("sucursal_id").equals(sucursalId).toArray(),
                db.descuentos.where("sucursal_id").equals(sucursalId).toArray(),
                db.mesas.where("sucursal_id").equals(sucursalId).sortBy("numero")
            ]);

            if (localProds.length > 0) {
                setProductos(localProds);
                setCategorias(localCats);
                setMetodosPago(localMPs);
                if (localMPs.length && !isEditing) setMetodoPagoId(localMPs[0].id);
                setConfigSucursal(localConfig);
                setGruposAdicionales(localGrps);
                setAdicionales(localAds);
                setProductoGrupos(localPGs);
                setDescuentos(localDescs);
                setMesas(localMesas);
            }
        } catch (err) {
            console.error("Error cargando datos locales:", err);
        }

        // ─── 2. Si hay red, actualizar desde Supabase ────────
        if (!navigator.onLine) return;

        const { data: prods } = await supabase.from("productos").select("*").eq("sucursal_id", sucursalId).order("nombre");

        // Also fetch products via category relationship to catch any products
        // linked to a category but missing sucursal_id on the product row itself
        const { data: catsWithProds } = await supabase
            .from("categorias")
            .select("productos(*)")
            .eq("sucursal_id", sucursalId);

        const prodsFromCats = (catsWithProds || []).flatMap((c: any) => c.productos || []);

        // Merge both sources, deduplicating by id
        const allProds = [...(prods || [])];
        prodsFromCats.forEach((p: any) => {
            if (!allProds.some(existing => existing.id === p.id)) {
                allProds.push(p);
            }
        });

        // Deduplicate products by id, preferring those with a category assigned
        const uniqueProds = allProds.reduce((acc: any[], current: any) => {
            const existing = acc.find(p => p.id === current.id);
            if (!existing) {
                acc.push(current);
            } else if (!existing.categoria_id && current.categoria_id) {
                // Replace if we found one with a category
                acc = acc.map(p => p.id === existing.id ? current : p);
            }
            return acc;
        }, []);

        if (uniqueProds.length > 0) setProductos(uniqueProds);

        const { data: cats } = await supabase.from("categorias").select("*").eq("sucursal_id", sucursalId).order("orden");
        if (cats) setCategorias(cats);

        const { data: mps } = await supabase.from("metodos_pago").select("*").eq("sucursal_id", sucursalId).eq("activo", true);
        if (mps) {
            setMetodosPago(mps);
            if (mps.length && !isEditing && !metodoPagoId) setMetodoPagoId(mps[0].id);
        }

        const { data: szonas } = await supabase.from("zonas_entrega").select("*").eq("sucursal_id", sucursalId).eq("activo", true);
        if (szonas) setZonas(szonas);

        const { data: cfg } = await supabase.from("config_sucursal").select("*").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
        if (cfg) setConfigSucursal(cfg);

        const { data: grps } = await supabase.from("grupos_adicionales").select("*").eq("sucursal_id", sucursalId);
        if (grps) setGruposAdicionales(grps);

        const { data: ads } = await supabase.from("adicionales").select("*").eq("sucursal_id", sucursalId);
        if (ads) setAdicionales(ads);

        const { data: pg } = await supabase.from("producto_grupos_adicionales").select("*").eq("sucursal_id", sucursalId);
        if (pg) setProductoGrupos(pg);

        const { data: descs } = await supabase.from("descuentos").select("*").eq("sucursal_id", sucursalId).order("activo", { ascending: false }).order("nombre");
        if (descs) setDescuentos(descs);

        const { data: mss } = await supabase.from("mesas").select("*").eq("sucursal_id", sucursalId).order("numero");
        if (mss) setMesas(mss);

        // Fetch staff via server-side API
        try {
            const staffRes = await fetch(`/api/staff?sucursal_id=${sucursalId}`);
            if (staffRes.ok) {
                const staffData = await staffRes.json();
                setCamareros(staffData || []);
            }
        } catch (err: any) {
            console.error("Error fetching staff:", err);
        }
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
        if (!sucursalId) {
            setValidacionDelivery({ valid: false, costo: 0, loading: false, error: "Error interno." });
            return;
        }

        const { data: zonasDB } = await supabase
            .from("zonas_entrega")
            .select("*")
            .eq("sucursal_id", sucursalId)
            .eq("activo", true);

        // 3. Cargar config del local
        const { data: cfg } = await supabase
            .from("config_sucursal")
            .select("local_lat, local_lng")
            .eq("sucursal_id", sucursalId)
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
            producto_id: p.id,
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
                return { 
                    nombre: ad?.nombre || "", 
                    precio: ad?.precio_venta || 0, 
                    cantidad: qty,
                    impresora: ad?.impresora
                };
            });

        if (editCartIndex !== null) {
            updateCartItem(editCartIndex, productoCustom, customQty, customNota, selectedAds);
        } else {
            addToCart(productoCustom, customQty, customNota, selectedAds);
        }
    }

    function editCartItem(idx: number) {
        const item = carrito[idx];
        const p = productos.find(prod => prod.id === item.producto_id) || productos.find(prod => prod.nombre === item.nombre);
        if (!p) {
            alert("No se puede editar este producto porque ya no se encuentra en el catálogo.");
            return;
        }
        setProductoCustom(p);
        setCustomQty(item.cantidad);
        setCustomNota(item.nota || "");

        // Helper to normalize strings for robust comparison (handles whitespace, dashes, accents, cases)
        const normalize = (s: string) => 
            s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]/g, '');

        const adsMapping: Record<string, number> = {};
        if (item.adicionales) {
            // Get allowed groups for this product to prioritize matches in those groups
            const allowedGroupIds = productoGrupos
                .filter((pg: any) => pg.producto_id === p.id)
                .map((pg: any) => pg.grupo_id);

            item.adicionales.forEach(a => {
                const target = normalize(a.nombre);
                
                // Priority 1: Match name in allowed groups
                let adici = adicionales.find(ad => 
                    normalize(ad.nombre) === target && 
                    allowedGroupIds.includes(ad.grupo_id)
                );

                // Priority 2: Fallback to match name anywhere in master list
                if (!adici) {
                    adici = adicionales.find(ad => normalize(ad.nombre) === target);
                }

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
        const item = carrito[idx];
        if (!item) return;
        if (itemsComandados.has(item.id) && !isAdmin) {
            alert("Solo un administrador puede modificar la cantidad de un producto ya comandado.");
            return;
        }
        if (delta < 0 && itemsComandados.has(item.id)) {
            // Even admins might want a warning or reason here, but for now we just allow it.
        }
        setCarrito(prev => prev.map((it, i) => {
            if (i !== idx) return it;
            const nq = it.cantidad + delta;
            return nq <= 0 ? it : { ...it, cantidad: nq };
        }));
    }

    function updateCartPrice(idx: number, price: number) {
        const item = carrito[idx];
        if (item && item.precioOverride !== price) {
            const motivo = prompt("Motivo del ajuste de precio:");
            if (!motivo) return;
        }
        setCarrito(prev => prev.map((item, i) => i === idx ? { ...item, precioOverride: price } : item));
    }

    function removeFromCart(index: number) {
        const item = carrito[index];
        const isComandado = itemsComandados.has(item.id);

        if (isComandado) {
            if (!isAdmin) {
                alert("Solo un administrador puede eliminar productos comandados.");
                return;
            }
            setItemToDelete(index);
            setMotivoEliminacion("");
            setShowMotivoModal(true);
            return;
        }

        const newCarrito = [...carrito];
        newCarrito.splice(index, 1);
        setCarrito(newCarrito);
    }

    async function confirmRemoveComandado() {
        if (itemToDelete === null || !motivoEliminacion.trim() || !sucursalId) return;
        
        const item = carrito[itemToDelete];
        
        try {
            // Log to database
            await supabase.from("logs_eliminacion_pedidos").insert({
                sucursal_id: sucursalId,
                pedido_id: editPedido?.id,
                producto_nombre: item.nombre,
                cantidad: item.cantidad,
                motivo: motivoEliminacion.trim(),
                usuario_id: user?.id,
                usuario_nombre: user?.email
            });

            const newCarrito = [...carrito];
            newCarrito.splice(itemToDelete, 1);
            setCarrito(newCarrito);
            
            setShowMotivoModal(false);
            setItemToDelete(null);
            setMotivoEliminacion("");
        } catch (error) {
            console.error("Error logging deletion:", error);
            alert("Error al registrar la eliminación. Intente de nuevo.");
        }
    }

    async function fetchPrintConfig() {
        if (!sucursalId) return;
        try {
            const { data } = await supabase.from("config_impresion").select("*").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
            const { data: suc } = await supabase.from("config_sucursal").select("panel_settings").eq("sucursal_id", sucursalId).limit(1).maybeSingle();
            const { data: infoSuc } = await supabase.from("sucursales").select("nombre").eq("id", sucursalId).limit(1).maybeSingle();
            const boldMap = suc?.panel_settings?.print_bold || {};
            const fuente_adicionales = suc?.panel_settings?.fuente_adicionales;
            const impresoras = suc?.panel_settings?.impresoras || {};
            const bridge_ip = suc?.panel_settings?.bridge_ip || "127.0.0.1";
            const nombre_local = infoSuc?.nombre || "MMM Pizza Artesanal";
            if (data) setPrintConfig({ ...data, boldMap, fuente_adicionales, impresoras, bridge_ip, nombre_local });
            else setPrintConfig({ boldMap, fuente_adicionales, impresoras, bridge_ip, nombre_local });
        } catch {}
    }

    async function comandarSalon() {
        if (carrito.length === 0) return;
        setLoading(true);
        try {
            const mPago = metodosPago.find(m => m.id === metodoPagoId);
            const metodoPagoNombre = mPago ? mPago.nombre : "Efectivo";

            // Identify NEW items (not yet commanded)
            const newItems = carrito.filter(item => !itemsComandados.has(item.id));

            if (editPedido && editPedido.id) {
                // UPDATE existing salon order
                const { error: uError } = await supabase.from("pedidos").update({
                    cliente_nombre: cliente.nombre || "Consumidor Final",
                    tipo: "salon", subtotal, total,
                    metodo_pago_id: metodoPagoId || null,
                    metodo_pago_nombre: metodoPagoNombre,
                    notas: notaPedido || "",
                    estado: "preparando",
                    mesa_id: mesaId || null,
                    camarero_id: camareroId || null,
                    camarero_nombre: camareros.find(c => c.id === camareroId)?.nombre || null,
                    comensales: comensales,
                }).eq("id", editPedido.id);
                if (uError) throw uError;

                // Delete old items and re-insert all
                await supabase.from("pedido_items").delete().eq("pedido_id", editPedido.id);
                const items = carrito.map(item => ({
                    pedido_id: editPedido.id,
                    producto_id: item.producto_id,
                    nombre_producto: item.nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precioOverride,
                    notas: item.nota || "",
                    adicionales: item.adicionales || []
                }));
                await supabase.from("pedido_items").insert(items);

                // Print only new items to kitchen
                if (newItems.length > 0) {
                    const pedidoForPrint = { ...editPedido, tipo: "salon", mesa_numero: editPedido.mesas?.numero, numero_pedido: editPedido.numero_pedido, created_at: new Date().toISOString(), notas: notaPedido };
                    const printItems = newItems.map(item => {
                        const fullProd = productos.find(p => p.id === item.producto_id) || {};
                        const catNombre = categorias.find(c => c.id === fullProd.categoria_id)?.nombre || "";
                        return {
                            nombre_producto: item.nombre,
                            cantidad: item.cantidad,
                            adicionales: item.adicionales || [],
                            notas: item.nota || "",
                            impresora: fullProd.impresora,
                            categoria_id: fullProd.categoria_id,
                            categoria_nombre: catNombre
                        };
                    });
                    printCocinaIncremental(pedidoForPrint, printItems, printConfig);
                }

                // Mark all items as commanded
                setItemsComandados(new Set(carrito.map(i => i.id)));
            } else {
                // CREATE new salon order
                const localId = generateLocalId();
                const now = new Date();
                const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });
                const todayStr = formatter.format(now);
                const datePart = todayStr.replace(/-/g, '');

                let createdPedido: any = null;
                let attempts = 0;
                while (attempts < 10 && !createdPedido) {
                    attempts++;
                    if (attempts > 1) await new Promise(r => setTimeout(r, 300));
                    const { data: nextSeq, error: rpcError } = await supabase.rpc('get_next_order_number', { p_sucursal_id: sucursalId, p_date_part: datePart });
                    if (rpcError) throw rpcError;
                    const paddedSeq = String(nextSeq).padStart(4, '0');
                    const numeroPedido = `SALON-${datePart}-${paddedSeq}`;

                    const { data: pedido, error: pError } = await supabase.from("pedidos").insert({
                        id: localId,
                        sucursal_id: sucursalId,
                        numero_pedido: numeroPedido,
                        cliente_nombre: cliente.nombre || "Consumidor Final",
                        tipo: "salon", subtotal, costo_envio: 0, total,
                        metodo_pago_id: metodoPagoId || null,
                        metodo_pago_nombre: metodoPagoNombre,
                        estado: "preparando",
                        notas: notaPedido || "",
                        mesa_id: mesaId || null,
                        camarero_id: camareroId || null,
                        camarero_nombre: camareros.find(c => c.id === camareroId)?.nombre || null,
                        comensales: comensales,
                    }).select().single();

                    if (pError) {
                        if (pError.code === '23505') continue;
                        throw pError;
                    }
                    createdPedido = pedido;
                }
                if (!createdPedido) throw new Error("No se pudo crear el pedido.");

                const items = carrito.map(item => ({
                    pedido_id: createdPedido.id,
                    producto_id: item.producto_id,
                    nombre_producto: item.nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precioOverride,
                    notas: item.nota || "",
                    adicionales: item.adicionales || []
                }));
                await supabase.from("pedido_items").insert(items);

                // Update mesa status
                if (mesaId) {
                    await supabase.from("mesas").update({ estado: "ocupada" }).eq("id", mesaId);
                }

                // Print ALL items to kitchen (first comanda)
                const pedidoForPrint = { ...createdPedido, mesas: { numero: mesas.find(m => m.id === mesaId)?.numero } };
                const printItems = carrito.map(item => {
                    const fullProd = productos.find(p => p.id === item.producto_id) || {};
                    const catNombre = categorias.find(c => c.id === fullProd.categoria_id)?.nombre || "";
                    return {
                        nombre_producto: item.nombre,
                        cantidad: item.cantidad,
                        adicionales: item.adicionales || [],
                        notas: item.nota || "",
                        impresora: fullProd.impresora || item.impresora,
                        categoria_id: fullProd.categoria_id,
                        categoria_nombre: catNombre
                    };
                });
                printCocina(pedidoForPrint, printConfig, printItems);

                // Mark all items as commanded
                setItemsComandados(new Set(carrito.map(i => i.id)));
            }

            onCreated();
            onClose();
        } catch (e: any) {
            console.error(e);
            alert("Error al comandar: " + (e.message || ""));
        } finally { setLoading(false); }
    }

    async function cobrarMesa() {
        if (!editPedido || !editPedido.id) return;
        if (!confirm("¿Deseas cobrar y finalizar este pedido? La mesa quedará libre.")) return;
        setLoading(true);
        try {
            // 1. Update order status to 'entregado' (finalized)
            const { error: uError } = await supabase
                .from("pedidos")
                .update({ estado: "entregado" })
                .eq("id", editPedido.id);
            if (uError) throw uError;

            // 2. Free up the table
            if (mesaId) {
                await supabase.from("mesas").update({ estado: "libre" }).eq("id", mesaId);
            }

            onCreated(); // Refresh map
            onClose();
        } catch (e: any) {
            console.error(e);
            alert("Error al cobrar: " + (e.message || ""));
        } finally { setLoading(false); }
    }

    const subtotal = carrito.reduce((s, item) => s + item.precioOverride * item.cantidad, 0);

    const costoEnvio = tipo === "delivery" ? validacionDelivery.costo : 0;

    // Descuento promo QR
    const promoDescuento = (() => {
        if (!promoResult?.valid || !promoResult?.codigo?.premio) return 0;
        const p = promoResult.codigo.premio;
        if (p.tipo === "envio_gratis") return costoEnvio;
        if (p.tipo === "porcentaje" && p.valor) return Math.round(subtotal * p.valor / 100);
        if (p.tipo === "fijo" && p.valor) return Math.min(p.valor, subtotal);
        return 0;
    })();

    // Descuento por código de descuento seleccionado
    const descuentoSeleccionado = descuentos.find(d => d.id === codigoDescuentoId) || null;
    const codigoDescuento = (() => {
        if (!descuentoSeleccionado) return 0;

        // Calculate the eligible subtotal based on the discount's scope
        let subtotalElegible = subtotal; // default for "general"

        if (descuentoSeleccionado.aplicar_a === "categoria") {
            const catIds = descuentoSeleccionado.categorias_ids || (descuentoSeleccionado.categoria_id ? [descuentoSeleccionado.categoria_id] : []);
            if (catIds.length > 0) {
                subtotalElegible = carrito.reduce((sum, item) => {
                    const prod = productos.find(p => p.id === item.producto_id);
                    if (prod && catIds.includes(prod.categoria_id)) {
                        return sum + item.precioOverride * item.cantidad;
                    }
                    return sum;
                }, 0);
            }
        } else if (descuentoSeleccionado.aplicar_a === "producto") {
            const prodIds = descuentoSeleccionado.productos_ids || (descuentoSeleccionado.producto_id ? [descuentoSeleccionado.producto_id] : []);
            if (prodIds.length > 0) {
                subtotalElegible = carrito.reduce((sum, item) => {
                    if (item.producto_id && prodIds.includes(item.producto_id)) {
                        return sum + item.precioOverride * item.cantidad;
                    }
                    return sum;
                }, 0);
            }
        }

        if (subtotalElegible <= 0) return 0;
        if (descuentoSeleccionado.tipo === "porcentaje") return Math.round(subtotalElegible * descuentoSeleccionado.valor / 100);
        if (descuentoSeleccionado.tipo === "fijo") return Math.min(descuentoSeleccionado.valor, subtotalElegible);
        return 0;
    })();

    const total = subtotal + costoEnvio - promoDescuento - codigoDescuento;

    // Auto-apply discounts logic
    useEffect(() => {
        if (!descuentos.length || !metodoPagoId || editPedido?.id) return;
        
        // Find candidate auto-apply discounts
        const autoDescs = descuentos.filter(d => 
            d.activo && 
            d.auto_aplicar && 
            (!d.metodo_pago_id || d.metodo_pago_id === metodoPagoId) &&
            (!d.minimo_compra || subtotal >= d.minimo_compra)
        );

        if (autoDescs.length > 0) {
            // Sort by better value for customer (higher discount)
            const sorted = [...autoDescs].sort((a, b) => {
                const valA = a.tipo === 'porcentaje' ? (subtotal * a.valor / 100) : a.valor;
                const valB = b.tipo === 'porcentaje' ? (subtotal * b.valor / 100) : b.valor;
                return valB - valA;
            });
            
            const best = sorted[0];
            if (codigoDescuentoId !== best.id) {
                setCodigoDescuentoId(best.id);
            }
        } else if (codigoDescuentoId) {
            // If we had an auto-applied discount and now it's not valid, clear it
            const current = descuentos.find(d => d.id === codigoDescuentoId);
            if (current && current.auto_aplicar) {
                setCodigoDescuentoId("");
            }
        }
    }, [metodoPagoId, subtotal, descuentos, codigoDescuentoId]);


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

    const productosFiltrados = productos.filter(p => {
        if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
        if (catSeleccionada !== "todos" && p.categoria_id !== catSeleccionada) return false;
        return true;
    });

    async function crearPedido() {
        if (carrito.length === 0) return;
        if (!omitirCliente && !cliente.nombre && tipo !== "salon") { alert("Ingresá el nombre del cliente"); return; }
        setLoading(true);
        let pedidoFinalId: string | null = null;
        try {
            const mPago = metodosPago.find(m => m.id === metodoPagoId);
            const mPagoNombre1 = mPago ? mPago.nombre : (metodoPagoId ? "Transferencia" : "Efectivo");
            let metodoPagoNombre = mPagoNombre1;

            let notasPagoMixto = "";
            if (isMixto && metodoPago2Id && montoMixto1) {
                const mPago2 = metodosPago.find(m => m.id === metodoPago2Id);
                const mPagoNombre2 = mPago2 ? mPago2.nombre : "Transferencia";
                metodoPagoNombre = `Mixto (${mPagoNombre1} / ${mPagoNombre2})`;
                notasPagoMixto = `Pago mixto: $${montoMixto1} en ${mPagoNombre1}, resto en ${mPagoNombre2}. `;
            }

            let resolvedClienteId = null;
            if (!omitirCliente && cliente.telefono) {
                // Robust client handling with retry to avoid 409
                let clientAttempts = 0;
                while (clientAttempts < 3 && !resolvedClienteId) {
                    clientAttempts++;
                    const { data: existingClient } = await supabase
                        .from("clientes")
                        .select("id")
                        .eq("sucursal_id", sucursalId)
                        .eq("telefono", cliente.telefono)
                        .maybeSingle();

                    if (existingClient) {
                        resolvedClienteId = existingClient.id;
                        await supabase.from("clientes").update({
                            nombre: cliente.nombre,
                            direccion: tipo === "delivery" && cliente.direccion ? cliente.direccion : undefined
                        }).eq("id", resolvedClienteId);
                    } else {
                        const { data: newClient, error: cError } = await supabase.from("clientes").insert({
                            sucursal_id: sucursalId,
                            telefono: cliente.telefono,
                            nombre: cliente.nombre,
                            direccion: tipo === "delivery" ? cliente.direccion : null
                        }).select("id").maybeSingle();

                        if (newClient) {
                            resolvedClienteId = newClient.id;
                        } else if (cError?.code === '23505') {
                            // Race condition: someone else just created it. Retry to fetch it.
                            continue;
                        } else if (cError) {
                            throw cError;
                        }
                    }
                }
            }

            if (editPedido && editPedido.id) {
                // UPDATE existing order
                const { error: uError } = await supabase.from("pedidos").update({
                    cliente_id: resolvedClienteId || null,
                    cliente_nombre: omitirCliente ? "Consumidor Final" : cliente.nombre,
                    cliente_telefono: cliente.telefono,
                    cliente_direccion: tipo === "delivery" ? cliente.direccion : (tipo === "salon" ? "Salón" : "Take Away"),
                    tipo, subtotal, costo_envio: costoEnvio, total,
                    descuento: codigoDescuento > 0 ? codigoDescuento : (promoDescuento > 0 ? promoDescuento : 0),
                    notas_internas: descuentoSeleccionado ? descuentoSeleccionado.nombre : null,
                    metodo_pago_id: metodoPagoId || null,
                    metodo_pago_nombre: metodoPagoNombre,
                    notas: notasPagoMixto + (notaPedido || (seAbona ? `Abona con: $${seAbona}` : "")),
                    cliente_lng: direccionGeocoded?.lng,
                    mesa_id: tipo === "salon" ? (mesaId || null) : null,
                    camarero_id: tipo === "salon" ? (camareroId || null) : null,
                    camarero_nombre: tipo === "salon" ? (camareros.find(c => c.id === camareroId)?.nombre || null) : null,
                    comensales: tipo === "salon" ? comensales : null,
                    cubierto_cobrado: tipo === "salon" ? cubiertoCobrado : false
                }).eq("id", editPedido.id);
                if (uError) throw uError;

                // Delete old items and insert new
                await supabase.from("pedido_items").delete().eq("pedido_id", editPedido.id);
                const items = carrito.map(item => ({
                    pedido_id: editPedido.id,
                    producto_id: item.producto_id,
                    nombre_producto: item.nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precioOverride,
                    notas: item.nota || "",
                    adicionales: item.adicionales || []
                }));
                const { error: iError2 } = await supabase.from("pedido_items").insert(items);
                if (iError2) throw iError2;
                pedidoFinalId = editPedido.id;
            } else {
                // ═══ HYBRID PERSISTENCE ═══
                const localId = generateLocalId();
                const now = new Date();
                const formatter = new Intl.DateTimeFormat('en-CA', { 
                    timeZone: 'America/Argentina/Buenos_Aires', 
                    year: 'numeric', month: '2-digit', day: '2-digit' 
                });
                const todayStr = formatter.format(now);
                const datePart = todayStr.replace(/-/g, '');
                const tipoPrefix = tipo === "delivery" ? "DELIVERY" : tipo === "takeaway" ? "TAKE AWAY" : "SALON";

                // 1. Intentar obtener número real si hay red
                let numeroPedidoFinal = `${tipoPrefix}-${datePart}-LOCAL-${localId.slice(0, 6).toUpperCase()}`;
                if (navigator.onLine) {
                    try {
                        const { data: nextSeq } = await supabase.rpc('get_next_order_number', {
                            p_sucursal_id: sucursalId,
                            p_date_part: datePart
                        });
                        if (nextSeq) {
                            numeroPedidoFinal = `${tipoPrefix}-${datePart}-${String(nextSeq).padStart(4, '0')}`;
                        }
                    } catch (e) { console.warn("Error getting real order number, using local one."); }
                }

                const pedidoPayload = {
                    id: localId,
                    sucursal_id: sucursalId,
                    numero_pedido: numeroPedidoFinal,
                    cliente_id: resolvedClienteId || null,
                    cliente_nombre: omitirCliente ? "Consumidor Final" : cliente.nombre,
                    cliente_telefono: cliente.telefono,
                    cliente_direccion: tipo === "delivery" ? cliente.direccion : (tipo === "salon" ? "Salón" : "Take Away"),
                    tipo, subtotal, costo_envio: costoEnvio, total,
                    descuento: codigoDescuento > 0 ? codigoDescuento : (promoDescuento > 0 ? promoDescuento : 0),
                    notas_internas: descuentoSeleccionado ? descuentoSeleccionado.nombre : null,
                    metodo_pago_id: metodoPagoId || null,
                    metodo_pago_nombre: metodoPagoNombre,
                    estado: "pendiente",
                    notas: notasPagoMixto + (notaPedido || (seAbona ? `Abona con: $${seAbona}` : "")),
                    cliente_lng: direccionGeocoded?.lng,
                    mesa_id: tipo === "salon" ? (mesaId || null) : null,
                    camarero_id: tipo === "salon" ? (camareroId || null) : null,
                    camarero_nombre: tipo === "salon" ? (camareros.find(c => c.id === camareroId)?.nombre || null) : null,
                    comensales: tipo === "salon" ? comensales : null,
                    cubierto_cobrado: tipo === "salon" ? cubiertoCobrado : false
                };

                const itemsPayload = carrito.map(item => ({
                    id: generateLocalId(),
                    producto_id: item.producto_id,
                    nombre_producto: item.nombre,
                    cantidad: item.cantidad,
                    precio_unitario: item.precioOverride,
                    notas: item.nota || "",
                    adicionales: item.adicionales || []
                }));

                // persistirPedidoHibrido handles IndexedDB -> Supabase -> Local Hub
                const result = await persistirPedidoHibrido(
                    pedidoPayload, 
                    itemsPayload, 
                    printConfig?.bridge_ip || "127.0.0.1",
                    sucursalId!
                );
                
                pedidoFinalId = localId;
                console.log(`[Hybrid] Pedido guardado via: ${result.source}`);
            }

            onCreated();
            onClose();

            // Marcar código promo como usado
            if (promoResult?.valid && promoResult?.codigo?.id && pedidoFinalId) {
                try {
                    await supabase.from("promo_qr_codigos").update({
                        usado: true,
                        fecha_uso: new Date().toISOString(),
                        pedido_canje_id: pedidoFinalId,
                    }).eq("id", promoResult.codigo.id);
                } catch { /* Se sincronizará después */ }
            }
        } catch (e: any) {
            console.error(e);
            alert("Error al " + (editPedido ? "editar" : "crear") + " pedido: " + (e.message || ""));
        } finally { setLoading(false); }
    }

    function fmt(n: number) { return new Intl.NumberFormat("es-AR").format(n); }

    async function validatePromoCode() {
        if (!promoCode.trim() || !sucursalId) return;
        setPromoValidating(true);
        setPromoResult(null);
        try {
            const res = await fetch("/api/promo/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo: promoCode.trim().toUpperCase(), sucursalId }),
            });
            const data = await res.json();
            setPromoResult(data);
        } catch {
            setPromoResult({ valid: false, message: "Error de conexión" });
        } finally {
            setPromoValidating(false);
        }
    }

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
                                        <button
                                            onClick={() => updateCartQty(idx, -1)}
                                            disabled={itemsComandados.has(item.id) && !isAdmin}
                                            className={`${itemsComandados.has(item.id) && !isAdmin ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-gray-900'}`}
                                        ><Minus size={12} /></button>
                                        <span className="text-xs font-bold w-4 text-center">{item.cantidad}</span>
                                        <button 
                                            onClick={() => updateCartQty(idx, 1)} 
                                            disabled={itemsComandados.has(item.id) && !isAdmin}
                                            className={`${itemsComandados.has(item.id) && !isAdmin ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-gray-900'}`}
                                        ><Plus size={12} /></button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {itemsComandados.has(item.id) && (
                                            <span className="text-[8px] text-orange-500 font-bold flex items-center gap-0.5"><Lock size={8} /> Comandado</span>
                                        )}
                                        <button onClick={() => editCartItem(idx)} className="text-xs text-blue-500 hover:text-blue-700 font-bold transition-colors">
                                            Editar
                                        </button>
                                        <button
                                            onClick={() => removeFromCart(idx)}
                                            className={`text-xs font-bold transition-colors flex items-center gap-1 ${itemsComandados.has(item.id) && !isAdmin ? 'text-gray-300 cursor-not-allowed' : 'text-red-400 hover:text-red-600'}`}
                                        >
                                            <Trash2 size={12} />
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Código de descuento (tabla descuentos) */}
                    {!camareroMode && (
                        <div className="px-3 pt-3 border-t border-gray-200">
                            <label className="text-[10px] text-gray-400 font-medium block mb-1">🏷️ Código de descuento</label>
                            <select
                                value={codigoDescuentoId}
                                onChange={e => setCodigoDescuentoId(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs font-medium outline-none focus:border-purple-500 bg-white text-gray-700"
                            >
                                <option value="">— Sin descuento —</option>
                                {descuentos
                                    .map(d => (
                                        <option key={d.id} value={d.id}>
                                            {!d.activo ? "⚫ [INACTIVO] " : "🟢 "}{d.nombre} — {d.tipo === "porcentaje" ? `${d.valor}%` : `$${d.valor}`} OFF{d.codigo ? ` (${d.codigo})` : ""}
                                        </option>
                                    ))
                                }
                            </select>
                            {descuentoSeleccionado && (
                                <div className="mt-1.5 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 bg-green-50 text-green-700 border border-green-200">
                                    ✅ {descuentoSeleccionado.nombre} — Ahorro: ${fmt(codigoDescuento)}
                                    <button onClick={() => setCodigoDescuentoId("")} className="ml-auto text-gray-400 hover:text-gray-600">×</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Código Promo QR */}
                    {!camareroMode && (
                        <div className="px-3 pt-3 border-t border-gray-200">
                            <label className="text-[10px] text-gray-400 font-medium block mb-1">🎁 Código Promo QR</label>
                            <div className="flex gap-1">
                            <input
                                type="text"
                                value={promoCode}
                                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                                onKeyDown={e => e.key === 'Enter' && validatePromoCode()}
                                placeholder="XXXX"
                                maxLength={4}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono font-bold tracking-widest outline-none focus:border-purple-500 uppercase"
                            />
                            <button
                                onClick={validatePromoCode}
                                disabled={promoValidating || promoCode.length < 4}
                                className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-500 disabled:opacity-40 transition-colors"
                            >
                                {promoValidating ? "..." : "OK"}
                            </button>
                            </div>
                            {promoResult && (
                                <div className={`mt-1.5 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border ${promoResult.valid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    {promoResult.valid ? '✅' : '❌'}
                                    {promoResult.valid
                                        ? `${promoResult.codigo?.premio?.nombre || 'Premio'} — Ahorro: $${fmt(promoDescuento)}`
                                        : (promoResult.message || 'Código inválido')}
                                    {promoResult.valid && (
                                        <button onClick={() => { setPromoResult(null); setPromoCode(''); }} className="ml-auto text-gray-400 hover:text-gray-600">×</button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Se abona */}
                    {!camareroMode && (
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
                    )}
                </div>

                {/* ═══ CENTER PANEL: Catalog / Customization / Setup ═══ */}
                <div className="flex-1 flex flex-col bg-white min-h-0">
                    {tipo === "salon" && salonStep === "setup" ? (
                        /* APERTURA DE MESA SETUP */
                        <div className="flex-1 flex flex-col items-center justify-center p-10 bg-slate-50">
                            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-8 animate-in fade-in zoom-in-95 duration-300">
                                <div className="text-center space-y-2">
                                    <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <User size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-gray-900 uppercase">Apertura de Mesa</h3>
                                    <p className="text-gray-500 text-sm">Seleccione los datos para iniciar el pedido</p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Camarero Responsable</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {camareros.map(c => (
                                                <button
                                                    key={c.id}
                                                    onClick={() => setCamareroId(c.id)}
                                                    type="button"
                                                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${camareroId === c.id
                                                        ? "border-orange-500 bg-orange-50 ring-4 ring-orange-500/10"
                                                        : "border-gray-100 bg-gray-50 hover:border-gray-200"
                                                        }`}
                                                >
                                                    <div className="w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: c.color || '#ccc' }} />
                                                    <span className={`text-xs font-bold truncate ${camareroId === c.id ? "text-orange-700" : "text-gray-700"}`}>
                                                        {c.nombre}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Cantidad de Comensales</label>
                                        <div className="flex items-center gap-4 bg-gray-50 p-2 rounded-2xl border border-gray-100">
                                            <button
                                                type="button"
                                                onClick={() => setComensales(Math.max(1, comensales - 1))}
                                                className="w-12 h-12 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-xl font-bold hover:bg-gray-100 active:scale-95 transition-all"
                                            >
                                                -
                                            </button>
                                            <div className="flex-1 text-center">
                                                <span className="text-3xl font-black text-gray-900">{comensales}</span>
                                                <span className="text-[10px] text-gray-400 font-bold block uppercase">Personas</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setComensales(comensales + 1)}
                                                className="w-12 h-12 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-xl font-bold hover:bg-gray-100 active:scale-95 transition-all"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSalonStep("catalog")}
                                    disabled={!camareroId || comensales < 1}
                                    className="w-full bg-orange-600 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-wider hover:bg-orange-500 transition-all shadow-lg shadow-orange-500/20 disabled:bg-gray-200 disabled:shadow-none disabled:cursor-not-allowed active:scale-[0.98]"
                                >
                                    Comenzar Pedido
                                </button>
                            </div>
                        </div>
                    ) : view === "catalog" ? (
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
                        <div className="flex-1 flex flex-col min-h-0">
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

                            {/* Adicionales & Notas */}
                            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 bg-slate-50/30">
                                {/* Adicionales groups */}
                                <div className="flex flex-wrap items-start gap-6">
                                    {gruposAdicionales.map(grp => {
                                        const isAllowed = productoGrupos.some((pg: any) => pg.producto_id === productoCustom?.id && pg.grupo_id === grp.id);
                                        if (!isAllowed) return null;

                                        const grpAds = adicionales.filter(a => a.grupo_id === grp.id).sort((a, b) => a.nombre.localeCompare(b.nombre));
                                        if (grpAds.length === 0) return null;
                                        return (
                                            <div key={grp.id} className="w-full flex flex-col shrink-0">
                                                <div className="flex flex-col gap-0.5 mb-2 px-1">
                                                    <h4 className="text-[13px] font-black text-gray-900 uppercase tracking-tight">{grp.titulo}</h4>
                                                    <div className="flex items-center gap-2">
                                                        {grp.seleccion_obligatoria && (
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${!isGroupValid(grp) ? "bg-red-500 text-white animate-pulse" : "bg-green-100 text-green-700"}`}>
                                                                {!isGroupValid(grp) ? "SELECCIÓN OBLIGATORIA" : "¡LISTO!"}
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] text-gray-400 font-bold">
                                                            MÁX {grp.seleccion_maxima} {grp.seleccion_minima > 0 && `| MÍN ${grp.seleccion_minima}`}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2 bg-white rounded-2xl border border-gray-100 p-1.5 shadow-sm">
                                                    {grpAds.map(ad => {
                                                        const qty = customAdicionales[ad.id] || 0;
                                                        // Calculate total selected in this group
                                                        const totalInGroup = grpAds.reduce((sum, a) => sum + (customAdicionales[a.id] || 0), 0);
                                                        const atMaxGroup = grp.seleccion_maxima > 0 && totalInGroup >= grp.seleccion_maxima;
                                                        const atMaxItem = ad.seleccion_maxima > 0 && qty >= ad.seleccion_maxima;
                                                        const disabledPlus = atMaxGroup || atMaxItem;
                                                        return (
                                                            <div key={ad.id} className="flex items-center gap-1.5 py-1 px-1.5 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                                                <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                                                                    <button
                                                                        onClick={() => setCustomAdicionales({ ...customAdicionales, [ad.id]: Math.max(0, qty - 1) })}
                                                                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-white rounded-md transition-all shadow-sm active:scale-95"
                                                                    ><Minus size={12} /></button>
                                                                    <span className="text-[11px] font-black w-4 text-center text-gray-900">{qty}</span>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (!disabledPlus) setCustomAdicionales({ ...customAdicionales, [ad.id]: qty + 1 });
                                                                        }}
                                                                        className={`w-6 h-6 flex items-center justify-center transition-all rounded-md shadow-sm active:scale-95 ${disabledPlus ? 'text-gray-200 cursor-not-allowed bg-transparent' : 'text-gray-500 hover:text-gray-900 hover:bg-white'}`}
                                                                        disabled={disabledPlus}
                                                                    ><Plus size={12} /></button>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] text-gray-700 font-bold truncate pr-1">{ad.nombre}</span>
                                                                        {ad.precio_venta > 0 && (
                                                                            <span className="text-[10px] text-green-600 font-black shrink-0">+$ {fmt(ad.precio_venta)}</span>
                                                                        )}
                                                                    </div>
                                                                    {ad.seleccion_maxima > 0 && (
                                                                        <span className="text-[9px] text-gray-400 font-medium block -mt-0.5">Límite {ad.seleccion_maxima}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Nota al producto */}
                                <div className="w-full sm:w-[400px] shrink-0 mt-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-2 px-1">Nota al producto</label>
                                    <textarea
                                        rows={3}
                                        value={customNota}
                                        onChange={e => setCustomNota(e.target.value)}
                                        placeholder="Ej: Sin cebolla, bien cocido..."
                                        className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-gray-900 bg-white shadow-sm transition-all"
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
                        {!camareroMode && (
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
                                    <button
                                        onClick={() => setTipo("salon")}
                                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-colors ${tipo === "salon" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                                    >
                                        Salón
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Método de pago */}
                        {!camareroMode && (
                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Método de pago</label>
                                <div className="flex gap-2 flex-wrap">
                                    {metodosPago.map(m => (
                                        <button
                                            key={m.id}
                                            onClick={() => { setMetodoPagoId(m.id); setIsMixto(false); }}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${metodoPagoId === m.id && !isMixto ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"}`}
                                        >
                                            {m.nombre}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setIsMixto(true)}
                                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${isMixto ? "bg-purple-600 text-white" : "bg-white border border-purple-200 text-purple-600 hover:bg-purple-50"}`}
                                    >
                                        Mixto
                                    </button>
                                </div>

                                {isMixto && (
                                    <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100 space-y-3">
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Pago 1</label>
                                                <select
                                                    value={metodoPagoId}
                                                    onChange={e => setMetodoPagoId(e.target.value)}
                                                    className="w-full border border-purple-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-purple-500 bg-white"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {metodosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Monto Pago 1</label>
                                                <input
                                                    type="number"
                                                    value={montoMixto1}
                                                    onChange={e => setMontoMixto1(e.target.value)}
                                                    placeholder="Ej: 5000"
                                                    className="w-full border border-purple-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-purple-500 bg-white"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <label className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-1">Pago 2 (Resto)</label>
                                                <select
                                                    value={metodoPago2Id}
                                                    onChange={e => setMetodoPago2Id(e.target.value)}
                                                    className="w-full border border-purple-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-purple-500 bg-white"
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {metodosPago.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Omitir cliente (solo si no es salon) */}
                        {!camareroMode && tipo !== "salon" && (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={omitirCliente}
                                    onChange={e => setOmitirCliente(e.target.checked)}
                                    className="w-4 h-4 text-gray-900 rounded border-gray-300 focus:ring-gray-900"
                                />
                                <span className="text-xs font-medium text-gray-600">Omitir datos del cliente</span>
                            </label>
                        )}

                        {/* Salon fields */}
                        {tipo === "salon" && (
                            <div className="space-y-3 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Mesa</label>
                                    <select
                                        value={mesaId}
                                        onChange={(e) => setMesaId(e.target.value)}
                                        disabled={camareroMode && editPedido?.mesa_id}
                                        className="w-full border border-purple-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500 bg-white disabled:opacity-70"
                                    >
                                        <option value="">Seleccionar mesa...</option>
                                        {mesas.map(m => (
                                            <option key={m.id} value={m.id}>{m.nombre} (Cap: {m.capacidad}) - {m.estado}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Camarero</label>
                                    <select
                                        value={camareroId}
                                        onChange={(e) => setCamareroId(e.target.value)}
                                        className="w-full border border-purple-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-purple-500 bg-white"
                                    >
                                        <option value="">Seleccionar camarero...</option>
                                        {camareros.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.nombre} {c.apellido || ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Nombre del Cliente (Opcional)</label>
                                    <input 
                                        type="text" 
                                        value={cliente.nombre} 
                                        onChange={e => setCliente({ ...cliente, nombre: e.target.value })} 
                                        placeholder="Nombre para identificar la mesa"
                                        className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 bg-white" 
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Comensales</label>
                                        <input 
                                            type="number" 
                                            min="1"
                                            value={comensales} 
                                            onChange={e => setComensales(parseInt(e.target.value) || 1)} 
                                            className="w-full border border-purple-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500 bg-white" 
                                        />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer pt-1">
                                    <input
                                        type="checkbox"
                                        checked={cubiertoCobrado}
                                        onChange={e => setCubiertoCobrado(e.target.checked)}
                                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                    />
                                    <span className="text-xs font-medium text-gray-700">Cobrar cubiertos automáticamente</span>
                                </label>
                            </div>
                        )}

                        {/* Client fields */}
                        {tipo !== "salon" && !omitirCliente && (
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
                        {promoDescuento > 0 && (
                            <div className="flex justify-between text-xs text-green-600 font-bold">
                                <span>🎁 Promo QR</span><span>- $ {fmt(promoDescuento)}</span>
                            </div>
                        )}
                        {codigoDescuento > 0 && (
                            <div className="flex justify-between text-xs text-green-600 font-bold">
                                <span>🏷️ {descuentoSeleccionado?.codigo}</span><span>- $ {fmt(codigoDescuento)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-200">
                            <span>Total</span><span>$ {fmt(total)}</span>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                            <button onClick={onClose} className="text-red-500 font-bold text-xs hover:text-red-600 transition-colors">
                                Cancelar
                            </button>
                            {tipo === "salon" ? (
                                <>
                                    {editPedido && (
                                        <div className="flex-1 flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const mesaObj = mesas.find(m => m.id === mesaId);
                                                    const camareroObj = camareros.find(c => c.id === camareroId);
                                                    const patchedPedido = {
                                                        ...editPedido,
                                                        mesas: mesaObj ? { numero: mesaObj.numero || mesaObj.nombre } : editPedido.mesas,
                                                        camarero_nombre: camareroObj ? `${camareroObj.nombre} ${camareroObj.apellido || ""}`.trim() : null
                                                    };
                                                    printPreCuenta(patchedPedido, printConfig);
                                                    onClose();
                                                }}
                                                className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 py-3 rounded-full text-[10px] font-black transition-colors"
                                            >
                                                📄 PRE-CUENTA
                                            </button>
                                            {!camareroMode && (
                                                <button
                                                    onClick={cobrarMesa}
                                                    disabled={loading}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-full text-[10px] font-black transition-colors shadow-lg shadow-emerald-500/20"
                                                >
                                                    💰 COBRAR
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={comandarSalon}
                                        disabled={loading || carrito.length === 0}
                                        className="flex-1 bg-orange-600 text-white py-3 rounded-full text-xs font-bold hover:bg-orange-500 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        {loading ? "Procesando..." : (editPedido ? "ACTUALIZAR PEDIDO" : "🍳 COMANDAR")}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={crearPedido}
                                    disabled={loading || carrito.length === 0}
                                    className="flex-1 bg-gray-900 text-white py-3 rounded-full text-xs font-bold hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                                >
                                    {loading ? (editPedido ? "Editando..." : "Creando...") : (editPedido ? "Editar pedido" : "Crear pedido")}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
 
            {/* Motivo de Eliminación Modal */}
            {showMotivoModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-8 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                                    <AlertCircle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 uppercase italic">Motivo de Eliminación</h3>
                                    <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">Es obligatorio para productos comandados</p>
                                </div>
                            </div>
 
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                                    Estás eliminando <span className="font-bold text-gray-900">{itemToDelete !== null && carrito[itemToDelete]?.nombre}</span>. Por favor, indica el motivo:
                                </p>
                                <textarea
                                    autoFocus
                                    value={motivoEliminacion}
                                    onChange={e => setMotivoEliminacion(e.target.value)}
                                    placeholder="Ej: Error al comandar, plato devuelto, etc..."
                                    className="w-full border-2 border-gray-100 rounded-2xl p-4 text-sm font-medium outline-none focus:border-red-500 bg-gray-50/50 transition-all min-h-[100px] resize-none"
                                />
                            </div>
 
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setShowMotivoModal(false); setItemToDelete(null); }}
                                    className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmRemoveComandado}
                                    disabled={!motivoEliminacion.trim()}
                                    className="flex-1 bg-red-600 text-white px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500 disabled:opacity-40 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
