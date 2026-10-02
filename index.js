const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Configuración general del Bot
const CONFIG = {
    prefix: '!',
    authFolder: 'auth_info'
};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.authFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }), // Oculta logs innecesarios de Baileys
        auth: state,
        printQRInTerminal: false,
        browser: ['ShadowBot', 'Chrome', '1.0.0']
    });

    // Cargador dinámico de comandos avanzado
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
                    // Si el comando tiene alias, los registramos también
                    if (command.aliases && Array.isArray(command.aliases)) {
                        command.aliases.forEach(alias => sock.commands.set(alias, command));
                    }
                }
            } catch (err) {
                console.error(`❌ Error al cargar el comando ${file}:`, err.message);
            }
        }
        console.log(`📦 Se han cargado ${sock.commands.size} comandos/alias correctamente.`);
    } else {
        // Creamos la carpeta commands automáticamente si no existe
        fs.mkdirSync(commandsPath, { recursive: true });
        console.log('📁 Carpeta "commands" creada automáticamente.');
    }

    // Sistema de emparejamiento por número (Pairing Code)
    if (!sock.authState.creds.registered) {
        const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        const question = (text) => new Promise((resolve) => readline.question(text, resolve));
        const phoneNumber = await question('📱 Ingresa tu número de WhatsApp (ej: 519...): ');
        readline.close();

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber.trim());
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔑 Tu código de emparejamiento es: [ ${code} ]\n`);
            } catch (err) {
                console.error('❌ Error al solicitar el código de emparejamiento:', err.message);
            }
        }, 3000);
    }

    // Guardar credenciales de sesión automáticamente
    sock.ev.on('creds.update', saveCreds);

    // Control de conexión y reconexión automática
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Conexión cerrada con WhatsApp. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('\n=========================================');
            console.log('✅ ¡Bot Shadow conectado y operativo al 100%!');
            console.log(`⚡ Prefijo actual del sistema: [ ${CONFIG.prefix} ]`);
            console.log('=========================================\n');
        }
    });

    // Handler Principal de Mensajes (Máximo rendimiento y control en consola)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        // Extraer texto del mensaje de forma segura
        const messageType = Object.keys(m.message)[0];
        const body = messageType === 'conversation' ? m.message.conversation :
                     messageType === 'extendedTextMessage' ? m.message.extendedTextMessage.text :
                     messageType === 'imageMessage' ? m.message.imageMessage.caption :
                     messageType === 'videoMessage' ? m.message.videoMessage.caption : '';

        if (!body) return;

        const senderJid = m.key.remoteJid;
        const pushName = m.pushName || 'Usuario Anónimo';

        // Detectar si el usuario escribió un comando intentando usarlo pero sin prefijo
        // (Ejemplo: escribe "crear carpeta test" en vez de "!crear carpeta test")
        const firstWord = body.trim().split(/ +/)[0].toLowerCase();
        
        if (!body.startsWith(CONFIG.prefix)) {
            // Verificamos si la primera palabra coincide con un comando real existente
            if (sock.commands.has(firstWord)) {
                console.log(`[AVISO] ⚠️ ${pushName} intentó usar el comando '${firstWord}' sin el prefijo (${CONFIG.prefix}).`);
                
                await sock.sendMessage(senderJid, { 
                    text: `⚠️ *¡Ups! Olvidaste el prefijo.*\nPara ejecutar comandos debes usar el símbolo *${CONFIG.prefix}* adelante.\n\nEjemplo: \`${CONFIG.prefix}${body}\`` 
                }, { quoted: m });
            }
            return;
        }

        // Procesamiento formal del comando con prefijo
        const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = sock.commands.get(commandName);

        // Si el comando no existe en absoluto
        if (!command) {
            console.log(`[CMD LOG] ❌ Comando no reconocido: "${commandName}" enviado por ${pushName} (${senderJid})`);
            return;
        }

        // Registrar en la consola la ejecución exitosa del comando
        console.log(`[CMD LOG] ⚡ Ejecutando [ ${commandName} ] solicitado por 👤 ${pushName}`);

        try {
            // Ejecutar el comando pasándole el socket, el mensaje completo y los argumentos limpios
            await command.execute(sock, m, args, CONFIG);
        } catch (error) {
            console.error(`❌ Error crítico ejecutando el comando [${commandName}]:`, error);
            await sock.sendMessage(senderJid, { 
                text: `❌ Ocurrió un error interno al procesar el comando \`${commandName}\`.` 
            }, { quoted: m });
        }
    });
}

startBot();
