const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 3000;

// Endpoint para listar impresoras (Windows)
app.get('/printers', (req, res) => {
    const cmd = 'powershell "Get-Printer | Select-Object Name"';
    exec(cmd, (err, stdout) => {
        if (err) return res.status(500).json({ error: err.message });
        const printers = stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && line !== 'Name' && !line.startsWith('----'));
        res.json(printers);
    });
});

// Endpoint para imprimir HTML
app.post('/print', async (req, res) => {
    const { html, printerName } = req.body;
    if (!html || !printerName) return res.status(400).json({ error: 'Faltan datos' });

    const tempHtml = path.join(os.tmpdir(), `print_${Date.now()}.html`);
    fs.writeFileSync(tempHtml, html);

    // Comando para imprimir usando Chrome en modo headless (debe estar instalado en la ruta por defecto)
    // Este comando genera un PDF temporal y lo manda a la impresora
    const chromePath = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"`;
    const tempPdf = path.join(os.tmpdir(), `print_${Date.now()}.pdf`);

    const cmdPdf = `${chromePath} --headless --disable-gpu --print-to-pdf="${tempPdf}" "${tempHtml}"`;
    
    exec(cmdPdf, (err) => {
        if (err) return res.status(500).json({ error: 'Error generando PDF: ' + err.message });

        // Imprimir el PDF generado usando PowerShell
        const cmdPrint = `powershell "Start-Process -FilePath '${tempPdf}' -Verb PrintTo -ArgumentList '${printerName}' -WindowStyle Hidden"`;
        
        exec(cmdPrint, (err2) => {
            // Limpieza (opcionalmente esperar un poco antes de borrar)
            setTimeout(() => {
                try { fs.unlinkSync(tempHtml); fs.unlinkSync(tempPdf); } catch(e){}
            }, 5000);

            if (err2) return res.status(500).json({ error: 'Error enviando a impresora: ' + err2.message });
            res.json({ success: true });
        });
    });
});

// Test endpoint
app.post('/print-test', (req, res) => {
    const { printerName } = req.body;
    const testHtml = `<h1>Test de Impresi\u00f3n</h1><p>Impresora: ${printerName}</p><p>Fecha: ${new Date().toLocaleString()}</p>`;
    // Reutilizar l\u00f3gica de /print o simplemente responder
    console.log(`Prueba solicitada para: ${printerName}`);
    res.json({ success: true, message: 'Puente activo' });
});

app.listen(PORT, () => {
    console.log(`\uD83D\uDDA5\uFE0F Puente de Impresi\u00f3n MMM ejecut\u00e1ndose en http://localhost:${PORT}`);
    console.log(`\uD83D\uDCCB Listo para recibir comandas.`);
});
