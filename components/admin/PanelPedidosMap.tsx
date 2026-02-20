"use client";

import { useEffect, useState } from "react";

type PedidoMapCoords = {
    id: string;
    numero_pedido: string;
    estado: string;
    cliente_nombre: string;
    cliente_lat: number | null;
    cliente_lng: number | null;
    total: number;
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
    // Dynamic import to avoid SSR issues
    const { MapContainer, TileLayer, Marker, Popup } = require("react-leaflet");
    const L = require("leaflet");

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

    const validPedidos = pedidos.filter(p => p.cliente_lat != null && p.cliente_lng != null);

    const defaultCenter: [number, number] = validPedidos.length > 0
        ? [validPedidos[0].cliente_lat as number, validPedidos[0].cliente_lng as number]
        : [-34.6037, -58.3816];

    return (
        <MapContainer
            center={defaultCenter}
            zoom={13}
            style={{ width: "100%", height: "100%", zIndex: 0 }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

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
