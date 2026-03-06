"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

export default function PanelPedidosMap({
    pedidos,
    selectedPedidoId,
    onSelectPedido
}: {
    pedidos: PedidoMapCoords[];
    selectedPedidoId: string | null;
    onSelectPedido?: (id: string) => void;
}) {
    const { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } = require("react-leaflet");
    const L = require("leaflet");

    const [storePos, setStorePos] = useState<{ lat: number; lng: number } | null>(null);
    const [zonas, setZonas] = useState<ZonaData[]>([]);

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

    const customIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
    });

    const purpleIcon = L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const storeIcon = L.divIcon({
        html: `<div style="background:#7B1FA2;width:32px;height:32px;border-radius:50%;border:3px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.4)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        className: "",
    });

    const validPedidos = pedidos.filter(p => p.cliente_lat != null && p.cliente_lng != null);

    const defaultCenter: [number, number] = storePos
        ? [storePos.lat, storePos.lng]
        : validPedidos.length > 0
            ? [validPedidos[0].cliente_lat as number, validPedidos[0].cliente_lng as number]
            : [-34.6037, -58.3816];

    const ZONA_COLORS = ["#8b5cf6", "#ef4444", "#f59e0b", "#10b981", "#3b82f6"];

    function MapUpdater({ center }: { center: [number, number] }) {
        const map = useMap();
        useEffect(() => {
            map.setView(center, map.getZoom());
        }, [center, map]);
        return null;
    }

    return (
        <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ width: "100%", height: "100%", zIndex: 0 }}
        >
            <MapUpdater center={defaultCenter} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            {/* Active delivery zones */}
            {zonas.map((zona, idx) =>
                zona.polygon_coords && zona.polygon_coords.length >= 3 ? (
                    <Polygon
                        key={zona.id}
                        positions={zona.polygon_coords.map((p: any) => [p.lat, p.lng])}
                        pathOptions={{
                            color: ZONA_COLORS[idx % ZONA_COLORS.length],
                            fillColor: ZONA_COLORS[idx % ZONA_COLORS.length],
                            fillOpacity: 0.1,
                            weight: 2,
                            dashArray: "6 4",
                        }}
                    />
                ) : null
            )}

            {/* Store marker */}
            {storePos && (
                <Marker position={[storePos.lat, storePos.lng]} icon={storeIcon}>
                    <Popup>
                        <div className="text-center font-bold text-gray-900">🏪 MMM Pizza Artesanal</div>
                    </Popup>
                </Marker>
            )}

            {/* Order markers */}
            {validPedidos.map((p: any) => (
                <Marker
                    key={p.id}
                    position={[p.cliente_lat, p.cliente_lng]}
                    icon={selectedPedidoId === p.id ? purpleIcon : customIcon}
                    eventHandlers={{
                        click: () => onSelectPedido && onSelectPedido(p.id)
                    }}
                >
                    <Popup>
                        <div className="text-center min-w-[120px]">
                            <p className="font-bold text-gray-900 border-b pb-1 mb-1 m-0">{p.numero_pedido}</p>
                            <p className="text-sm m-0 leading-tight">{p.cliente_nombre}</p>
                            <p className="text-xs text-gray-500 font-bold m-0 mt-1 uppercase">
                                ${new Intl.NumberFormat("es-AR").format(p.total)} • {p.estado}
                            </p>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}

