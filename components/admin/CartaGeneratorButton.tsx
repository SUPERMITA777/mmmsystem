"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FileImage, Loader2 } from "lucide-react";

export default function CartaGeneratorButton({ sucursalId }: { sucursalId: string }) {
    const [generating, setGenerating] = useState(false);

    async function generateCarta() {
        setGenerating(true);
        try {
            // 1. Fetch logo
            const { data: suc } = await supabase.from("sucursales").select("nombre, logo_url").eq("id", sucursalId).single();

            // 2. Fetch categories with products
            const { data: cats } = await supabase
                .from("categorias")
                .select(`id, nombre, productos (id, nombre, precio, activo, visible_en_menu, producto_oculto, orden)`)
                .eq("activo", true)
                .order("orden", { ascending: true });

            if (!cats) { alert("No hay datos para generar la carta."); return; }

            const filteredCats = cats
                .map((cat: any) => ({
                    ...cat,
                    productos: (cat.productos || [])
                        .filter((p: any) => p.activo && p.visible_en_menu && !p.producto_oculto)
                        .sort((a: any, b: any) => (a.orden ?? 999) - (b.orden ?? 999))
                }))
                .filter((cat: any) => cat.productos.length > 0);

            // 3. Fetch active discounts
            const { data: descs } = await supabase.from("descuentos").select("*").eq("activo", true);

            function getDiscount(prodId: string, catId: string) {
                if (!descs) return null;
                const d = descs.find((x: any) => x.aplicar_a === 'producto' && x.producto_id === prodId)
                    || descs.find((x: any) => x.aplicar_a === 'categoria' && x.categoria_id === catId)
                    || descs.find((x: any) => x.aplicar_a === 'general');
                if (!d) return null;
                if (d.tipo === 'porcentaje') return d.valor;
                return null;
            }

            // 4. Canvas setup (9:16 ratio)
            const W = 1080;
            const H = 1920;
            const canvas = document.createElement("canvas");
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext("2d")!;

            // Background
            ctx.fillStyle = "#0d0d0d";
            ctx.fillRect(0, 0, W, H);

            // Decorative top gradient
            const grd = ctx.createLinearGradient(0, 0, 0, 300);
            grd.addColorStop(0, "rgba(249,115,22,0.15)");
            grd.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, W, 300);

            let y = 60;

            // 5. Draw logo
            if (suc?.logo_url) {
                try {
                    const logo = await loadImage(suc.logo_url);
                    const logoH = 120;
                    const logoW = (logo.width / logo.height) * logoH;
                    ctx.drawImage(logo, (W - logoW) / 2, y, logoW, logoH);
                    y += logoH + 30;
                } catch {
                    y += 20;
                }
            }

            // Store name
            if (suc?.nombre) {
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 36px 'Arial', sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(suc.nombre.toUpperCase(), W / 2, y);
                y += 20;
            }

            // Divider
            y += 20;
            ctx.strokeStyle = "rgba(255,255,255,0.1)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(80, y);
            ctx.lineTo(W - 80, y);
            ctx.stroke();
            y += 30;

            const fmt = (n: number) => new Intl.NumberFormat("es-AR").format(n);

            // 6. Draw categories and products
            for (const cat of filteredCats) {
                // Check if we need a new "page" (won't overflow)
                const neededHeight = 60 + cat.productos.length * 42;
                if (y + neededHeight > H - 80) {
                    // Stop drawing — won't fit
                    ctx.fillStyle = "rgba(255,255,255,0.3)";
                    ctx.font = "italic 20px 'Arial', sans-serif";
                    ctx.textAlign = "center";
                    ctx.fillText("... continúa", W / 2, H - 50);
                    break;
                }

                // Category title
                ctx.fillStyle = "#f97316";
                ctx.font = "bold 32px 'Arial', sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(cat.nombre.toUpperCase(), W / 2, y);
                y += 12;

                // Category underline
                const tw = ctx.measureText(cat.nombre.toUpperCase()).width;
                ctx.strokeStyle = "rgba(249,115,22,0.4)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo((W - tw) / 2, y);
                ctx.lineTo((W + tw) / 2, y);
                ctx.stroke();
                y += 25;

                // Products
                for (const prod of cat.productos) {
                    const disc = getDiscount(prod.id, cat.id);

                    // Product name (left aligned)
                    ctx.fillStyle = "#e2e8f0";
                    ctx.font = "500 22px 'Arial', sans-serif";
                    ctx.textAlign = "left";
                    ctx.fillText(prod.nombre, 100, y);

                    // Price (right aligned)
                    if (disc && disc > 0) {
                        const originalPrice = `$ ${fmt(prod.precio)}`;
                        const discountedPrice = `$ ${fmt(Math.round(prod.precio * (1 - disc / 100)))}`;

                        // Original price crossed out
                        ctx.fillStyle = "rgba(255,255,255,0.3)";
                        ctx.font = "500 18px 'Arial', sans-serif";
                        ctx.textAlign = "right";
                        const opW = ctx.measureText(originalPrice).width;
                        ctx.fillText(originalPrice, W - 200, y);
                        ctx.strokeStyle = "rgba(255,255,255,0.4)";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(W - 200 - opW, y - 6);
                        ctx.lineTo(W - 200, y - 6);
                        ctx.stroke();

                        // Discounted price
                        ctx.fillStyle = "#4ade80";
                        ctx.font = "bold 22px 'Arial', sans-serif";
                        ctx.textAlign = "right";
                        ctx.fillText(discountedPrice, W - 100, y);
                    } else {
                        ctx.fillStyle = "#ffffff";
                        ctx.font = "bold 22px 'Arial', sans-serif";
                        ctx.textAlign = "right";
                        ctx.fillText(`$ ${fmt(prod.precio)}`, W - 100, y);
                    }

                    // Dotted line between name and price
                    ctx.setLineDash([2, 4]);
                    ctx.strokeStyle = "rgba(255,255,255,0.08)";
                    ctx.lineWidth = 1;
                    const nameW = ctx.measureText(prod.nombre).width;
                    ctx.beginPath();
                    ctx.moveTo(110 + nameW, y - 6);
                    ctx.lineTo(W - 220, y - 6);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    y += 42;
                }

                y += 25; // spacing between categories
            }

            // 7. Download
            const link = document.createElement("a");
            link.download = `carta-${suc?.nombre || 'menu'}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch (err) {
            console.error("Error generating carta:", err);
            alert("Error al generar la carta");
        } finally {
            setGenerating(false);
        }
    }

    function loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    return (
        <button
            onClick={generateCarta}
            disabled={generating}
            className="flex items-center gap-2 px-3 py-2 text-orange-600 hover:text-orange-800 text-sm transition-colors font-semibold disabled:opacity-50"
        >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <FileImage size={15} />}
            CARTA
        </button>
    );
}
