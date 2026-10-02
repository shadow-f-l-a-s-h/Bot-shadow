const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Configuración global del Bot
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
        printQRInTerminal: false,
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
                console.error(`❌ Error al cargar el comando ${file}:`, err.message);
            }
        }
        console.log(`📦 Se han cargado ${sock.commands.size} comandos correctamente.`);
    } else {
        fs.mkdirSync(commandsPath, { recursive: true });
        console.log('📁 Carpeta "commands" creada automáticamente.');
    }

    // Sistema de emparejamiento por código (Pairing Code)
    if (!sock.authState.creds.registered) {
        const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        const question = (text) => new Promise((resolve) => readline.question(text, resolve));
        
        console.log('\n=========================================');
        console.log('🔗 ASISTENTE DE VINCULACIÓN POR CÓDIGO');
        console.log('=========================================');
        const phoneNumber = await question('📱 Ingresa tu número de WhatsApp (ej: 51912345678):\n-> ');
        readline.close();

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber.trim());
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔑 CÓDIGO DE VINCULACIÓN: [ ${code} ]\n`);
            } catch (err) {
                console.error('❌ Error al solicitar el código:', err.message);
            }
        }, 4000);
    }

    sock.ev.on('creds.update', saveCreds);

    // Control de conexión con Banner de Letras Especiales
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Conexión cerrada. Reconectando...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('\n╔════════════════════════════════════════════╗');
            console.log('║        ✨  𝐒 𝐇 𝐀 𝐃 𝐎 𝐖   𝐁 𝐎 𝐓  ✨        ║');
            console.log('║      Naruto RPG Engine - Operativo         ║');
            console.log('╚════════════════════════════════════════════╝');
            console.log(`⚡ Prefijo del sistema: [ ${CONFIG.prefix} ]\n`);
        }
    });

    // Handler de Mensajes (Configurado para aceptar tus propios mensajes)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages.at(0);
        if (!m.message) return; // 👈 Ya no bloquea fromMe para que te responda a ti mismo

        const messageType = Object.keys(m.message)[0];
        const body = messageType === 'conversation' ? m.message.conversation :
                     messageType === 'extendedTextMessage' ? m.message.extendedTextMessage.text :
                     messageType === 'imageMessage' ? m.message.imageMessage.caption : '';

        if (!body) return;

        const senderJid = m.key.remoteJid;
        const pushName = m.pushName || 'ShadowUser';

        // Validar si olvidaste el prefijo pero escribiste un comando existente
        if (!body.startsWith(CONFIG.prefix)) {
            const firstWord = body.trim().split(/ +/)[0].toLowerCase();
            if (sock.commands.has(firstWord)) {
                console.log(`[AVISO] ⚠️ ${pushName} usó '${firstWord}' sin prefijo.`);
                await sock.sendMessage(senderJid, { 
                    text: `⚠️ *¡Olvidaste el prefijo!*\nUsa el símbolo *${CONFIG.prefix}* adelante.\n\nEjemplo: \`${CONFIG.prefix}${body}\`` 
                }, { quoted: m });
            }
            return;
        }

        const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = sock.commands.get(commandName);

        if (!command) {
            console.log(`[CMD LOG] ❌ Comando no existente: "${commandName}"`);
            await sock.sendMessage(senderJid, { 
                text: `❌ El comando \`${CONFIG.prefix}${commandName}\` no existe.` 
            }, { quoted: m });
            return;
        }

        console.log(`[CMD LOG] ⚡ Ejecutando [ ${commandName} ] solicitado por 👤 ${pushName}`);

        try {
            await command.execute(sock, m, args, CONFIG);
        } catch (error) {
            console.error(`❌ Error en comando [${commandName}]:`, error);
            await sock.sendMessage(senderJid, { text: `❌ Error interno al procesar \`${commandName}\`.` }, { quoted: m });
        }
    });
}

startBot();
    
