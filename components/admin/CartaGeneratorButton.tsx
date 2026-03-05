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

            // 4. Calc total height needed
            const W = 1080;
            const PADDING_X = 80;
            const NAME_LEFT = PADDING_X;
            const PRICE_RIGHT = W - PADDING_X;
            const ROW_H = 38;
            const CAT_TITLE_H = 55;
            const CAT_GAP = 20;
            const HEADER_H = 220; // logo + name + divider
            const FOOTER_H = 60;

            let totalContentH = HEADER_H;
            for (const cat of filteredCats) {
                totalContentH += CAT_TITLE_H + CAT_GAP;
                totalContentH += cat.productos.length * ROW_H;
                totalContentH += CAT_GAP;
            }
            totalContentH += FOOTER_H;

            // Ensure minimum 9:16 ratio
            const minH = Math.round(W * 16 / 9);
            const H = Math.max(minH, totalContentH);

            const canvas = document.createElement("canvas");
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext("2d")!;

            // Background
            ctx.fillStyle = "#0d0d0d";
            ctx.fillRect(0, 0, W, H);

            // Decorative top gradient
            const grd = ctx.createLinearGradient(0, 0, 0, 300);
            grd.addColorStop(0, "rgba(249,115,22,0.12)");
            grd.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, W, 300);

            let y = 50;

            // 5. Draw logo
            if (suc?.logo_url) {
                try {
                    const logo = await loadImage(suc.logo_url);
                    const logoH = 100;
                    const logoW = (logo.width / logo.height) * logoH;
                    ctx.drawImage(logo, (W - logoW) / 2, y, logoW, logoH);
                    y += logoH + 20;
                } catch {
                    y += 10;
                }
            }

            // Store name
            if (suc?.nombre) {
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 32px 'Arial', sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(suc.nombre.toUpperCase(), W / 2, y);
                y += 15;
            }

            // Divider
            y += 15;
            ctx.strokeStyle = "rgba(255,255,255,0.1)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(PADDING_X, y);
            ctx.lineTo(W - PADDING_X, y);
            ctx.stroke();
            y += 25;

            const fmt = (n: number) => new Intl.NumberFormat("es-AR").format(n);

            // 6. Draw categories and products
            for (const cat of filteredCats) {
                // Category title
                ctx.fillStyle = "#f97316";
                ctx.font = "bold 28px 'Arial', sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(cat.nombre.toUpperCase(), W / 2, y);
                y += 8;

                // Category underline
                const tw = ctx.measureText(cat.nombre.toUpperCase()).width;
                ctx.strokeStyle = "rgba(249,115,22,0.35)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo((W - tw) / 2, y);
                ctx.lineTo((W + tw) / 2, y);
                ctx.stroke();
                y += CAT_GAP;

                // Products
                for (const prod of cat.productos) {
                    const disc = getDiscount(prod.id, cat.id);

                    // Product name (left aligned)
                    ctx.fillStyle = "#e2e8f0";
                    ctx.font = "500 20px 'Arial', sans-serif";
                    ctx.textAlign = "left";
                    ctx.fillText(prod.nombre, NAME_LEFT, y);
                    const nameW = ctx.measureText(prod.nombre).width;

                    // Price (right aligned)
                    let priceEndX: number;
                    if (disc && disc > 0) {
                        const discountedPrice = `$ ${fmt(Math.round(prod.precio * (1 - disc / 100)))}`;

                        // Discounted price right-aligned
                        ctx.fillStyle = "#4ade80";
                        ctx.font = "bold 20px 'Arial', sans-serif";
                        ctx.textAlign = "right";
                        ctx.fillText(discountedPrice, PRICE_RIGHT, y);
                        const dpW = ctx.measureText(discountedPrice).width;

                        // Original price crossed out, left of discounted
                        const originalPrice = `$ ${fmt(prod.precio)}`;
                        ctx.fillStyle = "rgba(255,255,255,0.3)";
                        ctx.font = "500 16px 'Arial', sans-serif";
                        ctx.textAlign = "right";
                        const opX = PRICE_RIGHT - dpW - 12;
                        ctx.fillText(originalPrice, opX, y);
                        const opW = ctx.measureText(originalPrice).width;
                        ctx.strokeStyle = "rgba(255,255,255,0.4)";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(opX - opW, y - 5);
                        ctx.lineTo(opX, y - 5);
                        ctx.stroke();

                        priceEndX = opX - opW - 10;
                    } else {
                        const priceText = `$ ${fmt(prod.precio)}`;
                        ctx.fillStyle = "#ffffff";
                        ctx.font = "bold 20px 'Arial', sans-serif";
                        ctx.textAlign = "right";
                        ctx.fillText(priceText, PRICE_RIGHT, y);
                        const prW = ctx.measureText(priceText).width;
                        priceEndX = PRICE_RIGHT - prW - 10;
                    }

                    // Dotted line between name and price
                    const dotsStartX = NAME_LEFT + nameW + 8;
                    const dotsEndX = priceEndX;
                    if (dotsEndX > dotsStartX + 10) {
                        ctx.setLineDash([2, 5]);
                        ctx.strokeStyle = "rgba(255,255,255,0.12)";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(dotsStartX, y - 5);
                        ctx.lineTo(dotsEndX, y - 5);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                    y += ROW_H;
                }

                y += CAT_GAP;
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
