export interface WhatsAppOrderAdicional {
    nombre: string;
    precio?: number;
    cantidad?: number;
}

export interface WhatsAppOrderItem {
    nombre: string;
    cantidad: number;
    precioUnitario: number; // Precio unitario base (sin adicionales)
    categoriaNombre?: string;
    adicionales?: WhatsAppOrderAdicional[];
    notas?: string;
}

export interface WhatsAppOrderMessageParams {
    numeroPedido: string;
    tipo: "delivery" | "takeaway" | "salon" | string;
    clienteNombre: string;
    clienteTelefono?: string | null;
    clienteDireccion?: string | null;
    items: WhatsAppOrderItem[];
    subtotal: number;
    costoEnvio?: number;
    envioGratis?: boolean;
    propina?: number;
    descuento?: number;
    recargo?: number;
    total: number;
    metodoPago: string;
    abonaCon?: string;
}

/**
 * Normaliza un número telefónico para enlaces wa.me (prefijo 54 para Argentina si falta).
 */
export function formatWhatsAppPhone(telefono?: string | null): string | null {
    if (!telefono) return null;
    const rawPhone = telefono.replace(/\D/g, "");
    if (!rawPhone || rawPhone === "0000000000" || rawPhone.length < 6) return null;
    return rawPhone.startsWith("54") ? rawPhone : `54${rawPhone}`;
}

function formatDisplayPhone(telefono?: string | null): string {
    const trimmed = (telefono || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("+")) return trimmed;
    const digits = trimmed.replace(/\D/g, "");
    if (digits.startsWith("54")) return `+${digits}`;
    return `+54 ${trimmed}`;
}

/**
 * Genera el texto del resumen de pedido para WhatsApp con el formato estándar del local,
 * incluyendo el detalle del costo de envío y eventuales descuentos/recargos/propinas.
 */
export function buildWhatsAppOrderMessage(params: WhatsAppOrderMessageParams): string {
    const fmt = (n: number) => new Intl.NumberFormat("es-AR").format(n);

    const groupedByCategory = params.items.reduce<Record<string, WhatsAppOrderItem[]>>((acc, item) => {
        const cat = (item.categoriaNombre || "").trim() || "PRODUCTOS";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    const itemsTexto = Object.entries(groupedByCategory).map(([cat, catItems]) => {
        const catHeader = `*${cat.toUpperCase()}:*`;
        const productsText = catItems.map((i) => {
            const groupedAds = (i.adicionales || []).reduce<Record<string, { precio: number; qty: number }>>((acc, a) => {
                const qty = a.cantidad && a.cantidad > 0 ? a.cantidad : 1;
                if (!acc[a.nombre]) acc[a.nombre] = { precio: 0, qty: 0 };
                acc[a.nombre].qty += qty;
                acc[a.nombre].precio += Number(a.precio || 0) * qty;
                return acc;
            }, {});
            const ads = Object.entries(groupedAds)
                .map(([nombre, data]) => `  + ${data.qty > 1 ? `${nombre} x ${data.qty}` : nombre} (+$${fmt(data.precio)})`)
                .join("\n");
            const notaLimpia = i.notas?.trim();
            const notaTexto = notaLimpia ? `\n  ⚠️ NOTA: ${notaLimpia}` : "";
            return `• ${i.cantidad}x ${i.nombre} - $${fmt(i.precioUnitario * i.cantidad)}${ads ? `\n${ads}` : ""}${notaTexto}`;
        }).join("\n");
        return `${catHeader}\n${productsText}`;
    }).join("\n\n");

    const tipoLabel =
        params.tipo === "delivery"
            ? "Delivery"
            : params.tipo === "takeaway"
                ? "Take Away"
                : "Salón";

    const displayPhone = formatDisplayPhone(params.clienteTelefono);
    const costoEnvio = Number(params.costoEnvio || 0);
    const descuento = Number(params.descuento || 0);
    const recargo = Number(params.recargo || 0);
    const propina = Number(params.propina || 0);

    const abonaSuffix = params.abonaCon?.trim() ? ` (con $${params.abonaCon.trim()})` : "";
    const pagoText = `${params.metodoPago || "Efectivo"}${abonaSuffix}`;

    const envioLinea =
        params.tipo === "delivery" && costoEnvio > 0
            ? `*Envío:* $${fmt(costoEnvio)}\n`
            : params.tipo === "delivery" && costoEnvio === 0 && params.envioGratis === true
                ? `*Envío:* Gratis\n`
                : "";

    return (
        `🍕 *NUEVO PEDIDO*\n\n` +
        `*ID:* ${params.numeroPedido}\n` +
        `*Tipo:* ${tipoLabel}\n` +
        `*Cliente:* ${params.clienteNombre || "Consumidor Final"}\n` +
        (displayPhone ? `*Teléfono:* ${displayPhone}\n` : "") +
        (params.tipo === "delivery" && params.clienteDireccion ? `*Dirección:* ${params.clienteDireccion}\n` : "") +
        `\n${itemsTexto}\n\n` +
        `*Subtotal:* $${fmt(params.subtotal)}\n` +
        envioLinea +
        (descuento > 0 ? `*Descuento:* -$${fmt(descuento)}\n` : "") +
        (recargo > 0 ? `*Recargo:* $${fmt(recargo)}\n` : "") +
        (propina > 0 ? `*Propina:* $${fmt(propina)}\n` : "") +
        `*Total:* $${fmt(params.total)}\n` +
        `*Pago:* ${pagoText}`
    );
}

/**
 * Construye el enlace https://wa.me/... con el detalle completo del pedido.
 */
export function buildWhatsAppOrderUrl(
    targetPhone: string | null | undefined,
    params: WhatsAppOrderMessageParams
): string | null {
    const waPhone = formatWhatsAppPhone(targetPhone);
    if (!waPhone) return null;
    const msg = buildWhatsAppOrderMessage(params);
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
}

/**
 * Construye el enlace de WhatsApp con el detalle del pedido a partir de un registro guardado en DB.
 */
export function buildWhatsAppOrderUrlFromPedido(pedido: any): string | null {
    if (!pedido) return null;

    // Los pedidos creados desde el panel guardan precio_unitario con adicionales incluidos;
    // los creados desde el menú web (CartModal) guardan precio_unitario base.
    const priceIncludesAds = pedido.origen !== "web";

    const items: WhatsAppOrderItem[] = (pedido.pedido_items || []).map((item: any) => {
        const prod = Array.isArray(item.productos) ? item.productos[0] : item.productos;
        const categoriaNombre = prod?.categorias?.nombre || item.categoria_nombre || "PRODUCTOS";
        const ads: WhatsAppOrderAdicional[] = Array.isArray(item.adicionales) ? item.adicionales : [];
        const adTotalUnit = ads.reduce((sum, a) => {
            const qty = a.cantidad && a.cantidad > 0 ? a.cantidad : 1;
            return sum + Number(a.precio || 0) * qty;
        }, 0);

        const unitPrice = Number(item.precio_unitario || 0);
        const baseUnitPrice =
            priceIncludesAds && adTotalUnit > 0 && unitPrice >= adTotalUnit
                ? unitPrice - adTotalUnit
                : unitPrice;

        const cleanNotas = item.notas
            ? String(item.notas).replace(/\[Descuento: .*?\]/g, "").trim()
            : "";

        return {
            nombre: item.nombre_producto,
            cantidad: Number(item.cantidad || 1),
            precioUnitario: baseUnitPrice,
            categoriaNombre,
            adicionales: ads,
            notas: cleanNotas || undefined,
        };
    });

    const abonaMatch = typeof pedido.notas === "string"
        ? pedido.notas.match(/Abona con:\s*\$?([\d.,]+)/i)
        : null;

    return buildWhatsAppOrderUrl(pedido.cliente_telefono, {
        numeroPedido: pedido.numero_pedido || String(pedido.id || "").slice(0, 8),
        tipo: pedido.tipo || "delivery",
        clienteNombre: pedido.cliente_nombre || "Consumidor Final",
        clienteTelefono: pedido.cliente_telefono,
        clienteDireccion: pedido.tipo === "delivery" ? pedido.cliente_direccion : undefined,
        items,
        subtotal: Number(pedido.subtotal || 0),
        costoEnvio: Number(pedido.costo_envio || 0),
        propina: Number(pedido.propina || 0),
        descuento: Number(pedido.descuento || 0),
        recargo: Number(pedido.recargo || 0),
        total: Number(pedido.total || 0),
        metodoPago: pedido.metodo_pago_nombre || "Efectivo",
        abonaCon: abonaMatch ? abonaMatch[1] : undefined,
    });
}
