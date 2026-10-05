const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');

const CONFIG = {
    prefix: '!',
    authFolder: 'auth_info',
    botName: ' 𝐒 𝐇 𝐀 𝐃 𝐎 𝐖 - 𝐁 𝐎 T '
};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: true, // Muestra el QR directamente en la terminal
        browser: ['ShadowBot', 'Chrome', '1.0.0']
    });

    // Cargador dinámico de comandos
    sock.commands = new Map();
    const commandsPath = path.join(__dirname, 'commands');

    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            try {
                const command = require(filePath);
                if (command.name && typeof command.execute === 'function') {
                    sock.commands.set(command.name, command);
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => sock.commands.set(alias, command));
                    }
                }
            } catch (err) {
                console.error(`❌ Error al cargar comando ${file}:`, err.message);
            }
        }
        console.log(`📦 Se han cargado ${sock.commands.size} comandos correctamente.`);
    }

    sock.ev.on('creds.update', saveCreds);

    // Control de conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Escanea el código QR con tu WhatsApp:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Conexión cerrada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(() => startBot(), 3000);
            }
        } else if (connection === 'open') {
            console.log('\n╔════════════════════════════════════════════╗');
            console.log('║        ✨  𝐒 𝐇 𝐀 𝐃 𝐎 𝐖   𝐁 𝐎 𝐓  ✨        ║');
            console.log('║      Naruto RPG Engine - Operativo         ║');
            console.log('╚════════════════════════════════════════════╝');
            console.log(`⚡ Prefijo del sistema: [ ${CONFIG.prefix} ]\n`);
        }
    });

    // Handler de Mensajes
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;
            const m = messages.at(0);
            if (!m.message) return;

            const messageType = Object.keys(m.message)[0];
            const body = messageType === 'conversation' ? m.message.conversation :
                         messageType === 'extendedTextMessage' ? m.message.extendedTextMessage.text : '';

            if (!body || !body.startsWith(CONFIG.prefix)) return;

            const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = sock.commands.get(commandName);

            if (!command) return;

            console.log(`[CMD] Ejecutando: ${commandName}`);
            await command.execute(sock, m, args, CONFIG);
        } catch (err) {
            console.error('Error procesando mensaje:', err);
        }
    });
}

startBot();
            
