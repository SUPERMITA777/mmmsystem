// injected.js - Corre en el contexto real de la ventana de PedidosYa
// Intercepta las respuestas fetch y XMLHttpRequest
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
        return u.includes("deliveries") || 
               u.includes("orders") || 
               u.includes("live-orders") || 
               u.includes("vendor-api") || 
               u.includes("restaurant-partners");
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
                        console.log("📦 [MMM Interceptor Fetch] Capturada respuesta de:", url, data);
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
                    console.log("📦 [MMM Interceptor XHR] Capturada respuesta de:", this._url, data);
                    notificarExtension({ url: this._url, data });
                }
            } catch (e) {}
        });
        return originalXhrSend.apply(this, arguments);
    };
})();
