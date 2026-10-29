document.addEventListener('DOMContentLoaded', () => {
    const sucursalSelect = document.getElementById('sucursalSelect');
    const customIdBox = document.getElementById('customIdBox');
    const sucursalIdInput = document.getElementById('sucursalId');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');

    // 1. Cargar la sucursal guardada (por defecto MMM Pizza)
    chrome.storage.sync.get(['sucursalId'], (result) => {
        const currentId = result.sucursalId || "9d1bfdb8-cb79-4568-b2bc-5f04f1888462";
        
        let found = false;
        for (let option of sucursalSelect.options) {
            if (option.value === currentId) {
                sucursalSelect.value = currentId;
                found = true;
                break;
            }
        }

        if (!found) {
            sucursalSelect.value = "custom";
            customIdBox.style.display = "block";
            sucursalIdInput.value = currentId;
        }
    });

    // 2. Controlar si se selecciona "Otro ID"
    sucursalSelect.addEventListener('change', () => {
        if (sucursalSelect.value === 'custom') {
            customIdBox.style.display = 'block';
            sucursalIdInput.focus();
        } else {
            customIdBox.style.display = 'none';
        }
    });

    // 3. Botón guardar
    saveBtn.addEventListener('click', () => {
        let chosenId = sucursalSelect.value;
        if (chosenId === 'custom') {
            chosenId = sucursalIdInput.value.trim();
        }

        if (!chosenId) {
            alert("Por favor selecciona o ingresa un ID de sucursal.");
            return;
        }

        chrome.storage.sync.set({
            sucursalId: chosenId
        }, () => {
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
                window.close(); // Cierra el popup automáticamente
            }, 1200);
        });
    });
});
