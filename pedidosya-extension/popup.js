document.addEventListener('DOMContentLoaded', () => {
    const sucursalIdInput = document.getElementById('sucursalId');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
    const catalogBadge = document.getElementById('catalogBadge');
    const syncCatalogBtn = document.getElementById('syncCatalogBtn');
    const catalogStatus = document.getElementById('catalogStatus');

    // Cargar la sucursal guardada (por defecto MMM Pizza)
    chrome.storage.sync.get(['sucursalId'], (result) => {
        sucursalIdInput.value = result.sucursalId || "9d1bfdb8-cb79-4568-b2bc-5f04f1888462";
    });

    // Revisar catálogo en caché local
    function verificarCatalogo() {
        chrome.storage.local.get(['pedidosya_catalog', 'pedidosya_catalog_time'], (res) => {
            const count = res.pedidosya_catalog?.length || 0;
            if (count > 0) {
                catalogBadge.textContent = `🟢 ${count} productos listos`;
                catalogBadge.style.backgroundColor = '#dcfce7';
                catalogBadge.style.color = '#15803d';
                syncCatalogBtn.disabled = false;
            } else {
                catalogBadge.textContent = 'Recarga PedidosYa';
                catalogBadge.style.backgroundColor = '#fef3c7';
                catalogBadge.style.color = '#b45309';
            }
        });
    }

    verificarCatalogo();

    // Guardar vinculación
    saveBtn.addEventListener('click', () => {
        const chosenId = sucursalIdInput.value.trim();

        if (!chosenId) {
            alert("Por favor ingresa el código de vinculación de tu local.");
            return;
        }

        chrome.storage.sync.set({
            sucursalId: chosenId
        }, () => {
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 1500);
        });
    });

    // Sincronizar catálogo con MMM SYSTEM
    syncCatalogBtn.addEventListener('click', () => {
        syncCatalogBtn.disabled = true;
        syncCatalogBtn.textContent = '⏳ Sincronizando...';
        catalogStatus.style.display = 'block';
        catalogStatus.style.color = '#64748b';
        catalogStatus.textContent = 'Enviando menú a MMM SYSTEM...';

        chrome.runtime.sendMessage({ action: "SYNC_CATALOG_PEDIDOSYA" }, (res) => {
            syncCatalogBtn.disabled = false;
            syncCatalogBtn.textContent = '🔄 Sincronizar Menú con MMM SYSTEM';

            if (res && res.success) {
                catalogStatus.style.color = '#16a34a';
                catalogStatus.textContent = `✅ ${res.total || res.creados} productos sincronizados en categoría 'PedidosYa'!`;
            } else {
                catalogStatus.style.color = '#dc2626';
                catalogStatus.textContent = `❌ ${res?.error || 'No se pudo sincronizar'}`;
            }

            setTimeout(() => {
                catalogStatus.style.display = 'none';
            }, 4000);
        });
    });
});
