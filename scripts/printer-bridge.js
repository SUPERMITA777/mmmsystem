/* ───────────────────────────────────────────────
   Puente de Impresión MMM – Print Bridge
   Se ejecuta en la PC del restaurante y permite
   que la web imprima silenciosamente.
   ─────────────────────────────────────────────── */

const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const PORT = 9100;
const FALLBACK_PORT = 9101;

function startServer(port) {
    const server = http.createServer((req, res) => {
        // CORS headers for all requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
        }

        const parsedUrl = url.parse(req.url, true);

        // ─── GET /printers ─── List all installed printers
        if (req.method === 'GET' && parsedUrl.pathname === '/printers') {
            const cmd = 'powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"';
            exec(cmd, { timeout: 5000 }, (err, stdout) => {
                if (err) {
                    console.error('Error listando impresoras:', err.message);
                    return res.writeHead(500).end(JSON.stringify({ error: err.message }));
                }
                const printers = stdout
                    .split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0);
                console.log(`📋 Impresoras encontradas: ${printers.join(', ')}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(printers));
            });
            return;
        }

        // ─── GET /status ─── Health check
        if (req.method === 'GET' && parsedUrl.pathname === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ok', version: '1.0.0', port }));
        }

        // ─── POST /print ─── Print HTML to a specific printer
        if (req.method === 'POST' && parsedUrl.pathname === '/print') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { html, printerName } = JSON.parse(body);
                    if (!html || !printerName) {
                        res.writeHead(400);
                        return res.end(JSON.stringify({ error: 'Faltan html o printerName' }));
                    }

                    const tempFile = path.join(os.tmpdir(), `mmm_print_${Date.now()}.html`);
                    
                    // Wrap HTML with auto-print script
                    const printableHtml = html.includes('<script>') ? html : html.replace(
                        '</body>',
                        `<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script></body>`
                    );
                    
                    fs.writeFileSync(tempFile, printableHtml, 'utf8');

                    // Use SumatraPDF or built-in Windows printing
                    // Method 1: Use PowerShell's Out-Printer for text
                    // Method 2: Use rundll32 for HTML files
                    // Method 3: Use Chrome headless for pixel-perfect printing
                    
                    const escapedPrinter = printerName.replace(/'/g, "''");
                    const escapedFile = tempFile.replace(/\\/g, '\\\\');
                    
                    // Try using the default browser in headless mode
                    // We create a VBS script that handles printing silently
                    const vbsContent = `
Set objShell = CreateObject("WScript.Shell")
Set objIE = CreateObject("InternetExplorer.Application")
objIE.Visible = False
objIE.Navigate "${tempFile.replace(/\\/g, '\\')}"
Do While objIE.Busy Or objIE.ReadyState <> 4
    WScript.Sleep 100
Loop
WScript.Sleep 500
objIE.ExecWB 6, 2
WScript.Sleep 2000
objIE.Quit
`;
                    const vbsFile = path.join(os.tmpdir(), `mmm_print_${Date.now()}.vbs`);
                    
                    // Alternative: Use PowerShell to invoke printing via .NET
                    const psCmd = `
$printerName = '${escapedPrinter}'
$htmlFile = '${tempFile.replace(/\\/g, '\\\\')}'

# Set target printer as default temporarily
$currentDefault = (Get-CimInstance -ClassName Win32_Printer -Filter "Default=True").Name

try {
    # Set desired printer as default
    $printer = Get-CimInstance -ClassName Win32_Printer -Filter "Name='$printerName'"
    if ($printer) {
        Invoke-CimMethod -InputObject $printer -MethodName SetDefaultPrinter | Out-Null
    }
    
    # Print using shell verb
    Start-Process -FilePath "$htmlFile" -Verb Print -WindowStyle Hidden
    Start-Sleep -Seconds 3
    
    # Restore original default
    if ($currentDefault) {
        $origPrinter = Get-CimInstance -ClassName Win32_Printer -Filter "Name='$currentDefault'"
        if ($origPrinter) {
            Invoke-CimMethod -InputObject $origPrinter -MethodName SetDefaultPrinter | Out-Null
        }
    }
} catch {
    Write-Error $_.Exception.Message
}
`;
                    const psFile = path.join(os.tmpdir(), `mmm_print_${Date.now()}.ps1`);
                    fs.writeFileSync(psFile, psCmd, 'utf8');
                    
                    exec(`powershell -ExecutionPolicy Bypass -File "${psFile}"`, { timeout: 15000 }, (err) => {
                        // Cleanup
                        setTimeout(() => {
                            try { fs.unlinkSync(tempFile); } catch(e) {}
                            try { fs.unlinkSync(psFile); } catch(e) {}
                        }, 10000);
                        
                        if (err) {
                            console.error(`❌ Error imprimiendo en ${printerName}:`, err.message);
                            res.writeHead(500);
                            return res.end(JSON.stringify({ error: err.message }));
                        }
                        
                        console.log(`✅ Impreso en: ${printerName}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    });

                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'JSON inválido' }));
                }
            });
            return;
        }

        // ─── POST /print-test ─── Test a specific printer
        if (req.method === 'POST' && parsedUrl.pathname === '/print-test') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { printerName } = JSON.parse(body);
                    const testHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>@page{size:80mm auto;margin:5mm}body{font-family:Arial;width:72mm;text-align:center}</style>
</head><body>
<h1 style="font-size:24px">✅ TEST OK</h1>
<p style="font-size:16px;font-weight:bold">Puente de Impresión MMM</p>
<hr>
<p>Impresora: ${printerName}</p>
<p>${new Date().toLocaleString('es-AR')}</p>
<p style="font-size:12px;color:#666">Si podés leer esto, la impresión funciona correctamente.</p>
</body></html>`;

                    const tempFile = path.join(os.tmpdir(), `mmm_test_${Date.now()}.html`);
                    fs.writeFileSync(tempFile, testHtml, 'utf8');

                    const escapedPrinter = printerName.replace(/'/g, "''");
                    const psCmd = `
$printer = Get-CimInstance -ClassName Win32_Printer -Filter "Name='${escapedPrinter}'"
if ($printer) {
    $currentDefault = (Get-CimInstance -ClassName Win32_Printer -Filter "Default=True").Name
    Invoke-CimMethod -InputObject $printer -MethodName SetDefaultPrinter | Out-Null
    Start-Process -FilePath "${tempFile.replace(/\\/g, '\\\\')}" -Verb Print -WindowStyle Hidden
    Start-Sleep -Seconds 3
    if ($currentDefault) {
        $orig = Get-CimInstance -ClassName Win32_Printer -Filter "Name='$currentDefault'"
        if ($orig) { Invoke-CimMethod -InputObject $orig -MethodName SetDefaultPrinter | Out-Null }
    }
}`;
                    exec(`powershell -ExecutionPolicy Bypass -Command "${psCmd.replace(/"/g, '\\"').replace(/\n/g, '; ')}"`, 
                        { timeout: 15000 }, (err) => {
                        setTimeout(() => { try { fs.unlinkSync(tempFile); } catch(e) {} }, 10000);
                        
                        if (err) {
                            console.error(`❌ Test falló para ${printerName}:`, err.message);
                            res.writeHead(500);
                            return res.end(JSON.stringify({ error: err.message }));
                        }
                        console.log(`✅ Test enviado a: ${printerName}`);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    });
                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'JSON inválido' }));
                }
            });
            return;
        }

        // ─── 404 ───
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && port === PORT) {
            console.log(`⚠️  Puerto ${PORT} ocupado, intentando ${FALLBACK_PORT}...`);
            startServer(FALLBACK_PORT);
        } else {
            console.error('Error del servidor:', err);
        }
    });

    server.listen(port, () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════╗');
        console.log('║   🖨️  PUENTE DE IMPRESIÓN MMM v1.0          ║');
        console.log(`║   Ejecutándose en http://localhost:${port}     ║`);
        console.log('║   Listo para recibir comandas.               ║');
        console.log('╚══════════════════════════════════════════════╝');
        console.log('');
        
        // List printers on startup
        exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err, stdout) => {
            if (!err) {
                const printers = stdout.split('\n').map(l => l.trim()).filter(l => l);
                console.log(`📋 Impresoras detectadas (${printers.length}):`);
                printers.forEach((p, i) => console.log(`   ${i + 1}. ${p}`));
                console.log('');
            }
        });
    });
}

startServer(PORT);
