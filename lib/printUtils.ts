export const printOrderTicket = (pedido: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = pedido.pedido_items
        ?.map(
            (item: any) => `
    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-family: monospace;">
      <span>${item.cantidad}x ${item.nombre_producto}</span>
      <span>$${(item.precio_unitario * item.cantidad).toFixed(2)}</span>
    </div>
  `
        )
        .join("");

    printWindow.document.write(`
    <html>
      <head>
        <title>Comanda - ${pedido.numero_pedido}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 10px; margin: 0; font-size: 14px; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .footer { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; text-align: center; }
          .total { font-weight: bold; font-size: 16px; margin-top: 10px; }
          .details { margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="margin: 0;">MMM SYSTEM</h2>
          <p style="margin: 5px 0;">${new Date(pedido.created_at).toLocaleString()}</p>
          <p style="font-weight: bold; font-size: 18px; margin: 5px 0;">#${pedido.numero_pedido}</p>
        </div>
        
        <div class="details">
          <p><strong>Cliente:</strong> ${pedido.cliente_nombre || "Particular"}</p>
          <p><strong>Tel:</strong> ${pedido.cliente_telefono || "—"}</p>
          <p><strong>Modo:</strong> ${pedido.tipo.toUpperCase()}</p>
          ${pedido.cliente_direccion ? `<p><strong>Dir:</strong> ${pedido.cliente_direccion}</p>` : ""}
        </div>

        <div style="border-bottom: 1px dashed #000; margin-bottom: 10px;"></div>
        ${itemsHtml}
        <div style="border-bottom: 1px dashed #000; margin-top: 10px; margin-bottom: 10px;"></div>

        <div class="total">
          <div style="display: flex; justify-content: space-between;">
            <span>TOTAL:</span>
            <span>$${pedido.total.toFixed(2)}</span>
          </div>
        </div>

        ${pedido.metodo_pago_nombre
            ? `<p style="text-align: center; font-weight: bold; margin-top: 10px;">PAGO: ${pedido.metodo_pago_nombre.toUpperCase()}</p>`
            : ""
        }

        <div class="footer">
          <p>¡Gracias por su compra!</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          }
        </script>
      </body>
    </html>
  `);
    printWindow.document.close();
};
