// background.js - Service worker de la extensión MMM System PedidosYa Linker

// Valores por defecto preconfigurados para MMM SYSTEM (MMM Pizza)
const DEFAULT_CONFIG = {
    supabaseUrl: "https://xnupjsxbvyirpeagbloe.supabase.co",
    supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY0OTg2OSwiZXhwIjoyMDg2MjI1ODY5fQ.abuUcTgjLUnHZqagnlk10l8BpsCnDg3q_IRPUg5hKw0",
    sucursalId: "9d1bfdb8-cb79-4568-b2bc-5f04f1888462", // MMM Pizza
    apiUrl: "https://mmmsystem.vercel.app"
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SEND_PEDIDO_SUPABASE") {
        enviarASupabase(request.payload)
            .then(res => sendResponse({ success: true, ...res }))
            .catch(err => sendResponse({ success: false, error: err.message }));

        return true; // Canal abierto para respuesta asíncrona
    }

    if (request.action === "PEDIDOSYA_CATALOG_DETECTED") {
        const productos = request.payload?.productos || [];
        chrome.storage.local.set({
            pedidosya_catalog: productos,
            pedidosya_catalog_time: Date.now()
        }, () => {
            console.log(`[MMM PY] ${productos.length} productos guardados en caché local.`);
        });
        sendResponse({ success: true, count: productos.length });
        return false;
    }

    if (request.action === "SYNC_CATALOG_PEDIDOSYA") {
        sincronizarCatalogo(request.payload?.productos)
            .then(res => sendResponse({ success: true, ...res }))
            .catch(err => sendResponse({ success: false, error: err.message }));

        return true;
    }

    if (request.action === "POLL_PEDIDOSYA_ACTIONS") {
        consultarAccionesPendientes()
            .then(acciones => sendResponse({ success: true, acciones }))
            .catch(err => sendResponse({ success: false, error: err.message }));

        return true;
    }

    if (request.action === "UPDATE_PEDIDOSYA_ACTION") {
        actualizarResultadoAccion(request.payload)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));

        return true;
    }

    if (request.action === "EXECUTE_PY_HTTP") {
        const { url, method, headers, body } = request.payload || {};
        (async () => {
            try {
                const fetchOpts = {
                    method: method || "GET",
                    headers: headers || {}
                };
                if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
                    fetchOpts.body = typeof body === "string" ? body : JSON.stringify(body);
                }
                const res = await fetch(url, fetchOpts);
                const status = res.status;
                const ok = res.ok || status === 204;
                let data = null;
                let text = "";
                try {
                    text = await res.text();
                    data = JSON.parse(text);
                } catch(e) {
                    data = text;
                }
                console.log(`[MMM PY Background] HTTP ${method || 'GET'} ${url} -> Status ${status}`);
                sendResponse({ success: true, ok, status, data, rawText: text });
            } catch (err) {
                console.error("[MMM PY Background] Error ejecutando HTTP:", err);
                sendResponse({ success: false, ok: false, error: err.message });
            }
        })();
        return true;
    }
});

async function consultarAccionesPendientes() {
    const stored = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'sucursalId']);
    const supabaseUrl = stored.supabaseUrl || DEFAULT_CONFIG.supabaseUrl;
    const supabaseKey = stored.supabaseKey || DEFAULT_CONFIG.supabaseKey;
    const sucursalId = stored.sucursalId || DEFAULT_CONFIG.sucursalId;

    if (!sucursalId) return [];

    const headers = {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
    };

    let res = await fetch(`${supabaseUrl}/rest/v1/pedidosya_acciones?sucursal_id=eq.${sucursalId}&estado=eq.pendiente&limit=5&order=created_at.asc`, {
        method: "GET",
        headers
    });

    if (!res.ok) return [];
    let acciones = await res.json().catch(() => []);

    // Si no hay pendientes, chequear si hay alguna con error reciente para reintentar
    if (!acciones || acciones.length === 0) {
        const resErr = await fetch(`${supabaseUrl}/rest/v1/pedidosya_acciones?sucursal_id=eq.${sucursalId}&estado=eq.error&limit=2&order=created_at.desc`, {
            headers
        });
        if (resErr.ok) {
            const errs = await resErr.json().catch(() => []);
            if (errs && errs.length > 0) {
                acciones = errs;
            }
        }
    }

    if (!acciones || acciones.length === 0) return [];

    // Marcar como procesando para evitar llamadas duplicadas
    const ids = acciones.map(a => a.id);
    for (const id of ids) {
        await fetch(`${supabaseUrl}/rest/v1/pedidosya_acciones?id=eq.${id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ estado: "procesando" })
        }).catch(() => {});
    }

    return acciones;
}

async function actualizarResultadoAccion(payload) {
    const { actionId, success, error } = payload || {};
    if (!actionId) return;

    const stored = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey']);
    const supabaseUrl = stored.supabaseUrl || DEFAULT_CONFIG.supabaseUrl;
    const supabaseKey = stored.supabaseKey || DEFAULT_CONFIG.supabaseKey;

    const headers = {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json"
    };

    await fetch(`${supabaseUrl}/rest/v1/pedidosya_acciones?id=eq.${actionId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
            estado: success ? "procesado" : "error",
            mensaje_error: error || null,
            processed_at: new Date().toISOString()
        })
    });
}

async function sincronizarCatalogo(productosDirectos) {
    const stored = await chrome.storage.sync.get(['sucursalId', 'apiUrl']);
    const local = await chrome.storage.local.get(['pedidosya_catalog']);

    const sucursalId = stored.sucursalId || DEFAULT_CONFIG.sucursalId;
    const apiUrl = stored.apiUrl || DEFAULT_CONFIG.apiUrl;
    const productos = productosDirectos || local.pedidosya_catalog || [];

    if (!sucursalId) {
        throw new Error("No hay código de vinculación de sucursal configurado.");
    }

    if (!productos || productos.length === 0) {
        throw new Error("No hay productos detectados en el catálogo de PedidosYa todavía. Abre o recarga la pestaña de PedidosYa.");
    }

    console.log(`[MMM PY] Enviando ${productos.length} productos a sincronizar en MMM SYSTEM (${apiUrl})...`);

    const response = await fetch(`${apiUrl}/api/pedidosya/sync-catalog`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            sucursal_id: sucursalId,
            productos: productos
        })
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Error del servidor (${response.status}): ${errText}`);
    }

    const data = await response.json();
    console.log("[MMM PY] ✅ Catálogo sincronizado:", data);

    // Reactivar cualquier acción que hubiera fallado previamente por falta de catálogo
    const supabaseUrl = stored.supabaseUrl || DEFAULT_CONFIG.supabaseUrl;
    const supabaseKey = stored.supabaseKey || DEFAULT_CONFIG.supabaseKey;
    reactivarAccionesConError(sucursalId, supabaseUrl, supabaseKey);

    return data;
}

async function reactivarAccionesConError(sucursalId, supabaseUrl, supabaseKey) {
    try {
        const headers = {
            "apikey": supabaseKey,
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json"
        };
        const res = await fetch(`${supabaseUrl}/rest/v1/pedidosya_acciones?sucursal_id=eq.${sucursalId}&estado=eq.error&limit=10&order=created_at.desc`, {
            headers
        });
        if (!res.ok) return;
        const errActions = await res.json().catch(() => []);
        for (const act of errActions) {
            if (act.mensaje_error && act.mensaje_error.includes("No se pudo resolver el ID")) {
                console.log(`[MMM PY] 🔄 Reactivando acción previa para reintento: #${act.id} (${act.tipo_accion})`);
                await fetch(`${supabaseUrl}/rest/v1/pedidosya_acciones?id=eq.${act.id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ estado: "pendiente", mensaje_error: null })
                }).catch(() => {});
            }
        }
    } catch(e) {}
}

async function enviarASupabase(pedidoPY) {
    const stored = await chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'sucursalId']);

    const supabaseUrl = stored.supabaseUrl || DEFAULT_CONFIG.supabaseUrl;
    const supabaseKey = stored.supabaseKey || DEFAULT_CONFIG.supabaseKey;
    const sucursalId = stored.sucursalId || DEFAULT_CONFIG.sucursalId;

    if (!supabaseUrl || !supabaseKey || !sucursalId) {
        throw new Error("Credenciales de Supabase no configuradas en el popup de la extensión.");
    }

    const headers = {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };

    // 1. Verificar si el pedido ya existe por su nota o id de PedidosYa
    const idPyStr = String(pedidoPY.id_py);
    const cleanId = idPyStr.replace(/^oma_/i, '');
    const resCheck = await fetch(`${supabaseUrl}/rest/v1/pedidos?sucursal_id=eq.${sucursalId}&notas=like.*${encodeURIComponent(cleanId)}*&select=id,numero_pedido,estado`, {
        method: "GET",
        headers
    });

    if (resCheck.ok) {
        const exist = await resCheck.json();
        if (exist && exist.length > 0) {
            const pedidoExistente = exist[0];
            const nuevoEstado = pedidoPY.estado_mmm;

            // Si cambió el estado en PedidosYa respecto al que tiene en MMM SYSTEM, actualizarlo inmediatamente
            if (nuevoEstado && pedidoExistente.estado !== nuevoEstado) {
                console.log(`[MMM PY] 🔄 Actualizando estado de comanda #${pedidoExistente.numero_pedido} (${idPyStr}): ${pedidoExistente.estado} ➔ ${nuevoEstado}`);
                await fetch(`${supabaseUrl}/rest/v1/pedidos?id=eq.${pedidoExistente.id}`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({
                        estado: nuevoEstado,
                        updated_at: new Date().toISOString()
                    })
                });
                return { data: pedidoExistente.id, numeroPedido: pedidoExistente.numero_pedido, statusUpdated: true };
            }

            console.log(`[MMM PY] El pedido ${idPyStr} (${pedidoExistente.numero_pedido}) ya existe con estado '${pedidoExistente.estado}'.`);
            return { data: pedidoExistente.id, numeroPedido: pedidoExistente.numero_pedido };
        }
    }

    // 2. Armar el número de comanda REAL
    // Si viene el número real de comanda de PeYa (ej: "1234"), lo mostramos directamente como PY-#1234
    // Si no, usamos los últimos dígitos del ID
    let numeroPedido = "";
    if (pedidoPY.numero_real) {
        numeroPedido = `PY-#${pedidoPY.numero_real}`;
    } else {
        const cleanId = idPyStr.replace(/[^a-zA-Z0-9]/g, '');
        const shortPy = cleanId.length > 5 ? cleanId.slice(-5).toUpperCase() : cleanId.toUpperCase();
        numeroPedido = `PY-${shortPy}`;
    }

    const subtotal = pedidoPY.total || 0;
    const total = pedidoPY.total || 0;

    // Gestionar / registrar el cliente en la tabla 'clientes' de la base de datos
    let clienteId = null;
    let clienteNombreFinal = (pedidoPY.cliente || "Cliente (peya)").trim();
    if (!clienteNombreFinal.toLowerCase().includes("(peya)")) {
        clienteNombreFinal = `${clienteNombreFinal} (peya)`;
    }
    const clienteTelefono = pedidoPY.telefono || "";
    const cleanPhone = clienteTelefono.replace(/[^0-9]/g, '');

    try {
        if (cleanPhone && cleanPhone.length >= 6) {
            const resCli = await fetch(`${supabaseUrl}/rest/v1/clientes?sucursal_id=eq.${sucursalId}&telefono=eq.${encodeURIComponent(cleanPhone)}&select=id,total_pedidos,total_gastado`, {
                method: "GET",
                headers
            });
            if (resCli.ok) {
                const cliData = await resCli.json().catch(() => []);
                if (cliData && cliData.length > 0) {
                    clienteId = cliData[0].id;
                    const prevPedidos = cliData[0].total_pedidos || 0;
                    const prevGastado = cliData[0].total_gastado || 0;
                    await fetch(`${supabaseUrl}/rest/v1/clientes?id=eq.${clienteId}`, {
                        method: "PATCH",
                        headers,
                        body: JSON.stringify({
                            nombre: clienteNombreFinal,
                            direccion: pedidoPY.direccion || undefined,
                            total_pedidos: prevPedidos + 1,
                            total_gastado: prevGastado + total,
                            updated_at: new Date().toISOString()
                        })
                    }).catch(() => {});
                }
            }
        }

        // Si no existe el cliente, crearlo en la base de datos
        if (!clienteId && clienteNombreFinal && clienteNombreFinal !== "Cliente (peya)") {
            const resNewCli = await fetch(`${supabaseUrl}/rest/v1/clientes`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    sucursal_id: sucursalId,
                    nombre: clienteNombreFinal,
                    telefono: cleanPhone || clienteTelefono,
                    direccion: pedidoPY.direccion || "",
                    total_pedidos: 1,
                    total_gastado: total
                })
            });
            if (resNewCli.ok) {
                const newCliData = await resNewCli.json().catch(() => []);
                if (newCliData && newCliData.length > 0) {
                    clienteId = newCliData[0].id;
                    console.log(`[MMM PY] 👤 Cliente registrado en base de datos: ${clienteNombreFinal} (#${clienteId})`);
                }
            }
        }
    } catch (e) {
        console.warn("[MMM PY] Aviso gestionando cliente en base de datos:", e);
    }

    const pedidoBody = {
        sucursal_id: sucursalId,
        numero_pedido: numeroPedido,
        cliente_id: clienteId,
        cliente_nombre: clienteNombreFinal,
        cliente_telefono: pedidoPY.telefono || "0000000000",
        cliente_direccion: pedidoPY.direccion || "",
        tipo: 'delivery',
        estado: pedidoPY.estado_mmm || 'preparando',
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
    return { data: dbPedidoId, numeroPedido };
}
