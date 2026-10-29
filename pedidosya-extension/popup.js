document.addEventListener('DOMContentLoaded', () => {
    const sucursalIdInput = document.getElementById('sucursalId');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // Cargar la sucursal guardada (por defecto MMM Pizza)
    chrome.storage.sync.get(['sucursalId'], (result) => {
        sucursalIdInput.value = result.sucursalId || "9d1bfdb8-cb79-4568-b2bc-5f04f1888462";
    });

    // Guardar
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
                window.close();
            }, 1200);
        });
    });
});
