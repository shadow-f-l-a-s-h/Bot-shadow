const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    // Cargador dinámico de comandos
    sock.commands = new Map();
    const commandsPath = path.join(__dirname, 'commands');

    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('name' in command && 'execute' in command) {
                sock.commands.set(command.name, command);
            }
        }
    }

    // Sistema de emparejamiento por número (Pairing Code)
    if (!sock.authState.creds.registered) {
        const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        const question = (text) => new Promise((resolve) => readline.question(text, resolve));
        const phoneNumber = await question('Ingresa tu número de WhatsApp (ej: 519...): ');
        readline.close();

        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber.trim());
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`\n🔑 Código de emparejamiento: ${code}\n`);
        }, 3000);
    }

    // Guardar credenciales de sesión automáticamente
    sock.ev.on('creds.update', saveCreds);

    // Control de conexión (reconexión automática)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Conexión cerrada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ ¡Bot conectado exitosamente a WhatsApp!');
        }
    });

    // Escucha de mensajes entrantes (Handler Principal)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        // Extraer el texto del mensaje (soporta texto plano y mensajes extendidos)
        const messageType = Object.keys(m.message)[0];
        const body = messageType === 'conversation' ? m.message.conversation :
                     messageType === 'extendedTextMessage' ? m.message.extendedTextMessage.text : '';

        // Definir prefijo del bot (ej: '!')
        const prefix = '!';
        if (!body.startsWith(prefix)) return;

        const args = body.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = sock.commands.get(commandName);
        if (!command) return;

        try {
            await command.execute(sock, m, args);
        } catch (error) {
            console.error(`❌ Error ejecutando el comando ${commandName}:`, error);
        }
    });
}

startBot();
			
