/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║     MMM SYSTEM — Agente WhatsApp IA                     ║
 * ║     Conectá tu negocio con IA en WhatsApp               ║
 * ╚══════════════════════════════════════════════════════════╝
 * 
 * Ejecutable standalone que conecta WhatsApp al sistema MMM.
 * Solo necesitás: Código de Negocio + escanear QR.
 */

import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers, downloadMediaMessage } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
// Silent logger mock (replaces pino to avoid native module issues in pkg)
const silentLogger = {
    level: 'silent',
    fatal: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
    child: () => silentLogger,
} as any;

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
  ║   ${c.dim}${c.white}v2.1.0 — Conectá tu negocio con IA${c.reset}${c.magenta}${c.bold}            ║
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

async function sendStatusUpdate(config: SavedConfig, status: string, qr: string | null = null, phone: string | null = null) {
    try {
        await axios.post(
            `${config.serverUrl}/api/ai/sync-agent`,
            { tenantId: config.tenantId, status, qr, phone },
            { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
        );
    } catch (error: any) {
        logWarn(`No se pudo sincronizar el estado "${status}" con el servidor web: ${error.message}`);
    }
}

async function connectToWhatsApp(config: SavedConfig) {
    console.log(`  ${c.dim}────────────────────────────────────────────${c.reset}`);
    logInfo(`Conectando a WhatsApp Web...`);
    logInfo(`Servidor: ${c.bold}${config.serverUrl}${c.reset}`);
    logInfo(`Negocio: ${c.bold}${config.tenantId}${c.reset}`);
    console.log('');

    await sendStatusUpdate(config, 'connecting');

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        logger: silentLogger,
    });

    sock.ev.on('creds.update', saveCreds);

    let isSyncingHistory = false;
    sock.ev.on('messaging-history.set', async ({ messages }) => {
        if (isSyncingHistory) return;
        isSyncingHistory = true;
        
        logInfo('📥 Recibiendo historial de chats desde tu teléfono...');
        
        (async () => {
            try {
                const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
                const messagesToSync = [];
                let audioCount = 0;

                for (const msg of messages) {
                    if (!msg.message) continue;
                    const sender = msg.key.remoteJid;
                    if (!sender || sender.includes('@g.us') || sender === 'status@broadcast') continue;

                    const timestamp = ((msg.messageTimestamp as number) || Math.floor(Date.now() / 1000)) * 1000;
                    if (timestamp < sixtyDaysAgo) continue;

                    const fromMe = msg.key.fromMe || false;
                    let text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                    let audioBase64: string | undefined;
                    let audioMimeType: string | undefined;

                    if (msg.message.audioMessage) {
                        try {
                            const buffer = await downloadMediaMessage(
                                msg,
                                'buffer',
                                {},
                                {
                                    logger: silentLogger,
                                    reuploadRequest: sock.updateMediaMessage
                                }
                            );
                            if (Buffer.isBuffer(buffer)) {
                                audioBase64 = buffer.toString('base64');
                                audioMimeType = msg.message.audioMessage.mimetype || 'audio/ogg; codecs=opus';
                                text = '[Nota de voz]';
                                audioCount++;
                            }
                        } catch {
                            text = '[Nota de voz (Expirada)]';
                        }
                    }

                    if (!text && !audioBase64) continue;

                    messagesToSync.push({
                        sender,
                        text,
                        fromMe,
                        timestamp,
                        audio: audioBase64,
                        audioMime: audioMimeType
                    });
                }

                if (messagesToSync.length > 0) {
                    logInfo(`Subiendo ${messagesToSync.length} mensajes históricos a la base de datos...`);
                    const chunkSize = 30;
                    for (let i = 0; i < messagesToSync.length; i += chunkSize) {
                        const chunk = messagesToSync.slice(i, i + chunkSize);
                        await axios.post(
                            `${config.serverUrl}/api/ai/sync-history`,
                            { tenantId: config.tenantId, messages: chunk },
                            { headers: { 'Content-Type': 'application/json' }, timeout: 180000 }
                        );
                    }
                    logSuccess(`Sincronización de historial completada (${messagesToSync.length} mensajes actualizados).`);
                }
            } catch (err: any) {
                logError(`Error al sincronizar historial: ${err.message}`);
            } finally {
                isSyncingHistory = false;
            }
        })();
    });

    sock.ev.on('connection.update', async (update) => {
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

            await sendStatusUpdate(config, 'qr', qr);
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                logWarn('Conexión perdida. Reconectando en 5 segundos...');
                await sendStatusUpdate(config, 'connecting');
                setTimeout(() => connectToWhatsApp(config), 5000);
            } else {
                console.log('');
                logError('Sesión de WhatsApp cerrada.');
                console.log(`  ${c.dim}  Se eliminó la sesión anterior.${c.reset}`);
                console.log(`  ${c.dim}  Reiniciá el programa para conectar de nuevo.${c.reset}`);
                console.log('');
                await sendStatusUpdate(config, 'disconnected');
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

            const connectedPhone = sock.user?.id ? sock.user.id.split(':')[0] : null;
            await sendStatusUpdate(config, 'connected', null, connectedPhone);
        }
    });

    // ═══════════════════════════════════════════
    // MESSAGE HANDLER (Debounce + Multimedia + Human Takeover)
    // ═══════════════════════════════════════════

    interface PendingBuffer {
        texts: string[];
        senderName?: string;
        audioBase64?: string;
        audioMimeType?: string;
        imageBase64?: string;
        imageMimeType?: string;
        location?: { lat: number; lng: number; address?: string };
        timer: ReturnType<typeof setTimeout>;
    }

    const DEBOUNCE_MS = 4500;
    const pendingBuffers = new Map<string, PendingBuffer>();
    const botSentIds = new Set<string>();

    const trackBotSentId = (msgId?: string | null) => {
        if (!msgId) return;
        botSentIds.add(msgId);
        setTimeout(() => botSentIds.delete(msgId), 90000);
    };

    const flushPendingBuffer = async (sender: string) => {
        const buf = pendingBuffers.get(sender);
        pendingBuffers.delete(sender);
        if (!buf) return;

        const senderShort = sender.split('@')[0];
        const combinedText = buf.texts.filter(Boolean).join('\n').trim();
        if (!combinedText && !buf.audioBase64 && !buf.imageBase64 && !buf.location) return;

        try {
            await sock.sendPresenceUpdate('composing', sender);

            const response = await axios.post(
                `${config.serverUrl}/api/ai/sync-agent`,
                {
                    tenantId: config.tenantId,
                    sender,
                    senderName: buf.senderName,
                    text: combinedText || (buf.imageBase64 ? '[Imagen]' : buf.location ? '[Ubicación]' : '[Nota de voz]'),
                    fromMe: false,
                    audio: buf.audioBase64,
                    audioMime: buf.audioMimeType,
                    image: buf.imageBase64,
                    imageMime: buf.imageMimeType,
                    location: buf.location,
                },
                { headers: { 'Content-Type': 'application/json' }, timeout: 45000 }
            );

            const data = response.data;
            await sock.sendPresenceUpdate('paused', sender);

            if (data.reply) {
                const sent = await sock.sendMessage(sender, { text: data.reply });
                trackBotSentId(sent?.key?.id);
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
    };

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message) continue;

            const sender = msg.key.remoteJid;
            if (!sender) continue;
            if (sender.includes('@g.us') || sender === 'status@broadcast') continue;

            const fromMe = Boolean(msg.key.fromMe);
            const msgId = msg.key.id;

            // Ignorar eco de mensajes que envió este mismo bot
            if (fromMe && msgId && botSentIds.has(msgId)) {
                continue;
            }

            let text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                '';

            // Si un humano del local respondió manualmente desde el celular o WhatsApp Web:
            // cancelamos cualquier respuesta pendiente del bot y pausamos el chat automáticamente.
            if (fromMe) {
                const existingBuf = pendingBuffers.get(sender);
                if (existingBuf) {
                    clearTimeout(existingBuf.timer);
                    pendingBuffers.delete(sender);
                }

                const humanText =
                    text ||
                    (msg.message.audioMessage ? '[Nota de voz del local]' : '') ||
                    (msg.message.imageMessage ? '[Imagen enviada por el local]' : '');

                if (!humanText) continue;

                const senderShort = sender.split('@')[0];
                log('🙋', `Respuesta humana a ${c.bold}${senderShort}${c.reset} → pausando bot`, c.yellow);

                try {
                    await axios.post(
                        `${config.serverUrl}/api/ai/sync-agent`,
                        {
                            tenantId: config.tenantId,
                            sender,
                            text: humanText,
                            fromMe: true,
                            humanTakeover: true,
                        },
                        { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
                    );
                } catch (err: any) {
                    logWarn(`No se pudo notificar pausa humana: ${err.message}`);
                }
                continue;
            }

            let audioBase64: string | undefined;
            let audioMimeType: string | undefined;
            let imageBase64: string | undefined;
            let imageMimeType: string | undefined;
            let location: { lat: number; lng: number; address?: string } | undefined;

            if (msg.message.audioMessage) {
                try {
                    log('🎤 ' + sender.split('@')[0] + ': Recibiendo nota de voz...', c.cyan);
                    const buffer = await downloadMediaMessage(
                        msg,
                        'buffer',
                        {},
                        {
                            logger: silentLogger,
                            reuploadRequest: sock.updateMediaMessage,
                        }
                    );
                    if (Buffer.isBuffer(buffer)) {
                        audioBase64 = buffer.toString('base64');
                        audioMimeType = msg.message.audioMessage.mimetype || 'audio/ogg; codecs=opus';
                        if (!text) text = '[Nota de voz]';
                    }
                } catch (err: any) {
                    logError(`Error al descargar nota de voz: ${err.message}`);
                }
            }

            if (msg.message.imageMessage) {
                try {
                    log('🖼️ ' + sender.split('@')[0] + ': Recibiendo imagen...', c.cyan);
                    const buffer = await downloadMediaMessage(
                        msg,
                        'buffer',
                        {},
                        {
                            logger: silentLogger,
                            reuploadRequest: sock.updateMediaMessage,
                        }
                    );
                    if (Buffer.isBuffer(buffer)) {
                        if (buffer.length <= 4 * 1024 * 1024) {
                            imageBase64 = buffer.toString('base64');
                            imageMimeType = msg.message.imageMessage.mimetype || 'image/jpeg';
                            if (!text) text = '[Imagen]';
                        } else {
                            logWarn('Imagen mayor a 4MB omitida.');
                        }
                    }
                } catch (err: any) {
                    logError(`Error al descargar imagen: ${err.message}`);
                }
            }

            const locMsg = msg.message.locationMessage || msg.message.liveLocationMessage;
            if (locMsg && typeof locMsg.degreesLatitude === 'number' && typeof locMsg.degreesLongitude === 'number') {
                const addrParts = [
                    (msg.message.locationMessage as any)?.name,
                    (msg.message.locationMessage as any)?.address,
                ]
                    .filter(Boolean)
                    .join(' - ');
                location = {
                    lat: locMsg.degreesLatitude,
                    lng: locMsg.degreesLongitude,
                    address: addrParts || undefined,
                };
                if (!text) text = '[Ubicación]';
            }

            if (!text && !audioBase64 && !imageBase64 && !location) continue;

            const senderShort = sender.split('@')[0];
            logMsg('<<', senderShort, text || '[Multimedia]');
            messageCount++;

            // Agrupar mensajes consecutivos (debounce 4.5s) antes de consultar a la IA
            const existing = pendingBuffers.get(sender);
            if (existing) {
                clearTimeout(existing.timer);
                if (text) existing.texts.push(text);
                if (msg.pushName && !existing.senderName) existing.senderName = msg.pushName;
                if (audioBase64) {
                    existing.audioBase64 = audioBase64;
                    existing.audioMimeType = audioMimeType;
                }
                if (imageBase64) {
                    existing.imageBase64 = imageBase64;
                    existing.imageMimeType = imageMimeType;
                }
                if (location) {
                    existing.location = location;
                }
                existing.timer = setTimeout(() => {
                    void flushPendingBuffer(sender);
                }, DEBOUNCE_MS);
            } else {
                const timer = setTimeout(() => {
                    void flushPendingBuffer(sender);
                }, DEBOUNCE_MS);
                pendingBuffers.set(sender, {
                    texts: text ? [text] : [],
                    senderName: msg.pushName || undefined,
                    audioBase64,
                    audioMimeType,
                    imageBase64,
                    imageMimeType,
                    location,
                    timer,
                });
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
