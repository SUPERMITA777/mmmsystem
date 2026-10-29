// injected.js - Corre en el contexto real de la ventana de PedidosYa
// Intercepta las respuestas fetch y XMLHttpRequest de orders/deliveries
(function() {
    console.log("🚀 [MMM System Linker] Interceptor de red inyectado en PedidosYa Portal");

    function notificarExtension(data) {
        window.postMessage({
            source: "MMM_PY_INTERCEPTOR",
            payload: data
        }, "*");
    }

    // 1. Interceptar Fetch
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
            if (url.includes("deliveries-web") || url.includes("orders") || url.includes("deliveries")) {
                const clone = response.clone();
                clone.json().then(data => {
                    if (data) {
                        // console.log("📦 [MMM Interceptor] Datos interceptados de:", url, data);
                        notificarExtension({ url, data });
                    }
                }).catch(() => {});
            }
        } catch (e) {
            // Ignorar errores silenciosamente para no romper la app de PedidosYa
        }
        return response;
    };

    // 2. Interceptar XMLHttpRequest
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            try {
                if (this._url && (this._url.includes("deliveries-web") || this._url.includes("orders") || this._url.includes("deliveries"))) {
                    const data = JSON.parse(this.responseText);
                    // console.log("📦 [MMM Interceptor XHR] Datos interceptados de:", this._url, data);
                    notificarExtension({ url: this._url, data });
                }
            } catch (e) {}
        });
        return originalXhrSend.apply(this, arguments);
    };
})();
