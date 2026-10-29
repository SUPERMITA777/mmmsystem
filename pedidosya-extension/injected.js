// injected.js - Corre en el contexto real de la ventana de PedidosYa Portal
// Intercepta órdenes, catálogo y ejecuta sincronización bidireccional (precios y disponibilidad)
(function() {
    console.log("🚀 [MMM System Linker] Interceptor de red inyectado en PedidosYa Portal v2.6");

    window.__MMM_PY_TOKEN = null;
    window.__MMM_PY_CATALOG_BASE_URL = null;
    window.__MMM_PY_PRODUCTS_MAP = new Map();
    window.__MMM_PY_PRODUCTS_DATA = new Map();

    function normalizar(texto) {
        if (!texto || typeof texto !== 'string') return '';
        return texto
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    }

    // Recuperar token, base URL y mapa de productos guardados previamente
    try {
        window.__MMM_PY_CATALOG_BASE_URL = localStorage.getItem("__MMM_PY_CATALOG_BASE_URL") || null;
        window.__MMM_PY_TOKEN = localStorage.getItem("__MMM_PY_TOKEN") || null;

        const savedMap = localStorage.getItem("__MMM_PY_PRODUCTS_MAP");
        if (savedMap) {
            const parsed = JSON.parse(savedMap);
            for (const [k, v] of Object.entries(parsed)) {
                window.__MMM_PY_PRODUCTS_MAP.set(k, String(v));
            }
            console.log(`📦 [MMM Interceptor] Restaurados ${window.__MMM_PY_PRODUCTS_MAP.size} índices de productos desde almacenamiento local.`);
        }
    } catch(e) {}

    function notificarExtension(payload) {
        window.postMessage({
            source: "MMM_PY_INTERCEPTOR",
            payload: payload
        }, "*");
    }

    // Desempaquetador recursivo universal de productos
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

            // Recorrer posibles contenedores de catálogo
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

    function registrarProductosEnMapa(data) {
        if (!data) return;
        const list = aplanarProductos(data);

        list.forEach(p => {
            const id = p.id || p.productId || p.catalogProductId || p.code;
            const name = p.name || p.title || p.productName;
            if (id && name) {
                const idStr = String(id).trim();
                const rawName = String(name).trim();
                const cleanKey = normalizar(rawName);

                window.__MMM_PY_PRODUCTS_MAP.set(cleanKey, idStr);
                window.__MMM_PY_PRODUCTS_MAP.set(rawName.toLowerCase(), idStr);
                window.__MMM_PY_PRODUCTS_DATA.set(idStr, p);
            }
        });

        // Guardar en localStorage para disponibilidad instantánea entre recargas
        try {
            const obj = {};
            for (const [k, v] of window.__MMM_PY_PRODUCTS_MAP.entries()) {
                obj[k] = v;
            }
            localStorage.setItem("__MMM_PY_PRODUCTS_MAP", JSON.stringify(obj));
        } catch(e) {}
    }

    function resolverEndpointProductos(baseUrl) {
        if (!baseUrl) return null;
        // Detectar /catalogs/{id} y armar /products
        const catalogMatch = baseUrl.match(/(.*?\/catalogs\/[^\/\?]+)/);
        if (catalogMatch) {
            return `${catalogMatch[1]}/products`;
        }
        return baseUrl.replace(/\/(products|categories|sections).*$/, '') + '/products';
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

        return (u.includes("products") || u.includes("catalogs") || u.includes("/menu/") || u.includes("categories")) &&
               (u.includes("vendor-api") || u.includes("restaurant-partners") || u.includes("portal-app"));
    }

    // 1. Interceptar Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const rawUrl = args[0];
        const url = typeof rawUrl === 'string' ? rawUrl : (rawUrl?.url || '');
        const options = args[1] || {};

        extraerToken(options.headers);

        if (url.includes("catalogs") && (url.includes("products") || url.includes("platforms") || url.includes("categories"))) {
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
                if (this._url && this._url.includes("catalogs") && (this._url.includes("products") || this._url.includes("platforms") || this._url.includes("categories"))) {
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

    // Resolver ID numérico de forma resiliente
    async function resolverIdProducto(action) {
        let targetId = action.id_py;
        if (targetId && /^\d+$/.test(String(targetId))) {
            return String(targetId);
        }

        const nombre = (action.datos?.nombre || action.id_py || '').trim();
        const norm = normalizar(nombre);
        const lower = nombre.toLowerCase();

        // 1. Búsqueda directa en memoria
        if (norm && window.__MMM_PY_PRODUCTS_MAP.has(norm)) {
            return window.__MMM_PY_PRODUCTS_MAP.get(norm);
        }
        if (lower && window.__MMM_PY_PRODUCTS_MAP.has(lower)) {
            return window.__MMM_PY_PRODUCTS_MAP.get(lower);
        }

        // 2. Coincidencia difusa en memoria
        for (const [k, v] of window.__MMM_PY_PRODUCTS_MAP.entries()) {
            if (k && norm && (k.includes(norm) || norm.includes(k))) {
                console.log(`🔍 [MMM PY] Coincidencia difusa encontrada para '${nombre}':`, k, "->", v);
                return v;
            }
        }

        // 3. Esperar hasta 4 segundos por si las peticiones de catálogo están cargando
        console.log(`⏳ [MMM PY] Esperando resolución de ID para '${nombre}'...`);
        for (let i = 0; i < 8; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (norm && window.__MMM_PY_PRODUCTS_MAP.has(norm)) return window.__MMM_PY_PRODUCTS_MAP.get(norm);
            if (lower && window.__MMM_PY_PRODUCTS_MAP.has(lower)) return window.__MMM_PY_PRODUCTS_MAP.get(lower);
            for (const [k, v] of window.__MMM_PY_PRODUCTS_MAP.entries()) {
                if (k && norm && (k.includes(norm) || norm.includes(k))) return v;
            }
        }

        return null;
    }

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

            const targetId = await resolverIdProducto(action);
            if (!targetId || !/^\d+$/.test(String(targetId))) {
                throw new Error(`No se pudo resolver el ID numérico de '${action.datos?.nombre || action.id_py}' en PedidosYa. Abre la sección de Menú en PedidosYa.`);
            }

            const headers = {
                "Content-Type": "application/json"
            };
            if (token) headers["Authorization"] = token;

            const productsBase = resolverEndpointProductos(baseUrl);
            const productUrl = `${productsBase}/${targetId}`;
            const rawProd = window.__MMM_PY_PRODUCTS_DATA.get(String(targetId)) || {};

            let res;
            if (action.tipo_accion === "CAMBIAR_DISPONIBILIDAD") {
                const disponible = Boolean(action.datos?.disponible);
                console.log(`[MMM PY] Cambiando disponibilidad de #${targetId} (${action.datos?.nombre || ''}) a: ${disponible}`);

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
                console.log(`[MMM PY] Actualizando precio de #${targetId} (${action.datos?.nombre || ''}) a: $${precio}`);

                const payload = { 
                    price: precio, 
                    pricing: { price: precio },
                    vendorOverrides: { price: precio }
                };

                if (Array.isArray(rawProd.sizes) && rawProd.sizes.length > 0) {
                    payload.sizes = rawProd.sizes.map(s => ({
                        ...s,
                        price: precio,
                        vendorOverrides: { ...(s.vendorOverrides || {}), price: precio }
                    }));
                }

                res = await originalFetch(productUrl, {
                    method: "PATCH",
                    headers,
                    credentials: "include",
                    body: JSON.stringify(payload)
                }).catch(() => null);

                if (!res || !res.ok) {
                    res = await originalFetch(`${productUrl}/price`, {
                        method: "PUT",
                        headers,
                        credentials: "include",
                        body: JSON.stringify({ price: precio })
                    }).catch(() => null);
                }

                if (!res || !res.ok) {
                    res = await originalFetch(`${productUrl}/pricing`, {
                        method: "PATCH",
                        headers,
                        credentials: "include",
                        body: JSON.stringify({ price: precio })
                    }).catch(() => null);
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
