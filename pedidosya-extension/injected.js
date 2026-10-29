// injected.js - Corre en el contexto real de la ventana de PedidosYa Portal
// Intercepta las llamadas de órdenes en vivo y el catálogo de productos
(function() {
    console.log("🚀 [MMM System Linker] Interceptor de red inyectado en PedidosYa Portal v2.2");

    function notificarExtension(payload) {
        window.postMessage({
            source: "MMM_PY_INTERCEPTOR",
            payload: payload
        }, "*");
    }

    function esUrlOrdenes(url) {
        if (!url || typeof url !== 'string') return false;
        const u = url.toLowerCase();

        // Descartar explícitamente catálogos, configuraciones, traducciones e impresiones
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

        // Aceptar únicamente endpoints de pedidos / deliveries
        return u.includes("deliveries-web") || 
               u.includes("/deliveries") || 
               u.includes("/orders") || 
               u.includes("live-orders");
    }

    function esUrlCatalogo(url) {
        if (!url || typeof url !== 'string') return false;
        const u = url.toLowerCase();

        // Descartar ruido
        if (u.includes("translations") || 
            u.includes("printing") || 
            u.includes("escpos") || 
            u.includes("assets") || 
            u.includes("locize")) {
            return false;
        }

        // Aceptar llamadas que traen productos o catálogo
        return (u.includes("products") || u.includes("catalogs") || u.includes("/menu/")) &&
               (u.includes("vendor-api") || u.includes("restaurant-partners") || u.includes("portal-app"));
    }

    // 1. Interceptar Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const rawUrl = args[0];
            const url = typeof rawUrl === 'string' ? rawUrl : (rawUrl?.url || '');
            
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
                        console.log("📋 [MMM Interceptor Fetch] Capturado catálogo de productos de PedidosYa");
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

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = typeof url === 'string' ? url : '';
        return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            try {
                if (esUrlOrdenes(this._url)) {
                    const data = JSON.parse(this.responseText);
                    console.log("📦 [MMM Interceptor XHR] Capturada respuesta de órdenes:", this._url);
                    notificarExtension({ tipo: "ORDEN_PY", url: this._url, data });
                } else if (esUrlCatalogo(this._url)) {
                    const data = JSON.parse(this.responseText);
                    console.log("📋 [MMM Interceptor XHR] Capturado catálogo de productos de PedidosYa");
                    notificarExtension({ tipo: "CATALOGO_PY", url: this._url, data });
                }
            } catch (e) {}
        });
        return originalXhrSend.apply(this, arguments);
    };
})();
