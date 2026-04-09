/**
 * MMM SYSTEM - Agente Local WhatsApp
 * 
 * Este programa se ejecuta localmente en la PC del negocio.
 * Conecta WhatsApp al sistema MMM para respuestas automáticas con IA.
 * 
 * Uso: ts-node src/index.ts [tenantId]
 * O: npm start [tenantId]
 */

import { default as makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';

// ═══════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════

// Load .env if available
try { require('dotenv').config(); } catch {}

const SERVER_URL = process.env.MMM_API_URL || "http://localhost:3000";
const authFolder = path.join(process.cwd(), 'auth_info_baileys');

// ═══════════════════════════════════════════
// TENANT ID: CLI argument or prompt
// ═══════════════════════════════════════════

const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

let tenantId: string = "";

const argsTenantId = process.argv[2] || process.env.TENANT_ID;

console.log(`\n${'═'.repeat(50)}`);
console.log(`  🤖 MMM SYSTEM - AGENTE IA WHATSAPP`);
console.log(`${'═'.repeat(50)}\n`);

if (!argsTenantId) {
    rl.question("👉 Introduce tu Código de Negocio (Tenant ID o slug): ", (answer: string) => {
        const inputTenantId = answer.trim();
        if (!inputTenantId) {
            console.error("❌ Código inválido. Cerrando programa.");
            process.exit(1);
        }
        tenantId = inputTenantId;
        rl.close();
        connectToWhatsApp();
    });
} else {
    tenantId = argsTenantId;
    console.log(`📋 Tenant configurado: [${tenantId}]`);
    rl.close();
    connectToWhatsApp();
}

// ═══════════════════════════════════════════
// WHATSAPP CONNECTION
// ═══════════════════════════════════════════

async function connectToWhatsApp() {
    console.log(`\n🔄 Conectando a WhatsApp Web...`);
    console.log(`📡 Servidor API: ${SERVER_URL}\n`);

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📱 Versión WA Web: v${version.join('.')} (Última: ${isLatest})`);

    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        browser: Browsers.macOS('Desktop'),
        logger: pino({ level: 'warn' }) as any
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n📲 ESCANEÁ ESTE QR CON TU WHATSAPP:");
            console.log("   (Abrí WhatsApp > Menú > Dispositivos vinculados > Vincular)\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Conexión cerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            } else {
                console.log("\n🔴 Sesión cerrada permanentemente.");
                console.log("   Eliminá la carpeta 'auth_info_baileys' para escanear de nuevo.");
                fs.rmSync(authFolder, { recursive: true, force: true });
                process.exit(0);
            }
        } else if (connection === 'open') {
            console.log('\n✅ ¡Conectado exitosamente a WhatsApp!');
            console.log('🤖 La IA ya está monitoreando y respondiendo mensajes.');
            console.log('   Para detener, simplemente cerrá esta ventana.\n');
            console.log(`${'─'.repeat(50)}`);
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

            // Extract text (supports plain text and quoted replies)
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

            if (!text || !sender) continue;
            // Skip group messages and status broadcasts
            if (sender.includes('@g.us') || sender === 'status@broadcast') continue;

            const senderShort = sender.split('@')[0];
            console.log(`\n[<<] Mensaje de ${senderShort}: "${text.substring(0, 80)}${text.length > 80 ? '...' : ''}"`);

            try {
                // 1. Show "typing" indicator + human-like delay
                await sock.sendPresenceUpdate('composing', sender);
                const delay = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
                await new Promise(r => setTimeout(r, delay));

                // 2. Send to MMM System API
                const response = await axios.post(`${SERVER_URL}/api/ai/sync-agent`, {
                    tenantId,
                    sender,
                    text,
                    fromMe
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 30000
                });

                const data = response.data;

                // 3. Reply to client
                if (data.reply) {
                    await sock.sendPresenceUpdate('paused', sender);
                    await sock.sendMessage(sender, { text: data.reply });
                    console.log(`[>>] Respondido a ${senderShort} ✓`);

                    if (data.action) {
                        console.log(`[⚡] Acción ejecutada: ${data.action.type}`);
                    }
                } else {
                    await sock.sendPresenceUpdate('paused', sender);
                    console.log(`[--] Sin respuesta para ${senderShort} (agente inactivo o mensaje propio)`);
                }

            } catch (error: any) {
                await sock.sendPresenceUpdate('paused', sender);
                if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                    console.error(`[!!] Timeout al conectar con ${SERVER_URL}. Revisá tu conexión.`);
                } else if (error.code === 'ECONNREFUSED') {
                    console.error(`[!!] No se pudo conectar al servidor ${SERVER_URL}. ¿Está corriendo?`);
                } else if (error.code === 'ENOTFOUND') {
                    console.error(`[!!] No se encontró el servidor ${SERVER_URL}. Revisá la configuración.`);
                } else {
                    console.error(`[!!] Error procesando mensaje de ${senderShort}:`, error?.response?.data || error.message);
                }
            }
        }
    });
}
