/* ───────────────────────────────────────────────
   Puente de Impresión MMM – Print Bridge
   v4.0 - Solo impresión, sin credenciales, sin DB
   ─────────────────────────────────────────────── */

const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');

// --- CONFIG (OPCIONAL — solo para cambiar el puerto) ---
// Si existe bridge-config.json, se puede usar { "port": 9101 } para cambiar el puerto.
// No se necesitan credenciales de ningún tipo.
let bridgeConfig = {};
const configPath = path.join(__dirname, 'bridge-config.json');
try {
    if (fs.existsSync(configPath)) {
        bridgeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('[Config] Configuración cargada desde bridge-config.json');
    }
} catch(e) {
    console.error('[Config] Error leyendo bridge-config.json:', e.message);
}

const PORT = bridgeConfig.port ? parseInt(bridgeConfig.port) : 9100;

// --- ESC/POS HELPERS ---
function htmlToEscPos(html) {
    let text = html
        .replace(/<style([\s\S]*?)<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<li[^>]*>/gi, ' • ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<h[1-6][^>]*>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/g, '')
        .trim();

    text = text.replace(/\n{3,}/g, '\n\n');

    const ESC = '\x1B';
    const GS  = '\x1D';
    const INIT = ESC + '@';
    const CUT  = GS + 'V' + '\x41' + '\x03'; // Full cut

    const charMap = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U'
    };
    text = text.split('').map(c => charMap[c] || c).join('');

    return INIT + text + '\n\n\n\n' + CUT;
}

// --- PRINT QUEUE ---
const printQueue = [];
let isPrinting = false;

function printToIp(job, attempt = 1) {
    const client = new net.Socket();
    client.setTimeout(4000);

    client.connect(9100, job.printerIp, () => {
        const data = htmlToEscPos(job.html);
        client.write(data, 'binary', () => {
            client.destroy();
            console.log(`>>> Impresion IP completada OK (intento ${attempt})`);
            if (job.res && !job.res.writableEnded) {
                job.res.writeHead(200, { 'Content-Type': 'application/json' });
                job.res.end(JSON.stringify({ success: true, mode: 'direct-ip' }));
            }
            isPrinting = false;
            processQueue();
        });
    });

    client.on('error', (err) => {
        client.destroy();
        if (attempt < 2) {
            console.warn(`*** Error IP intento ${attempt}, reintentando en 500ms: ${err.message}`);
            setTimeout(() => printToIp(job, attempt + 1), 500);
        } else {
            console.error(`*** Error final imprimiendo a IP ${job.printerIp}: ${err.message}`);
            if (job.res && !job.res.writableEnded) {
                job.res.writeHead(500);
                job.res.end(JSON.stringify({ error: 'Error de conexión: ' + err.message }));
            }
            isPrinting = false;
            processQueue();
        }
    });

    client.on('timeout', () => {
        client.destroy();
        if (attempt < 2) {
            console.warn(`*** Timeout IP intento ${attempt}, reintentando...`);
            setTimeout(() => printToIp(job, attempt + 1), 500);
        } else {
            console.error(`*** Timeout final conectando a IP ${job.printerIp}`);
            if (job.res && !job.res.writableEnded) {
                job.res.writeHead(500);
                job.res.end(JSON.stringify({ error: 'Timeout de conexión con impresora IP' }));
            }
            isPrinting = false;
            processQueue();
        }
    });
}

function processQueue() {
    if (isPrinting || printQueue.length === 0) return;
    isPrinting = true;
    const job = printQueue.shift();

    if (job.printerIp) {
        console.log(`\n>>> IMPRIMIENDO DIRECTO A IP: ${job.printerIp}`);
        printToIp(job);
        return;
    }

    // Impresión vía PowerShell (Windows Driver — para impresoras USB o en red por nombre)
    console.log(`\n>>> PROCESANDO TRABAJO EN COLA (Windows Spooler)`);
    console.log('    Impresora destino: ' + job.printerName);

    const tempFile = path.join(os.tmpdir(), 'mmm_print_' + Date.now() + '.html');
    fs.writeFileSync(tempFile, job.html, 'utf8');

    const psContent = buildPrintScript(job.printerName, tempFile);
    const psFile = path.join(os.tmpdir(), 'mmm_print_' + Date.now() + '.ps1');
    fs.writeFileSync(psFile, psContent, 'utf8');

    // -NonInteractive -NoProfile reducen el tiempo de arranque de PowerShell (~300ms menos)
    const child = spawn('powershell', ['-STA', '-NonInteractive', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psFile]);

    // Timeout global de seguridad
    const killTimeout = setTimeout(() => {
        console.error('*** Timeout global de PowerShell — matando proceso');
        child.kill('SIGTERM');
    }, 15000);

    child.on('close', (code) => {
        clearTimeout(killTimeout);
        setTimeout(() => {
            try { fs.unlinkSync(tempFile); } catch(e) {}
            try { fs.unlinkSync(psFile); } catch(e) {}
        }, 10000);

        if (code !== 0) {
            console.error('*** Proceso termino con error (codigo ' + code + ')');
            if (job.res && !job.res.writableEnded) {
                job.res.writeHead(500);
                job.res.end(JSON.stringify({ error: 'Error en proceso (codigo ' + code + ')' }));
            }
        } else {
            console.log('>>> Impresion completada OK');
            if (job.res && !job.res.writableEnded) {
                job.res.writeHead(200, { 'Content-Type': 'application/json' });
                job.res.end(JSON.stringify({ success: true }));
            }
        }

        isPrinting = false;
        processQueue();
    });
}

function buildPrintScript(printerName, htmlFilePath) {
    var ps = '';
    ps += '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8\r\n';
    ps += 'Add-Type -AssemblyName System.Windows.Forms\r\n';
    ps += '$printerName = \'' + printerName.replace(/'/g, "''") + '\'\r\n';
    ps += '$htmlFile = \'file:///' + htmlFilePath.replace(/\\/g, '/') + '\'\r\n';
    ps += 'try {\r\n';
    ps += '    $regPath = "HKCU:\\Software\\Microsoft\\Internet Explorer\\PageSetup"\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "margin_bottom" -Value "0" -ErrorAction SilentlyContinue\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "margin_left"   -Value "0" -ErrorAction SilentlyContinue\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "margin_right"  -Value "0" -ErrorAction SilentlyContinue\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "margin_top"    -Value "0" -ErrorAction SilentlyContinue\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "header" -Value "" -ErrorAction SilentlyContinue\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "footer" -Value "" -ErrorAction SilentlyContinue\r\n';
    // Get-Printer es 3-5x más rápido que Get-CimInstance Win32_Printer
    ps += '    $allPrinters = Get-Printer\r\n';
    ps += '    $matched = $allPrinters | Where-Object { $_.Name -eq $printerName } | Select-Object -First 1\r\n';
    ps += '    if (-not $matched) {\r\n';
    ps += '        $pNameLower = $printerName.ToLower()\r\n';
    ps += '        $matched = $allPrinters | Where-Object { $_.Name.ToLower().Contains($pNameLower) -or $pNameLower.Contains($_.Name.ToLower()) } | Select-Object -First 1\r\n';
    ps += '    }\r\n';
    ps += '    if (-not $matched) {\r\n';
    ps += '        $matched = $allPrinters | Where-Object { $_.Default -eq $true } | Select-Object -First 1\r\n';
    ps += '    }\r\n';
    ps += '    $currentDefault = ($allPrinters | Where-Object { $_.Default -eq $true } | Select-Object -First 1).Name\r\n';
    ps += '    $changedDefault = $false\r\n';
    ps += '    if ($matched -and $matched.Name -ne $currentDefault) {\r\n';
    ps += '        rundll32 printui.dll,PrintUIEntry /y /n "$($matched.Name)"\r\n';
    ps += '        $changedDefault = $true\r\n';
    ps += '    }\r\n';
    ps += '    $browser = New-Object System.Windows.Forms.WebBrowser\r\n';
    ps += '    $browser.ScrollBarsEnabled = $false\r\n';
    ps += '    $browser.ScriptErrorsSuppressed = $true\r\n';
    ps += '    $browser.Navigate($htmlFile)\r\n';
    ps += '    $timeout = [DateTime]::Now.AddSeconds(5)\r\n';
    ps += '    while ($browser.ReadyState -ne "Complete" -and [DateTime]::Now -lt $timeout) {\r\n';
    ps += '        [System.Windows.Forms.Application]::DoEvents()\r\n';
    ps += '        Start-Sleep -Milliseconds 20\r\n';
    ps += '    }\r\n';
    ps += '    $axIns = $browser.ActiveXInstance\r\n';
    ps += '    $axIns.ExecWB(6, 2, [ref]$null, [ref]$null)\r\n';
    ps += '    if ($changedDefault) {\r\n';
    ps += '        Start-Sleep -Seconds 1\r\n';
    ps += '        rundll32 printui.dll,PrintUIEntry /y /n "$currentDefault"\r\n';
    ps += '    } else {\r\n';
    ps += '        Start-Sleep -Milliseconds 100\r\n';
    ps += '    }\r\n';
    ps += '} catch { exit 1 }\r\n';
    return ps;
}

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

function startServer(port) {
    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
        }

        const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = parsedUrl.pathname;

        // --- ENDPOINT: STATUS ---
        if (req.method === 'GET' && pathname === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ok', version: '4.0.0' }));
        }

        // --- ENDPOINT: GET PRINTERS ---
        if (req.method === 'GET' && pathname === '/printers') {
            exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err, stdout) => {
                if (err) return res.writeHead(500).end(JSON.stringify({ error: err.message }));
                const printers = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(printers));
            });
            return;
        }

        // --- ENDPOINT: PRINT ---
        if (req.method === 'POST' && pathname === '/print') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { html, printerName, printerIp } = JSON.parse(body);
                    if (!printerName && !printerIp) {
                        res.writeHead(400).end(JSON.stringify({ error: 'Falta printerName o printerIp' }));
                        return;
                    }
                    // Responder 200 inmediatamente — el trabajo queda en cola
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, queued: true }));

                    printQueue.push({ html, printerName, printerIp, res });
                    processQueue();
                } catch (e) {
                    res.writeHead(400).end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }

        // --- ENDPOINT: PRINT TEST ---
        if (req.method === 'POST' && pathname === '/print-test') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { printerName } = JSON.parse(body);
                    const testHtml = `
                        <html><body style="font-family:Arial;text-align:center;padding:20px;">
                            <h1>TEST OK</h1>
                            <p>MMM SYSTEM v4.0</p>
                            <p>Impresora: ${printerName}</p>
                            <p>Fecha: ${new Date().toLocaleString()}</p>
                        </body></html>
                    `;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, queued: true }));

                    printQueue.push({ html: testHtml, printerName, res });
                    processQueue();
                } catch (e) {
                    res.writeHead(400).end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
            return;
        }

        // --- ENDPOINT: SELF-UPDATE (git pull + restart) ---
        if (req.method === 'POST' && pathname === '/update') {
            console.log('>>> SOLICITUD DE ACTUALIZACION RECIBIDA');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Iniciando actualización...' }));

            setTimeout(() => {
                exec('git pull', (err, stdout) => {
                    if (err) {
                        console.error('Error en git pull:', err);
                    } else {
                        console.log('Git pull completado:', stdout);
                    }
                    console.log('Reiniciando puente para aplicar cambios...');
                    process.exit(0);
                });
            }, 500);
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && port === 9100) {
            console.warn('*** Puerto 9100 ocupado. Intentando con puerto 9101...');
            startServer(9101);
        } else {
            console.error('CRITICAL ERROR:', err.message);
            process.exit(1);
        }
    });

    server.listen(port, '0.0.0.0', () => {
        const localIp = getLocalIp();
        console.log('\n=================================================');
        console.log('   MMM PRINT BRIDGE v4.0');
        console.log('   -----------------------------------');
        console.log('   Sin credenciales — Solo impresión');
        console.log('   DIRECCION IP: ' + localIp);
        console.log('   PUERTO: ' + port);
        console.log('   URL PARA TABLETS: http://' + localIp + ':' + port);
        console.log('=================================================\n');
        exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err, stdout) => {
            if (!err) {
                const printers = stdout.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                console.log('Impresoras encontradas: ' + printers.join(', '));
            }
        });
    });
}

startServer(PORT);

process.on('uncaughtException', err => console.error('CRITICAL ERROR:', err));
process.on('unhandledRejection', r  => console.error('REJECTION:', r));
