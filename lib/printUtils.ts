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
  fuente_totales: number;
  fuente_total_bold: number;
  fuente_footer: number;
  mostrar_telefono: boolean;
  mostrar_direccion: boolean;
  mostrar_fecha_hora: boolean;
  color_accents: string;
};

const DEFAULT_CONFIG: PrintConfig = {
  fuente_titulo: 22,
  fuente_subtitulo: 15,
  fuente_cliente_nombre: 19,
  fuente_cliente_detalles: 13,
  fuente_direccion: 14,
  fuente_items: 15,
  fuente_totales: 14,
  fuente_total_bold: 18,
  fuente_footer: 12,
  mostrar_telefono: true,
  mostrar_direccion: true,
  mostrar_fecha_hora: true,
  color_accents: '#2563eb',
};

function doPrint(html: string) {
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

/* ──────────────────────────────────────────────────────
   COMANDAR  – Ticket completo
   ────────────────────────────────────────────────────── */
export function printComanda(pedido: any, config: Partial<PrintConfig> = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };

  const tipoLabel =
    pedido.tipo === "delivery" ? "Delivery"
      : pedido.tipo === "takeaway" ? "Take Away"
        : "Salón";

  const numCorto = pedido.numero_pedido?.split("-")[1] ?? pedido.numero_pedido;

  const createdAt = new Date(pedido.created_at);
  const fechaLarga = createdAt.toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  const horaCreado = createdAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const itemsRows = (pedido.pedido_items ?? []).map((item: any) => {
    const subtotal = item.precio_unitario * item.cantidad;
    const ads = (item.adicionales ?? []).map((a: any) =>
      `<tr>
              <td style="padding-left:10px;font-size:${c.fuente_footer}px;color:#555">+ ${a.nombre}</td>
              <td style="text-align:right;font-size:${c.fuente_footer}px;color:#555">+${fmtARS(a.precio ?? 0)}</td>
            </tr>`
    ).join("");
    return `
            <tr>
              <td style="padding:3px 0;font-size:${c.fuente_items}px">${item.cantidad} ${item.nombre_producto}</td>
              <td style="text-align:right;padding:3px 0;font-size:${c.fuente_items}px;white-space:nowrap">${fmtARS(subtotal)}</td>
            </tr>${ads}`;
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
  <div class="center" style="font-size:${c.fuente_titulo}px;font-weight:bold;margin-bottom:2px">
    ${tipoLabel} N°${numCorto}
  </div>
  <div class="center" style="font-size:${c.fuente_subtitulo}px;font-weight:bold;margin-bottom:6px">MMM Pizza</div>

  <!-- FECHA Y HORA -->
  ${c.mostrar_fecha_hora ? `
  <div class="center" style="font-size:${c.fuente_footer}px;color:#333">${fechaLarga}</div>
  <div class="center" style="font-size:${c.fuente_footer}px;color:#333">Creado a las ${horaCreado} hs.</div>
  ` : ''}

  <div style="margin: 8px 0"></div>

  <!-- CLIENTE -->
  <div class="center" style="font-size:${c.fuente_cliente_nombre}px;font-weight:bold">${pedido.cliente_nombre || "Particular"}</div>
  ${pedido.cliente_telefono && c.mostrar_telefono
      ? `<div class="center" style="font-size:${c.fuente_cliente_detalles}px;color:#333">${pedido.cliente_telefono}</div>`
      : ""}

  ${pedido.cliente_direccion && c.mostrar_direccion ? `
  <div style="margin-top:8px;font-size:${c.fuente_direccion}px;line-height:1.5">
    ${pedido.cliente_direccion.split(",").map((part: string) =>
        `<span>${part.trim()}.</span><br>`
      ).join("")}
  </div>` : ""}

  <hr class="sep">

  <!-- PRODUCTOS -->
  <div style="font-size:${c.fuente_direccion}px;font-weight:bold;margin-bottom:4px">PROMOS</div>
  <table>${itemsRows}</table>

  <hr class="sep">

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

</body></html>`;

  doPrint(html);
}

/* ──────────────────────────────────────────────────────
   COCINA – Ticket mínimo para cocina
   ────────────────────────────────────────────────────── */
export function printCocina(pedido: any, config: Partial<PrintConfig> = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };

  const tipoLabel =
    pedido.tipo === "delivery" ? "Delivery"
      : pedido.tipo === "takeaway" ? "Take Away"
        : "Salón";

  const numCorto = pedido.numero_pedido?.split("-")[1] ?? pedido.numero_pedido;

  const itemsHtml = (pedido.pedido_items ?? []).map((item: any) => `
        <div style="font-weight:bold;font-size:${c.fuente_cliente_nombre}px;margin:5px 0;line-height:1.3">
            ${item.cantidad} ${item.nombre_producto.toUpperCase()}
        </div>
        ${(item.adicionales ?? []).length
      ? `<div style="font-size:${c.fuente_cliente_detalles}px;margin-left:10px;color:#333">${(item.adicionales ?? []).map((a: any) => `+ ${a.nombre}`).join(" · ")}</div>`
      : ""}
        ${item.notas
      ? `<div style="font-size:${c.fuente_cliente_detalles}px;margin-left:10px;font-style:italic;color:#555">${item.notas}</div>`
      : ""}`
  ).join("");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 5mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; width: 72mm; line-height: 1.4; }
  .sep { border: none; border-top: 1px dashed #555; margin: 6px 0; }
</style>
</head>
<body>

  <!-- ENCABEZADO -->
  <div style="font-weight:bold;font-size:${c.fuente_total_bold}px">${tipoLabel} N°${numCorto}
    <span style="font-weight:normal;font-size:${c.fuente_direccion}px;margin-left:4px">#${pedido.numero_pedido}</span>
  </div>

  ${pedido.cliente_direccion && c.mostrar_direccion
      ? `<div style="font-size:${c.fuente_direccion}px;font-weight:bold;margin-top:2px">${pedido.cliente_direccion}</div>`
      : ""}
  ${pedido.cliente_nombre
      ? `<div style="font-size:${c.fuente_cliente_detalles}px;color:#333">${pedido.cliente_nombre}</div>`
      : ""}

  <hr class="sep">

  <!-- PRODUCTOS -->
  <div style="font-weight:bold;font-size:${c.fuente_subtitulo}px;margin-bottom:6px">PROMOS</div>
  ${itemsHtml}

</body></html>`;

  doPrint(html);
}

/* Alias legacy */
export const printOrderTicket = printComanda;
