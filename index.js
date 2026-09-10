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

    if (!sock.authState.creds.registered) {
        const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        const question = (text) => new Promise((resolve) => readline.question(text, resolve));
        const phoneNumber = await question('Ingresa tu número de WhatsApp (ej. 519XXXXXXXX): ');
        readline.close();

        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber.trim());
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`\n🔑 Código de emparejamiento: ${code}\n`);
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('💎 [SYSTEM] Bot Shadow PRIME conectado y operando a máxima potencia.');
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;

            const sender = m.key.remoteJid;
            const messageType = Object.keys(m.message)[0];
            const body = messageType === 'conversation' ? m.message.conversation :
                         messageType === 'extendedTextMessage' ? m.message.extendedTextMessage.text : '';

            if (body) {
                console.log(`📥 [MSG] ${sender.split('@')[0]} ➔ ${body}`);
            }

            if (m.key.fromMe || !body) return;

            const prefix = '.';
            if (!body.startsWith(prefix)) return;

            const args = body.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (!sock.commands.has(commandName)) return;

            console.log(`⚡ [EXEC] Ejecutando comando: .${commandName}`);
            const command = sock.commands.get(commandName);
            await command.execute(sock, m, args, prefix);
        } catch (err) {
            console.log('❌ Error en procesador:', err);
        }
    });
}

startBot();
	
