// injected.js - Corre en el contexto real de la ventana de PedidosYa Portal
// Intercepta órdenes, catálogo y ejecuta sincronización bidireccional (precios y disponibilidad)
(function() {
    console.log("🚀 [MMM System Linker] Interceptor de red inyectado en PedidosYa Portal v2.5");

    window.__MMM_PY_TOKEN = null;
    window.__MMM_PY_CATALOG_BASE_URL = null;
    window.__MMM_PY_PRODUCTS_MAP = new Map();

    // Recuperar token y base URL guardados previamente si existen
    try {
        window.__MMM_PY_CATALOG_BASE_URL = localStorage.getItem("__MMM_PY_CATALOG_BASE_URL") || null;
        window.__MMM_PY_TOKEN = localStorage.getItem("__MMM_PY_TOKEN") || null;
    } catch(e) {}

    function notificarExtension(payload) {
        window.postMessage({
            source: "MMM_PY_INTERCEPTOR",
            payload: payload
        }, "*");
    }

    function registrarProductosEnMapa(data) {
        if (!data) return;
        let list = [];
        if (Array.isArray(data)) list = data;
        else if (Array.isArray(data.products)) list = data.products;
        else if (Array.isArray(data.items)) list = data.items;
        else if (Array.isArray(data.categories)) {
            data.categories.forEach(c => {
                if (Array.isArray(c.products)) list.push(...c.products);
                if (Array.isArray(c.items)) list.push(...c.items);
            });
        }

        list.forEach(p => {
            if (p && p.name) {
                const id = p.id || p.productId || p.catalogProductId || p.code;
                if (id) {
                    window.__MMM_PY_PRODUCTS_MAP.set(p.name.trim().toLowerCase(), String(id));
                }
            }
        });
    }

    function extraerToken(headers) {
        try {
            if (!headers) return;
            let auth = null;
            if (typeof headers.get === 'function') {
                auth = headers.get('Authorization') || headers.get('authorization');
            } else if (typeof headers === 'object') {
                auth = headers['Authorization'] || headers['authorization'];
            }
            if (auth && auth.startsWith('Bearer ')) {
                window.__MMM_PY_TOKEN = auth;
                try { localStorage.setItem("__MMM_PY_TOKEN", auth); } catch(e) {}
            }
        } catch (e) {}
    }

    function esUrlOrdenes(url) {
        if (!url || typeof url !== 'string') return false;
        const u = url.toLowerCase();

        if (u.includes("catalogs") || 
            u.includes("products") || 
            u.includes("categories") || 
            u.includes("translations") || 
            u.includes("printing") || 
            u.includes("escpos") || 
            u.includes("restaurants") || 
            u.includes("dine-in") || 
            u.includes("schedules") || 
            u.includes("reviews") || 
            u.includes("assets") || 
            u.includes("auth") ||
            u.includes("feedback") ||
            u.includes("locize")) {
            return false;
        }

        return u.includes("deliveries-web") || 
               u.includes("/deliveries") || 
               u.includes("/orders") || 
               u.includes("live-orders");
    }

    function esUrlCatalogo(url) {
        if (!url || typeof url !== 'string') return false;
        const u = url.toLowerCase();

        if (u.includes("translations") || 
            u.includes("printing") || 
            u.includes("escpos") || 
            u.includes("assets") || 
            u.includes("locize")) {
            return false;
        }

        return (u.includes("products") || u.includes("catalogs") || u.includes("/menu/")) &&
               (u.includes("vendor-api") || u.includes("restaurant-partners") || u.includes("portal-app"));
    }

    // 1. Interceptar Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const rawUrl = args[0];
        const url = typeof rawUrl === 'string' ? rawUrl : (rawUrl?.url || '');
        const options = args[1] || {};

        extraerToken(options.headers);

        if (url.includes("catalogs") && (url.includes("products") || url.includes("platforms"))) {
            window.__MMM_PY_CATALOG_BASE_URL = url.split("?")[0];
            try { localStorage.setItem("__MMM_PY_CATALOG_BASE_URL", window.__MMM_PY_CATALOG_BASE_URL); } catch(e) {}
        }

        const response = await originalFetch.apply(this, args);
        try {
            if (esUrlOrdenes(url)) {
                const clone = response.clone();
                clone.json().then(data => {
                    if (data) {
                        console.log("📦 [MMM Interceptor Fetch] Capturada respuesta de órdenes:", url);
                        notificarExtension({ tipo: "ORDEN_PY", url, data });
                    }
                }).catch(() => {});
            } else if (esUrlCatalogo(url)) {
                const clone = response.clone();
                clone.json().then(data => {
                    if (data) {
                        console.log("📋 [MMM Interceptor Fetch] Capturado catálogo de productos de PedidosYa:", data);
                        registrarProductosEnMapa(data);
                        notificarExtension({ tipo: "CATALOGO_PY", url, data });
                    }
                }).catch(() => {});
            }
        } catch (e) {}
        return response;
    };

    // 2. Interceptar XMLHttpRequest
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;
    const originalXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = typeof url === 'string' ? url : '';
        return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
        if (header && header.toLowerCase() === 'authorization' && value?.startsWith('Bearer ')) {
            window.__MMM_PY_TOKEN = value;
            try { localStorage.setItem("__MMM_PY_TOKEN", value); } catch(e) {}
        }
        return originalXhrSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            try {
                if (this._url && this._url.includes("catalogs") && (this._url.includes("products") || this._url.includes("platforms"))) {
                    window.__MMM_PY_CATALOG_BASE_URL = this._url.split("?")[0];
                    try { localStorage.setItem("__MMM_PY_CATALOG_BASE_URL", window.__MMM_PY_CATALOG_BASE_URL); } catch(e) {}
                }

                if (esUrlOrdenes(this._url)) {
                    const data = JSON.parse(this.responseText);
                    console.log("📦 [MMM Interceptor XHR] Capturada respuesta de órdenes:", this._url);
                    notificarExtension({ tipo: "ORDEN_PY", url: this._url, data });
                } else if (esUrlCatalogo(this._url)) {
                    const data = JSON.parse(this.responseText);
                    console.log("📋 [MMM Interceptor XHR] Capturado catálogo de productos de PedidosYa:", data);
                    registrarProductosEnMapa(data);
                    notificarExtension({ tipo: "CATALOGO_PY", url: this._url, data });
                }
            } catch (e) {}
        });
        return originalXhrSend.apply(this, arguments);
    };

    // 3. Ejecutar Acciones Bidireccionales (cambio de precios y stock/disponibilidad)
    window.addEventListener("message", async (event) => {
        if (event.source !== window || !event.data || event.data.source !== "MMM_PY_EXECUTE_ACTION") {
            return;
        }

        const { action } = event.data;
        if (!action || !action.id) return;

        console.log("⚡ [MMM System Linker] Solicitud de cambio recibida para PedidosYa:", action);

        try {
            const token = window.__MMM_PY_TOKEN;
            const baseUrl = window.__MMM_PY_CATALOG_BASE_URL;

            if (!baseUrl) {
                throw new Error("Aún no se ha detectado la URL del catálogo de PedidosYa. Por favor abre la sección de Menú en PedidosYa una vez.");
            }

            // Resolver ID numérico del producto
            let targetId = action.id_py;
            if (!targetId || !/^\d+$/.test(String(targetId))) {
                const nom = (action.datos?.nombre || action.id_py || '').trim().toLowerCase();
                if (window.__MMM_PY_PRODUCTS_MAP.has(nom)) {
                    targetId = window.__MMM_PY_PRODUCTS_MAP.get(nom);
                }
            }

            if (!targetId || !/^\d+$/.test(String(targetId))) {
                throw new Error(`No se pudo resolver el ID numérico de '${action.datos?.nombre || action.id_py}' en PedidosYa. Asegúrate de tener la pestaña de Menú de PedidosYa abierta.`);
            }

            const headers = {
                "Content-Type": "application/json"
            };
            if (token) headers["Authorization"] = token;

            // Construir URL del producto en el catálogo de PedidosYa
            const cleanBase = baseUrl.replace(/\/products.*$/, '') + '/products';
            const productUrl = `${cleanBase}/${targetId}`;

            let res;
            if (action.tipo_accion === "CAMBIAR_DISPONIBILIDAD") {
                const disponible = Boolean(action.datos?.disponible);
                console.log(`[MMM PY] Cambiando disponibilidad de #${targetId} a: ${disponible}`);

                res = await originalFetch(`${productUrl}/availability`, {
                    method: "PATCH",
                    headers,
                    credentials: "include",
                    body: JSON.stringify({ isAvailable: disponible, available: disponible })
                }).catch(() => null);

                if (!res || !res.ok) {
                    res = await originalFetch(productUrl, {
                        method: "PATCH",
                        headers,
                        credentials: "include",
                        body: JSON.stringify({ available: disponible, isAvailable: disponible })
                    });
                }
            } else if (action.tipo_accion === "ACTUALIZAR_PRECIO") {
                const precio = parseFloat(action.datos?.precio || 0);
                console.log(`[MMM PY] Actualizando precio de #${targetId} a: $${precio}`);

                res = await originalFetch(productUrl, {
                    method: "PATCH",
                    headers,
                    credentials: "include",
                    body: JSON.stringify({ 
                        price: precio, 
                        pricing: { price: precio },
                        vendorOverrides: { price: precio }
                    })
                }).catch(() => null);

                if (!res || !res.ok) {
                    res = await originalFetch(`${productUrl}/price`, {
                        method: "PUT",
                        headers,
                        credentials: "include",
                        body: JSON.stringify({ price: precio })
                    });
                }
            }

            if (res && (res.ok || res.status === 204)) {
                console.log(`✅ [MMM System Linker] ¡Acción #${action.id} ejecutada con éxito en PedidosYa!`);
                window.postMessage({
                    source: "MMM_PY_ACTION_RESULT",
                    actionId: action.id,
                    success: true
                }, "*");
            } else {
                const errText = res ? await res.text().catch(() => "") : "Sin respuesta del servidor";
                throw new Error(`PedidosYa respondió (${res?.status}): ${errText}`);
            }

        } catch (err) {
            console.error("❌ [MMM System Linker] Error ejecutando acción en PedidosYa:", err);
            window.postMessage({
                source: "MMM_PY_ACTION_RESULT",
                actionId: action.id,
                success: false,
                error: err.message
            }, "*");
        }
    });
})();
