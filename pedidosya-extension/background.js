// service worker de la extensión

// Listener de mensajes que llegan desde content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SEND_PEDIDO_SUPABASE") {
        enviarASupabase(request.payload)
            .then(res => sendResponse({ success: true, data: res }))
            .catch(err => sendResponse({ success: false, error: err.message }));

        return true; // Mantiene el canal abierto para la respuesta asíncrona
    }
});

async function enviarASupabase(pedidoPY) {
    // Leer config del storage local de chrome
    const config = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'sucursalId']);

    if (!config.supabaseUrl || !config.supabaseKey || !config.sucursalId) {
        throw new Error("Credenciales de Supabase no configuradas en el popup de la extensión.");
    }

    const { supabaseUrl, supabaseKey, sucursalId } = config;

    // 1. Armar número de pedido único pseudo-consecutivo (Para evitar lock del trigger viejo)
    const yearPart = new Date().getFullYear().toString().slice(-2);
    const randomSeq = Math.floor(Math.random() * 900000) + 100000;
    const numeroPedido = `PY-${yearPart}${randomSeq}`;

    const subtotal = pedidoPY.total; // Simplificación
    const total = pedidoPY.total;

    // 2. Insertar cabecera del Pedido
    const headers = {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };

    const pedidoBody = {
        sucursal_id: sucursalId,
        numero_pedido: numeroPedido,
        cliente_nombre: pedidoPY.cliente,
        cliente_telefono: "0000000000", // PY no da el telefono directo hasta aceptar
        tipo: 'delivery',
        estado: 'pendiente',
        origen: 'pedidosya',
        subtotal: subtotal,
        costo_envio: 0,
        propina: 0,
        total: total,
        metodo_pago_nombre: pedidoPY.metodo_pago,
        notas: `ID PedidosYa: ${pedidoPY.id_py}`
    };

    const resPedido = await fetch(`${supabaseUrl}/rest/v1/pedidos`, {
        method: "POST",
        headers,
        body: JSON.stringify(pedidoBody)
    });

    if (!resPedido.ok) {
        const errJson = await resPedido.json();
        throw new Error(`Error en cabecera de pedido: ${JSON.stringify(errJson)}`);
    }

    const pedidoData = await resPedido.json();
    const dbPedidoId = pedidoData[0].id;

    // 3. Insertar Items e identificar/crear Productos
    const itemsParaCargar = (pedidoPY.items && pedidoPY.items.length > 0)
        ? pedidoPY.items
        : [{ nombre: "Pedido PedidosYa", cantidad: 1, precio: pedidoPY.total, adicionales: [] }];

    const itemsToInsert = [];

    for (const item of itemsParaCargar) {
        let productoId = null;

        // a. Buscar el producto por nombre en Supabase
        const resSearch = await fetch(`${supabaseUrl}/rest/v1/productos?nombre=eq.${encodeURIComponent(item.nombre)}&select=id`, {
            method: "GET",
            headers
        });

        if (resSearch.ok) {
            const searchData = await resSearch.json();
            if (searchData && searchData.length > 0) {
                productoId = searchData[0].id;
            }
        }

        // b. Si no existe, lo creamos como inactivo
        if (!productoId) {
            const nuevoProd = {
                sucursal_id: sucursalId,
                nombre: item.nombre,
                descripcion: "Auto-generado desde PedidosYa",
                precio: item.precio || 0,
                estado: 'inactivo',
                disponible: true
            };

            const resCreate = await fetch(`${supabaseUrl}/rest/v1/productos`, {
                method: "POST",
                headers,
                body: JSON.stringify(nuevoProd)
            });

            if (resCreate.ok) {
                const createdData = await resCreate.json();
                if (createdData && createdData.length > 0) {
                    productoId = createdData[0].id;
                }
            }
        }

        // c. Preparar el item del pedido
        itemsToInsert.push({
            pedido_id: dbPedidoId,
            producto_id: productoId,
            nombre_producto: item.nombre,
            cantidad: item.cantidad,
            precio_unitario: item.precio || 0,
            notas: Array.isArray(item.adicionales) ? item.adicionales.join(", ") : (item.adicionales || "")
        });
    }

    // d. Impactar todos los items generados en la DB
    const resItems = await fetch(`${supabaseUrl}/rest/v1/pedido_items`, {
        method: "POST",
        headers,
        body: JSON.stringify(itemsToInsert)
    });

    if (!resItems.ok) {
        console.warn("Error insertando los items:", await resItems.text());
    }

    return dbPedidoId;
}

