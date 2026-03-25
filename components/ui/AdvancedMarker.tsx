"use client";

import { useEffect, useRef } from "react";
import { useGoogleMap } from "@react-google-maps/api";

interface AdvancedMarkerProps {
    position: google.maps.LatLngLiteral;
    title?: string;
    onClick?: () => void;
    onDragEnd?: (latlng: { lat: number; lng: number }) => void;
    draggable?: boolean;
    children?: React.ReactNode;
    // content can be a string (emoji) or a React component
    label?: string;
    icon?: string | { url: string };
}

export default function AdvancedMarker({
    position,
    title,
    onClick,
    onDragEnd,
    draggable,
    children,
    label,
    icon,
}: AdvancedMarkerProps) {
    const map = useGoogleMap();
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

    useEffect(() => {
        if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement || !position) return;

        // Custom content element if needed
        let content: HTMLElement | undefined = undefined;
        if (label || icon) {
            content = document.createElement("div");
            if (label) {
                content.innerHTML = `<div style="font-size: 20px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); cursor: pointer;">${label}</div>`;
            } else if (icon) {
                const iconUrl = typeof icon === "string" ? icon : icon.url;
                content.innerHTML = `<img src="${iconUrl}" style="width: 32px; height: 32px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); cursor: pointer;" />`;
            }
        }

        // Create marker
        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position,
            title,
            content,
            gmpDraggable: draggable
        });

        markerRef.current = marker;

        // Add listeners
        const clickListener = marker.addListener("click", () => {
            if (onClick) onClick();
        });

        const dragListener = marker.addListener("dragend", (e: any) => {
            if (onDragEnd && marker.position) {
                // AdvancedMarker position can be LatLng or LatLngLiteral
                const pos = marker.position as google.maps.LatLngLiteral;
                onDragEnd({ lat: pos.lat, lng: pos.lng });
            }
        });

        return () => {
            if (clickListener) clickListener.remove();
            if (dragListener) dragListener.remove();
            marker.map = null;
        };
    }, [map, title, onClick, onDragEnd, draggable, label, icon]); // Re-create if these change

    // Efficiently update position without re-creating the marker
    useEffect(() => {
        if (markerRef.current && position) {
            markerRef.current.position = position;
        }
    }, [position]);

    return null;
}
