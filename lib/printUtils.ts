/* ────────────────────────────────────────────
   printUtils.ts – Utilidades de impresión 80mm
   ──────────────────────────────────────────── */

function openPrint(html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function fmtARS(n: number) {
  return "$ " + new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(n);
}

/* ──────────────────────────────────────────────────────
   COMANDAR  – Ticket completo (igual a la captura)
   ────────────────────────────────────────────────────── */
export function printComanda(pedido: any) {
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
              <td style="padding-left:10px;font-size:10px;color:#555">+ ${a.nombre}</td>
              <td style="text-align:right;font-size:10px;color:#555">+${fmtARS(a.precio ?? 0)}</td>
            </tr>`
    ).join("");
    return `
            <tr>
              <td style="padding:3px 0;font-size:13px">${item.cantidad} ${item.nombre_producto}</td>
              <td style="text-align:right;padding:3px 0;font-size:13px;white-space:nowrap">${fmtARS(subtotal)}</td>
            </tr>${ads}`;
  }).join("");

  const metodoPago = pedido.metodo_pago_nombre || "Efectivo";

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${tipoLabel} N°${numCorto}</title>
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
  <div class="center" style="font-size:20px;font-weight:bold;margin-bottom:2px">
    ${tipoLabel} N°${numCorto}
  </div>
  <div class="center" style="font-size:13px;font-weight:bold;margin-bottom:6px">MMM Pizza</div>

  <!-- FECHA Y HORA -->
  <div class="center" style="font-size:10px;color:#333">${fechaLarga}</div>
  <div class="center" style="font-size:10px;color:#333">Creado a las ${horaCreado} hs.</div>

  <div style="margin: 8px 0"></div>

  <!-- CLIENTE -->
  <div class="center" style="font-size:15px;font-weight:bold">${pedido.cliente_nombre || "Particular"}</div>
  ${pedido.cliente_telefono
      ? `<div class="center" style="font-size:11px;color:#333">${pedido.cliente_telefono}</div>`
      : ""}

  ${pedido.cliente_direccion ? `
  <div style="margin-top:8px;font-size:12px;line-height:1.5">
    ${pedido.cliente_direccion.split(",").map((part: string) =>
        `<span>${part.trim()}.</span><br>`
      ).join("")}
  </div>` : ""}

  <hr class="sep">

  <!-- PRODUCTOS -->
  <div style="font-size:12px;font-weight:bold;margin-bottom:4px">PROMOS</div>
  <table>${itemsRows}</table>

  <hr class="sep">

  <!-- TOTALES -->
  <table style="font-size:12px">
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
      <td style="font-weight:bold;font-size:14px;padding-top:4px">${metodoPago}</td>
      <td style="text-align:right;font-weight:bold;font-size:14px;padding-top:4px">${fmtARS(pedido.total ?? 0)}</td>
    </tr>
    <tr>
      <td style="color:#333;font-size:11px">Abono</td>
      <td style="text-align:right;color:#333;font-size:11px">${fmtARS(pedido.total ?? 0)}</td>
    </tr>
  </table>

  <hr class="sep">

  <!-- FOOTER -->
  <div class="center" style="font-size:10px;color:#2563eb;font-style:italic;margin-top:2px">
    Comprobante no válido como factura.
  </div>

<script>
  window.onload = function() {
    window.print();
    window.onafterprint = function() { window.close(); };
  };
</script>
</body></html>`;

  openPrint(html);
}

/* ──────────────────────────────────────────────────────
   COCINA – Ticket mínimo para cocina (captura 3)
   ────────────────────────────────────────────────────── */
export function printCocina(pedido: any) {
  const tipoLabel =
    pedido.tipo === "delivery" ? "Delivery"
      : pedido.tipo === "takeaway" ? "Take Away"
        : "Salón";

  const numCorto = pedido.numero_pedido?.split("-")[1] ?? pedido.numero_pedido;

  const itemsHtml = (pedido.pedido_items ?? []).map((item: any) => `
        <div style="font-weight:bold;font-size:17px;margin:5px 0;line-height:1.3">
            ${item.cantidad} ${item.nombre_producto.toUpperCase()}
        </div>
        ${(item.adicionales ?? []).length
      ? `<div style="font-size:11px;margin-left:10px;color:#333">${(item.adicionales ?? []).map((a: any) => `+ ${a.nombre}`).join(" · ")}</div>`
      : ""}
        ${item.notas
      ? `<div style="font-size:11px;margin-left:10px;font-style:italic;color:#555">${item.notas}</div>`
      : ""}`
  ).join("");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Cocina ${numCorto}</title>
<style>
  @page { size: 80mm auto; margin: 5mm 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; width: 72mm; line-height: 1.4; }
  .sep { border: none; border-top: 1px dashed #555; margin: 6px 0; }
</style>
</head>
<body>

  <!-- ENCABEZADO -->
  <div style="font-weight:bold;font-size:16px">${tipoLabel} N°${numCorto}
    <span style="font-weight:normal;font-size:12px;margin-left:4px">#${pedido.numero_pedido}</span>
  </div>

  ${pedido.cliente_direccion
      ? `<div style="font-size:12px;font-weight:bold;margin-top:2px">${pedido.cliente_direccion}</div>`
      : ""}
  ${pedido.cliente_nombre
      ? `<div style="font-size:11px;color:#333">${pedido.cliente_nombre}</div>`
      : ""}

  <hr class="sep">

  <!-- PRODUCTOS -->
  <div style="font-weight:bold;font-size:13px;margin-bottom:6px">PROMOS</div>
  ${itemsHtml}

<script>
  window.onload = function() {
    window.print();
    window.onafterprint = function() { window.close(); };
  };
</script>
</body></html>`;

  openPrint(html);
}

/* Alias legacy */
export const printOrderTicket = printComanda;
