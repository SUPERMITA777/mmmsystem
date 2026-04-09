/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║     MMM SYSTEM — Agente WhatsApp IA                     ║
 * ║     Conectá tu negocio con IA en WhatsApp               ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * Ejecutable standalone que conecta WhatsApp al sistema MMM.
 * Solo necesitás: Código de Negocio + escanear QR.
 */

import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import pino from 'pino';

// ═══════════════════════════════════════════
// COLORS (ANSI sin dependencias)
// ═══════════════════════════════════════════
const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    white: '\x1b[37m',
    bgMagenta: '\x1b[45m',
    bgGreen: '\x1b[42m',
    bgRed: '\x1b[41m',
    bgBlue: '\x1b[44m',
};

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const CONFIG_FILE = path.join(process.cwd(), 'mmm-agent-config.json');
const AUTH_FOLDER = path.join(process.cwd(), 'auth_whatsapp');

// Default to production URL — change this to your deployed URL
const DEFAULT_SERVER = 'https://mmmsystem.vercel.app';

interface SavedConfig {
    tenantId: string;
    serverUrl: string;
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function clearScreen() {
    process.stdout.write('\x1bc');
}

function printBanner() {
    console.log(`
${c.magenta}${c.bold}  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║   ${c.white}🤖  MMM SYSTEM — Agente WhatsApp IA${c.magenta}           ║
  ║   ${c.dim}${c.white}Conectá tu negocio con inteligencia artificial${c.reset}${c.magenta}${c.bold}  ║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝${c.reset}
`);
}

function log(icon: string, msg: string, color: string = c.white) {
    const time = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    console.log(`  ${c.dim}[${time}]${c.reset} ${icon}  ${color}${msg}${c.reset}`);
}

function logSuccess(msg: string) { log('✅', msg, c.green); }
function logInfo(msg: string) { log('ℹ️', msg, c.cyan); }
function logWarn(msg: string) { log('⚠️', msg, c.yellow); }
function logError(msg: string) { log('❌', msg, c.red); }
function logMsg(direction: '<<' | '>>', sender: string, text: string) {
    const icon = direction === '<<' ? '📩' : '📤';
    const color = direction === '<<' ? c.cyan : c.green;
    const preview = text.length > 60 ? text.substring(0, 60) + '...' : text;
    log(icon, `${c.bold}${sender}${c.reset}${color}: "${preview}"`, color);
}

function ask(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(`  ${c.yellow}❯${c.reset} ${question}`, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function loadConfig(): SavedConfig | null {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch { }
    return null;
}

function saveConfig(config: SavedConfig) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

// ═══════════════════════════════════════════
// SETUP WIZARD
// ═══════════════════════════════════════════

async function setupWizard(): Promise<SavedConfig> {
    const saved = loadConfig();

    if (saved) {
        console.log(`  ${c.dim}────────────────────────────────────────────${c.reset}`);
        console.log(`  ${c.green}${c.bold}Configuración encontrada:${c.reset}`);
        console.log(`  ${c.dim}  Negocio:${c.reset}  ${c.bold}${saved.tenantId}${c.reset}`);
        console.log(`  ${c.dim}  Servidor:${c.reset} ${saved.serverUrl}`);
        console.log(`  ${c.dim}────────────────────────────────────────────${c.reset}\n`);

        const useExisting = await ask(`¿Usar esta configuración? (${c.bold}S${c.reset}/n): `);
        if (useExisting.toLowerCase() !== 'n') {
            return saved;
        }
        console.log('');
    }

    // New setup
    console.log(`  ${c.dim}────────────────────────────────────────────${c.reset}`);
    console.log(`  ${c.magenta}${c.bold}Configuración Inicial${c.reset}`);
    console.log(`  ${c.dim}────────────────────────────────────────────${c.reset}\n`);

    const tenantId = await ask(`Nombre de tu negocio (slug): `);
    if (!tenantId) {
        logError('El código de negocio no puede estar vacío.');
        await waitAndExit();
        return process.exit(1); 
    }

    console.log('');
    console.log(`  ${c.dim}  URL del servidor (dejá vacío para usar el predeterminado):${c.reset}`);
    console.log(`  ${c.dim}  Predeterminado: ${DEFAULT_SERVER}${c.reset}`);
    const serverInput = await ask(`Servidor [${DEFAULT_SERVER}]: `);
    const serverUrl = serverInput || DEFAULT_SERVER;

    const config: SavedConfig = { tenantId, serverUrl };
    saveConfig(config);

    console.log('');
    logSuccess('Configuración guardada en mmm-agent-config.json');
    console.log(`  ${c.dim}  (La próxima vez se cargará automáticamente)${c.reset}\n`);

    return config;
}

// ═══════════════════════════════════════════
// WHATSAPP CONNECTION
// ═══════════════════════════════════════════

let messageCount = 0;
let connectedAt: Date | null = null;

async function connectToWhatsApp(config: SavedConfig) {
    console.log(`  ${c.dim}────────────────────────────────────────────${c.reset}`);
    logInfo(`Conectando a WhatsApp Web...`);
    logInfo(`Servidor: ${c.bold}${config.serverUrl}${c.reset}`);
    logInfo(`Negocio: ${c.bold}${config.tenantId}${c.reset}`);
    console.log('');

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        logger: pino({ level: 'silent' }) as any,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('');
            console.log(`  ${c.bgBlue}${c.white}${c.bold} 📱 ESCANEÁ ESTE CÓDIGO QR CON WhatsApp ${c.reset}`);
            console.log(`  ${c.dim}  1. Abrí WhatsApp en tu celular${c.reset}`);
            console.log(`  ${c.dim}  2. Tocá "⋮" (menú) → Dispositivos vinculados${c.reset}`);
            console.log(`  ${c.dim}  3. Tocá "Vincular un dispositivo"${c.reset}`);
            console.log(`  ${c.dim}  4. Escaneá este QR:${c.reset}`);
            console.log('');
            qrcode.generate(qr, { small: true });
            console.log('');
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                logWarn('Conexión perdida. Reconectando en 5 segundos...');
                setTimeout(() => connectToWhatsApp(config), 5000);
            } else {
                console.log('');
                logError('Sesión de WhatsApp cerrada.');
                console.log(`  ${c.dim}  Se eliminó la sesión anterior.${c.reset}`);
                console.log(`  ${c.dim}  Reiniciá el programa para conectar de nuevo.${c.reset}`);
                console.log('');
                try { fs.rmSync(AUTH_FOLDER, { recursive: true, force: true }); } catch { }
                waitAndExit();
            }
        }

        if (connection === 'open') {
            connectedAt = new Date();
            console.log('');
            console.log(`  ${c.bgGreen}${c.white}${c.bold} ✅ ¡CONECTADO EXITOSAMENTE! ${c.reset}`);
            console.log('');
            logSuccess('El agente IA ya está escuchando mensajes de WhatsApp.');
            logInfo('Cada mensaje de cliente será procesado automáticamente.');
            console.log('');
            console.log(`  ${c.dim}  Para detener el agente, cerrá esta ventana${c.reset}`);
            console.log(`  ${c.dim}  o presioná Ctrl+C${c.reset}`);
            console.log('');
            console.log(`  ${c.dim}${'─'.repeat(48)}${c.reset}`);
            console.log(`  ${c.magenta}${c.bold}  MENSAJES EN VIVO:${c.reset}`);
            console.log(`  ${c.dim}${'─'.repeat(48)}${c.reset}`);
            console.log('');
        }
    });

    // ═══════════════════════════════════════════
    // MESSAGE HANDLER
    // ═══════════════════════════════════════════

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message) continue;

            const sender = msg.key.remoteJid;
            const fromMe = msg.key.fromMe;
            const text = msg.message.conversation
                || msg.message.extendedTextMessage?.text;

            if (!text || !sender) continue;
            if (sender.includes('@g.us') || sender === 'status@broadcast') continue;

            const senderShort = sender.split('@')[0];
            logMsg('<<', senderShort, text);
            messageCount++;

            try {
                // Typing indicator
                await sock.sendPresenceUpdate('composing', sender);

                // Human-like delay (1.5-3s)
                const delay = Math.floor(Math.random() * 1500) + 1500;
                await new Promise(r => setTimeout(r, delay));

                // Send to API
                const response = await axios.post(
                    `${config.serverUrl}/api/ai/sync-agent`,
                    { tenantId: config.tenantId, sender, text, fromMe },
                    { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
                );

                const data = response.data;
                await sock.sendPresenceUpdate('paused', sender);

                if (data.reply) {
                    await sock.sendMessage(sender, { text: data.reply });
                    logMsg('>>', senderShort, data.reply);

                    if (data.action) {
                        log('⚡', `Acción ejecutada: ${c.bold}${data.action.type}${c.reset}`, c.magenta);
                    }
                }

            } catch (error: any) {
                await sock.sendPresenceUpdate('paused', sender).catch(() => { });

                if (error.code === 'ECONNREFUSED') {
                    logError(`No se pudo conectar al servidor. ¿Está corriendo en ${config.serverUrl}?`);
                } else if (error.code === 'ECONNABORTED') {
                    logError('El servidor tardó demasiado en responder.');
                } else if (error.response?.status === 404) {
                    logError(`Negocio "${config.tenantId}" no encontrado en el servidor.`);
                } else {
                    logError(`Error: ${error.response?.data?.error || error.message}`);
                }
            }
        }
    });

    // Stats on Ctrl+C
    process.on('SIGINT', () => {
        console.log('\n');
        console.log(`  ${c.dim}${'─'.repeat(48)}${c.reset}`);
        console.log(`  ${c.magenta}${c.bold}  RESUMEN DE SESIÓN${c.reset}`);
        console.log(`  ${c.dim}${'─'.repeat(48)}${c.reset}`);
        if (connectedAt) {
            const duration = Math.floor((Date.now() - connectedAt.getTime()) / 1000 / 60);
            console.log(`  ${c.dim}  Conectado:${c.reset}  ${connectedAt.toLocaleString('es-AR')}`);
            console.log(`  ${c.dim}  Duración:${c.reset}   ${duration} minutos`);
        }
        console.log(`  ${c.dim}  Mensajes:${c.reset}   ${messageCount} procesados`);
        console.log(`  ${c.dim}${'─'.repeat(48)}${c.reset}\n`);
        process.exit(0);
    });
}

async function waitAndExit() {
    console.log(`  ${c.dim}Presioná ENTER para cerrar...${c.reset}`);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise<void>(resolve => {
        rl.on('line', () => {
            rl.close();
            resolve();
            process.exit(0);
        });
    });
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

async function main() {
    clearScreen();
    printBanner();
    logInfo('Iniciando agente...');

    try {
        const config = await setupWizard();
        await connectToWhatsApp(config);
    } catch (error: any) {
        logError(`Error crítico en main: ${error.message}`);
        console.error(error);
        await waitAndExit();
    }
}

// Global error handlers
process.on('uncaughtException', async (err) => {
    logError(`Excepción no capturada: ${err.message}`);
    console.error(err);
    await waitAndExit();
});

process.on('unhandledRejection', async (reason) => {
    logError(`Promesa rechazada no manejada: ${reason}`);
    await waitAndExit();
});

main();
