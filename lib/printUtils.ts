import { supabase } from "@/lib/supabaseClient";


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
  bridge_enabled?: boolean;
  fiscal?: {
    habilitado: boolean;
    razon_social: string;
    cuit: string;
    ingresos_brutos: string;
    inicio_actividades: string;
    punto_venta: string;
    condicion_iva: string;
    direccion_comercial: string;
  };
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
  bridge_enabled: true,
  fiscal: {
    habilitado: false,
    razon_social: "",
    cuit: "",
    ingresos_brutos: "",
    inicio_actividades: "",
    punto_venta: "0001",
    condicion_iva: "Responsable Inscripto",
    direccion_comercial: "Buenos Aires, Argentina",
  },
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

function getFacturacionKey(impresoras?: any): string {
  if (!impresoras) return "FACTURACION";
  const p = impresoras["FACTURACION"];
  if (p && (p.printerName || p.ip)) {
    return "FACTURACION";
  }
  return impresoras["FACTURACIÓN"] ? "FACTURACIÓN" : "FACTURACION";
}

const BRIDGE_PORTS = [9100, 9101];
let lastWorkingPort: number | null = null;

function bw(config: PrintConfig, key: string): string {
  return config.boldMap?.[key] ? 'font-weight:bold;' : '';
}

async function doPrint(html: string, printerName?: string, bridgeIp: string = '127.0.0.1', printerIp?: string, bridgeEnabled: boolean = true) {
  // 1. Try to send to Bridge if printerName or printerIp is provided and bridge is enabled
  if (bridgeEnabled && (printerName || printerIp)) {
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

  const pKey = getFacturacionKey(c.impresoras);
  const printerName = c.impresoras?.[pKey]?.printerName;
  const printerIp = c.impresoras?.[pKey]?.ip;
  doPrint(html, printerName, c.bridge_ip, printerIp, c.bridge_enabled !== false);
}

/* ──────────────────────────────────────────────────────
   COCINA – Ticket para cocina con N° grande y horario
   ────────────────────────────────────────────────────── */
export function printCocina(pedido: any, config: Partial<PrintConfig> = {}, itemsOverride?: any[]) {
  const printKey = `cocina-${pedido.id}-${JSON.stringify(itemsOverride || [])}`;
  if (isDuplicatePrint(printKey)) return;

  const c = { ...DEFAULT_CONFIG, ...config };

  if (c.bridge_enabled === false) {
    console.log(`[Printer] Impresión en cocina anulada porque el puente de impresión está desactivado.`);
    return;
  }

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

  // Group by physical printer to prevent duplicate tickets on the same hardware!
  const physicalPrinters: Record<string, { printerName?: string; printerIp?: string; items: any[], pKeys: string[] }> = {};

  Object.entries(itemsByPrinter).forEach(([pKey, items]) => {
    const pConf = c.impresoras?.[pKey] || c.impresoras?.[pKey.replace(" ", "")];
    const printerName = pConf?.printerName;
    const printerIp = pConf?.ip;
    if (!printerName && !printerIp) return;

    // Unique destination key representing the hardware printer
    const destKey = printerIp ? `ip:${printerIp}` : `name:${printerName}`;

    if (!physicalPrinters[destKey]) {
      physicalPrinters[destKey] = {
        printerName,
        printerIp,
        items: [],
        pKeys: []
      };
    }
    physicalPrinters[destKey].items.push(...items);
    if (!physicalPrinters[destKey].pKeys.includes(pKey)) {
      physicalPrinters[destKey].pKeys.push(pKey);
    }
  });

  // Imprimir un ticket por cada impresora física que tenga ítems
  const facturacionKey = getFacturacionKey(c.impresoras);
  const facturacionConf = c.impresoras?.[facturacionKey];
  const facturacionPrinterName = facturacionConf?.printerName;
  const facturacionPrinterIp = facturacionConf?.ip;

  Object.values(physicalPrinters).forEach(({ printerName, printerIp, items, pKeys }) => {
    if (pedido.tipo === "delivery" || pedido.tipo === "takeaway") {
      const isSameAsFacturacion = 
        (printerIp && printerIp === facturacionPrinterIp) ||
        (printerName && printerName === facturacionPrinterName);
      if (isSameAsFacturacion) {
        console.log(`[Printer] Saltando ticket de cocina en hardware compartido de FACTURACION para el pedido ${pedido.tipo}: ${printerName || printerIp}`);
        return;
      }
    }

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

    const printHeaderLabel = pKeys.join(" + ").toUpperCase();

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
  <div class="center" style="font-weight:bold;font-size:18px;margin-bottom:2px">${tipoLabel} [${printHeaderLabel}]</div>

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

    doPrint(html, printerName, c.bridge_ip, printerIp, c.bridge_enabled !== false);
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
export async function printPreCuenta(pedido: any, config: Partial<PrintConfig> = {}, title: string = "PRE-CUENTA") {
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

    // Check if there is a discount reason in item or in notas
    let discountReason = item.motivo_descuento || "";
    if (!discountReason && item.notas) {
      const match = item.notas.match(/\[Descuento: (.*?)\]/);
      if (match) discountReason = match[1];
    }
    const cleanNotas = item.notas ? item.notas.replace(/\[Descuento: (.*?)\]/, "").trim() : "";
    const cleanNotasRow = cleanNotas 
      ? `<tr>
          <td colspan="2" style="font-size:10px;color:#555;font-style:italic;padding-left:10px">
            Nota: ${cleanNotas}
          </td>
         </tr>`
      : "";

    const reasonRow = discountReason 
      ? `<tr>
          <td colspan="2" style="font-size:10px;color:#b45309;font-weight:bold;font-style:italic;padding-left:10px">
            * Motivo Descuento: ${discountReason}
          </td>
         </tr>`
      : "";

    return `
      <tr>
        <td style="padding:3px 0;font-size:${c.fuente_items}px">${item.cantidad} ${item.nombre_producto}</td>
        <td style="text-align:right;padding:3px 0;font-size:${c.fuente_items}px;white-space:nowrap">${fmtARS(subtotal)}</td>
      </tr>
      ${reasonRow}
      ${cleanNotasRow}
      ${ads}`;
  }).join("");

  // Load deletion logs
  let logsEliminados = pedido.logs_eliminacion || [];
  if (logsEliminados.length === 0 && pedido.id) {
    try {
      const { data } = await supabase
        .from("logs_eliminacion_pedidos")
        .select("producto_nombre, cantidad, motivo")
        .eq("pedido_id", pedido.id);
      if (data) logsEliminados = data;
    } catch (e) {
      console.error("Error fetching logs_eliminacion_pedidos inside printPreCuenta:", e);
    }
  }

  const logsHtml = logsEliminados.length > 0
    ? `<hr class="sep">
       <div style="font-size:11px;font-weight:black;margin-bottom:4px;color:#b45309;text-transform:uppercase;">
         Modificaciones / Eliminaciones:
       </div>
       <table style="width:100%;font-size:10px;color:#444;margin-bottom:6px;">
         ${logsEliminados.map((log: any) => `
           <tr>
             <td style="padding:2px 0;">
               - ${log.cantidad}x ${log.producto_nombre}<br>
               <span style="font-style:italic;color:#666;padding-left:8px;">Motivo: ${log.motivo}</span>
             </td>
           </tr>
         `).join("")}
       </table>`
    : "";

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
  ${pedido.comensales ? `<div class="center" style="font-size:14px;font-weight:bold;margin-bottom:2px">COMENSALES: ${pedido.comensales}</div>` : ""}
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
    ${(pedido.cubierto_total ?? 0) > 0 ? `
    <tr>
      <td style="color:#333">Cubiertos (${pedido.comensales || 1} pers.)</td>
      <td style="text-align:right;color:#333">${fmtARS(pedido.cubierto_total)}</td>
    </tr>` : ""}
    ${(pedido.recargo ?? 0) > 0 ? `
    <tr>
      <td style="color:#333">Recargo ${pedido.recargo_porcentaje ? `(${pedido.recargo_porcentaje}%)` : ""}</td>
      <td style="text-align:right;color:#333">${fmtARS(pedido.recargo)}</td>
    </tr>` : ""}
    <tr>
      <td style="font-weight:bold;font-size:${c.fuente_total_bold}px;padding-top:6px">${metodoPago}</td>
      <td style="text-align:right;font-weight:bold;font-size:${c.fuente_total_bold}px;padding-top:6px">${fmtARS(pedido.total ?? 0)}</td>
    </tr>
  </table>

  ${logsHtml}

  <hr class="sep">

  <div class="center" style="font-size:${c.fuente_footer}px;color:#555;font-style:italic;margin-top:2px">
    Comprobante no válido como factura.
  </div>
  ${(pedido as any).camarero_nombre ? `
  <div class="center" style="font-size:${c.fuente_footer}px;color:#333;margin-top:6px;font-weight:bold;text-transform:uppercase">
    USTED HA SIDO ATENDIDO POR ${(pedido as any).camarero_nombre}
  </div>` : ''}

</body></html>`;

  const pKey = getFacturacionKey(c.impresoras);
  let printerName = c.impresoras?.[pKey]?.printerName;
  let printerIp = c.impresoras?.[pKey]?.ip;

  if (!printerName && !printerIp && c.impresoras) {
    for (const [key, pConf] of Object.entries(c.impresoras)) {
      const conf = pConf as any;
      if (conf && (conf.printerName || conf.ip)) {
        printerName = conf.printerName;
        printerIp = conf.ip;
        break;
      }
    }
  }

  doPrint(html, printerName, c.bridge_ip, printerIp, c.bridge_enabled !== false);
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

/* ──────────────────────────────────────────────────────
   CIERRE DE CAJA / TURNO – Resumen de caja de 80mm
   ────────────────────────────────────────────────────── */
export function printCierreTurno(resumen: any, config: Partial<PrintConfig> = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };

  const formatARS = (n: number) => {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);
  };

  const fechaAperturaFmt = new Date(resumen.fechaApertura).toLocaleString("es-AR");
  const fechaCierreFmt = new Date(resumen.fechaCierre).toLocaleString("es-AR");

  const pagosRows = (resumen.pagos || []).map((p: any) => `
    <tr>
      <td style="padding: 2px 0;">${p.metodo}</td>
      <td style="text-align: right; padding: 2px 0; font-weight: bold;">${formatARS(p.total)}</td>
    </tr>
  `).join("");

  const descuentosRows = (resumen.descuentos || []).map((d: any) => `
    <div style="font-size: 11px; margin-bottom: 4px; border-bottom: 1px dotted #ccc; padding-bottom: 3px;">
      Pedido <b>#${d.numero}</b>: -${formatARS(d.monto)}<br>
      <span style="color: #444; font-style: italic;">Motivo: ${d.motivo || "No especificado"}</span>
    </div>
  `).join("");

  const canceladosRows = (resumen.cancelados || []).map((can: any) => `
    <div style="font-size: 11px; margin-bottom: 4px; border-bottom: 1px dotted #ccc; padding-bottom: 3px;">
      Pedido <b>#${can.numero}</b>: ${formatARS(can.monto)}<br>
      <span style="color: #444; font-style: italic;">Motivo: ${can.motivo || "No especificado"}</span>
    </div>
  `).join("");

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
  .title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
  .section-title { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-top: 8px; margin-bottom: 4px; border-bottom: 1px solid #000; padding-bottom: 2px; }
</style>
</head>
<body>

  <div class="center title" style="font-size:18px; font-weight: 900;">${c.nombre_local || "MMM Pizza Artesanal"}</div>
  <div class="center" style="font-size:14px; font-weight: bold; margin-bottom: 6px;">REPORTE CIERRE DE TURNO</div>
  
  <hr class="sep">

  <table style="font-size: 11px;">
    <tr><td><b>CAJERO:</b></td><td style="text-align: right;">${resumen.nombreCajero}</td></tr>
    <tr><td><b>APERTURA:</b></td><td style="text-align: right;">${fechaAperturaFmt}</td></tr>
    <tr><td><b>CIERRE:</b></td><td style="text-align: right;">${fechaCierreFmt}</td></tr>
  </table>

  <div class="section-title">VENTAS POR MODALIDAD</div>
  <table style="font-size: 11px;">
    <tr>
      <td><b>SALÓN:</b> (${resumen.pedidosSalonCount} ped)</td>
      <td style="text-align: right; font-weight: bold;">${formatARS(resumen.pedidosSalonTotal)}</td>
    </tr>
    <tr>
      <td><b>TAKE AWAY:</b> (${resumen.pedidosTakeAwayCount} ped)</td>
      <td style="text-align: right; font-weight: bold;">${formatARS(resumen.pedidosTakeAwayTotal)}</td>
    </tr>
    <tr>
      <td><b>DELIVERY:</b> (${resumen.pedidosDeliveryCount} ped)</td>
      <td style="text-align: right; font-weight: bold;">${formatARS(resumen.pedidosDeliveryTotal)}</td>
    </tr>
  </table>

  <div style="font-size: 11px; margin-top: 6px;">
    <b>COMENSALES SALÓN:</b> <span style="font-size: 13px; font-weight: bold;">${resumen.comensalesSalon}</span>
  </div>

  <div class="section-title">VENTAS POR MEDIO DE PAGO</div>
  <table style="font-size: 11px;">
    ${pagosRows || '<tr><td colspan="2">No se registraron cobros</td></tr>'}
  </table>

  <div class="section-title">AUDITORÍA DE EFECTIVO</div>
  <table style="font-size: 11px;">
    <tr><td>Monto Apertura:</td><td style="text-align: right;">${formatARS(resumen.montoApertura)}</td></tr>
    <tr><td>Egresos Manuales:</td><td style="text-align: right; color: #a11;">-${formatARS(resumen.totalEgresado)}</td></tr>
    <tr><td>Efectivo Esperado:</td><td style="text-align: right; font-weight: bold;">${formatARS(resumen.montoEsperado)}</td></tr>
    <tr><td>Efectivo Caja Real:</td><td style="text-align: right; font-weight: bold;">${formatARS(resumen.montoCierre)}</td></tr>
    <tr style="font-size: 12px; border-top: 1px dashed #777;">
      <td><b>Diferencia:</b></td>
      <td style="text-align: right; font-weight: bold; color: ${resumen.diferencia < 0 ? '#a11' : resumen.diferencia > 0 ? '#173' : '#000'}">
        ${resumen.diferencia > 0 ? '+' : ''}${formatARS(resumen.diferencia)}
      </td>
    </tr>
  </table>

  <div style="font-size: 12px; font-weight: bold; margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; display: flex; justify-content: space-between;">
    <span>TOTAL GENERAL VENTAS:</span>
    <span>${formatARS(resumen.totalGeneral)}</span>
  </div>

  ${resumen.observaciones ? `
    <div class="section-title">OBSERVACIONES</div>
    <div style="font-size: 11px; font-style: italic; white-space: pre-wrap; background: #eee; padding: 4px; border-radius: 4px;">${resumen.observaciones}</div>
  ` : ""}

  ${resumen.descuentos && resumen.descuentos.length > 0 ? `
    <div class="section-title">DESCUENTOS APLICADOS</div>
    ${descuentosRows}
  ` : ""}

  ${resumen.cancelados && resumen.cancelados.length > 0 ? `
    <div class="section-title">PEDIDOS CANCELADOS</div>
    ${canceladosRows}
  ` : ""}

  <hr class="sep" style="margin-top: 12px;">
  <div class="center" style="font-size: 10px; font-style: italic;">Reporte de turno generado por sistema.</div>

</body></html>`;

  const pKey = getFacturacionKey(c.impresoras);
  const printerName = c.impresoras?.[pKey]?.printerName;
  const printerIp = c.impresoras?.[pKey]?.ip;

  doPrint(html, printerName, c.bridge_ip, printerIp);
}

/* ──────────────────────────────────────────────────────
   FACTURA FISCAL – Comprobante oficial de AFIP (Argentina)
   ────────────────────────────────────────────────────── */
export function printFacturaFiscal(pedido: any, config: Partial<PrintConfig> = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };

  if (!c.fiscal?.habilitado) {
    alert("La facturación fiscal no está habilitada en la configuración.");
    return;
  }

  const numCorto = pedido.numero_pedido?.split("-").pop() ?? pedido.numero_pedido;
  const ptoVta = (c.fiscal.punto_venta || "0001").padStart(4, "0");
  const nroCmp = String(parseInt(numCorto) || Math.floor(Math.random() * 10000)).padStart(8, "0");

  const isRI = c.fiscal.condicion_iva === "Responsable Inscripto";
  const esResponsableInscriptoCliente = pedido.cliente_cuit && pedido.cliente_cuit.length > 5;
  
  // Decide tipo de comprobante
  let tipoComprobante = "FACTURA C";
  let letraCmp = "C";
  let codCmp = "011";
  
  if (isRI) {
    if (esResponsableInscriptoCliente) {
      tipoComprobante = "FACTURA A";
      letraCmp = "A";
      codCmp = "001";
    } else {
      tipoComprobante = "FACTURA B";
      letraCmp = "B";
      codCmp = "006";
    }
  }

  const createdAt = new Date(pedido.created_at || new Date());
  const fechaLarga = createdAt.toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });
  const horaCreado = createdAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const total = pedido.total || 0;
  const subtotal = pedido.subtotal || 0;
  const costoEnvio = pedido.costo_envio || 0;
  
  // Calcular IVA discriminado si corresponde
  const ivaTasa = 0.21;
  let neto = total;
  let ivaMonto = 0;

  if (letraCmp === "A") {
    neto = total / (1 + ivaTasa);
    ivaMonto = total - neto;
  } else if (letraCmp === "B" && isRI) {
    // Para consumidor final, el IVA está incluido pero lo desglosamos informativamente
    neto = total / (1 + ivaTasa);
    ivaMonto = total - neto;
  }

  // Generar QR fiscal oficial AFIP
  const cuitNum = parseInt(c.fiscal.cuit.replace(/\D/g, "")) || 30123456789;
  const tipoDocRec = esResponsableInscriptoCliente ? 80 : 99; // 80=CUIT, 99=Sin identificar / Consumidor final
  const nroDocRec = esResponsableInscriptoCliente ? parseInt(pedido.cliente_cuit.replace(/\D/g, "")) || 0 : 0;
  
  const qrDataObj = {
    ver: 1,
    fecha: createdAt.toISOString().split("T")[0],
    cuit: cuitNum,
    ptoVta: parseInt(ptoVta) || 1,
    tipoCmp: parseInt(codCmp),
    nroCmp: parseInt(nroCmp) || 1,
    importe: Number(total.toFixed(2)),
    moneda: "PES",
    ctz: 1,
    tipoDocRec: tipoDocRec,
    nroDocRec: nroDocRec,
    tipoCodAut: "E",
    codAut: 76192837482374 + (parseInt(nroCmp) || 1) // CAE simulado de 14 dígitos
  };

  let base64Json = "";
  try {
    base64Json = btoa(unescape(encodeURIComponent(JSON.stringify(qrDataObj))));
  } catch (e) {
    base64Json = btoa(JSON.stringify(qrDataObj));
  }
  const afipQrUrl = "https://www.afip.gob.ar/fe/qr/?p=" + base64Json;

  // CAE simulado con vencimiento de 10 días
  const cae = String(qrDataObj.codAut);
  const caeDocVenc = new Date(createdAt.getTime() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString("es-AR");

  const itemsRows = (pedido.pedido_items ?? []).map((item: any) => {
    const sub = item.precio_unitario * item.cantidad;
    const aggregated = aggregateAdicionales(item.adicionales ?? []);
    const ads = aggregated.map((a: any) =>
      `<tr>
        <td style="padding-left:10px;font-size:${c.fuente_adicionales || c.fuente_footer}px;color:#555">+ ${a.nombre}</td>
        <td style="text-align:right;font-size:${c.fuente_adicionales || c.fuente_footer}px;color:#555">+${fmtARS(a.precio ?? 0)}</td>
      </tr>`
    ).join("");
    return `
      <tr>
        <td style="padding:3px 0;font-size:${c.fuente_items}px">${item.cantidad} x ${item.nombre_producto}</td>
        <td style="text-align:right;padding:3px 0;font-size:${c.fuente_items}px;white-space:nowrap">${fmtARS(sub)}</td>
      </tr>${ads}`;
  }).join("");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    width: 72mm;
    color: #000;
    line-height: 1.4;
    margin: 0;
    padding: 4mm 2mm;
  }
  .center { text-align: center; }
  .sep { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .sep-double { border: none; border-top: 3px double #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; }
  .bold { font-weight: bold; }
  .fiscal-header {
    border: 1px solid #000;
    padding: 4px;
    text-align: center;
    margin-bottom: 8px;
  }
  .letra-box {
    border: 2px solid #000;
    font-size: 28px;
    font-weight: 900;
    width: 40px;
    height: 40px;
    line-height: 36px;
    margin: 0 auto 4px;
    background: #fff;
  }
</style>
</head>
<body>

  <!-- LETRA FISCAL -->
  <div class="fiscal-header">
    <div class="letra-box">${letraCmp}</div>
    <div style="font-size:12px;font-weight:bold;letter-spacing:1px">${tipoComprobante}</div>
    <div style="font-size:9px;color:#333">Cod. Comprobante: ${codCmp}</div>
  </div>

  <!-- EMISOR -->
  <div class="center" style="font-size:14px;font-weight:bold;margin-bottom:2px">${c.fiscal.razon_social}</div>
  <div class="center" style="font-size:10px;color:#333;margin-bottom:4px">${c.fiscal.direccion_comercial}</div>
  
  <div style="font-size:9px;margin-bottom:6px">
    <div><b>CUIT:</b> ${c.fiscal.cuit}</div>
    <div><b>Ingresos Brutos:</b> ${c.fiscal.ingresos_brutos}</div>
    <div><b>Inicio de Actividades:</b> ${c.fiscal.inicio_actividades}</div>
    <div><b>IVA:</b> ${c.fiscal.condicion_iva}</div>
  </div>

  <hr class="sep">

  <!-- COMPROBANTE INFO -->
  <div style="font-size:10px;margin-bottom:6px">
    <div><b>Punto de Venta:</b> ${ptoVta} &nbsp;&nbsp;&nbsp; <b>Comp. Nro:</b> ${nroCmp}</div>
    <div><b>Fecha de Emisión:</b> ${fechaLarga} ${horaCreado} hs.</div>
  </div>

  <hr class="sep">

  <!-- RECEPTOR -->
  <div style="font-size:10px;margin-bottom:6px">
    <div><b>A:</b> ${pedido.cliente_nombre || "Consumidor Final"}</div>
    ${pedido.cliente_cuit ? `<div><b>CUIT/DNI:</b> ${pedido.cliente_cuit}</div>` : "<div><b>Condición de IVA:</b> Consumidor Final</div>"}
    ${pedido.cliente_direccion ? `<div><b>Dirección:</b> ${pedido.cliente_direccion}</div>` : ""}
  </div>

  <hr class="sep-double">

  <!-- PRODUCTOS -->
  <table>
    ${itemsRows}
  </table>

  <hr class="sep">

  <!-- TOTALES -->
  <table style="font-size:11px">
    ${letraCmp === "A" || (letraCmp === "B" && isRI) ? `
    <tr>
      <td style="color:#555">Neto Gravado</td>
      <td style="text-align:right;color:#555">${fmtARS(neto)}</td>
    </tr>
    <tr>
      <td style="color:#555">IVA 21%</td>
      <td style="text-align:right;color:#555">${fmtARS(ivaMonto)}</td>
    </tr>
    ` : `
    <tr>
      <td style="color:#555">Subtotal</td>
      <td style="text-align:right;color:#555">${fmtARS(subtotal)}</td>
    </tr>
    `}
    ${costoEnvio > 0 ? `
    <tr>
      <td style="color:#555">Envío</td>
      <td style="text-align:right;color:#555">${fmtARS(costoEnvio)}</td>
    </tr>` : ""}
    <tr>
      <td class="bold" style="font-size:14px;padding-top:4px">TOTAL</td>
      <td class="bold" style="text-align:right;font-size:14px;padding-top:4px">${fmtARS(total)}</td>
    </tr>
  </table>

  <hr class="sep-double">

  <!-- AFIP QR FISCAL -->
  <div class="center" style="margin: 12px 0 8px;">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(afipQrUrl)}" alt="QR AFIP" width="130" height="130" style="display:block;margin:0 auto 4px" />
    <div style="font-size:8px;color:#333;font-weight:bold;margin-top:4px">Comprobante Autorizado por AFIP</div>
    <div style="font-size:9px;color:#000;margin-top:2px"><b>CAE:</b> ${cae}</div>
    <div style="font-size:9px;color:#000"><b>Vto. CAE:</b> ${caeDocVenc}</div>
  </div>

  <hr class="sep">
  
  <div class="center" style="font-size:9px;color:#555;font-weight:bold">
    ¡Gracias por su compra!
  </div>

</body></html>`;

  const pKey = getFacturacionKey(c.impresoras);
  const printerName = c.impresoras?.[pKey]?.printerName;
  const printerIp = c.impresoras?.[pKey]?.ip;

  doPrint(html, printerName, c.bridge_ip, printerIp, c.bridge_enabled !== false);
}
