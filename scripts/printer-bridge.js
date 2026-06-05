/* ───────────────────────────────────────────────
   Puente de Impresión MMM – Local Hub & Print Bridge
   v3.0 - Soporte Offline-First LAN
   ─────────────────────────────────────────────── */

const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const https = require('https');
const net = require('net'); // Añadido para impresión directa por IP

const PORT = 9100;
const DB_PATH = path.join(os.homedir(), '.mmm_local_db.json');

// --- CONFIG (FROM .ENV) ---
const SUPABASE_URL = 'https://xnupjsxbvyirpeagbloe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhudXBqc3hidnlpcnBlYWdibG9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDY0OTg2OSwiZXhwIjoyMDg2MjI1ODY5fQ.abuUcTgjLUnHZqagnlk10l8BpsCnDg3q_IRPUg5hKw0';

// --- DATABASE LOGIC ---
function loadDb() {
    try {
        if (!fs.existsSync(DB_PATH)) return { orders: [] };
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error('Error cargando DB local:', e);
        return { orders: [] };
    }
}

function saveDb(data) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Error guardando DB local:', e);
    }
}

// --- ESC/POS HELPERS ---
function htmlToEscPos(html) {
    // Limpieza básica de HTML para impresoras térmicas
    let text = html
        .replace(/<style([\s\S]*?)<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<li[^>]*>/gi, ' • ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<h[1-6][^>]*>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '') // Quitar etiquetas restantes
        .replace(/&nbsp;/g, ' ')
        .replace(/&[a-z]+;/g, '')
        .trim();

    // Reemplazar múltiples saltos de línea por dos
    text = text.replace(/\n{3,}/g, '\n\n');

    // Comandos ESC/POS básicos
    const ESC = '\x1B';
    const GS = '\x1D';
    const INIT = ESC + '@';
    const CUT = GS + 'V' + '\x41' + '\x03'; // Full cut
    
    // Convertir acentos para impresoras térmicas (CP850 o similar)
    const charMap = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U'
    };
    text = text.split('').map(c => charMap[c] || c).join('');

    return INIT + text + '\n\n\n\n' + CUT;
}

// --- PRINT QUEUE LOGIC ---
const printQueue = [];
let isPrinting = false;

function processQueue() {
    if (isPrinting || printQueue.length === 0) return;
    isPrinting = true;
    const job = printQueue.shift();

    if (job.printerIp) {
        console.log(`\n>>> IMPRIMIENDO DIRECTO A IP: ${job.printerIp}`);
        const client = new net.Socket();
        client.setTimeout(5000);

        client.connect(9100, job.printerIp, () => {
            const data = htmlToEscPos(job.html);
            client.write(data, 'binary', () => {
                client.destroy();
                console.log('>>> Impresion IP completada OK');
                if (job.res && !job.res.writableEnded) {
                    job.res.writeHead(200, { 'Content-Type': 'application/json' });
                    job.res.end(JSON.stringify({ success: true, mode: 'direct-ip' }));
                }
                isPrinting = false;
                processQueue();
            });
        });

        client.on('error', (err) => {
            console.error(`*** Error imprimiendo a IP ${job.printerIp}:`, err.message);
            if (job.res && !job.res.writableEnded) {
                job.res.writeHead(500);
                job.res.end(JSON.stringify({ error: 'Error de conexión con impresora IP: ' + err.message }));
            }
            client.destroy();
            isPrinting = false;
            processQueue();
        });

        client.on('timeout', () => {
            console.error(`*** Timeout conectando a IP ${job.printerIp}`);
            if (job.res && !job.res.writableEnded) {
                job.res.writeHead(500);
                job.res.end(JSON.stringify({ error: 'Timeout de conexión con impresora IP' }));
            }
            client.destroy();
            isPrinting = false;
            processQueue();
        });
        return;
    }

    // Impresión vía PowerShell (Windows Driver)
    console.log(`\n>>> PROCESANDO TRABAJO EN COLA (Windows Spooler)`);
    console.log('    Impresora destino: ' + job.printerName);

    const tempFile = path.join(os.tmpdir(), 'mmm_print_' + Date.now() + '.html');
    fs.writeFileSync(tempFile, job.html, 'utf8');

    const psContent = buildPrintScript(job.printerName, tempFile);
    const psFile = path.join(os.tmpdir(), 'mmm_print_' + Date.now() + '.ps1');
    fs.writeFileSync(psFile, psContent, 'utf8');

    const child = spawn('powershell', ['-STA', '-ExecutionPolicy', 'Bypass', '-File', psFile]);

    child.on('close', (code) => {
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
    ps += '    Set-ItemProperty -Path $regPath -Name "margin_left" -Value "0" -ErrorAction SilentlyContinue\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "margin_right" -Value "0" -ErrorAction SilentlyContinue\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "margin_top" -Value "0" -ErrorAction SilentlyContinue\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "header" -Value "" -ErrorAction SilentlyContinue\r\n';
    ps += '    Set-ItemProperty -Path $regPath -Name "footer" -Value "" -ErrorAction SilentlyContinue\r\n';
    ps += '    $printer = Get-CimInstance -ClassName Win32_Printer -Filter "Name=\'$printerName\'"\r\n';
    ps += '    $currentDefault = (Get-CimInstance -ClassName Win32_Printer -Filter "Default=True").Name\r\n';
    ps += '    Invoke-CimMethod -InputObject $printer -MethodName SetDefaultPrinter | Out-Null\r\n';
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
    ps += '    Start-Sleep -Milliseconds 500\r\n'; // Reducido de 2s a 500ms
    ps += '    if ($currentDefault) {\r\n';
    ps += '        $orig = Get-CimInstance -ClassName Win32_Printer -Filter "Name=\'$currentDefault\'"\r\n';
    ps += '        Invoke-CimMethod -InputObject $orig -MethodName SetDefaultPrinter | Out-Null\r\n';
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
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tenant-ID');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            return res.end();
        }

        const parsedUrl = url.parse(req.url, true);

        // --- ENDPOINT: STATUS ---
        if (req.method === 'GET' && parsedUrl.pathname === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ok', version: '3.0.0', hub_active: true }));
        }

        // --- ENDPOINT: GET PRINTERS ---
        if (req.method === 'GET' && parsedUrl.pathname === '/printers') {
            exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err, stdout) => {
                if (err) return res.writeHead(500).end(JSON.stringify({ error: err.message }));
                const printers = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(printers));
            });
            return;
        }

        // --- ENDPOINT: PRINT ---
        if (req.method === 'POST' && parsedUrl.pathname === '/print') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { html, printerName, printerIp } = JSON.parse(body);
                    if (!printerName && !printerIp) {
                        res.writeHead(400).end(JSON.stringify({ error: 'Falta printerName o printerIp' }));
                        return;
                    }
                    // Responder inmediatamente al cliente para evitar timeouts y fallback a la impresión del navegador
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
        if (req.method === 'POST' && parsedUrl.pathname === '/print-test') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { printerName } = JSON.parse(body);
                    const testHtml = `
                        <html><body style="font-family:Arial;text-align:center;padding:20px;">
                            <h1>TEST OK</h1>
                            <p>MMM SYSTEM</p>
                            <p>Impresora: ${printerName}</p>
                            <p>Fecha: ${new Date().toLocaleString()}</p>
                        </body></html>
                    `;
                    // Responder inmediatamente al cliente
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

        // --- ENDPOINT: SAVE ORDER (LOCAL HUB) ---
        if (req.method === 'POST' && (parsedUrl.pathname === '/api/save-order' || parsedUrl.pathname === '/api/orders')) {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const orderData = JSON.parse(body);
                    const db = loadDb();
                    
                    // Si ya existe por ID, lo actualizamos, sino lo agregamos
                    const index = db.orders.findIndex(o => o.id === orderData.id);
                    if (index !== -1) {
                        db.orders[index] = { ...db.orders[index], ...orderData, last_updated: new Date().toISOString() };
                    } else {
                        db.orders.push({ ...orderData, created_at_local: new Date().toISOString(), synced: false });
                    }
                    
                    saveDb(db);
                    console.log('>>> PEDIDO GUARDADO LOCALMENTE:', orderData.id || orderData.numero_pedido);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, id: orderData.id }));
                } catch (e) {
                    res.writeHead(400).end(JSON.stringify({ error: 'Invalid Order JSON' }));
                }
            });
            return;
        }

        // --- ENDPOINT: GET ORDERS (FOR LAN SYNC) ---
        if (req.method === 'GET' && (parsedUrl.pathname === '/api/get-orders' || parsedUrl.pathname === '/api/orders')) {
            const db = loadDb();
            const sucursalId = req.headers['x-tenant-id'];
            
            let filteredOrders = db.orders;
            if (sucursalId) {
                filteredOrders = db.orders.filter(o => 
                    o.sucursal_id === sucursalId || 
                    o.tenantId === sucursalId || 
                    (o.pedido && o.pedido.sucursal_id === sucursalId)
                );
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(filteredOrders));
            return;
        }

        // --- ENDPOINT: SYNC COMPLETE ---
        if (req.method === 'POST' && parsedUrl.pathname === '/api/sync-complete') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const { ids } = JSON.parse(body);
                    const db = loadDb();
                    db.orders = db.orders.map(o => ids.includes(o.id) ? { ...o, synced: true } : o);
                    saveDb(db);
                    res.writeHead(200).end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(400).end();
                }
            });
            return;
        }

        // --- ENDPOINT: SELF-UPDATE (GIT PULL) ---
        if (req.method === 'POST' && parsedUrl.pathname === '/update') {
            console.log('>>> SOLICITUD DE ACTUALIZACION RECIBIDA');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Iniciando actualización...' }));
            
            // Ejecutar git pull y salir (el .bat reiniciará)
            setTimeout(() => {
                exec('git pull', (err, stdout, stderr) => {
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

        // Default 404
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(port, '0.0.0.0', () => {
        const localIp = getLocalIp();
        console.log('\n=================================================');
        console.log('   MMM LOCAL HUB & PRINT BRIDGE v3.1');
        console.log('   -----------------------------------');
        console.log('   ESTA MAQUINA ES EL SERVIDOR LOCAL');
        console.log('   DIRECCION IP: ' + localIp);
        console.log('   PUERTO: ' + port);
        console.log('   URL PARA TABLETS: http://' + localIp + ':' + port);
        console.log('=================================================\n');
        console.log('Buscando impresoras...');
        exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err, stdout) => {
            if (!err) {
                const printers = stdout.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
                console.log('Impresoras encontradas: ' + printers.join(', '));
            }
        });
    });
}

// --- BACKGROUND SYNC TO SUPABASE ---
async function syncToSupabase() {
    const db = loadDb();
    const unsynced = db.orders.filter(o => !o.synced);
    if (unsynced.length === 0) return;

    console.log(`[Sync] Intentando sincronizar ${unsynced.length} pedidos con Supabase...`);

    for (const order of unsynced) {
        try {
            const payload = order.pedido || order;
            const items = order.items || [];
            
            // 1. Subir pedido
            const success = await supabasePost('/rest/v1/pedidos', payload);
            if (success) {
                // 2. Subir items
                if (items.length > 0) {
                    const itemsWithId = items.map(it => ({ ...it, pedido_id: payload.id }));
                    await supabasePost('/rest/v1/pedido_items', itemsWithId);
                }
                order.synced = true;
                console.log(`[Sync] Pedido ${payload.numero_pedido || payload.id} sincronizado OK`);
            }
        } catch (e) {
            console.error(`[Sync] Error sincronizando ${order.id}:`, e.message);
        }
    }
    saveDb(db);
}

function supabasePost(path, data) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(SUPABASE_URL);
        const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'resolution=merge-duplicates'
            }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(true);
            else {
                let errData = '';
                res.on('data', d => errData += d);
                res.on('end', () => {
                    console.warn(`[Supabase] Error ${res.statusCode}: ${errData}`);
                    resolve(false);
                });
            }
        });

        req.on('error', (e) => reject(e));
        req.write(JSON.stringify(data));
        req.end();
    });
}

// Iniciar loop de sincronización cada 30 segundos
setInterval(syncToSupabase, 30000);

startServer(PORT);

process.on('uncaughtException', err => console.error('CRITICAL ERROR:', err));
process.on('unhandledRejection', r => console.error('REJECTION:', r));

