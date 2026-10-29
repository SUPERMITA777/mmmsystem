// injected.js - Corre en el contexto real de la ventana de PedidosYa Portal
// Intercepta únicamente las llamadas de órdenes / entregas en vivo
(function() {
    console.log("🚀 [MMM System Linker] Interceptor de red inyectado en PedidosYa Portal");

    function notificarExtension(payload) {
        window.postMessage({
            source: "MMM_PY_INTERCEPTOR",
            payload: payload
        }, "*");
    }

    function esUrlRelevante(url) {
        if (!url || typeof url !== 'string') return false;
        const u = url.toLowerCase();

        // 1. Descartar explícitamente catálogos, configuraciones, traducciones e impresiones
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

        // 2. Aceptar únicamente endpoints de pedidos / deliveries
        return u.includes("deliveries-web") || 
               u.includes("/deliveries") || 
               u.includes("/orders") || 
               u.includes("live-orders");
    }

    // 1. Interceptar Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const rawUrl = args[0];
            const url = typeof rawUrl === 'string' ? rawUrl : (rawUrl?.url || '');
            
            if (esUrlRelevante(url)) {
                const clone = response.clone();
                clone.json().then(data => {
                    if (data) {
                        console.log("📦 [MMM Interceptor Fetch] Capturada respuesta de órdenes:", url);
                        notificarExtension({ url, data });
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
                if (esUrlRelevante(this._url)) {
                    const data = JSON.parse(this.responseText);
                    console.log("📦 [MMM Interceptor XHR] Capturada respuesta de órdenes:", this._url);
                    notificarExtension({ url: this._url, data });
                }
            } catch (e) {}
        });
        return originalXhrSend.apply(this, arguments);
    };
})();
