// content.js - Inyectado en el Partner Portal de PedidosYa

console.log("🍕 MMM SYSTEM LINKER: Monitor de PedidosYa Iniciado");

// Guardamos en memoria los IDs de pedidos ya enviados en esta sesión para no duplicar
let procesados = new Set();

// Buscar contenedores de tarjetas de pedidos nuevos cada 10 segundos
setInterval(buscarPedidosNuevos, 10000);

function buscarPedidosNuevos() {
    // NOTA TÉCNICA: Los selectores de clases en PedidosYa en React suelen estar minificados ("sc-1xxx"),
    // Por eso, es más confiable buscar por ciertos atributos de accesibilidad, botones específicos o 
    // palabras clave en el DOM.

    // 1. Normalmente, PedidosYa agrupa los pedidos nuevos en una columna que dice "Nuevos" o "Pendientes"
    const tarjetasPedidos = document.querySelectorAll('div[data-testid="order-card"], .order-card, [class*="OrderCard"], [class*="order-card"]');

    tarjetasPedidos.forEach(tarjeta => {
        procesarTarjetaPedido(tarjeta);
    });
}

function procesarTarjetaPedido(tarjeta) {
    try {
        const textoTarjeta = tarjeta.innerText || "";

        // Evitar procesar lo que claramente no es un pedido nuevo
        if (textoTarjeta.toLowerCase().includes("finalizado") || textoTarjeta.toLowerCase().includes("cancelado")) {
            return;
        }

        // 3. Extraer el ID del pedido
        const matchId = textoTarjeta.match(/#([a-zA-Z0-9\-]+)/);
        if (!matchId) return;

        const idPedidoPy = matchId[1];

        if (procesados.has(idPedidoPy)) {
            return;
        }

        console.log(`🍟 Nuevo pedido detectado! ID: ${idPedidoPy}`);

        // 4. Extraer Datos
        let nombreCliente = "Cliente PedidosYa";

        // El nombre suele estar arriba, intentamos sacarlo de la primera línea o de un span/h3 específico
        const lineas = textoTarjeta.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lineas.length > 0) {
            // A veces la primera línea es el ID, la segunda el nombre
            if (lineas[0].includes(idPedidoPy) && lineas.length > 1) {
                nombreCliente = lineas[1];
            } else {
                nombreCliente = lineas[0];
            }
        }

        let metodoPago = "Efectivo";
        let total = 0;

        const matchTotal = textoTarjeta.match(/\$\s?([0-9.,]+)/);
        if (matchTotal) {
            total = parseFloat(matchTotal[1].replace(/\./g, '').replace(',', '.'));
        }

        if (textoTarjeta.toLowerCase().includes("online") ||
            textoTarjeta.toLowerCase().includes("pagado") ||
            textoTarjeta.toLowerCase().includes("pre-pagado") ||
            textoTarjeta.toLowerCase().includes("voucher")) {
            metodoPago = "Online / Pagado";
        }

        // 5. Extraer Items mejorado
        const itemsEncontrados = [];

        // Buscamos patrones: "2x Pizza", "1 x Lomito", "1 Cantidad Producto"
        for (let linea of lineas) {
            const mQty = linea.match(/^(\d+)\s?[xX×]\s+(.+)/i) || linea.match(/^(\d+)\s+([a-zA-Z].+)/);
            if (mQty) {
                const cantidad = parseInt(mQty[1]);
                let nombreProd = mQty[2].trim();

                // Limpiar si el nombre trae el precio al final tipo "Pizza $1200"
                nombreProd = nombreProd.split('$')[0].trim();

                // Evitar capturar cosas que no son productos (ej: "1 minuto", "2 km")
                if (nombreProd.toLowerCase().includes("minuto") || nombreProd.toLowerCase().includes("km")) {
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

        // Si no encontramos items por regex de línea, intentamos buscar dentro de la tarjeta
        if (itemsEncontrados.length === 0) {
            console.warn(`No se detectaron items para el pedido ${idPedidoPy}, revisando estructura interna...`);
        }

        const pedidoData = {
            id_py: idPedidoPy,
            cliente: nombreCliente,
            total: total,
            metodo_pago: metodoPago,
            items: itemsEncontrados
        };

        console.log("Preparando envío a Supabase:", pedidoData);

        chrome.runtime.sendMessage({ action: "SEND_PEDIDO_SUPABASE", payload: pedidoData }, (response) => {
            if (response && response.success) {
                console.log(`✅ Pedido ${idPedidoPy} enviado exitosamente a Supabase!`);
                procesados.add(idPedidoPy);
            } else {
                console.error(`❌ Error mandando pedido ${idPedidoPy} a Supabase:`, response?.error);
            }
        });

    } catch (error) {
        console.error("Error scrapeando tarjeta de pedido:", error);
    }
}
