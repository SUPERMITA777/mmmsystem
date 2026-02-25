/* ────────────────────────────────────────────
   printUtils.ts – Utilidades de impresión
   ──────────────────────────────────────────── */

function openPrint(html: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

/* ──────────────────────────────────────────────────────
   COMANDAR  – Ticket completo (igual a captura 2)
   ────────────────────────────────────────────────────── */
export function printComanda(pedido: any) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0 }).format(n);

  const tipoLabel =
    pedido.tipo === "delivery"
      ? "Delivery"
      : pedido.tipo === "takeaway"
        ? "Take Away"
        : "Salón";

  const numeroPedido = pedido.numero_pedido?.split("-")[1] ?? pedido.numero_pedido;

  const fechaCreacion = new Date(pedido.created_at).toLocaleString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const horaCreacion = new Date(pedido.created_at).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsHtml = (pedido.pedido_items ?? [])
    .map(
      (item: any) => `
      <tr>
        <td style="padding:3px 0">${item.cantidad} ${item.nombre_producto}</td>
        <td style="text-align:right;padding:3px 0">$${fmt(item.precio_unitario * item.cantidad)}</td>
      </tr>
      ${item.adicionales && item.adicionales.length
          ? item.adicionales
            .map(
              (a: any) => `
        <tr><td style="padding-left:12px;color:#555;font-size:11px">+ ${a.nombre}</td>
            <td style="text-align:right;color:#555;font-size:11px">+$${fmt(a.precio ?? 0)}</td></tr>`
            )
            .join("")
          : ""
        }`
    )
    .join("");

  const html = `<!DOCTYPE html><html><head>
    <title>${tipoLabel} N°${numeroPedido}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing: border-box; margin:0; padding:0; }
      body { font-family: 'Courier New', monospace; font-size:13px; width:72mm; }
      .center { text-align:center; }
      .bold { font-weight:bold; }
      .big { font-size:15px; font-weight:bold; }
      .sep { border-top:1px dashed #000; margin:6px 0; }
      table { width:100%; border-collapse:collapse; }
      .total-row td { font-weight:bold; padding-top:4px; }
      .section-title { font-weight:bold; margin:6px 0 3px; }
      .small { font-size:11px; }
    </style></head><body>
    <div class="center big">${tipoLabel} N°${numeroPedido}</div>
    <div class="center small">MMM Pizza</div>
    <div class="center small">${fechaCreacion}</div>
    <div class="center small">Creado a las ${horaCreacion} hs.</div>
    <div class="sep"></div>
    <div class="bold">${pedido.cliente_nombre || "Particular"}</div>
    <div class="small">${pedido.cliente_telefono || ""}</div>
    ${pedido.cliente_direccion ? `<div>${pedido.cliente_direccion}</div>` : ""}
    <div class="sep"></div>
    <div class="section-title">PROMOS</div>
    <table>${itemsHtml}</table>
    <div class="sep"></div>
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">$${fmt(pedido.subtotal ?? 0)}</td></tr>
      ${pedido.costo_envio > 0 ? `<tr><td>Envío</td><td style="text-align:right">$${fmt(pedido.costo_envio)}</td></tr>` : ""}
      ${pedido.propina > 0 ? `<tr><td>Propina</td><td style="text-align:right">$${fmt(pedido.propina)}</td></tr>` : ""}
      <tr class="total-row">
        <td class="big">${pedido.metodo_pago_nombre || "Efectivo"}</td>
        <td class="big" style="text-align:right">$${fmt(pedido.total ?? 0)}</td>
      </tr>
      ${pedido.total > 0 ? `<tr><td colspan="2" style="font-size:11px;padding-top:2px">Abono</td></tr><tr><td colspan="2" style="text-align:right;font-size:11px">$${fmt(pedido.total)}</td></tr>` : ""}
    </table>
    <div class="sep"></div>
    <div class="center small" style="color:#555">Comprobante no válido como factura.</div>
    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
    </body></html>`;

  openPrint(html, `Comanda ${pedido.numero_pedido}`);
}

/* ──────────────────────────────────────────────────────
   COCINA  – Ticket mínimo para cocina (captura 3)
   ────────────────────────────────────────────────────── */
export function printCocina(pedido: any) {
  const tipoLabel =
    pedido.tipo === "delivery"
      ? "Delivery"
      : pedido.tipo === "takeaway"
        ? "Take Away"
        : "Salón";

  const numeroPedido = pedido.numero_pedido?.split("-")[1] ?? pedido.numero_pedido;

  const itemsHtml = (pedido.pedido_items ?? [])
    .map(
      (item: any) => `
      <div style="font-weight:bold;font-size:15px;margin:4px 0">
        ${item.cantidad} ${item.nombre_producto.toUpperCase()}
      </div>
      ${item.adicionales && item.adicionales.length
          ? `<div style="font-size:12px;margin-left:8px">${item.adicionales.map((a: any) => `+ ${a.nombre}`).join(", ")}</div>`
          : ""
        }
      ${item.notas ? `<div style="font-size:11px;margin-left:8px;font-style:italic">${item.notas}</div>` : ""}`
    )
    .join("\n");

  const html = `<!DOCTYPE html><html><head>
    <title>Cocina ${numeroPedido}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:'Courier New', monospace; font-size:13px; width:72mm; }
      .sep { border-top:1px dashed #000; margin:6px 0; }
    </style></head><body>
    <div style="font-weight:bold;font-size:14px">${tipoLabel} N°${numeroPedido} <span style="font-weight:normal">#${pedido.numero_pedido}</span></div>
    ${pedido.cliente_direccion ? `<div>${pedido.cliente_direccion}</div>` : ""}
    <div class="sep"></div>
    <div style="font-weight:bold;font-size:13px;margin-bottom:4px">PROMOS</div>
    ${itemsHtml}
    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();}}</script>
    </body></html>`;

  openPrint(html, `Cocina ${pedido.numero_pedido}`);
}

/* Alias legacy */
export const printOrderTicket = printComanda;
