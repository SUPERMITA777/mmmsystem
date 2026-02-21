// content.js - Inyectado en el Partner Portal de PedidosYa

console.log("🍕 MMM SYSTEM LINKER: Monitor de PedidosYa Iniciado (v1.1)");

// Guardamos en memoria los IDs de pedidos ya enviados en esta sesión para no duplicar
let procesados = new Set();
let ultimaDeteccion = Date.now();

// 1. Iniciamos Observador de Cambios en el DOM (Mucho más rápido que setInterval)
const observer = new MutationObserver((mutations) => {
    // Evitamos ejecutarlo demasiadas veces seguidas si hay muchas mutaciones
    if (Date.now() - ultimaDeteccion > 2000) {
        ultimaDeteccion = Date.now();
        buscarPedidosNuevos();
    }
});

// Empezamos a observar cambios en todo el cuerpo de la página
observer.observe(document.body, { childList: true, subtree: true });

// También mantenemos un interval de seguridad por si acaso nada cambia en el DOM pero hay algo ahí
setInterval(buscarPedidosNuevos, 15000);

function buscarPedidosNuevos() {
    // console.log("🔍 Escaneando pedidos...");

    // Selectores variados para tarjetas de pedidos (PedidosYa cambia mucho los nombres de clase)
    const selectores = [
        'div[data-testid="order-card"]',
        '.order-card',
        '[class*="OrderCard"]',
        '[class*="order-card"]',
        'div:has(button):has(span:contains("#"))', // Selectores lógicos (experimental)
        'div[role="listitem"]', // A veces las tarjetas están en una lista
    ];

    let tarjetasPedidos = [];
    selectores.forEach(selector => {
        try {
            const encontrados = document.querySelectorAll(selector);
            tarjetasPedidos = [...tarjetasPedidos, ...Array.from(encontrados)];
        } catch (e) { /* selector no soportado */ }
    });

    // Si no encontramos nada con selectores, buscamos manualmente CUALQUIER div que parezca un pedido
    if (tarjetasPedidos.length === 0) {
        const divs = document.querySelectorAll('div');
        divs.forEach(d => {
            const txt = d.innerText || "";
            // Si tiene un # algo, un precio y botones de aceptar/rechazar, es un pedido
            if (txt.includes("#") && (txt.includes("Aceptar") || txt.includes("Confirmar")) && txt.length < 1000) {
                tarjetasPedidos.push(d);
            }
        });
    }

    // Filtrar duplicados de la lista de elementos encontrados
    const unicos = [...new Set(tarjetasPedidos)];

    unicos.forEach(tarjeta => {
        procesarTarjetaPedido(tarjeta);
    });
}

function procesarTarjetaPedido(tarjeta) {
    try {
        const textoTarjeta = tarjeta.innerText || "";

        // Evitar procesar lo que claramente no es un pedido nuevo
        if (textoTarjeta.toLowerCase().includes("finalizado") ||
            textoTarjeta.toLowerCase().includes("cancelado") ||
            textoTarjeta.toLowerCase().includes("entregado") ||
            textoTarjeta.length < 50) {
            return;
        }

        // 3. Extraer el ID del pedido (Flexibilizado)
        // Buscamos algo tipo #1234 o directamente una secuencia larga de números/letras
        const matchId = textoTarjeta.match(/#([a-zA-Z0-9\-]+)/) || textoTarjeta.match(/([a-zA-Z0-9]{8,12})/);
        if (!matchId) return;

        const idPedidoPy = matchId[1] || matchId[0];

        if (procesados.has(idPedidoPy)) {
            return;
        }

        console.log(`🍟 DEBUG: Analizando posible pedido ID: ${idPedidoPy}`);

        // 4. Extraer Datos
        let nombreCliente = "Cliente PedidosYa";
        const lineas = textoTarjeta.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        if (lineas.length > 0) {
            // Lógica para encontrar el nombre: suele ser la línea antes o después del ID
            const idxId = lineas.findIndex(l => l.includes(idPedidoPy));
            if (idxId !== -1) {
                if (idxId > 0 && lineas[idxId - 1].length > 3) nombreCliente = lineas[idxId - 1];
                else if (idxId < lineas.length - 1) nombreCliente = lineas[idxId + 1];
            } else {
                nombreCliente = lineas[0];
            }
        }

        let total = 0;
        const matchTotal = textoTarjeta.match(/\$\s?([0-9.,]+)/);
        if (matchTotal) {
            total = parseFloat(matchTotal[1].replace(/\./g, '').replace(',', '.'));
        }

        let metodoPago = "Efectivo";
        if (textoTarjeta.toLowerCase().includes("online") ||
            textoTarjeta.toLowerCase().includes("pagado") ||
            textoTarjeta.toLowerCase().includes("pre-pagado") ||
            textoTarjeta.toLowerCase().includes("voucher") ||
            textoTarjeta.toLowerCase().includes("tarjeta")) {
            metodoPago = "Online / Pagado";
        }

        // 5. Extraer Items
        const itemsEncontrados = [];
        for (let linea of lineas) {
            // Patrones comunes: "1x Coca", "2 x Pizza", "1 Cantidad"
            const mQty = linea.match(/^(\d+)\s?[xX×]\s+(.+)/i) || linea.match(/^(\d+)\s+([a-zA-Z].+)/);
            if (mQty) {
                const cantidad = parseInt(mQty[1]);
                let nombreProd = mQty[2].trim();
                nombreProd = nombreProd.split('$')[0].trim();

                if (nombreProd.toLowerCase().includes("minuto") ||
                    nombreProd.toLowerCase().includes("km") ||
                    nombreProd.toLowerCase().includes("distancia")) {
                    continue;
                }

                itemsEncontrados.push({
                    cantidad: cantidad,
                    nombre: nombreProd,
                    precio: 0,
                    adicionales: []
                });
            }
        }

        const pedidoData = {
            id_py: idPedidoPy,
            cliente: nombreCliente,
            total: total,
            metodo_pago: metodoPago,
            items: itemsEncontrados
        };

        console.log(`🚀 DEBUG: Intentando enviar pedido ${idPedidoPy} a Supabase...`, pedidoData);

        chrome.runtime.sendMessage({ action: "SEND_PEDIDO_SUPABASE", payload: pedidoData }, (response) => {
            if (response && response.success) {
                console.log(`✅ Pedido ${idPedidoPy} enviado exitosamente!`);
                procesados.add(idPedidoPy);
            } else {
                console.error(`❌ Error al enviar pedido ${idPedidoPy}:`, response?.error);
            }
        });

    } catch (error) {
        console.error("Error scrapeando tarjeta de pedido:", error);
    }
}

