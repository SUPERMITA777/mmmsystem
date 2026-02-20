"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MapPin, Plus, Trash2, Edit3, Check, X, Navigation } from "lucide-react";
import dynamic from "next/dynamic";

// Tipos
type LatLng = { lat: number; lng: number };
type Zona = {
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
type ConfigLocal = {
    local_lat: number | null;
    local_lng: number | null;
    local_direccion: string | null;
};

// Colores por zona
const ZONA_COLORS = [
    "#8b5cf6", "#ef4444", "#f59e0b", "#10b981",
    "#3b82f6", "#ec4899", "#14b8a6", "#f97316"
];

// Algoritmo ray-casting para punto en polígono (solo para refs)
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
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

// =====================
// Componente del mapa (solo client-side)
// =====================
function MapaZonas({
    zonas,
    localPos,
    drawingZonaId,
    tempPoints,
    onMapClick,
    onLocalDrag,
}: {
    zonas: Zona[];
    localPos: LatLng | null;
    drawingZonaId: string | null;
    tempPoints: LatLng[];
    onMapClick: (latlng: LatLng) => void;
    onLocalDrag: (latlng: LatLng) => void;
}) {
    const { MapContainer, TileLayer, Polygon, Marker, useMapEvents, Polyline } = require("react-leaflet");
    const L = require("leaflet");

    const defaultCenter: [number, number] = localPos
        ? [localPos.lat, localPos.lng]
        : [-34.6037, -58.3816]; // Buenos Aires por defecto

    // Icono del marcador del local
    const localIcon = L.divIcon({
        html: `<div style="background:#111;width:28px;height:28px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: "",
    });

    function MapClickHandler() {
        useMapEvents({
            click(e: any) {
                if (drawingZonaId) {
                    onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
                }
            },
        });
        return null;
    }

    return (
        <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ height: "400px", width: "100%", borderRadius: "12px" }}
            className={drawingZonaId ? "cursor-crosshair" : ""}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler />

            {/* Marcador del local */}
            {localPos && (
                <Marker
                    position={[localPos.lat, localPos.lng]}
                    icon={localIcon}
                    draggable={true}
                    eventHandlers={{
                        dragend: (e: any) => {
                            const pos = e.target.getLatLng();
                            onLocalDrag({ lat: pos.lat, lng: pos.lng });
                        },
                    }}
                />
            )}

            {/* Polígonos de zonas guardadas */}
            {zonas.map((zona, idx) =>
                zona.polygon_coords && zona.polygon_coords.length >= 3 ? (
                    <Polygon
                        key={zona.id}
                        positions={zona.polygon_coords.map(p => [p.lat, p.lng])}
                        pathOptions={{
                            color: ZONA_COLORS[idx % ZONA_COLORS.length],
                            fillColor: ZONA_COLORS[idx % ZONA_COLORS.length],
                            fillOpacity: zona.activo ? 0.2 : 0.05,
                            weight: 2,
                            dashArray: zona.activo ? undefined : "6 4",
                        }}
                    />
                ) : null
            )}

            {/* Dibujo en curso */}
            {tempPoints.length > 0 && (
                <>
                    <Polyline
                        positions={[...tempPoints.map(p => [p.lat, p.lng] as [number, number]),
                        ...(tempPoints.length > 1 ? [[tempPoints[0].lat, tempPoints[0].lng] as [number, number]] : [])]}
                        pathOptions={{ color: "#8b5cf6", dashArray: "8 4", weight: 2 }}
                    />
                    {tempPoints.map((p, i) => (
                        <Marker
                            key={i}
                            position={[p.lat, p.lng]}
                            icon={L.divIcon({
                                html: `<div style="background:#8b5cf6;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
                                iconSize: [10, 10],
                                iconAnchor: [5, 5],
                                className: "",
                            })}
                        />
                    ))}
                </>
            )}
        </MapContainer>
    );
}

// =====================
// Componente Principal
// =====================
export function ZonasEntregaTab() {
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [config, setConfig] = useState<ConfigLocal>({ local_lat: null, local_lng: null, local_direccion: null });
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        nombre: "", costo_envio: 0, minimo_compra: 0,
        envio_gratis_desde: "", tiempo_estimado_minutos: "",
        tipo_precio: "fijo" as "fijo" | "por_km", precio_por_km: 0,
    });
    const [drawingZonaId, setDrawingZonaId] = useState<string | null>(null);
    const [tempPoints, setTempPoints] = useState<LatLng[]>([]);
    const [localSearch, setLocalSearch] = useState("");
    const [searching, setSearching] = useState(false);
    const [sucursalId, setSucursalId] = useState<string | null>(null);
    const [configId, setConfigId] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [savingLocal, setSavingLocal] = useState(false);
    const [saveLocalMsg, setSaveLocalMsg] = useState("");

    useEffect(() => {
        setIsMounted(true);
        fetchData();
    }, []);

    async function fetchData() {
        const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
        if (suc) {
            setSucursalId(suc.id);
            const { data: zonasData } = await supabase
                .from("zonas_entrega")
                .select("*")
                .eq("sucursal_id", suc.id)
                .order("nombre");
            setZonas(zonasData || []);

            const { data: cfg } = await supabase
                .from("config_sucursal")
                .select("id, local_lat, local_lng, local_direccion")
                .eq("sucursal_id", suc.id)
                .limit(1)
                .maybeSingle();
            if (cfg) {
                setConfigId(cfg.id);
                setConfig({ local_lat: cfg.local_lat, local_lng: cfg.local_lng, local_direccion: cfg.local_direccion });
                setLocalSearch(cfg.local_direccion || "");
            }
        }
        setLoading(false);
    }

    // Geocodificar la dirección del local
    async function geocodeLocal() {
        if (!localSearch.trim()) return;
        setSearching(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(localSearch)}&limit=1`,
                { headers: { "Accept-Language": "es" } }
            );
            const data = await res.json();
            if (data[0]) {
                const lat = parseFloat(data[0].lat);
                const lng = parseFloat(data[0].lon);
                setConfig(prev => ({ ...prev, local_lat: lat, local_lng: lng, local_direccion: localSearch }));
            } else {
                alert("No se encontró la dirección. Intentá ser más específico.");
            }
        } catch {
            alert("Error al buscar la dirección.");
        }
        setSearching(false);
    }

    async function saveLocalPosition(lat?: number, lng?: number) {
        setSavingLocal(true);
        const newLat = lat ?? config.local_lat;
        const newLng = lng ?? config.local_lng;
        if (!sucursalId || !newLat || !newLng) { setSavingLocal(false); return; }

        const payload = { local_lat: newLat, local_lng: newLng, local_direccion: config.local_direccion };
        let ok = false;

        if (configId) {
            const { error } = await supabase.from("config_sucursal").update(payload).eq("id", configId);
            ok = !error;
            if (error) console.error("update config_sucursal:", error.message);
        } else {
            const { data, error } = await supabase
                .from("config_sucursal")
                .insert({ ...payload, sucursal_id: sucursalId })
                .select("id")
                .single();
            if (!error && data) { setConfigId(data.id); ok = true; }
            else if (error) console.error("insert config_sucursal:", error.message);
        }

        if (ok) {
            setSaveLocalMsg("✓ Guardado");
            setTimeout(() => setSaveLocalMsg(""), 2500);
        } else {
            alert("Error al guardar. Aplicá el SQL de la migración 003 en Supabase primero.");
        }
        setSavingLocal(false);
    }



    async function handleCreate() {
        if (!form.nombre.trim() || !sucursalId) return;

        const fullPayload = {
            sucursal_id: sucursalId,
            nombre: form.nombre,
            costo_envio: form.costo_envio,
            minimo_compra: form.minimo_compra,
            envio_gratis_desde: form.envio_gratis_desde ? Number(form.envio_gratis_desde) : null,
            tiempo_estimado_minutos: form.tiempo_estimado_minutos ? Number(form.tiempo_estimado_minutos) : null,
            tipo_precio: form.tipo_precio,
            precio_por_km: form.precio_por_km,
        };

        // Intentar con todos los campos; si falla por caché de PostgREST, usar solo los básicos
        let newZonaId: string | null = null;
        const { data: d1, error: err1 } = await supabase.from("zonas_entrega").insert(fullPayload).select("id").single();
        if (err1) {
            if (err1.code === "PGRST204") {
                // Caché desactualizado — insertar sin columnas nuevas
                const { sucursal_id, nombre, costo_envio, minimo_compra, envio_gratis_desde, tiempo_estimado_minutos } = fullPayload;
                const { data: d2, error: err2 } = await supabase.from("zonas_entrega").insert({
                    sucursal_id, nombre, costo_envio, minimo_compra, envio_gratis_desde, tiempo_estimado_minutos
                }).select("id").single();
                if (err2) { alert("Error al guardar la zona: " + err2.message); return; }
                newZonaId = d2?.id ?? null;
            } else {
                alert("Error al guardar la zona: " + err1.message);
                return;
            }
        } else {
            newZonaId = d1?.id ?? null;
        }

        setForm({ nombre: "", costo_envio: 0, minimo_compra: 0, envio_gratis_desde: "", tiempo_estimado_minutos: "", tipo_precio: "fijo", precio_por_km: 0 });
        setShowForm(false);
        await fetchData();

        // Auto-entrar en modo dibujo para la zona recién creada
        if (newZonaId) {
            setDrawingZonaId(newZonaId);
            setTempPoints([]);
        }
    }

    async function toggleActivo(zona: Zona) {
        await supabase.from("zonas_entrega").update({ activo: !zona.activo }).eq("id", zona.id);
        fetchData();
    }

    async function handleDelete(id: string) {
        if (!confirm("¿Eliminar esta zona de entrega?")) return;
        await supabase.from("zonas_entrega").delete().eq("id", id);
        fetchData();
    }

    function startDrawing(zonaId: string) {
        setDrawingZonaId(zonaId);
        setTempPoints([]);
    }

    function cancelDrawing() {
        setDrawingZonaId(null);
        setTempPoints([]);
    }

    async function savePolygon() {
        if (!drawingZonaId || tempPoints.length < 3) {
            alert("Dibujá al menos 3 puntos para definir la zona.");
            return;
        }
        // Intentar con polygon_coords; si falla por caché, guardar sin esa columna
        const { error: err1 } = await supabase.from("zonas_entrega")
            .update({ polygon_coords: tempPoints })
            .eq("id", drawingZonaId);

        if (err1) {
            if (err1.code === "PGRST204") {
                alert("⚠ El servidor aún no reconoce la columna de polígonos. Aplicá el parche SQL en Supabase:\nALTER TABLE zonas_entrega ADD COLUMN IF NOT EXISTS polygon_coords JSONB;");
            } else {
                alert("Error al guardar el polígono: " + err1.message);
            }
            return;
        }

        setDrawingZonaId(null);
        setTempPoints([]);
        fetchData();
    }

    async function clearPolygon(zonaId: string) {
        if (!confirm("¿Eliminar el polígono de esta zona?")) return;
        const { error } = await supabase.from("zonas_entrega").update({ polygon_coords: null }).eq("id", zonaId);
        if (error) { alert("Error: " + error.message); return; }
        fetchData();
    }

    function handleMapClick(latlng: LatLng) {
        setTempPoints(prev => [...prev, latlng]);
    }

    function handleLocalDrag(latlng: LatLng) {
        setConfig(prev => ({ ...prev, local_lat: latlng.lat, local_lng: latlng.lng }));
        saveLocalPosition(latlng.lat, latlng.lng);
    }

    const localPos = config.local_lat && config.local_lng
        ? { lat: config.local_lat, lng: config.local_lng }
        : null;

    if (loading) return <p className="text-gray-400 py-8 text-center text-sm">Cargando zonas...</p>;

    return (
        <div className="pt-6 space-y-6">

            {/* === Ubicación del local === */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2">
                    <Navigation size={14} className="text-purple-600" />
                    Ubicación de tu local (punto de origen)
                </h4>
                <div className="flex gap-2">
                    <fieldset className="border border-gray-300 rounded-lg px-3 py-2 flex-1">
                        <legend className="text-xs text-gray-500 px-1">Dirección del local</legend>
                        <input
                            type="text"
                            value={localSearch}
                            onChange={e => setLocalSearch(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && geocodeLocal()}
                            className="w-full bg-transparent outline-none text-sm text-gray-900"
                            placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
                        />
                    </fieldset>
                    <button
                        onClick={geocodeLocal}
                        disabled={searching}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-500 disabled:opacity-50 whitespace-nowrap"
                    >
                        {searching ? "Buscando..." : "Ubicar"}
                    </button>
                    {localPos && (
                        <button
                            onClick={() => saveLocalPosition()}
                            disabled={savingLocal}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap ${saveLocalMsg ? "bg-green-600 text-white" : "bg-gray-900 text-white hover:bg-gray-700"
                                }`}
                        >
                            {savingLocal ? "..." : saveLocalMsg || "Guardar"}
                        </button>
                    )}
                </div>
                {localPos && (
                    <p className="text-xs text-gray-500 mt-2">
                        📍 {config.local_lat?.toFixed(5)}, {config.local_lng?.toFixed(5)} — Podés arrastrar el marcador en el mapa para ajustar la posición exacta
                    </p>
                )}
            </div>

            {/* === Mapa === */}
            <div className="rounded-xl overflow-hidden border border-gray-200 relative">
                {drawingZonaId && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-black/80 text-white text-xs px-4 py-2 rounded-full flex items-center gap-3">
                        <span>✏️ Hacé clic en el mapa para dibujar la zona ({tempPoints.length} puntos)</span>
                        <button
                            onClick={() => tempPoints.length > 0 && setTempPoints(prev => prev.slice(0, -1))}
                            className="underline opacity-70 hover:opacity-100"
                        >Deshacer</button>
                        <button onClick={savePolygon} className="text-green-400 font-bold hover:text-green-300">✓ Guardar</button>
                        <button onClick={cancelDrawing} className="text-red-400 hover:text-red-300">✕ Cancelar</button>
                    </div>
                )}
                {isMounted ? (
                    <MapaZonas
                        zonas={zonas}
                        localPos={localPos}
                        drawingZonaId={drawingZonaId}
                        tempPoints={tempPoints}
                        onMapClick={handleMapClick}
                        onLocalDrag={handleLocalDrag}
                    />
                ) : (
                    <div className="h-[400px] bg-gray-100 flex items-center justify-center">
                        <p className="text-gray-400 text-sm">Cargando mapa...</p>
                    </div>
                )}
            </div>

            {/* === Header zonas === */}
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Zonas de entrega</h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-1 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                    <Plus size={14} /> Nueva zona
                </button>
            </div>

            {/* === Formulario nueva zona === */}
            {showForm && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                    <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                        <legend className="text-xs text-gray-500 px-1">Nombre de la zona</legend>
                        <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Ej: Centro, Radio 1, Villa X" />
                    </fieldset>

                    {/* Tipo de precio */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setForm({ ...form, tipo_precio: "fijo" })}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${form.tipo_precio === "fijo" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}
                        >Costo fijo</button>
                        <button
                            onClick={() => setForm({ ...form, tipo_precio: "por_km" })}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${form.tipo_precio === "por_km" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600 hover:border-gray-500"}`}
                        >Por kilómetro</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {form.tipo_precio === "fijo" ? (
                            <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                                <legend className="text-xs text-gray-500 px-1">Costo envío ($)</legend>
                                <input type="number" value={form.costo_envio} onChange={e => setForm({ ...form, costo_envio: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm text-gray-900" />
                            </fieldset>
                        ) : (
                            <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                                <legend className="text-xs text-gray-500 px-1">Precio por km ($)</legend>
                                <input type="number" value={form.precio_por_km} onChange={e => setForm({ ...form, precio_por_km: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm text-gray-900" />
                            </fieldset>
                        )}
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Mínimo compra ($)</legend>
                            <input type="number" value={form.minimo_compra} onChange={e => setForm({ ...form, minimo_compra: Number(e.target.value) })} className="w-full bg-transparent outline-none text-sm text-gray-900" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Envío gratis desde ($)</legend>
                            <input type="number" value={form.envio_gratis_desde} onChange={e => setForm({ ...form, envio_gratis_desde: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Opcional" />
                        </fieldset>
                        <fieldset className="border border-gray-300 rounded-lg px-3 py-2">
                            <legend className="text-xs text-gray-500 px-1">Tiempo estimado (min)</legend>
                            <input type="number" value={form.tiempo_estimado_minutos} onChange={e => setForm({ ...form, tiempo_estimado_minutos: e.target.value })} className="w-full bg-transparent outline-none text-sm text-gray-900" placeholder="Opcional" />
                        </fieldset>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleCreate} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-500">Guardar zona</button>
                        <button onClick={() => setShowForm(false)} className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:text-gray-700">Cancelar</button>
                    </div>
                </div>
            )}

            {/* === Lista de zonas === */}
            {zonas.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    <MapPin size={40} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No hay zonas configuradas</p>
                    <p className="text-xs mt-1">Creá una zona y dibujá su área en el mapa</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {zonas.map((zona, idx) => {
                        const color = ZONA_COLORS[idx % ZONA_COLORS.length];
                        const hasPolygon = zona.polygon_coords && zona.polygon_coords.length >= 3;
                        const isDrawing = drawingZonaId === zona.id;
                        return (
                            <div key={zona.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3">
                                        {/* Color indicator */}
                                        <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0" style={{ background: color }} />
                                        <div>
                                            <span className="font-medium text-gray-900 text-sm">{zona.nombre}</span>
                                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
                                                {zona.tipo_precio === "fijo" ? (
                                                    <span>Envío: ${zona.costo_envio.toLocaleString("es-AR")}</span>
                                                ) : (
                                                    <span>Precio/km: ${zona.precio_por_km}</span>
                                                )}
                                                <span>Mín: ${zona.minimo_compra.toLocaleString("es-AR")}</span>
                                                {zona.envio_gratis_desde && <span>Gratis desde: ${zona.envio_gratis_desde.toLocaleString("es-AR")}</span>}
                                                {zona.tiempo_estimado_minutos && <span>{zona.tiempo_estimado_minutos} min</span>}
                                            </div>
                                            {/* Estado del polígono */}
                                            <div className="mt-1.5 flex gap-2">
                                                {hasPolygon ? (
                                                    <>
                                                        <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                                                            ✓ Zona dibujada ({zona.polygon_coords!.length} puntos)
                                                        </span>
                                                        <button
                                                            onClick={() => clearPolygon(zona.id)}
                                                            className="text-xs text-gray-400 hover:text-red-500 underline"
                                                        >Borrar</button>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                        ⚠ Sin zona dibujada
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Controles */}
                                    <div className="flex items-center gap-2">
                                        {isDrawing ? (
                                            <div className="flex items-center gap-1">
                                                <button onClick={savePolygon} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-500">✓ Ok</button>
                                                <button onClick={cancelDrawing} className="bg-gray-300 text-gray-700 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-400">✕</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startDrawing(zona.id)}
                                                className="flex items-center gap-1 text-xs text-purple-600 border border-purple-200 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                                            >
                                                <Edit3 size={11} />
                                                {hasPolygon ? "Redibujar" : "Dibujar zona"}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => toggleActivo(zona)}
                                            className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${zona.activo ? "bg-green-500" : "bg-gray-300"}`}
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${zona.activo ? "left-5" : "left-0.5"}`} />
                                        </button>
                                        <button onClick={() => handleDelete(zona.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
