// background.js - Service worker de la extensión MMM System PedidosYa Linker

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SEND_PEDIDO_SUPABASE") {
        enviarASupabase(request.payload)
            .then(res => sendResponse({ success: true, data: res }))
            .catch(err => sendResponse({ success: false, error: err.message }));

        return true; // Canal abierto para respuesta asíncrona
    }
});

async function enviarASupabase(pedidoPY) {
    const config = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'sucursalId']);

    if (!config.supabaseUrl || !config.supabaseKey || !config.sucursalId) {
        throw new Error("Credenciales de Supabase no configuradas en el popup de la extensión.");
    }

    const { supabaseUrl, supabaseKey, sucursalId } = config;

    const headers = {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };

    // 1. Verificar si el pedido ya existe por su nota o id de PedidosYa
    const idPyStr = String(pedidoPY.id_py);
    const resCheck = await fetch(`${supabaseUrl}/rest/v1/pedidos?sucursal_id=eq.${sucursalId}&notas=like.*${encodeURIComponent(idPyStr)}*&select=id`, {
        method: "GET",
        headers
    });

    if (resCheck.ok) {
        const exist = await resCheck.json();
        if (exist && exist.length > 0) {
            console.log(`[MMM PY] El pedido ${idPyStr} ya existe en Supabase (ID: ${exist[0].id}). Se omite.`);
            return exist[0].id;
        }
    }

    // 2. Armar número de pedido único legible
    const yearPart = new Date().getFullYear().toString().slice(-2);
    const shortPy = idPyStr.length > 6 ? idPyStr.slice(-6) : idPyStr;
    const numeroPedido = `PY-${yearPart}${shortPy}`;

    const subtotal = pedidoPY.total || 0;
    const total = pedidoPY.total || 0;

    const pedidoBody = {
        sucursal_id: sucursalId,
        numero_pedido: numeroPedido,
        cliente_nombre: pedidoPY.cliente || "Cliente PedidosYa",
        cliente_telefono: pedidoPY.telefono || "0000000000",
        cliente_direccion: pedidoPY.direccion || "",
        tipo: 'delivery',
        estado: 'pendiente',
        origen: 'pedidosya',
        subtotal: subtotal,
        costo_envio: 0,
        propina: 0,
        total: total,
        metodo_pago_nombre: pedidoPY.metodo_pago || "Online / Pagado",
        pago_confirmado: (pedidoPY.metodo_pago || "").toLowerCase().includes("online"),
        notas: `ID PedidosYa: ${idPyStr}`
    };

    const resPedido = await fetch(`${supabaseUrl}/rest/v1/pedidos`, {
        method: "POST",
        headers,
        body: JSON.stringify(pedidoBody)
    });

    if (!resPedido.ok) {
        const errJson = await resPedido.json().catch(() => ({}));
        throw new Error(`Error en cabecera de pedido: ${JSON.stringify(errJson)}`);
    }

    const pedidoData = await resPedido.json();
    const dbPedidoId = pedidoData[0].id;

    // 3. Insertar Items e identificar/crear Productos
    const itemsParaCargar = (pedidoPY.items && pedidoPY.items.length > 0)
        ? pedidoPY.items
        : [{ nombre: "Pedido PedidosYa", cantidad: 1, precio: total, adicionales: [] }];

    const itemsToInsert = [];

    for (const item of itemsParaCargar) {
        let productoId = null;

        // a. Buscar el producto por nombre en Supabase
        const resSearch = await fetch(`${supabaseUrl}/rest/v1/productos?sucursal_id=eq.${sucursalId}&nombre=ilike.${encodeURIComponent(item.nombre)}&select=id`, {
            method: "GET",
            headers
        });

        if (resSearch.ok) {
            const searchData = await resSearch.json().catch(() => []);
            if (searchData && searchData.length > 0) {
                productoId = searchData[0].id;
            }
        }

        // b. Si no existe, crearlo como inactivo
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
                const createdData = await resCreate.json().catch(() => []);
                if (createdData && createdData.length > 0) {
                    productoId = createdData[0].id;
                }
            }
        }

        // c. Preparar item
        const adicionalesTexto = Array.isArray(item.adicionales) ? item.adicionales.join(", ") : (item.adicionales || "");
        const notasItem = [adicionalesTexto, item.notas].filter(Boolean).join(" | ");

        itemsToInsert.push({
            pedido_id: dbPedidoId,
            producto_id: productoId,
            nombre_producto: item.nombre,
            cantidad: item.cantidad || 1,
            precio_unitario: item.precio || 0,
            notas: notasItem,
            adicionales: Array.isArray(item.adicionales) ? item.adicionales.map(a => ({ nombre: a, precio: 0 })) : []
        });
    }

    // d. Insertar ítems en pedido_items
    const resItems = await fetch(`${supabaseUrl}/rest/v1/pedido_items`, {
        method: "POST",
        headers,
        body: JSON.stringify(itemsToInsert)
    });

    if (!resItems.ok) {
        console.warn("[MMM PY] Error insertando items:", await resItems.text().catch(() => ""));
    }

    console.log(`[MMM PY] ✅ Pedido #${numeroPedido} impactado con éxito en MMM SYSTEM (ID: ${dbPedidoId})`);
    return dbPedidoId;
}
