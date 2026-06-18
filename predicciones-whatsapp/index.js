const express = require('express');
const cors = require('cors');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(express.json());

let sock = null;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }) // suppress logs except errors
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if(connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401; // 401 is logged out
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            // reconnect if not logged out
            if(shouldReconnect) {
                connectToWhatsApp();
            }
        } else if(connection === 'open') {
            console.log('opened connection');
        }
    });
}

// Start connection
connectToWhatsApp();

app.post('/send', async (req, res) => {
    try {
        const { numero, mensaje } = req.body;
        
        if (!numero || !mensaje) {
            return res.status(400).json({ error: 'Falta numero o mensaje' });
        }

        // Check if socket is connected
        if (!sock) {
            return res.status(503).json({ error: 'WhatsApp no está conectado' });
        }

        // Format number: if it doesn't have @s.whatsapp.net, append it
        const jid = numero.includes('@s.whatsapp.net') ? numero : `${numero}@s.whatsapp.net`;
        
        await sock.sendMessage(jid, { text: mensaje });
        
        return res.json({ success: true });
    } catch (err) {
        console.error('Error al enviar mensaje:', err);
        return res.status(500).json({ error: 'Error interno' });
    }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`WhatsApp Service listening on port ${PORT}`);
});
