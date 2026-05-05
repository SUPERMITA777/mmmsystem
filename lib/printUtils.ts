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
  nombre_local?: string; // Nombre del local configurado en la web
  bridge_ip?: string;
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
  nombre_local: "MMM Pizza Artesanal",
};

const recentlyPrinted = new Map<string, number>();

function isDuplicatePrint(key: string): boolean {
  const now = Date.now();
  const lastTime = recentlyPrinted.get(key);
  if (lastTime && (now - lastTime) < 4000) {
    console.warn(`[Printer] Ignorando impresión duplicada para la clave: ${key}`);
    return true;
  }
  recentlyPrinted.set(key, now);
  return false;
}

const BRIDGE_PORTS = [9100, 9101];
let lastWorkingPort: number | null = null;

function bw(config: PrintConfig, key: string): string {
  return config.boldMap?.[key] ? 'font-weight:bold;' : '';
}

async function doPrint(html: string, printerName?: string, bridgeIp: string = '127.0.0.1', printerIp?: string) {
  // 1. Try to send to Bridge if printerName or printerIp is provided
  if (printerName || printerIp) {
    let sent = false;
    
    // Probar primero el último puerto que funcionó para ganar velocidad
    const portsToTry = lastWorkingPort ? [lastWorkingPort, ...BRIDGE_PORTS.filter(p => p !== lastWorkingPort)] : BRIDGE_PORTS;

    for (const port of portsToTry) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Reducido a 3s para respuesta rápida
        const res = await fetch(`http://${bridgeIp}:${port}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, printerName, printerIp }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          sent = true;
          lastWorkingPort = port;
          break;
        }
      } catch (e) {
          // Ignorar errores de conexión y seguir probando
      }
    }
    if (sent) return; // Silent print success
    else {
        console.warn("Fallo impresión silenciosa o Bridge no encontrado.");
    }
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
  const printKey = `comanda-${pedido.id}`;
  if (isDuplicatePrint(printKey)) return;

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
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    width: 100%;
    color: #000;
    line-height: 1.4;
    padding: 2mm 0;
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
  <div class="center" style="font-size:${c.fuente_subtitulo}px;${bw(c, 'fuente_subtitulo')}margin-bottom:6px">${c.nombre_local}</div>

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

  const pKey = c.impresoras?.["FACTURACIÓN"] ? "FACTURACIÓN" : "FACTURACION";
  const printerName = c.impresoras?.[pKey]?.printerName;
  const printerIp = c.impresoras?.[pKey]?.ip;
  doPrint(html, printerName, c.bridge_ip, printerIp);
}

/* ──────────────────────────────────────────────────────
   COCINA – Ticket para cocina con N° grande y horario
   ────────────────────────────────────────────────────── */
export function printCocina(pedido: any, config: Partial<PrintConfig> = {}, itemsOverride?: any[]) {
  const printKey = `cocina-${pedido.id}-${JSON.stringify(itemsOverride || [])}`;
  if (isDuplicatePrint(printKey)) return;

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

  const itemsToPrint = itemsOverride ?? pedido.pedido_items ?? [];

  // Agrupar items por impresora según configuración
  const itemsByPrinter: Record<string, any[]> = {};
  const defaultPrinterKey = "COCINA 1";
  
  itemsToPrint.forEach((item: any) => {
    const mainProdObj = Array.isArray(item.productos) ? item.productos[0] : item.productos;
    const mainProdSingular = Array.isArray(item.producto) ? item.producto[0] : item.producto;
    const finalMainProd = mainProdObj || mainProdSingular || {};

    const mainItemCatId = finalMainProd.categoria_id || item.categoria_id || finalMainProd.id_categoria;
    const mainItemCatName = (finalMainProd.categorias?.nombre || item.categoria_nombre || finalMainProd.categoria_nombre || "").toUpperCase();

    // Determine main item printer
    let mainPrinterKey = defaultPrinterKey;
    const prodPrinter = item.impresora || 
                       item.impresora_id || 
                       finalMainProd.impresora || 
                       finalMainProd.id_impresora || 
                       finalMainProd.impresora_id;

    if (prodPrinter && (c.impresoras?.[prodPrinter] || Object.values(c.impresoras || {}).some((p: any) => p.printerName === prodPrinter))) {
      mainPrinterKey = c.impresoras?.[prodPrinter] ? prodPrinter : 
                       Object.keys(c.impresoras || {}).find(k => (c.impresoras?.[k] as any).printerName === prodPrinter) || defaultPrinterKey;
    } else if (c.impresoras) {
      for (const [key, pConf] of Object.entries(c.impresoras)) {
        const conf = pConf as any;
        const catIds = conf.categoriasIds || [];
        const catNames = (conf.categoriasNombres || []).map((n: string) => n.toUpperCase());
        if ((mainItemCatId && catIds.includes(mainItemCatId)) || (mainItemCatName && catNames.includes(mainItemCatName))) {
          mainPrinterKey = key;
          break;
        }
      }
    }

    // Separate additionals that have a different printer
    const mainItemAdditionals: any[] = [];
    const satelliteAdditionals: Record<string, any[]> = {};

    (item.adicionales || []).forEach((ad: any) => {
      const adPrinter = ad.impresora;
      if (adPrinter && adPrinter !== mainPrinterKey && c.impresoras?.[adPrinter]) {
        if (!satelliteAdditionals[adPrinter]) satelliteAdditionals[adPrinter] = [];
        satelliteAdditionals[adPrinter].push(ad);
      } else {
        mainItemAdditionals.push(ad);
      }
    });

    // Add main item (with its remaining additionals) to its printer
    if (!itemsByPrinter[mainPrinterKey]) itemsByPrinter[mainPrinterKey] = [];
    itemsByPrinter[mainPrinterKey].push({
      ...item,
      adicionales: mainItemAdditionals
    });

    // Add satellite additionals to their respective printers
    Object.entries(satelliteAdditionals).forEach(([sKey, ads]) => {
      if (!itemsByPrinter[sKey]) itemsByPrinter[sKey] = [];
      ads.forEach(ad => {
        itemsByPrinter[sKey].push({
          nombre: `${ad.nombre} (PARA ${item.nombre_producto || item.nombre})`,
          cantidad: item.cantidad * (ad.cantidad || 1),
          adicionales: [], // It's already an additional
          notas: item.notas ? `Ref: ${item.nombre_producto || item.nombre} - ${item.notas}` : `Ref: ${item.nombre_producto || item.nombre}`
        });
      });
    });
  });

  // Imprimir un ticket por cada impresora que tenga ítems
  Object.entries(itemsByPrinter).forEach(([pKey, items]) => {
    const pConf = c.impresoras?.[pKey] || c.impresoras?.[pKey.replace(" ", "")];
    const printerName = pConf?.printerName;
    const printerIp = pConf?.ip;
    if (!printerName && !printerIp) return;

    const itemsHtml = items.map(item => {
      const aggregated = aggregateAdicionales(item.adicionales ?? []);
      const ads = aggregated.map((a: any) =>
        `<div style="font-size:18px;margin-left:12px;font-weight:bold">+ ${a.nombre}</div>`
      ).join("");
      const itemNotas = item.notas ? `<div style="font-size:16px;font-weight:bold;margin-left:12px;font-style:italic;background:#eee;padding:2px">📝 ${item.notas}</div>` : "";
      return `
        <div style="margin-bottom:8px">
          <div style="font-size:24px;font-weight:900">${item.cantidad} x ${item.nombre_producto || item.nombre}</div>
          ${ads}${itemNotas}
        </div>`;
    }).join("");

    // Título simplificado para Salón
    const mainTitle = (pedido.tipo === "salon" || pedido.tipo === "mesa") && mesaNum 
      ? `MESA ${mesaNum}` 
      : `N° ${numCorto}`;

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial Black', Gadget, sans-serif; width: 100%; color: #000; line-height: 1.2; margin: 0; padding: 2mm 0; }
  .center { text-align: center; }
  .sep { border: none; border-top: 2px dashed #000; margin: 8px 0; }
</style>
</head>
<body>

  <!-- NÚMERO DE MESA O PEDIDO GRANDE -->
  <div class="center" style="font-weight:900;font-size:38px;letter-spacing:2px;margin-bottom:4px">
    ${mainTitle}
  </div>
  <div class="center" style="font-weight:bold;font-size:18px;margin-bottom:2px">${tipoLabel}</div>

  <!-- HORARIO COMANDADO -->
  <div class="center" style="font-size:20px;font-weight:bold;margin:6px 0;padding:4px;border:2px solid #000;border-radius:4px">
    ⏰ ${horaComandado} hs
  </div>

  ${pedido.cliente_nombre && (pedido.tipo !== "salon" && pedido.tipo !== "mesa")
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

  <!-- CAMARERO -->
  ${pedido.usuarios?.nombre || pedido.camarero_nombre ? `
  <div class="center" style="font-size:18px;font-weight:bold;margin-top:10px;padding:4px;border:1px dashed #000">
    ATENDIDO POR: ${(pedido.usuarios?.nombre || pedido.camarero_nombre).toUpperCase()}
  </div>` : ""}

  <hr class="sep">
  <div class="center" style="font-size:10px;color:#666">Pedido #${pedido.numero_pedido || "—"}</div>

</body></html>`;

    doPrint(html, printerName, c.bridge_ip, printerIp);
  });
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
export function printPreCuenta(pedido: any, config: Partial<PrintConfig> = {}, title: string = "PRE-CUENTA") {
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
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; width: 72mm; color: #000; line-height: 1.4; margin: 0; padding: 5mm 4mm; }
  .center { text-align: center; }
  .sep { border: none; border-top: 1px dashed #555; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; }
</style>
</head>
<body>

  <div class="center" style="font-size:24px;font-weight:900;margin-bottom:4px">${title}</div>
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
  ${(pedido as any).camarero_nombre ? `
  <div class="center" style="font-size:${c.fuente_footer}px;color:#333;margin-top:6px;font-weight:bold;text-transform:uppercase">
    USTED HA SIDO ATENDIDO POR ${(pedido as any).camarero_nombre}
  </div>` : ''}

</body></html>`;

  const pKey = c.impresoras?.["FACTURACIÓN"] ? "FACTURACIÓN" : "FACTURACION";
  const printerName = c.impresoras?.[pKey]?.printerName;
  const printerIp = c.impresoras?.[pKey]?.ip;

  if (!printerName && !printerIp) {
      alert("No hay una impresora asignada a FACTURACIÓN en Ajustes > Impresoras. Se abrirá la ventana normal de impresión.");
  }
  doPrint(html, printerName, c.bridge_ip, printerIp);
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
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; width: 100%; line-height: 1.4; color: #000; padding: 2mm 0; }
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

  doPrint(html, undefined, c.bridge_ip);
}


/**
 * ──────────────────────────────────────────────────────
 * LLAMADAS AL BRIDGE (LOCAL HUB)
 * ──────────────────────────────────────────────────────
 * */
export async function doBridgePost(endpoint: string, data: any, bridgeIp: string = '127.0.0.1') {
    for (const port of BRIDGE_PORTS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`http://${bridgeIp}:${port}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) return await res.json();
        } catch (e) {
            console.warn(`Bridge no responde en ${bridgeIp}:${port}${endpoint}`);
        }
    }
    throw new Error("No se pudo contactar con el Bridge");
}
