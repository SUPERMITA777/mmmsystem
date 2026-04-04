"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X, Loader2 } from "lucide-react";
import { GoogleMap, HeatmapLayer, useJsApiLoader } from "@react-google-maps/api";

const libraries: ("geometry" | "visualization")[] = ["geometry", "visualization"];

export default function HeatmapModal({ sucursalId, onClose }: { sucursalId: string, onClose: () => void }) {
    const [pedidosCoords, setPedidosCoords] = useState<{lat: number, lng: number}[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    const { isLoaded, loadError } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        language: 'es',
        region: 'ar',
        libraries,
    });

    useEffect(() => {
        if (sucursalId) {
            fetchHeatmapData();
        }
    }, [sucursalId]);

    async function fetchHeatmapData() {
        setLoadingData(true);
        try {
            const { data, error } = await supabase
                .from("pedidos")
                .select("cliente_lat, cliente_lng")
                .eq("sucursal_id", sucursalId)
                .eq("tipo", "delivery")
                .not("cliente_lat", "is", null)
                .not("cliente_lng", "is", null);
            
            if (error) throw error;
            
            if (data) {
                setPedidosCoords(data.map(p => ({ lat: p.cliente_lat, lng: p.cliente_lng })));
            }
        } catch (error) {
            console.error("Error fetching heatmap data:", error);
        } finally {
            setLoadingData(false);
        }
    }

    const heatmapData = useMemo(() => {
        if (!isLoaded || pedidosCoords.length === 0 || typeof window === 'undefined' || !window.google) return [];
        return pedidosCoords.map(c => new window.google.maps.LatLng(c.lat, c.lng));
    }, [isLoaded, pedidosCoords]);

    const center = useMemo(() => {
        if (pedidosCoords.length === 0) return { lat: -34.7891, lng: -58.2612 }; // Default Varela
        return { lat: pedidosCoords[0].lat, lng: pedidosCoords[0].lng };
    }, [pedidosCoords]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Mapa de Calor de Entregas</h2>
                        <p className="text-sm text-gray-500">Zonas con mayor concentración de pedidos ({pedidosCoords.length} entregas mapeadas)</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 relative bg-gray-100">
                    {loadingData || !isLoaded ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                        </div>
                    ) : loadError ? (
                        <div className="absolute inset-0 flex items-center justify-center text-red-500">
                            Error al cargar Google Maps
                        </div>
                    ) : (
                        <GoogleMap
                            mapContainerStyle={{ width: "100%", height: "100%" }}
                            center={center}
                            zoom={13}
                            options={{
                                streetViewControl: false,
                                mapTypeControl: false,
                            }}
                        >
                            {heatmapData.length > 0 && (
                                <HeatmapLayer
                                    data={heatmapData}
                                    options={{
                                        radius: 20,
                                        opacity: 1,
                                    }}
                                />
                            )}
                        </GoogleMap>
                    )}
                </div>
            </div>
        </div>
    );
}
