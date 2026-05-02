/* ────────────────────────────────────────────
   printUtils.ts – Utilidades de impresión 80mm
   ──────────────────────────────────────────── */

export type PrintConfig = {
  fuente_titulo: number;
  fuente_subtitulo: number;
  fuente_cliente_nombre: number;
  fuente_cliente_detalles: number;
  fuente_direccion: number;
  fuente_items: number;
  fuente_adicionales?: number;
  fuente_totales: number;
  fuente_total_bold: number;
  fuente_footer: number;
  mostrar_telefono: boolean;
  mostrar_direccion: boolean;
  mostrar_fecha_hora: boolean;
  color_accents: string;
  boldMap?: Record<string, boolean>;
  impresoras?: Record<string, { enabled: boolean; ip: string; printerName: string }>;
  promoQrUrl?: string; // URL para el código QR de la promo
};

const DEFAULT_CONFIG: PrintConfig = {
  fuente_titulo: 22,
  fuente_subtitulo: 15,
  fuente_cliente_nombre: 19,
  fuente_cliente_detalles: 13,
  fuente_direccion: 14,
  fuente_items: 15,
  fuente_adicionales: 12,
  fuente_totales: 14,
  fuente_total_bold: 18,
  fuente_footer: 12,
  mostrar_telefono: true,
  mostrar_direccion: true,
  mostrar_fecha_hora: true,
  color_accents: '#2563eb',
  boldMap: {},
  impresoras: {},
};

const BRIDGE_PORTS = [9100, 9101];

function bw(config: PrintConfig, key: string): string {
  return config.boldMap?.[key] ? 'font-weight:bold;' : '';
}

async function doPrint(html: string, printerName?: string) {
  // 1. Try to send to Bridge if printerName is provided
  if (printerName) {
    let sent = false;
    for (const port of BRIDGE_PORTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(`http://127.0.0.1:${port}/print`, {

          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, printerName }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          sent = true;
          break;
        }
      } catch (e) {}
    }
    if (sent) return; // Silent print success
  }

  // 2. Fallback to Browser Print
  // Para evitar abrir nuevas pestañas, usamos un iframe oculto
  let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  // Esperar a que cargue el contenido y luego imprimir
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
  }, 300);
}

function fmtARS(n: number) {
  return "$ " + new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(n);
}

function aggregateAdicionales(adicionales: any[]) {
  const counts: Record<string, { count: number, precio: number }> = {};
  adicionales.forEach(a => {
    const qty = a.cantidad || 1;
    if (!counts[a.nombre]) {
      counts[a.nombre] = { count: qty, precio: a.precio || 0 };
    } else {
      counts[a.nombre].count += qty;
    }
  });
  return Object.entries(counts).map(([nombre, data]) => ({
    nombre: data.count > 1 ? `${nombre} X ${data.count}` : nombre,
    precio: data.precio * data.count,
    count: data.count
  }));
}

/* ──────────────────────────────────────────────────────
   COMANDAR  – Ticket completo
   ────────────────────────────────────────────────────── */
export function printComanda(pedido: any, config: Partial<PrintConfig> = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };

  const tipoLabel =
    pedido.tipo === "delivery" ? "Delivery"
      : pedido.tipo === "takeaway" ? "Take Away"
        : "Salón";

  const numCorto = pedido.numero_pedido?.split("-").pop() ?? pedido.numero_pedido;

  const createdAt = new Date(pedido.created_at);
  const fechaLarga = createdAt.toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  const horaCreado = createdAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  // Agrupar items por categoría
  const groupedItems: Record<string, any[]> = {};
  (pedido.pedido_items ?? []).forEach((item: any) => {
    let catName = "PRODUCTOS";
    if (item.productos && item.productos.categorias && item.productos.categorias.nombre) {
      catName = item.productos.categorias.nombre.toUpperCase();
    }
    if (!groupedItems[catName]) groupedItems[catName] = [];
    groupedItems[catName].push(item);
  });

  const itemsRows = Object.keys(groupedItems).map(catName => {
    const headerRow = `<tr><td colspan="2" style="font-size:${c.fuente_direccion}px;font-weight:bold;padding-top:6px;padding-bottom:2px">${catName}</td></tr>`;

    const catItemsRows = groupedItems[catName].map(item => {
      const subtotal = item.precio_unitario * item.cantidad;
      const aggregated = aggregateAdicionales(item.adicionales ?? []);
      const ads = aggregated.map((a: any) =>
        `<tr>
                  <td style="padding-left:10px;font-size:${c.fuente_adicionales || c.fuente_footer}px;${bw(c, 'fuente_adicionales')}">+ ${a.nombre}</td>
                  <td style="text-align:right;font-size:${c.fuente_adicionales || c.fuente_footer}px;${bw(c, 'fuente_adicionales')}">+${fmtARS(a.precio ?? 0)}</td>
                </tr>`
      ).join("");
      const itemNotas = item.notas ? `<tr><td colspan="2" style="font-size:${c.fuente_adicionales || (c.fuente_items - 2)}px;font-weight:bold;padding-left:10px;font-style:italic">📝 ${item.notas}</td></tr>` : "";
      return `
                <tr>
                  <td style="padding:3px 0;font-size:${c.fuente_items}px">${item.cantidad} ${item.nombre_producto}</td>
                  <td style="text-align:right;padding:3px 0;font-size:${c.fuente_items}px;white-space:nowrap">${fmtARS(subtotal)}</td>
                </tr>${ads}${itemNotas}`;
    }).join("");
    return headerRow + catItemsRows;
  }).join("");

  const metodoPago = pedido.metodo_pago_nombre || "Efectivo";

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 5mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    width: 72mm;
    color: #000;
    line-height: 1.4;
  }
  .center { text-align: center; }
  .sep { border: none; border-top: 1px dashed #555; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; }
</style>
</head>
<body>

  <!-- TÍTULO -->
  <div class="center" style="font-size:${c.fuente_titulo}px;${bw(c, 'fuente_titulo')}margin-bottom:2px">
    ${tipoLabel} N°${numCorto}
  </div>
  <div class="center" style="font-size:${c.fuente_subtitulo}px;${bw(c, 'fuente_subtitulo')}margin-bottom:6px">MMM Pizza Artesanal</div>

  <!-- FECHA Y HORA -->
  ${c.mostrar_fecha_hora ? `
  <div class="center" style="font-size:${c.fuente_footer}px;color:#333">${fechaLarga}</div>
  <div class="center" style="font-size:${c.fuente_footer}px;color:#333">Creado a las ${horaCreado} hs.</div>
  ` : ''}

  <div style="margin: 8px 0"></div>

  <!-- CLIENTE -->
  <div class="center" style="font-size:${c.fuente_cliente_nombre}px;${bw(c, 'fuente_cliente_nombre')}">${pedido.cliente_nombre || "Particular"}</div>
  ${pedido.cliente_telefono && c.mostrar_telefono
      ? `<div class="center" style="font-size:${c.fuente_cliente_detalles}px;${bw(c, 'fuente_cliente_detalles')}color:#333">${pedido.cliente_telefono}</div>`
      : ""}

  ${pedido.cliente_direccion && c.mostrar_direccion ? `
  <div style="margin-top:8px;font-size:${c.fuente_direccion}px;line-height:1.5">
    ${pedido.cliente_direccion.split(",").map((part: string) =>
        `<span>${part.trim()}.</span><br>`
      ).join("")}
  </div>` : ""}

  <hr class="sep">

  <!-- PRODUCTOS -->
  <!-- PRODUCTOS -->
  <table>${itemsRows}</table>

  <hr class="sep">

  <!-- NOTAS DEL PEDIDO -->
  ${pedido.notas ? `
  <div style="font-size:16px;font-weight:bold;margin:10px 0;padding:8px;border:1px solid #000;border-radius:4px">
    COMENTARIOS: <br>
    ${pedido.notas.toUpperCase()}
  </div>
  <hr class="sep">` : ""}

  <!-- TOTALES -->
  <table style="font-size:${c.fuente_totales}px">
    <tr>
      <td style="color:#333">Subtotal</td>
      <td style="text-align:right;color:#333">${fmtARS(pedido.subtotal ?? 0)}</td>
    </tr>
    ${(pedido.costo_envio ?? 0) > 0 ? `
    <tr>
      <td style="color:#333">Envío</td>
      <td style="text-align:right;color:#333">${fmtARS(pedido.costo_envio)}</td>
    </tr>` : ""}
    ${(pedido.propina ?? 0) > 0 ? `
    <tr>
      <td style="color:#333">Propina</td>
      <td style="text-align:right;color:#333">${fmtARS(pedido.propina)}</td>
    </tr>` : ""}
    ${(pedido.descuento ?? 0) > 0 ? `
    <tr>
      <td style="color:#1a7a3f;font-weight:bold">🏷️ Descuento${pedido.notas_internas ? ` (${pedido.notas_internas})` : ""}</td>
      <td style="text-align:right;color:#1a7a3f;font-weight:bold">- ${fmtARS(pedido.descuento)}</td>
    </tr>` : ""}
    <tr>
      <td style="font-weight:bold;font-size:${c.fuente_total_bold}px;padding-top:4px">${metodoPago}</td>
      <td style="text-align:right;font-weight:bold;font-size:${c.fuente_total_bold}px;padding-top:4px">${fmtARS(pedido.total ?? 0)}</td>
    </tr>
    <tr>
      <td style="color:#333;font-size:${c.fuente_footer}px">Abono</td>
      <td style="text-align:right;color:#333;font-size:${c.fuente_footer}px">${fmtARS(pedido.total ?? 0)}</td>
    </tr>
  </table>

  <hr class="sep">

  <!-- FOOTER -->
  <div class="center" style="font-size:${c.fuente_footer}px;color:${c.color_accents};font-style:italic;margin-top:2px">
    Comprobante no válido como factura.
  </div>

  ${c.promoQrUrl ? `
  <hr class="sep" style="margin-top:10px">
  <!-- PROMO QR -->
  <div class="center" style="margin-top:8px">
    <div style="font-size:13px;font-weight:bold;margin-bottom:4px">🎁 ¡Escaneá y ganá un premio!</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(c.promoQrUrl)}" alt="QR Promo" width="110" height="110" style="display:block;margin:0 auto 4px" />
    <div style="font-size:10px;color:#555;margin-top:2px">Recibís un descuento o regalo sorpresa</div>
  </div>` : ''}

</body></html>`;

  const printerName = c.impresoras?.["FACTURACION"]?.printerName;
  doPrint(html, printerName);
}

/* ──────────────────────────────────────────────────────
   COCINA – Ticket para cocina con N° grande y horario
   ────────────────────────────────────────────────────── */
export function printCocina(pedido: any, config: Partial<PrintConfig> = {}, itemsOverride?: any[]) {
  const c = { ...DEFAULT_CONFIG, ...config };

  const tipoLabel =
    pedido.tipo === "delivery" ? "DELIVERY"
      : pedido.tipo === "takeaway" ? "TAKE AWAY"
        : "SALÓN";

  const numCorto = pedido.numero_pedido?.split("-").pop() ?? pedido.numero_pedido;
  const mesaNum = pedido.mesas?.numero || pedido.mesa_numero;

  const createdAt = new Date(pedido.created_at || new Date());
  const horaComandado = createdAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const fechaCorta = createdAt.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

  const items = itemsOverride ?? pedido.pedido_items ?? [];

  // Agrupar items por categoría para la cocina
  const groupedItemsCoc: Record<string, any[]> = {};
  items.forEach((item: any) => {
    let catName = "PRODUCTOS";
    if (item.productos && item.productos.categorias && item.productos.categorias.nombre) {
      catName = item.productos.categorias.nombre.toUpperCase();
    }
    if (!groupedItemsCoc[catName]) groupedItemsCoc[catName] = [];
    groupedItemsCoc[catName].push(item);
  });

  const itemsHtml = Object.keys(groupedItemsCoc).map(catName => {
    const header = `<div style="font-weight:bold;font-size:${c.fuente_subtitulo}px;margin-top:8px;margin-bottom:4px;border-bottom:1px solid #000;padding-bottom:2px">${catName}</div>`;

    const catItemsHtml = groupedItemsCoc[catName].map(item => `
          <div style="font-weight:bold;font-size:${Math.max(c.fuente_cliente_nombre, 20)}px;margin:8px 0 2px;line-height:1.3">
              ${item.cantidad} x ${(item.nombre_producto || item.nombre).toUpperCase()}
          </div>
          ${(item.adicionales ?? []).length
        ? `<div style="font-size:${c.fuente_adicionales || 14}px;margin-left:10px;font-weight:bold;${bw(c, 'fuente_adicionales')}">${aggregateAdicionales(item.adicionales).map((a: any) => `+ ${a.nombre}`).join("<br>")}</div>`
        : ""}
          ${(item.notas || item.nota)
        ? `<div style="font-size:${Math.max(c.fuente_cliente_detalles, 14)}px;margin-left:10px;margin-top:2px;font-weight:bold;font-style:italic;padding:4px 6px;border:1px dashed #000;border-radius:4px">📝 ${(item.notas || item.nota).toUpperCase()}</div>`
        : ""}`
    ).join("");
    return header + catItemsHtml;
  }).join("");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 5mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; width: 72mm; line-height: 1.4; }
  .center { text-align: center; }
  .sep { border: none; border-top: 2px dashed #000; margin: 8px 0; }
</style>
</head>
<body>

  <!-- NÚMERO DE PEDIDO GRANDE -->
  <div class="center" style="font-weight:900;font-size:32px;letter-spacing:2px;margin-bottom:4px">
    ${pedido.tipo === "salon" && mesaNum ? `MESA ${mesaNum}` : `N° ${numCorto}`}
  </div>
  <div class="center" style="font-weight:bold;font-size:16px;margin-bottom:2px">${tipoLabel}</div>

  <!-- HORARIO COMANDADO -->
  <div class="center" style="font-size:20px;font-weight:bold;margin:6px 0;padding:4px;border:2px solid #000;border-radius:4px">
    ⏰ ${horaComandado} hs — ${fechaCorta}
  </div>

  ${pedido.cliente_nombre && pedido.tipo !== "salon"
      ? `<div style="font-size:${c.fuente_cliente_detalles}px;font-weight:bold;color:#333;margin-top:4px">${pedido.cliente_nombre}</div>`
      : ""}

  <hr class="sep">

  <!-- NOTAS GENERALES -->
  ${pedido.notas ? `
  <div style="font-size:18px;font-weight:bold;margin:4px 0;padding:6px;border:2px solid #000;text-align:center">
    COMENTARIOS: ${pedido.notas.toUpperCase()}
  </div>
  <hr class="sep">` : ""}

  <!-- PRODUCTOS -->
  ${itemsHtml}

  <hr class="sep">
  <div class="center" style="font-size:10px;color:#666">Pedido #${pedido.numero_pedido || "—"}</div>

</body></html>`;

  const printerName = c.impresoras?.["COCINA 1"]?.printerName || c.impresoras?.["COCINA1"]?.printerName;
  doPrint(html, printerName);
}

/* ──────────────────────────────────────────────────────
   COCINA INCREMENTAL – Solo items nuevos (evita duplicados)
   ────────────────────────────────────────────────────── */
export function printCocinaIncremental(pedido: any, newItems: any[], config: Partial<PrintConfig> = {}) {
  if (!newItems || newItems.length === 0) return;
  printCocina(pedido, config, newItems);
}

/* ──────────────────────────────────────────────────────
   PRE-CUENTA – Ticket de pre-cuenta para mesa de salón
   ────────────────────────────────────────────────────── */
export function printPreCuenta(pedido: any, config: Partial<PrintConfig> = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };

  const mesaNum = pedido.mesas?.numero || pedido.mesa_numero || "—";
  const numCorto = pedido.numero_pedido?.split("-").pop() ?? pedido.numero_pedido;
  const metodoPago = pedido.metodo_pago_nombre || "Efectivo";

  const createdAt = new Date(pedido.created_at || new Date());
  const horaCreado = createdAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const fechaLarga = createdAt.toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const itemsRows = (pedido.pedido_items ?? []).map((item: any) => {
    const subtotal = item.precio_unitario * item.cantidad;
    const aggregated = aggregateAdicionales(item.adicionales ?? []);
    const ads = aggregated.map((a: any) =>
      `<tr>
        <td style="padding-left:10px;font-size:${c.fuente_adicionales || c.fuente_footer}px">+ ${a.nombre}</td>
        <td style="text-align:right;font-size:${c.fuente_adicionales || c.fuente_footer}px">+${fmtARS(a.precio ?? 0)}</td>
      </tr>`
    ).join("");
    return `
      <tr>
        <td style="padding:3px 0;font-size:${c.fuente_items}px">${item.cantidad} ${item.nombre_producto}</td>
        <td style="text-align:right;padding:3px 0;font-size:${c.fuente_items}px;white-space:nowrap">${fmtARS(subtotal)}</td>
      </tr>${ads}`;
  }).join("");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 5mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; width: 72mm; color: #000; line-height: 1.4; }
  .center { text-align: center; }
  .sep { border: none; border-top: 1px dashed #555; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; }
</style>
</head>
<body>

  <div class="center" style="font-size:24px;font-weight:900;margin-bottom:4px">PRE-CUENTA</div>
  <div class="center" style="font-size:20px;font-weight:bold;margin-bottom:2px">Mesa ${mesaNum}</div>
  <div class="center" style="font-size:${c.fuente_footer}px;color:#333">${fechaLarga}</div>
  <div class="center" style="font-size:${c.fuente_footer}px;color:#333">Pedido a las ${horaCreado} hs.</div>

  ${pedido.cliente_nombre ? `<div class="center" style="font-size:${c.fuente_cliente_detalles}px;margin-top:4px;font-weight:bold">${pedido.cliente_nombre}</div>` : ""}

  <hr class="sep">

  <table>${itemsRows}</table>

  <hr class="sep">

  <table style="font-size:${c.fuente_totales}px">
    <tr>
      <td style="color:#333">Subtotal</td>
      <td style="text-align:right;color:#333">${fmtARS(pedido.subtotal ?? 0)}</td>
    </tr>
    ${(pedido.descuento ?? 0) > 0 ? `
    <tr>
      <td style="color:#1a7a3f;font-weight:bold">🏷️ Descuento${pedido.notas_internas ? ` (${pedido.notas_internas})` : ""}</td>
      <td style="text-align:right;color:#1a7a3f;font-weight:bold">- ${fmtARS(pedido.descuento)}</td>
    </tr>` : ""}
    <tr>
      <td style="font-weight:bold;font-size:${c.fuente_total_bold}px;padding-top:6px">${metodoPago}</td>
      <td style="text-align:right;font-weight:bold;font-size:${c.fuente_total_bold}px;padding-top:6px">${fmtARS(pedido.total ?? 0)}</td>
    </tr>
  </table>

  <hr class="sep">

  <div class="center" style="font-size:${c.fuente_footer}px;color:#555;font-style:italic;margin-top:2px">
    Comprobante no válido como factura.
  </div>

</body></html>`;

  const printerName = c.impresoras?.["FACTURACIÓN"]?.printerName || c.impresoras?.["FACTURACION"]?.printerName;
  doPrint(html, printerName);
}

/* Alias legacy */
export const printOrderTicket = printComanda;

/* ──────────────────────────────────────────────────────
   PROMO QR WEB – Ticket genérico de promo
   ────────────────────────────────────────────────────── */
export function printPromoQrWeb(url: string, texto: string, imageUrl?: string, config: Partial<PrintConfig> = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 5mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; width: 72mm; line-height: 1.4; color: #000; }
  .center { text-align: center; }
  .sep { border: none; border-top: 1px dashed #555; margin: 6px 0; }
</style>
</head>
<body>
  
  ${imageUrl ? `<div class="center" style="margin-bottom:8px">
    <img src="${imageUrl}" alt="Promo Logo" style="max-width:200px; max-height:80px; display:block; margin:0 auto;" />
  </div>` : ''}

  <div class="center" style="font-size:${c.fuente_titulo}px;${bw(c, 'fuente_titulo')}margin-bottom:6px">
    PROMO ONLINE
  </div>

  <div class="center" style="margin-top:10px;margin-bottom:10px">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}" alt="QR Promo" width="180" height="180" style="display:block;margin:0 auto" />
  </div>

  <div class="center" style="font-size:${c.fuente_cliente_nombre}px;font-weight:bold;margin-top:8px;padding:4px">
    ${texto || "#GRACIAS POR ELEGIRNOS"}
  </div>

  <div class="center" style="font-size:${c.fuente_footer}px;color:#333;margin-top:6px">
    ¡Escaneá y pedí desde nuestra web!
  </div>

</body></html>`;

  doPrint(html);
}

