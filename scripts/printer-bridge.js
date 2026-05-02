/* ───────────────────────────────────────────────
   Puente de Impresión MMM – Print Bridge
   Se ejecuta en la PC del restaurante y permite
   que la web imprima silenciosamente.
   ─────────────────────────────────────────────── */

const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');

const PORT = 9100;
const FALLBACK_PORT = 9101;

const printQueue = [];
let isPrinting = false;

function processQueue() {
    if (isPrinting || printQueue.length === 0) return;
    
    isPrinting = true;
    const job = printQueue.shift();
    
    console.log('\n>>> PROCESANDO TRABAJO EN COLA (' + printQueue.length + ' restantes)');
    console.log('    Impresora destino: ' + job.printerName);

    const tempFile = path.join(os.tmpdir(), 'mmm_print_' + Date.now() + '.html');
    fs.writeFileSync(tempFile, job.html, 'utf8');

    const psContent = buildPrintScript(job.printerName, tempFile);
    const psFile = path.join(os.tmpdir(), 'mmm_print_' + Date.now() + '.ps1');
    fs.writeFileSync(psFile, psContent, 'utf8');

    console.log('    Ejecutando PowerShell...');

    const child = spawn('powershell', ['-STA', '-ExecutionPolicy', 'Bypass', '-File', psFile]);

    child.stdout.on('data', (data) => {
        console.log('    [PS] ' + data.toString().trim());
    });

    child.stderr.on('data', (data) => {
        console.error('    [PS ERR] ' + data.toString().trim());
    });

    child.on('close', (code) => {
        // Cleanup temp files after a delay
        setTimeout(() => {
            try { fs.unlinkSync(tempFile); } catch(e) {}
            try { fs.unlinkSync(psFile); } catch(e) {}
        }, 10000);

        if (code !== 0) {
            console.error('*** Proceso termino con error (codigo ' + code + ')');
            if (!job.res.writableEnded) {
                job.res.writeHead(500);
                job.res.end(JSON.stringify({ error: 'Error en proceso (codigo ' + code + ')' }));
            }
        } else {
            console.log('>>> Impresion completada OK');
            if (!job.res.writableEnded) {
                job.res.writeHead(200, { 'Content-Type': 'application/json' });
                job.res.end(JSON.stringify({ success: true }));
            }
        }
        
        isPrinting = false;
        processQueue(); // Continuar con el siguiente trabajo
    });
}

/**
 * Genera el contenido del script PowerShell para imprimir.
 * IMPORTANTE: Se usa concatenación de strings (NO template literals)
 * para evitar que JavaScript interprete los $() de PowerShell.
 */
function buildPrintScript(printerName, htmlFilePath) {
    var ps = '';
    ps += '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\r\n';
    ps += 'Add-Type -AssemblyName System.Windows.Forms\r\n';
    ps += '$printerName = \'' + printerName.replace(/'/g, "''") + '\'\r\n';
    ps += '$htmlFile = \'file:///' + htmlFilePath.replace(/\\/g, '/') + '\'\r\n';
    ps += '\r\n';
    ps += 'Write-Host "Paso 1: Buscando impresora [$printerName]..."\r\n';
    ps += 'try {\r\n';
    ps += '    $printer = Get-CimInstance -ClassName Win32_Printer -Filter "Name=\'$printerName\'"\r\n';
    ps += '    if (-not $printer) {\r\n';
    ps += '        Write-Host "ERROR: No se encontro la impresora exacta: $printerName"\r\n';
    ps += '        exit 1\r\n';
    ps += '    }\r\n';
    ps += '    \r\n';
    ps += '    $status = if ($printer.PrinterStatus -eq 3) { "Online" } else { "Status:" + $printer.PrinterStatus }\r\n';
    ps += '    $workOffline = if ($printer.WorkOffline) { "SI" } else { "NO" }\r\n';
    ps += '    Write-Host "INFO: Impresora detectada. Estado: $status. Trabajando Offline: $workOffline"\r\n';
    ps += '    \r\n';
    ps += '    Write-Host "Paso 2: Limpiando cola de trabajos previos..."\r\n';
    ps += '    Get-PrintJob -PrinterName $printerName | Remove-PrintJob -ErrorAction SilentlyContinue\r\n';
    ps += '    \r\n';
    ps += '    Write-Host "Paso 3: Guardando impresora predeterminada..."\r\n';
    ps += '    $currentDefault = (Get-CimInstance -ClassName Win32_Printer -Filter "Default=True").Name\r\n';
    ps += '    \r\n';
    ps += '    Write-Host "Paso 4: Estableciendo impresora destino..."\r\n';
    ps += '    Invoke-CimMethod -InputObject $printer -MethodName SetDefaultPrinter | Out-Null\r\n';
    ps += '    \r\n';
    ps += '    Write-Host "Paso 5: Creando motor de renderizado..."\r\n';
    ps += '    $browser = New-Object System.Windows.Forms.WebBrowser\r\n';
    ps += '    $browser.ScrollBarsEnabled = $false\r\n';
    ps += '    $browser.ScriptErrorsSuppressed = $true\r\n';
    ps += '    \r\n';
    ps += '    Write-Host "Paso 6: Navegando al documento..."\r\n';
    ps += '    $browser.Navigate($htmlFile)\r\n';
    ps += '    $timeout = 0\r\n';
    ps += '    while ($browser.ReadyState -ne "Complete" -and $timeout -lt 200) {\r\n';
    ps += '        [System.Windows.Forms.Application]::DoEvents()\r\n';
    ps += '        Start-Sleep -Milliseconds 50\r\n';
    ps += '        $timeout++\r\n';
    ps += '    }\r\n';
    ps += '    \r\n';
    ps += '    Write-Host "Paso 7: Enviando a cola de impresion (ExecWB)..."\r\n';
    ps += '    $axIns = $browser.ActiveXInstance\r\n';
    ps += '    $axIns.ExecWB(6, 2, [ref]$null, [ref]$null)\r\n';
    ps += '    \r\n';
    ps += '    Write-Host "Paso 8: Esperando que el spooler reciba el documento (8s)..."\r\n';
    ps += '    Start-Sleep -Seconds 8\r\n';
    ps += '    \r\n';
    ps += '    Write-Host "Paso 9: Restaurando impresora predeterminada..."\r\n';
    ps += '    if ($currentDefault -and $currentDefault -ne $printerName) {\r\n';
    ps += '        $orig = Get-CimInstance -ClassName Win32_Printer -Filter "Name=\'$currentDefault\'"\r\n';
    ps += '        if ($orig) { Invoke-CimMethod -InputObject $orig -MethodName SetDefaultPrinter | Out-Null }\r\n';
    ps += '    }\r\n';
    ps += '    Write-Host "Impresion enviada exitosamente al spooler de Windows."\r\n';
    ps += '} catch {\r\n';
    ps += '    Write-Host ("ERROR CRITICO EN POWERSHELL: " + $_.Exception.Message)\r\n';
    ps += '    exit 1\r\n';
    ps += '}\r\n';
    return ps;
}

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
                console.log('Impresoras encontradas: ' + printers.join(', '));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(printers));
            });
            return;
        }

        // ─── GET /status ─── Health check
        if (req.method === 'GET' && parsedUrl.pathname === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ok', version: '2.0.0', port }));
        }

        // ─── POST /print ─── Print HTML to a specific printer
        if (req.method === 'POST' && parsedUrl.pathname === '/print') {
            console.log('\n>>> RECIBIDA PETICION DE IMPRESION (/print)');
            let body = '';

            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { html, printerName } = JSON.parse(body);
                    if (!html || !printerName) {
                        res.writeHead(400);
                        return res.end(JSON.stringify({ error: 'Faltan html o printerName' }));
                    }

                    // ENCOLAR EL TRABAJO
                    printQueue.push({ html, printerName, res });
                    console.log(`[Cola] Trabajo añadido para ${printerName}. Posición: ${printQueue.length}`);
                    processQueue();

                } catch (e) {
                    console.error('Error procesando peticion:', e);
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'JSON invalido' }));
                }
            });
            return;
        }

        // ─── POST /print-test ─── Test a specific printer
        if (req.method === 'POST' && parsedUrl.pathname === '/print-test') {
            console.log('\n>>> RECIBIDA PETICION DE TEST (/print-test)');
            let body = '';

            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { printerName } = JSON.parse(body);
                    var testHtml = '<!DOCTYPE html><html><head><meta charset="utf-8">';
                    testHtml += '<style>@page{size:80mm auto;margin:5mm}body{font-family:Arial;width:72mm;text-align:center}</style>';
                    testHtml += '</head><body>';
                    testHtml += '<h1 style="font-size:24px">TEST OK</h1>';
                    testHtml += '<p style="font-size:16px;font-weight:bold">Puente de Impresion MMM</p>';
                    testHtml += '<hr>';
                    testHtml += '<p>Impresora: ' + printerName + '</p>';
                    testHtml += '<p>' + new Date().toLocaleString('es-AR') + '</p>';
                    testHtml += '<p style="font-size:12px;color:#666">Si podes leer esto, la impresion funciona correctamente.</p>';
                    testHtml += '</body></html>';

                    const tempFile = path.join(os.tmpdir(), 'mmm_test_' + Date.now() + '.html');
                    fs.writeFileSync(tempFile, testHtml, 'utf8');

                    const psContent = buildPrintScript(printerName, tempFile);
                    const psFile = path.join(os.tmpdir(), 'mmm_test_ps_' + Date.now() + '.ps1');
                    fs.writeFileSync(psFile, psContent, 'utf8');

                    const child = spawn('powershell', ['-STA', '-ExecutionPolicy', 'Bypass', '-File', psFile]);

                    child.stdout.on('data', (data) => {
                        console.log('    [PS] ' + data.toString().trim());
                    });

                    child.stderr.on('data', (data) => {
                        console.error('    [PS ERR] ' + data.toString().trim());
                    });

                    child.on('close', (code) => {
                        setTimeout(() => {
                            try { fs.unlinkSync(tempFile); } catch(e) {}
                            try { fs.unlinkSync(psFile); } catch(e) {}
                        }, 10000);

                        if (code !== 0) {
                            console.error('*** Test fallo (codigo ' + code + ')');
                            if (!res.writableEnded) {
                                res.writeHead(500);
                                res.end(JSON.stringify({ error: 'Test fallo (codigo ' + code + ')' }));
                            }
                        } else {
                            console.log('>>> Test enviado OK a: ' + printerName);
                            if (!res.writableEnded) {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true }));
                            }
                        }
                    });

                } catch (e) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'JSON invalido' }));
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
            console.log('Puerto ' + PORT + ' ocupado, intentando ' + FALLBACK_PORT + '...');
            startServer(FALLBACK_PORT);
        } else {
            console.error('Error del servidor:', err);
        }
    });

    server.listen(port, () => {
        console.log('');
        console.log('========================================');
        console.log('  PUENTE DE IMPRESION MMM v2.0');
        console.log('  Ejecutandose en http://localhost:' + port);
        console.log('  Listo para recibir comandas.');
        console.log('========================================');
        console.log('');

        // List printers on startup
        exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err, stdout) => {
            if (!err) {
                var printers = stdout.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
                console.log('Impresoras detectadas (' + printers.length + '):');
                printers.forEach(function(p, i) { console.log('   ' + (i + 1) + '. ' + p); });
                console.log('');
            }
        });
    });
}

startServer(PORT);

// Manejo global de errores para evitar que el proceso muera
process.on('uncaughtException', function(err) {
    console.error('ERROR NO CONTROLADO:', err);
});

process.on('unhandledRejection', function(reason) {
    console.error('PROMESA RECHAZADA:', reason);
});
