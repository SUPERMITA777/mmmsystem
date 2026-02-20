document.addEventListener('DOMContentLoaded', () => {
    // Cargar los datos almacenados
    chrome.storage.sync.get(['supabaseUrl', 'supabaseKey', 'sucursalId'], (result) => {
        if (result.supabaseUrl) document.getElementById('supabaseUrl').value = result.supabaseUrl;
        if (result.supabaseKey) document.getElementById('supabaseKey').value = result.supabaseKey;
        if (result.sucursalId) document.getElementById('sucursalId').value = result.sucursalId;
    });

    // Botón guardar
    document.getElementById('saveBtn').addEventListener('click', () => {
        const url = document.getElementById('supabaseUrl').value.trim();
        const key = document.getElementById('supabaseKey').value.trim();
        const sucursal = document.getElementById('sucursalId').value.trim();

        chrome.storage.sync.set({
            supabaseUrl: url,
            supabaseKey: key,
            sucursalId: sucursal
        }, () => {
            const status = document.getElementById('status');
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 2000);

            // Notificar al content script/background si es necesario
            chrome.runtime.sendMessage({ action: "CONFIG_UPDATED" });
        });
    });
});
