"use client";

import React, { useEffect, useRef, useState } from "react";

interface Segment {
  id: string;
  nombre: string;
  color: string;
  imagen_url?: string;
}

interface RuletaWheelProps {
  segments: Segment[];
  winnerIndex: number | null;
  onFinished: () => void;
  spinning: boolean;
}

export const RuletaWheel: React.FC<RuletaWheelProps> = ({
  segments,
  winnerIndex,
  onFinished,
  spinning,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Guardamos las imágenes cargadas para evitar recargas constantes
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    // Pre-cargar imágenes
    segments.forEach(seg => {
      if (seg.imagen_url && !imagesRef.current[seg.imagen_url]) {
        const img = new Image();
        img.src = seg.imagen_url;
        img.crossOrigin = "anonymous";
        img.onload = () => {
          imagesRef.current[seg.imagen_url!] = img;
          drawWheel();
        };
      }
    });
    drawWheel();
  }, [segments, rotation]);

  useEffect(() => {
    if (spinning && !isAnimating && winnerIndex !== null) {
      startSpin();
    }
  }, [spinning, winnerIndex]);

  const startSpin = () => {
    setIsAnimating(true);
    
    const segmentAngle = 360 / segments.length;
    // El punto de flecha está arriba (270 grados en canvas ordinario, o 0 si rotamos el canvas)
    // Para que el ganador quede arriba:
    // Destino = vueltas completas + compensación de segmento + offset random dentro del segmento
    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const winnerAngle = 360 - (winnerIndex * segmentAngle) - (segmentAngle / 2);
    const totalRotation = rotation + (extraSpins * 360) + winnerAngle - (rotation % 360);
    
    let startTimestamp: number | null = null;
    const duration = 5000; // 5 segundos de giro

    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = timestamp - startTimestamp;
      const t = Math.min(progress / duration, 1);
      
      // Función de easing: easeOutQuart
      const easeOut = 1 - Math.pow(1 - t, 4);
      const currentRotation = rotation + (totalRotation - rotation) * easeOut;
      
      setRotation(currentRotation);
      
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        onFinished();
      }
    };

    requestAnimationFrame(animate);
  };

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 40; // Espacio para el borde (masa)
    const numSegments = segments.length;
    const angleStep = (Math.PI * 2) / numSegments;

    ctx.clearRect(0, 0, size, size);
    
    // 1. Dibujar el Borde (MASA / CRUST)
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius + 25, 0, Math.PI * 2);
    // Gradiente para la masa horneada
    const crustGrad = ctx.createRadialGradient(center, center, radius + 5, center, center, radius + 25);
    crustGrad.addColorStop(0, "#D2691E"); // Chocolate/Brown
    crustGrad.addColorStop(0.5, "#E3A857"); // Golden
    crustGrad.addColorStop(1, "#8B4513"); // SaddleBrown (borde quemadito)
    ctx.fillStyle = crustGrad;
    ctx.fill();
    // Sombras de la maza
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 2. Dibujar las Porciones
    segments.forEach((seg, i) => {
      const startAngle = i * angleStep + (rotation * Math.PI) / 180;
      const endAngle = startAngle + angleStep;

      // Dibujar rebanada de pizza
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      
      // Fondo Queso/Salsa (Predomina el amarillo pizza)
      const sliceGrad = ctx.createRadialGradient(center, center, radius * 0.2, center, center, radius);
      sliceGrad.addColorStop(0, "#D32F2F"); // Salsa de tomate al centro
      sliceGrad.addColorStop(0.2, "#FFC107"); // Queso Mozzarella
      sliceGrad.addColorStop(1, "#FFD54F"); // Queso más dorado al borde
      ctx.fillStyle = sliceGrad;
      ctx.fill();
      
      // Borde de la porción (un poco de salsa saliendo)
      ctx.strokeStyle = "rgba(139, 69, 19, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // 3. Toppings (Pepperoni)
      // Dibujamos 3 pepperonis por porción en posiciones "pseudo-aleatorias" fijas
      const pepperoniColor = "#B71C1C";
      const drawPepperoni = (dist: number, angOffset: number, rad: number) => {
        const pAngle = startAngle + angleStep * angOffset;
        const px = center + Math.cos(pAngle) * (radius * dist);
        const py = center + Math.sin(pAngle) * (radius * dist);
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fillStyle = pepperoniColor;
        ctx.fill();
        // Brillo del pepperoni
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.stroke();
      };

      drawPepperoni(0.4, 0.5, 12);
      drawPepperoni(0.7, 0.3, 15);
      drawPepperoni(0.7, 0.7, 14);

      // 3.1 Toppings extra (Oregano/Albahaca)
      const herbColor = "#2E7D32";
      const drawHerb = (dist: number, angOffset: number) => {
        const hAngle = startAngle + angleStep * angOffset;
        const hx = center + Math.cos(hAngle) * (radius * dist);
        const hy = center + Math.sin(hAngle) * (radius * dist);
        ctx.beginPath();
        ctx.arc(hx, hy, 2, 0, Math.PI * 2);
        ctx.fillStyle = herbColor;
        ctx.fill();
      };
      drawHerb(0.3, 0.2);
      drawHerb(0.5, 0.8);
      drawHerb(0.6, 0.4);

      // 4. Contenido (Texto o Imagen)
      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + angleStep / 2);
      
      const textX = radius * 0.65;
      
      if (seg.imagen_url && imagesRef.current[seg.imagen_url]) {
        const img = imagesRef.current[seg.imagen_url];
        const imgSize = 45;
        // Sombra de la imagen para que resalte sobre el queso
        ctx.shadowColor = "rgba(0,0,0,0.3)";
        ctx.shadowBlur = 10;
        ctx.drawImage(img, textX - imgSize/2, -imgSize/2, imgSize, imgSize);
      } else {
        ctx.fillStyle = "#5D4037"; // Color madera/quemado para el texto
        ctx.font = "black 14px 'Outfit', sans-serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(255,255,255,0.5)";
        ctx.shadowBlur = 4;
        const label = seg.nombre.length > 15 ? seg.nombre.substring(0, 12) + "..." : seg.nombre;
        ctx.fillText(label, radius - 20, 0);
      }
      
      ctx.restore();
      ctx.restore();
    });

    // 5. Centro (Aceituna o Eje decorativo)
    ctx.beginPath();
    ctx.arc(center, center, 25, 0, Math.PI * 2);
    ctx.fillStyle = "#212121"; // Aceituna negra
    ctx.fill();
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Brillo de la aceituna
    ctx.beginPath();
    ctx.arc(center - 5, center - 5, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fill();

    // 6. Flecha indicadora (Cubierto / Cuchillo)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(center - 20, 10);
    ctx.lineTo(center + 20, 10);
    ctx.lineTo(center, 50);
    ctx.closePath();
    ctx.fillStyle = "#E0E0E0"; // Acero
    ctx.fill();
    ctx.strokeStyle = "#9E9E9E";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  };


  return (
    <div className="relative w-full aspect-square max-w-[400px] mx-auto">
      <canvas
        ref={canvasRef}
        width={800}
        height={800}
        className="w-full h-full drop-shadow-2xl"
      />
    </div>
  );
};
