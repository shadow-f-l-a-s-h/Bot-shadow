const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Configuración global del Bot
const CONFIG = {
    prefix: '!',
    authFolder: 'auth_info',
    botName: ' 𝐒 𝐇 𝐀 𝐃 𝐎 𝐖 - 𝐁 𝐎 T ',
    phoneNumber: '51983564381' // Tu número fijo configurado para evitar fallos
};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['Chrome', 'Desktop', '1.0.0']
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
                console.error(`❌ Error al cargar el comando ${file}:`, err.message);
            }
        }
        console.log(`📦 Se han cargado ${sock.commands.size} comandos correctamente.`);
    } else {
        fs.mkdirSync(commandsPath, { recursive: true });
        console.log('📁 Carpeta "commands" creada automáticamente.');
    }

    sock.ev.on('creds.update', saveCreds);

    // Control de conexión y solicitud segura de Código de Vinculación
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

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

    // Solicitar código de emparejamiento de forma segura al iniciar si no está registrado
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                console.log('\n=========================================');
                console.log('🔗 SOLICITANDO CÓDIGO DE VINCULACIÓN...');
                console.log('=========================================');
                
                await delay(3000); // Espera estable para evitar "Connection Closed"
                let code = await sock.requestPairingCode(CONFIG.phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                
                console.log(`\n🔑 CÓDIGO DE VINCULACIÓN: [ ${code} ]`);
                console.log(`📱 Usando número: ${CONFIG.phoneNumber}\n`);
            } catch (err) {
                console.error('❌ Error al solicitar el código:', err.message);
            }
        }, 5000);
    }

    // Handler de Mensajes
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages.at(0);
        if (!m.message) return;

        const messageType = Object.keys(m.message)[0];
        const body = messageType === 'conversation' ? m.message.conversation :
                     messageType === 'extendedTextMessage' ? m.message.extendedTextMessage.text :
                     messageType === 'imageMessage' ? m.message.imageMessage.caption : '';

        if (!body) return;

        const senderJid = m.key.remoteJid;
        const pushName = m.pushName || 'ShadowUser';

        if (!body.startsWith(CONFIG.prefix)) {
            const firstWord = body.trim().split(/ +/)[0].toLowerCase();
            if (sock.commands.has(firstWord)) {
                await sock.sendMessage(senderJid, { 
                    text: `⚠️ *¡Olvidaste el prefijo!*\nUsa el símbolo *${CONFIG.prefix}* adelante.` 
                }, { quoted: m });
            }
            return;
        }

        const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = sock.commands.get(commandName);

        if (!command) return;

        try {
            await command.execute(sock, m, args, CONFIG);
        } catch (error) {
            console.error(`❌ Error en comando [${commandName}]:`, error);
        }
    });
}

startBot();
