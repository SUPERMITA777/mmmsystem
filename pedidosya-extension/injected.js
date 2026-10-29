// injected.js - Corre en el contexto real de la ventana de PedidosYa Portal
// Intercepta órdenes, catálogo y ejecuta sincronización bidireccional (precios y disponibilidad)
(function() {
    console.log("🚀 [MMM System Linker] Interceptor de red inyectado en PedidosYa Portal v2.9");

    window.__MMM_PY_TOKEN = null;
    window.__MMM_PY_CATALOG_BASE_URL = null;
    window.__MMM_PY_CATALOG_ID = null;
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

    // Recuperar datos guardados previamente
    try {
        window.__MMM_PY_CATALOG_BASE_URL = localStorage.getItem("__MMM_PY_CATALOG_BASE_URL") || null;
        window.__MMM_PY_CATALOG_ID = localStorage.getItem("__MMM_PY_CATALOG_ID") || null;
        window.__MMM_PY_TOKEN = localStorage.getItem("__MMM_PY_TOKEN") || null;

        const savedMap = localStorage.getItem("__MMM_PY_PRODUCTS_MAP");
        if (savedMap) {
            const parsed = JSON.parse(savedMap);
            for (const [k, v] of Object.entries(parsed)) {
                window.__MMM_PY_PRODUCTS_MAP.set(k, String(v));
            }
            console.log(`📦 [MMM Interceptor] Restaurados ${window.__MMM_PY_PRODUCTS_MAP.size} productos desde memoria local.`);
        }
    } catch(e) {}

    function notificarExtension(payload) {
        window.postMessage({
            source: "MMM_PY_INTERCEPTOR",
            payload: payload
        }, "*");
    }

    function esProductoValido(node) {
        if (!node || typeof node !== 'object') return false;
        const id = node.id || node.productId || node.catalogProductId || node.code;
        const name = node.name || node.title || node.productName;
        if (!name || typeof name !== 'string' || !id) return false;

        // Si es contenedor de categorías o productos, no es producto hoja
        if (Array.isArray(node.products) || Array.isArray(node.items) || Array.isArray(node.categories)) {
            return false;
        }
        if (node.categoryType || node.subCategories) {
            return false;
        }

        return true;
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

            // Recorrer contenedores
            if (Array.isArray(node.products)) walk(node.products);
            if (Array.isArray(node.items)) walk(node.items);
            if (Array.isArray(node.categories)) walk(node.categories);
            if (Array.isArray(node.sections)) walk(node.sections);
            if (Array.isArray(node.catalogProducts)) walk(node.catalogProducts);
            if (Array.isArray(node.elements)) walk(node.elements);
            if (Array.isArray(node.data)) walk(node.data);

            if (esProductoValido(node)) {
                const id = node.id || node.productId || node.catalogProductId || node.code;
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
        if (list.length === 0) return;

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

        console.log(`🗺️ [MMM PY] Mapa de productos actualizado: ${window.__MMM_PY_PRODUCTS_MAP.size} entradas registradas.`);

        // Guardar en localStorage
        try {
            const obj = {};
            for (const [k, v] of window.__MMM_PY_PRODUCTS_MAP.entries()) {
                obj[k] = v;
            }
            localStorage.setItem("__MMM_PY_PRODUCTS_MAP", JSON.stringify(obj));
        } catch(e) {}
    }

    function inspeccionarRespuestaCatalogo(url, data) {
        if (!data || typeof data !== 'object') return;

        // Detectar catalogId en la respuesta
        if (Array.isArray(data.catalogs) && data.catalogs[0]?.id) {
            window.__MMM_PY_CATALOG_ID = String(data.catalogs[0].id);
            try { localStorage.setItem("__MMM_PY_CATALOG_ID", window.__MMM_PY_CATALOG_ID); } catch(e) {}
            console.log("🔑 [MMM PY] Catalog ID detectado en payload:", window.__MMM_PY_CATALOG_ID);
        }

        if (url) {
            const m = url.match(/\/catalogs\/(\d+)/);
            if (m && m[1]) {
                window.__MMM_PY_CATALOG_ID = m[1];
                try { localStorage.setItem("__MMM_PY_CATALOG_ID", window.__MMM_PY_CATALOG_ID); } catch(e) {}
            }
        }
    }

    function resolverEndpointProductos(baseUrl) {
        const catalogId = window.__MMM_PY_CATALOG_ID || localStorage.getItem("__MMM_PY_CATALOG_ID") || "252084";

        if (baseUrl) {
            // Caso 1: URL de vendors (.../vendors/{id}/catalogs)
            if (baseUrl.includes('/vendors/')) {
                const prefix = baseUrl.split('/vendors/')[0];
                return `${prefix}/catalogs/${catalogId}/products`;
            }

            // Caso 2: URL ya contiene /catalogs/{id}
            const match = baseUrl.match(/(.*?\/catalogs\/\d+)/);
            if (match) {
                return `${match[1]}/products`;
            }

            // Caso 3: URL base de platforms
            const platMatch = baseUrl.match(/(https?:\/\/[^\/]+\/api\/\d+\/platforms\/[^\/]+)/);
            if (platMatch) {
                return `${platMatch[1]}/catalogs/${catalogId}/products`;
            }
        }

        // Fallback estándar de PedidosYa Argentina
        return `https://vendor-api-ar.us.restaurant-partners.com/api/5/platforms/PY_AR/catalogs/${catalogId}/products`;
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
               u.includes("live-orders") ||
               u.includes("order-manager") ||
               u.includes("printing") ||
               u.includes("escpos");
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

        if (url.includes("catalogs") || (url.includes("platforms") && url.includes("products"))) {
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
                        console.log("📋 [MMM Interceptor Fetch] URL:", url, data);
                        inspeccionarRespuestaCatalogo(url, data);
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
                if (this._url && (this._url.includes("catalogs") || (this._url.includes("platforms") && this._url.includes("products")))) {
                    window.__MMM_PY_CATALOG_BASE_URL = this._url.split("?")[0];
                    try { localStorage.setItem("__MMM_PY_CATALOG_BASE_URL", window.__MMM_PY_CATALOG_BASE_URL); } catch(e) {}
                }

                if (esUrlOrdenes(this._url)) {
                    const data = JSON.parse(this.responseText);
                    console.log("📦 [MMM Interceptor XHR] Capturada respuesta de órdenes:", this._url);
                    notificarExtension({ tipo: "ORDEN_PY", url: this._url, data });
                } else if (esUrlCatalogo(this._url)) {
                    const data = JSON.parse(this.responseText);
                    console.log("📋 [MMM Interceptor XHR] URL:", this._url, data);
                    inspeccionarRespuestaCatalogo(this._url, data);
                    registrarProductosEnMapa(data);
                    notificarExtension({ tipo: "CATALOGO_PY", url: this._url, data });
                }
            } catch (e) {}
        });
        return originalXhrSend.apply(this, arguments);
    };

    // Resolver ID numérico de forma inteligente
    async function resolverIdProducto(action) {
        let targetId = action.id_py;
        if (targetId && /^\d+$/.test(String(targetId))) {
            return String(targetId);
        }

        const nombre = (action.datos?.nombre || action.id_py || '').trim();
        const norm = normalizar(nombre);
        const lower = nombre.toLowerCase();

        // 1. Clave exacta normalizada
        if (norm && window.__MMM_PY_PRODUCTS_MAP.has(norm)) {
            return window.__MMM_PY_PRODUCTS_MAP.get(norm);
        }
        // 2. Clave minúsculas
        if (lower && window.__MMM_PY_PRODUCTS_MAP.has(lower)) {
            return window.__MMM_PY_PRODUCTS_MAP.get(lower);
        }

        // 3. Coincidencia difusa / subcadena
        for (const [k, v] of window.__MMM_PY_PRODUCTS_MAP.entries()) {
            if (k && norm && (k.includes(norm) || norm.includes(k))) {
                console.log(`🔍 [MMM PY] Coincidencia difusa encontrada para '${nombre}':`, k, "->", v);
                return v;
            }
        }

        // 4. Coincidencia por palabras clave significativas (ej. "cancha" + "piedra")
        const palabras = norm.match(/[a-z0-9]{4,}/g) || [];
        if (palabras.length > 0) {
            for (const [k, v] of window.__MMM_PY_PRODUCTS_MAP.entries()) {
                const todasPresentes = palabras.every(p => k.includes(p));
                if (todasPresentes) {
                    console.log(`🔍 [MMM PY] Coincidencia por palabras clave para '${nombre}':`, k, "->", v);
                    return v;
                }
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

            let targetId = await resolverIdProducto(action);

            // Si no se encuentra en memoria, consultar catálogo completo a la API de PedidosYa en segundo plano
            if (!targetId && token) {
                const endpoint = resolverEndpointProductos(baseUrl);
                console.log(`🔍 [MMM PY] Buscando '${action.datos?.nombre}' en catálogo completo de PedidosYa:`, endpoint);
                try {
                    const cRes = await originalFetch(`${endpoint}?sizeSupport=true&includeVendorOverrides=true`, {
                        headers: { "Authorization": token, "Content-Type": "application/json" }
                    });
                    if (cRes && cRes.ok) {
                        const cData = await cRes.json();
                        registrarProductosEnMapa(cData);
                        notificarExtension({ tipo: "CATALOGO_PY", url: endpoint, data: cData });
                        targetId = await resolverIdProducto(action);
                    }
                } catch(e) {
                    console.warn("[MMM PY] Consulta de catálogo completo falló:", e);
                }
            }

            if (!targetId || !/^\d+$/.test(String(targetId))) {
                throw new Error(`No se pudo resolver el ID numérico de '${action.datos?.nombre || action.id_py}' en PedidosYa.`);
            }

            function sendHttp(payload) {
                return new Promise((resolve) => {
                    const requestId = "req_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);

                    function onMsg(ev) {
                        if (ev.source === window && ev.data && ev.data.source === "MMM_PY_HTTP_RESPONSE" && ev.data.requestId === requestId) {
                            window.removeEventListener("message", onMsg);
                            clearTimeout(timer);
                            resolve(ev.data.response);
                        }
                    }

                    const timer = setTimeout(async () => {
                        window.removeEventListener("message", onMsg);
                        console.warn("[MMM PY] Background no respondió a tiempo, probando fetch directo sin credentials...");
                        try {
                            const fetchOpts = {
                                method: payload.method || "GET",
                                headers: payload.headers || {}
                            };
                            if (payload.body && (payload.method === "POST" || payload.method === "PUT" || payload.method === "PATCH")) {
                                fetchOpts.body = typeof payload.body === "string" ? payload.body : JSON.stringify(payload.body);
                            }
                            const r = await originalFetch(payload.url, fetchOpts);
                            const st = r.status;
                            const ok = r.ok || st === 204;
                            const tx = await r.text().catch(() => "");
                            let dt = null;
                            try { dt = JSON.parse(tx); } catch(e) { dt = tx; }
                            resolve({ success: true, ok, status: st, data: dt, rawText: tx });
                        } catch(e) {
                            resolve({ success: false, ok: false, error: e.message });
                        }
                    }, 5000);

                    window.addEventListener("message", onMsg);
                    window.postMessage({
                        source: "MMM_PY_HTTP_REQUEST",
                        requestId: requestId,
                        payload: payload
                    }, "*");
                });
            }

            const productsBase = resolverEndpointProductos(baseUrl);
            const productUrl = `${productsBase}/${targetId}`;
            const rawProd = window.__MMM_PY_PRODUCTS_DATA.get(String(targetId)) || {};

            console.log(`⚡ [MMM PY] Ejecutando '${action.tipo_accion}' en URL:`, productUrl, "ID:", targetId);

            const headers = {
                "Content-Type": "application/json"
            };
            if (token) headers["Authorization"] = token;

            // Lista de URLs candidatas a intentar
            const candidateUrls = [productUrl];
            if (productUrl.includes("/catalogs/")) {
                const altUrl = productUrl.replace(/\/catalogs\/\d+\/products\//, '/catalogs/products/') + (productUrl.includes('?') ? '&' : '?') + 'vendorId=288326&locale=es';
                if (!candidateUrls.includes(altUrl)) candidateUrls.push(altUrl);
            }

            let res = null;

            if (action.tipo_accion === "CAMBIAR_DISPONIBILIDAD") {
                const disponible = Boolean(action.datos?.disponible);
                console.log(`[MMM PY] Cambiando disponibilidad de #${targetId} (${action.datos?.nombre || ''}) a: ${disponible}`);

                for (const u of candidateUrls) {
                    const cleanUrl = u.split('?')[0];
                    // 1. Probar /availability
                    res = await sendHttp({
                        url: `${cleanUrl}/availability`,
                        method: "PATCH",
                        headers,
                        body: { isAvailable: disponible, available: disponible }
                    });
                    if (res && res.ok) break;

                    // 2. Probar PATCH directo al producto
                    res = await sendHttp({
                        url: u,
                        method: "PATCH",
                        headers,
                        body: { available: disponible, isAvailable: disponible }
                    });
                    if (res && res.ok) break;
                }
            } else if (action.tipo_accion === "ACTUALIZAR_PRECIO") {
                const precio = parseFloat(action.datos?.precio || 0);
                console.log(`[MMM PY] Actualizando precio de #${targetId} (${action.datos?.nombre || ''}) a: $${precio}`);

                const payload = { 
                    price: precio, 
                    pricing: { price: precio, amount: precio },
                    vendorOverrides: { price: precio }
                };

                if (Array.isArray(rawProd.sizes) && rawProd.sizes.length > 0) {
                    payload.sizes = rawProd.sizes.map(s => ({
                        ...s,
                        price: precio,
                        vendorOverrides: { ...(s.vendorOverrides || {}), price: precio },
                        pricing: { ...(s.pricing || {}), price: precio, amount: precio }
                    }));
                }

                for (const u of candidateUrls) {
                    // 1. Probar PATCH completo al producto
                    res = await sendHttp({
                        url: u,
                        method: "PATCH",
                        headers,
                        body: payload
                    });
                    if (res && res.ok) break;

                    const cleanUrl = u.split('?')[0];
                    // 2. Probar PUT /price
                    res = await sendHttp({
                        url: `${cleanUrl}/price`,
                        method: "PUT",
                        headers,
                        body: { price: precio }
                    });
                    if (res && res.ok) break;

                    // 3. Probar PATCH /pricing
                    res = await sendHttp({
                        url: `${cleanUrl}/pricing`,
                        method: "PATCH",
                        headers,
                        body: { price: precio }
                    });
                    if (res && res.ok) break;
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
                const errText = res?.rawText || res?.error || `Status: ${res?.status || 'Network Error'}`;
                throw new Error(`PedidosYa respondió (${res?.status || 'Error'}): ${errText}`);
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
