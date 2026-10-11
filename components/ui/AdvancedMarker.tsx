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
    className?: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
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
    className,
    onMouseEnter,
    onMouseLeave,
}: AdvancedMarkerProps) {
    const map = useGoogleMap();
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

    // Callbacks en refs: evitan recrear el marcador cuando el padre re-renderiza
    const onClickRef = useRef(onClick);
    const onDragEndRef = useRef(onDragEnd);
    const onMouseEnterRef = useRef(onMouseEnter);
    const onMouseLeaveRef = useRef(onMouseLeave);
    const positionRef = useRef(position);
    onClickRef.current = onClick;
    onDragEndRef.current = onDragEnd;
    onMouseEnterRef.current = onMouseEnter;
    onMouseLeaveRef.current = onMouseLeave;
    positionRef.current = position;

    const iconUrl = icon ? (typeof icon === "string" ? icon : icon.url) : undefined;

    useEffect(() => {
        const initialPosition = positionRef.current;
        if (!map || !window.google?.maps?.marker?.AdvancedMarkerElement || !initialPosition) return;

        // Custom content element if needed
        let content: HTMLElement | undefined = undefined;
        if (label || iconUrl || className) {
            content = document.createElement("div");
            if (className) content.className = className;
            
            if (label) {
                content.innerHTML = `<div style="font-size: 20px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); cursor: pointer;">${label}</div>`;
            } else if (iconUrl) {
                content.innerHTML = `<img src="${iconUrl}" style="width: 32px; height: 32px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3)); cursor: pointer;" />`;
            } else {
                // Default pin if only className is provided
                content.innerHTML = `<div style="width: 24px; height: 34px; background-color: #ea4335; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 2px 2px 4px rgba(0,0,0,0.3); border: 2px solid white;"></div>`;
            }
        }

        // Create marker
        const marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: initialPosition,
            title,
            content,
            gmpDraggable: draggable
        });

        markerRef.current = marker;

        // Add listeners
        const clickListener = marker.addListener("gmp-click", () => {
            onClickRef.current?.();
        });

        const handleEnter = () => onMouseEnterRef.current?.();
        const handleLeave = () => onMouseLeaveRef.current?.();
        if (content) {
            content.addEventListener("mouseenter", handleEnter);
            content.addEventListener("mouseleave", handleLeave);
        }

        const dragListener = marker.addListener("dragend", () => {
            if (onDragEndRef.current && marker.position) {
                // AdvancedMarker position can be LatLng or LatLngLiteral
                const pos = marker.position as google.maps.LatLngLiteral;
                onDragEndRef.current({ lat: pos.lat, lng: pos.lng });
            }
        });

        return () => {
            if (clickListener) clickListener.remove();
            if (dragListener) dragListener.remove();
            if (content) {
                content.removeEventListener("mouseenter", handleEnter);
                content.removeEventListener("mouseleave", handleLeave);
            }
            marker.map = null;
            markerRef.current = null;
        };
    }, [map, title, draggable, label, iconUrl, className]); // Re-create only if visual props change

    // Efficiently update position without re-creating the marker
    useEffect(() => {
        if (markerRef.current && position) {
            markerRef.current.position = position;
        }
    }, [position?.lat, position?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

    return <>{children}</>;
}
