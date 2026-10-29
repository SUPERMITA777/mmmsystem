// content.js - Inyectado en portal-app.pedidosya.com / partner.pedidosya.com
console.log("🍕 MMM SYSTEM LINKER: Monitor de PedidosYa v2.0 Iniciado");

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

// Escuchar los mensajes del script inyectado
let procesados = new Set();

window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "MMM_PY_INTERCEPTOR") {
        return;
    }

    const { url, data } = event.data.payload || {};
    if (!data) return;

    procesarDatosDeRed(data);
});

function procesarDatosDeRed(data) {
    // La respuesta puede ser un array de órdenes o un objeto con lista
    let ordenes = [];
    if (Array.isArray(data)) {
        ordenes = data;
    } else if (data.orders && Array.isArray(data.orders)) {
        ordenes = data.orders;
    } else if (data.deliveries && Array.isArray(data.deliveries)) {
        ordenes = data.deliveries;
    } else if (data.items && Array.isArray(data.items)) {
        ordenes = [data];
    } else if (data.id || data.orderId) {
        ordenes = [data];
    }

    ordenes.forEach(orden => {
        normalizarYEnviarOrden(orden);
    });
}

function normalizarYEnviarOrden(orden) {
    try {
        const idPy = orden.id || orden.orderId || orden.shortId || orden.deliveryId || orden.code;
        if (!idPy) return;

        const idStr = String(idPy);
        if (procesados.has(idStr)) return;

        // Si la orden ya está cancelada o rechazada, no la cargamos como nueva
        const status = (orden.status || '').toUpperCase();
        if (status.includes("CANCELLED") || status.includes("REJECTED")) {
            return;
        }

        // Datos del cliente
        const clienteNombre = orden.customer?.name || 
                              orden.customer?.fullName || 
                              orden.customerName || 
                              orden.user?.name || 
                              "Cliente PedidosYa";

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
            cliente: clienteNombre,
            telefono: clienteTelefono,
            direccion: clienteDireccion,
            total,
            metodo_pago: metodoPago,
            notas,
            items: items.length > 0 ? items : [{ nombre: "Pedido PedidosYa", cantidad: 1, precio: total, adicionales: [] }]
        };

        console.log(`✨ [MMM System Linker] ¡Nueva orden detectada #${idStr}! Enviando a MMM SYSTEM...`, payload);

        chrome.runtime.sendMessage({ action: "SEND_PEDIDO_SUPABASE", payload }, (res) => {
            if (res && res.success) {
                console.log(`✅ [MMM System Linker] Pedido #${idStr} cargado exitosamente en el panel.`);
                procesados.add(idStr);
            } else {
                console.error(`❌ [MMM System Linker] Error cargando pedido #${idStr}:`, res?.error);
            }
        });

    } catch (e) {
        console.error("Error parseando orden interceptada:", e);
    }
}
