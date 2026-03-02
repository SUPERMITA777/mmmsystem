"use client";

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { X, ZoomIn, ZoomOut, RotateCcw, Grid, Check } from "lucide-react";

interface ImageCropperModalProps {
    isOpen: boolean;
    imageSrc: string;
    aspectRatio?: number;
    onCropComplete: (croppedBlob: Blob) => void;
    onClose: () => void;
    title?: string;
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = imageSrc;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas context");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas toBlob failed"));
            },
            "image/jpeg",
            0.92
        );
    });
}

export default function ImageCropperModal({
    isOpen,
    imageSrc,
    aspectRatio = 1,
    onCropComplete,
    onClose,
    title = "Recortar imagen",
}: ImageCropperModalProps) {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [showGrid, setShowGrid] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const onCropChange = useCallback((crop: Point) => setCrop(crop), []);
    const onZoomChange = useCallback((zoom: number) => setZoom(zoom), []);

    const onCropAreaComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    async function handleConfirm() {
        if (!croppedAreaPixels) return;
        setIsSaving(true);
        try {
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropComplete(croppedBlob);
        } catch (error) {
            console.error("Error cropping image:", error);
            alert("Error al recortar la imagen");
        } finally {
            setIsSaving(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Cropper Area */}
                <div className="relative w-full bg-slate-900" style={{ height: "420px" }}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={aspectRatio}
                        onCropChange={onCropChange}
                        onZoomChange={onZoomChange}
                        onCropComplete={onCropAreaComplete}
                        showGrid={showGrid}
                        style={{
                            containerStyle: { background: "#0f172a" },
                            cropAreaStyle: {
                                border: "2px solid rgba(168, 85, 247, 0.8)",
                                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                            },
                        }}
                    />

                    {/* Grid overlay on crop area */}
                    {showGrid && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            {/* The grid is shown by react-easy-crop's showGrid prop */}
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="px-6 py-4 bg-slate-50 space-y-3">
                    {/* Zoom slider */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setZoom(Math.max(1, zoom - 0.1))}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Alejar"
                        >
                            <ZoomOut size={18} />
                        </button>
                        <div className="flex-1 relative">
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.01}
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                            />
                            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5 px-0.5">
                                <span>1x</span>
                                <span>{zoom.toFixed(1)}x</span>
                                <span>3x</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Acercar"
                        >
                            <ZoomIn size={18} />
                        </button>
                    </div>

                    {/* Action buttons row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setRotation((r) => (r + 90) % 360)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                                title="Rotar"
                            >
                                <RotateCcw size={14} />
                                Rotar
                            </button>
                            <button
                                onClick={() => setShowGrid(!showGrid)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${showGrid
                                    ? "bg-purple-100 text-purple-700"
                                    : "text-slate-600 hover:bg-slate-200"
                                    }`}
                                title="Cuadrícula"
                            >
                                <Grid size={14} />
                                Cuadrícula
                            </button>
                            <button
                                onClick={() => {
                                    setCrop({ x: 0, y: 0 });
                                    setZoom(1);
                                    setRotation(0);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Resetear
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-6 py-2.5 text-red-600 font-bold hover:bg-red-50 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-white font-bold transition-all shadow-lg ${isSaving
                            ? "bg-slate-400 cursor-not-allowed"
                            : "bg-slate-950 hover:bg-slate-800 shadow-slate-950/20 active:scale-95"
                            }`}
                    >
                        <Check size={16} />
                        {isSaving ? "Procesando..." : "Aplicar recorte"}
                    </button>
                </div>
            </div>
        </div>
    );
}
