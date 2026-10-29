// content.js - Inyectado en portal-app.pedidosya.com / partner.pedidosya.com
console.log("🍕 MMM SYSTEM LINKER: Monitor de PedidosYa v2.10 Iniciado");

// Inyectar el script interceptor en el DOM de la página
function injectScript(file) {
    try {
        const s = document.createElement('script');
        s.setAttribute('type', 'text/javascript');
        s.setAttribute('src', chrome.runtime.getURL(file));
        (document.head || document.documentElement).appendChild(s);
        s.onload = () => s.remove();
    } catch (e) {
        console.error("Error inyectando script:", e);
    }
}

injectScript('injected.js');

// Evitar procesar el mismo pedido en el mismo estado múltiples veces
let ultimosEstados = new Map(); // id_py_estado -> true

// Mapeo automático de estados de PedidosYa hacia MMM SYSTEM
function mapearEstadoPedidosYa(rawStatus) {
    if (!rawStatus) return "preparando";
    const s = rawStatus.toUpperCase().trim();

    // 1. Entregado / Finalizado / Despachado / Cancelado / Baja
    if (s.includes("DELIVERED") || 
        s.includes("PICKED_UP") || 
        s.includes("IN_DELIVERY") || 
        s.includes("RECONCILED") || 
        s.includes("RECONCILIATION") ||
        s.includes("CANCELLED") ||
        s.includes("CANCELED") ||
        s.includes("REJECTED")) {
        return "entregado";
    }

    // 2. Listo (Comida lista para retirar / rider asignado o esperando)
    if (s.includes("READY") || 
        s.includes("WAITING_FOR_TRANSPORT") || 
        s.includes("WAITING_FOR_COURIER") || 
        s.includes("COURIER_ARRIVED") ||
        s.includes("DRIVER_ARRIVED") ||
        s.includes("NEAR_STORE")) {
        return "listo";
    }

    // 3. Todo pedido entrante / recibido / aceptado / impreso en PedidosYa: EN PREPARACIÓN
    // PedidosYa no utiliza confirmación manual en MMM: al entrar e imprimirse se cocina directamente
    return "preparando";
}

// Escuchar mensajes provenientes de injected.js
window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;

    if (event.data.source === "MMM_PY_INTERCEPTOR") {
        const { tipo, url, data } = event.data.payload || {};
        if (!data) return;

        if (tipo === "CATALOGO_PY") {
            procesarCatalogo(data, url);
        } else {
            procesarDatosDeRed(data, url);
        }
    } else if (event.data.source === "MMM_PY_ACTION_RESULT") {
        const { actionId, success, error } = event.data;
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: "UPDATE_PEDIDOSYA_ACTION",
                payload: { actionId, success, error }
            });
        }
    } else if (event.data.source === "MMM_PY_HTTP_REQUEST") {
        const { requestId, payload } = event.data;
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: "EXECUTE_PY_HTTP",
                payload: payload
            }, (res) => {
                const response = res || { ok: false, error: chrome.runtime?.lastError?.message || "Error en background" };
                window.postMessage({
                    source: "MMM_PY_HTTP_RESPONSE",
                    requestId: requestId,
                    response: response
                }, "*");
            });
        } else {
            window.postMessage({
                source: "MMM_PY_HTTP_RESPONSE",
                requestId: requestId,
                response: { ok: false, error: "Extensión no disponible en content.js" }
            }, "*");
        }
    }
});

// Polling de acciones pendientes desde MMM SYSTEM hacia PedidosYa (cada 12 segundos)
setInterval(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;

    chrome.runtime.sendMessage({ action: "POLL_PEDIDOSYA_ACTIONS" }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res && res.success && Array.isArray(res.acciones) && res.acciones.length > 0) {
            console.log(`⚡ [MMM System Linker] Se recibieron ${res.acciones.length} acciones para ejecutar en PedidosYa:`, res.acciones);
            res.acciones.forEach(action => {
                window.postMessage({
                    source: "MMM_PY_EXECUTE_ACTION",
                    action: action
                }, "*");
            });
        }
    });
}, 12000);

function parseNumeroPrecio(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const clean = val.replace(/[^0-9.,]/g, '').trim();
        if (!clean) return 0;
        if (clean.includes(',') && clean.includes('.')) {
            return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
        }
        if (clean.includes(',')) {
            return parseFloat(clean.replace(',', '.'));
        }
        return parseFloat(clean);
    }
    return 0;
}

function extraerPrecioProducto(p) {
    if (!p || typeof p !== 'object') return 0;

    // 1. Directo en p.price o p.pricing
    let precio = parseNumeroPrecio(p.price) || 
                 parseNumeroPrecio(p.pricing?.price) || 
                 parseNumeroPrecio(p.pricing?.amount) || 
                 parseNumeroPrecio(p.vendorPrice) || 
                 parseNumeroPrecio(p.salePrice) || 
                 parseNumeroPrecio(p.basePrice) || 
                 parseNumeroPrecio(p.unitPrice) || 
                 parseNumeroPrecio(p.amount) || 
                 parseNumeroPrecio(p.finalPrice);
    if (precio > 0) return precio;

    // 2. En vendorOverrides (Delivery Hero / PedidosYa v5)
    if (p.vendorOverrides && typeof p.vendorOverrides === 'object') {
        const vo = p.vendorOverrides;
        precio = parseNumeroPrecio(vo.price) || 
                 parseNumeroPrecio(vo.pricing?.price) || 
                 parseNumeroPrecio(vo.pricing?.amount) || 
                 parseNumeroPrecio(vo.vendorPrice) || 
                 parseNumeroPrecio(vo.basePrice);
        if (precio > 0) return precio;
    }

    // 3. En sizes (Delivery Hero con sizeSupport=true)
    if (Array.isArray(p.sizes) && p.sizes.length > 0) {
        for (const s of p.sizes) {
            precio = parseNumeroPrecio(s.price) || 
                     parseNumeroPrecio(s.vendorPrice) || 
                     parseNumeroPrecio(s.pricing?.price) || 
                     parseNumeroPrecio(s.pricing?.amount) || 
                     parseNumeroPrecio(s.vendorOverrides?.price);
            if (precio > 0) return precio;
        }
    }

    // 4. En variants
    if (Array.isArray(p.variants) && p.variants.length > 0) {
        for (const v of p.variants) {
            precio = parseNumeroPrecio(v.price) || 
                     parseNumeroPrecio(v.pricing?.price) || 
                     parseNumeroPrecio(v.pricing?.amount);
            if (precio > 0) return precio;
        }
    }

    return 0;
}

// Desempaquetador universal recursivo de productos de catálogo
function aplanarProductos(data) {
    const list = [];
    const seen = new Set();
    if (!data) return list;

    function walk(node) {
        if (!node || typeof node !== 'object') return;

        if (Array.isArray(node)) {
            for (const item of node) walk(item);
            return;
        }

        // Explorar posibles contenedores de catálogo
        if (Array.isArray(node.products)) walk(node.products);
        if (Array.isArray(node.items)) walk(node.items);
        if (Array.isArray(node.categories)) walk(node.categories);
        if (Array.isArray(node.sections)) walk(node.sections);
        if (Array.isArray(node.catalogProducts)) walk(node.catalogProducts);
        if (Array.isArray(node.elements)) walk(node.elements);
        if (Array.isArray(node.data)) walk(node.data);

        const id = node.id || node.productId || node.catalogProductId || node.code;
        const name = node.name || node.title || node.productName;

        if (name && typeof name === 'string' && id) {
            const sId = String(id).trim();
            if (!seen.has(sId)) {
                seen.add(sId);
                list.push(node);
            }
        }
    }

    walk(data);
    return list;
}

// Extraer lista de productos desde los diferentes formatos de catálogo de PedidosYa
function extraerProductosCatalogo(data) {
    const prods = aplanarProductos(data);
    const resultado = [];
    const vistos = new Set();

    prods.forEach(p => {
        if (!p || typeof p !== 'object') return;
        const nombre = p.name || p.title || p.productName;
        if (!nombre || typeof nombre !== 'string') return;

        const cleanNombre = nombre.trim();
        const norm = cleanNombre.toLowerCase();
        if (vistos.has(norm)) return;
        vistos.add(norm);

        const precio = extraerPrecioProducto(p);
        const descripcion = p.description || p.desc || "";
        const imagenUrl = p.imageUrl || p.image || p.picture || (Array.isArray(p.images) && p.images[0]?.url) || "";
        const idPy = p.id || p.productId || p.catalogProductId || p.code || "";

        resultado.push({
            id_py: String(idPy),
            nombre: cleanNombre,
            descripcion: descripcion.trim(),
            precio: precio || 0,
            imagen_url: imagenUrl
        });
    });

    return resultado;
}

function procesarCatalogo(data, url) {
    try {
        const productos = extraerProductosCatalogo(data);
        if (!productos || productos.length === 0) return;

        console.log(`📋 [MMM System Linker] Catálogo detectado (${productos.length} productos).`);

        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({
                action: "PEDIDOSYA_CATALOG_DETECTED",
                payload: { productos }
            });
        }
    } catch (e) {
        console.error("Error procesando catálogo:", e);
    }
}

// Validación estricta: sólo pedidos reales de clientes, NUNCA productos del catálogo
function esPedidoValido(obj) {
    if (!obj || typeof obj !== 'object') return false;

    // Si tiene campos de catálogo/producto de menú, descartar inmediatamente
    if (obj.categoryId || obj.modifierGroupIds || obj.barcode || obj.sectionId || obj.platformCatalogId) {
        return false;
    }

    // Debe tener un identificador
    const id = obj.id || obj.orderId || obj.deliveryId;
    if (!id) return false;

    // Debe tener estado de pedido, datos de cliente, items, o total válido
    const hasStatus = !!(obj.status || obj.deliveryStatus || obj.state);
    const hasCustomer = !!(obj.customer || obj.customerName || obj.user);
    const hasItems = Array.isArray(obj.items || obj.products || obj.orderItems) && (obj.items?.length > 0 || obj.products?.length > 0);
    const total = parseFloat(obj.total || obj.totalAmount || obj.pricing?.total || obj.payment?.total || 0);

    // Si no tiene status ni cliente ni items y el total es 0, no es un pedido de cliente
    if (!hasStatus && !hasCustomer && (!hasItems || total === 0)) {
        return false;
    }

    return true;
}

function procesarDatosDeRed(data, url) {
    let candidatos = [];

    if (Array.isArray(data)) {
        candidatos = data;
    } else if (data.deliveries && Array.isArray(data.deliveries)) {
        candidatos = data.deliveries;
    } else if (data.orders && Array.isArray(data.orders)) {
        candidatos = data.orders;
    } else if (data.items && Array.isArray(data.items) && (data.customer || data.status || data.deliveryId || data.orderId)) {
        candidatos = [data];
    } else if (data.id && (data.customer || data.status || data.deliveryId || data.orderId)) {
        candidatos = [data];
    }

    candidatos.forEach(item => {
        if (esPedidoValido(item)) {
            normalizarYEnviarOrden(item);
        }
    });
}

function normalizarYEnviarOrden(orden) {
    try {
        const idPy = orden.id || orden.orderId || orden.shortId || orden.deliveryId || orden.code;
        if (!idPy) return;

        const idStr = String(idPy);
        const rawStatus = (orden.status || orden.deliveryStatus || '').toUpperCase().trim();

        const estadoMmm = mapearEstadoPedidosYa(rawStatus);

        // Si ya procesamos esta orden con este mismo estado mapeado, no volvemos a enviarla
        const estadoKey = `${idStr}_${estadoMmm}`;
        if (ultimosEstados.has(estadoKey)) {
            return;
        }

        // Buscar el NÚMERO VISIBLE REAL de comanda (ej: #1234, 4521, etc.)
        let numeroReal = orden.orderNumber || 
                         orden.order_number || 
                         orden.displayNumber || 
                         orden.displayId || 
                         orden.shortNumber || 
                         orden.shortOrderNumber || 
                         orden.ticketNumber || 
                         orden.posId ||
                         null;

        // Si no viene campo específico pero 'code' o 'shortId' no es el uuid gigante, usarlo
        if (!numeroReal && orden.code && String(orden.code).length <= 8) {
            numeroReal = orden.code;
        }
        if (!numeroReal && orden.shortId && String(orden.shortId).length <= 8) {
            numeroReal = orden.shortId;
        }

        // Datos del cliente
        let rawClienteNombre = "";
        if (orden.customer) {
            if (orden.customer.name) {
                rawClienteNombre = orden.customer.name;
            } else if (orden.customer.fullName) {
                rawClienteNombre = orden.customer.fullName;
            } else if (orden.customer.firstName || orden.customer.lastName) {
                rawClienteNombre = `${orden.customer.firstName || ''} ${orden.customer.lastName || ''}`.trim();
            }
        }
        if (!rawClienteNombre) {
            rawClienteNombre = orden.customerName || 
                               orden.clientName || 
                               orden.recipient?.name || 
                               orden.delivery?.customer?.name || 
                               orden.delivery?.customerName ||
                               orden.user?.name || 
                               (orden.user?.firstName ? `${orden.user.firstName || ''} ${orden.user.lastName || ''}`.trim() : "") ||
                               "";
        }

        let clienteNombre = "";
        if (rawClienteNombre && rawClienteNombre.trim()) {
            const clean = rawClienteNombre.trim();
            clienteNombre = clean.toLowerCase().includes("(peya)") ? clean : `${clean} (peya)`;
        } else {
            clienteNombre = "Cliente (peya)";
        }

        const clienteTelefono = orden.customer?.phone || orden.customerPhone || "0000000000";
        const clienteDireccion = orden.customer?.address?.street || orden.address || "";

        // Totales
        const total = parseFloat(orden.total || orden.totalAmount || orden.pricing?.total || orden.payment?.total || 0);

        // Método de pago
        let metodoPago = "Online / Pagado";
        const paymentMethod = (orden.payment?.method || orden.paymentMethod || '').toLowerCase();
        if (paymentMethod.includes("cash") || paymentMethod.includes("efectivo")) {
            metodoPago = "Efectivo";
        }

        // Ítems / Productos
        const rawItems = orden.items || orden.products || orden.orderItems || [];
        const items = [];

        rawItems.forEach(item => {
            const nombre = item.name || item.productName || item.title || "Producto PedidosYa";
            const cantidad = parseInt(item.quantity || item.qty || 1);
            const precio = parseFloat(item.price || item.unitPrice || 0);
            
            // Adicionales / toppings / gustos
            const adicionales = [];
            const subitems = item.options || item.modifiers || item.subItems || item.toppings || [];
            subitems.forEach(sub => {
                const subNombre = sub.name || sub.title;
                if (subNombre) adicionales.push(subNombre);
            });

            const notasItem = item.notes || item.comment || "";

            items.push({
                nombre,
                cantidad,
                precio,
                adicionales,
                notas: notasItem
            });
        });

        // Notas del pedido completo
        const notas = orden.notes || orden.comment || orden.deliveryNotes || `ID PedidosYa: ${idStr}`;

        const payload = {
            id_py: idStr,
            status_py: rawStatus,
            estado_mmm: estadoMmm,
            numero_real: numeroReal ? String(numeroReal).replace(/^#/, '').trim() : null,
            cliente: clienteNombre,
            telefono: clienteTelefono,
            direccion: clienteDireccion,
            total,
            metodo_pago: metodoPago,
            notas,
            items: items.length > 0 ? items : [{ nombre: "Pedido PedidosYa", cantidad: 1, precio: total, adicionales: [] }]
        };

        console.log(`✨ [MMM System Linker] Pedido #${payload.numero_real || idStr} (${rawStatus} ➔ ${estadoMmm}). Enviando a MMM SYSTEM...`, payload);

        // Manejar envío verificando contexto válido de la extensión
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({ action: "SEND_PEDIDO_SUPABASE", payload }, (res) => {
                if (chrome.runtime.lastError) {
                    console.warn("Aviso extensión:", chrome.runtime.lastError.message);
                    return;
                }
                if (res && res.success) {
                    console.log(`✅ [MMM System Linker] Pedido #${res.numeroPedido || idStr} actualizado a '${estadoMmm}' en el panel.`);
                    ultimosEstados.set(estadoKey, true);
                } else {
                    console.error(`❌ [MMM System Linker] Error actualizando pedido #${idStr}:`, res?.error);
                }
            });
        }

    } catch (e) {
        console.error("Error parseando orden interceptada:", e);
    }
}
