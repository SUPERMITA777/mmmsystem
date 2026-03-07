"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF, PolygonF } from "@react-google-maps/api";

type PedidoMapCoords = {
    id: string;
    numero_pedido: string;
    estado: string;
    cliente_nombre: string;
    cliente_lat: number | null;
    cliente_lng: number | null;
    total: number;
};

type ZonaData = {
    id: string;
    nombre: string;
    activo: boolean;
    polygon_coords: { lat: number; lng: number }[] | null;
};

const mapContainerStyle = {
    width: "100%",
    height: "100%",
};

const ZONA_COLORS = ["#8b5cf6", "#ef4444", "#f59e0b", "#10b981", "#3b82f6"];

// Definimos las librerías necesarias fuera del componente para evitar re-cargas innecesarias
const libraries: ("places" | "marker" | "drawing" | "geometry")[] = ["marker", "geometry"];

export default function PanelPedidosMap({
    pedidos,
    selectedPedidoId,
    onSelectPedido
}: {
    pedidos: PedidoMapCoords[];
    selectedPedidoId: string | null;
    onSelectPedido?: (id: string) => void;
}) {
    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        language: 'es',
        region: 'ar',
        libraries
    });

    const [storePos, setStorePos] = useState<{ lat: number; lng: number } | null>(null);
    const [zonas, setZonas] = useState<ZonaData[]>([]);
    const [activeInfoWindow, setActiveInfoWindow] = useState<string | null>(null);

    useEffect(() => {
        async function fetchStoreData() {
            const { data: suc } = await supabase.from("sucursales").select("id").limit(1).single();
            if (!suc) return;
            const { data: cfg } = await supabase
                .from("config_sucursal")
                .select("local_lat, local_lng")
                .eq("sucursal_id", suc.id)
                .limit(1)
                .maybeSingle();
            if (cfg?.local_lat && cfg?.local_lng) {
                setStorePos({ lat: cfg.local_lat, lng: cfg.local_lng });
            }
            const { data: zonasData } = await supabase
                .from("zonas_entrega")
                .select("id, nombre, activo, polygon_coords")
                .eq("sucursal_id", suc.id)
                .eq("activo", true);
            setZonas(zonasData || []);
        }
        fetchStoreData();
    }, []);

    const validPedidos = useMemo(() =>
        pedidos.filter(p => p.cliente_lat != null && p.cliente_lng != null),
        [pedidos]);

    const defaultCenter = useMemo(() => {
        if (storePos) return storePos;
        if (validPedidos.length > 0) {
            return {
                lat: validPedidos[0].cliente_lat as number,
                lng: validPedidos[0].cliente_lng as number
            };
        }
        return { lat: -34.6037, lng: -58.3816 }; // Buenos Aires
    }, [storePos, validPedidos]);

    const [map, setMap] = useState<google.maps.Map | null>(null);

    const onLoad = useCallback(function callback(map: google.maps.Map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map: google.maps.Map) {
        setMap(null);
    }, []);

    useEffect(() => {
        if (map && selectedPedidoId) {
            const pedido = validPedidos.find(p => p.id === selectedPedidoId);
            if (pedido?.cliente_lat && pedido?.cliente_lng) {
                map.panTo({ lat: pedido.cliente_lat, lng: pedido.cliente_lng });
                setActiveInfoWindow(pedido.id);
            }
        }
    }, [selectedPedidoId, map, validPedidos]);

    if (loadError) return <div className="w-full h-full bg-red-50 flex items-center justify-center text-red-500 text-sm">Error al cargar Google Maps: {loadError.message}</div>;
    if (!isLoaded) return <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-400 text-sm">Cargando Google Maps...</div>;

    return (
        <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={13}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
                disableDefaultUI: false,
                clickableIcons: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
                // ID de mapa opcional si usas Advanced Markers con estilos personalizados en la consola
                // mapId: "YOUR_MAP_ID",
                styles: [
                    {
                        featureType: "poi",
                        elementType: "labels",
                        stylers: [{ visibility: "off" }]
                    }
                ]
            }}
        >
            {/* Active delivery zones */}
            {zonas.map((zona, idx) =>
                zona.polygon_coords && zona.polygon_coords.length >= 3 ? (
                    <PolygonF
                        key={zona.id}
                        paths={zona.polygon_coords}
                        options={{
                            fillColor: ZONA_COLORS[idx % ZONA_COLORS.length],
                            fillOpacity: 0.1,
                            strokeColor: ZONA_COLORS[idx % ZONA_COLORS.length],
                            strokeOpacity: 0.8,
                            strokeWeight: 2,
                        }}
                    />
                ) : null
            )}

            {/* Store marker */}
            {storePos && (
                <MarkerF
                    position={storePos}
                    label={{
                        text: "🏪",
                        fontSize: "20px"
                    }}
                    title="MMM Pizza Artesanal"
                />
            )}

            {/* Order markers */}
            {validPedidos.map((p) => (
                <MarkerF
                    key={p.id}
                    position={{ lat: p.cliente_lat as number, lng: p.cliente_lng as number }}
                    onClick={() => {
                        onSelectPedido?.(p.id);
                        setActiveInfoWindow(p.id);
                    }}
                    icon={selectedPedidoId === p.id ? {
                        url: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png"
                    } : undefined}
                >
                    {(activeInfoWindow === p.id || selectedPedidoId === p.id) && (
                        <InfoWindowF
                            onCloseClick={() => setActiveInfoWindow(null)}
                            position={{ lat: p.cliente_lat as number, lng: p.cliente_lng as number }}
                        >
                            <div className="text-center min-w-[120px] p-1">
                                <p className="font-bold text-gray-900 border-b pb-1 mb-1 m-0">N° {p.numero_pedido.split('-').pop()}</p>
                                <p className="text-sm m-0 leading-tight font-medium text-gray-700">{p.cliente_nombre}</p>
                                <p className="text-xs text-gray-500 font-bold m-0 mt-1 uppercase">
                                    ${new Intl.NumberFormat("es-AR").format(p.total)} • {p.estado}
                                </p>
                            </div>
                        </InfoWindowF>
                    )}
                </MarkerF>
            ))}
        </GoogleMap>
    );
}

