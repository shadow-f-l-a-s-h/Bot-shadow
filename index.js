const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { exec } = require('child_process');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    // Lógica para el emparejamiento por código de 8 dígitos si no está conectado
    if (!sock.authState.creds.registered) {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (text) => new Promise((resolve) => readline.question(text, resolve));
        const phoneNumber = await question('Por favor ingresa tu número de WhatsApp con código de país (ej. 519XXXXXXXX): ');
        readline.close();

        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber.trim());
            code = code?.match(/.{1,4}/g)?.join('-') || code;
            console.log(`\n Tu código de emparejamiento es: ${code}\n`);
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexión cerrada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('¡Bot conectado exitosamente a WhatsApp y listo para responder!');
        }
    });

    // Manejo robusto de mensajes
    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const m = chatUpdate.messages[0];
            if (!m.message) return;

            const sender = m.key.remoteJid;
            const messageType = Object.keys(m.message)[0];
            
            // Extraer el texto de forma segura sin importar si es normal o citado
            const body = messageType === 'conversation' ? m.message.conversation :
                         messageType === 'extendedTextMessage' ? m.message.extendedTextMessage.text :
                         messageType === 'imageMessage' ? m.message.imageMessage.caption : '';

            console.log(`[MENSAJE] De: ${sender} | Texto: ${body || '[Contenido multimedia/otro]'}`);

            if (m.key.fromMe) return; // Ignora los mensajes propios para evitar bucles
            if (!body) return;

            const prefix = '.';
            if (!body.startsWith(prefix)) return;

            const args = body.slice(prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            console.log(`[COMANDO] Detectado: .${command}`);

            switch (command) {
                case 'ping':
                    console.log('[RESPUESTA] Enviando Pong!...');
                    await sock.sendMessage(sender, { text: 'Pong! 🏓' }, { quoted: m });
                    break;

                case 'prefijo':
                    await sock.sendMessage(sender, { text: `El prefijo actual del bot es: *${prefix}*` }, { quoted: m });
                    break;

                case 'reinicio':
                    await sock.sendMessage(sender, { text: '🔄 Reiniciando el bot...' }, { quoted: m });
                    console.log('Reiniciando bot por comando...');
                    process.exit(0);
                    break;

                case 'fix':
                    await sock.sendMessage(sender, { text: '⬇️ Actualizando código desde GitHub...' }, { quoted: m });
                    exec('git pull', async (error, stdout, stderr) => {
                        if (error) {
                            await sock.sendMessage(sender, { text: `❌ Error al actualizar:\n\`\`\`${error.message}\`\`\`` }, { quoted: m });
                            return;
                        }
                        await sock.sendMessage(sender, { text: `✅ Actualización aplicada con éxito:\n\`\`\`${stdout}\`\`\`` }, { quoted: m });
                    });
                    break;

                case 'rfix':
                    await sock.sendMessage(sender, { text: '⚡ Sincronizando con rama main y reiniciando sistema...' }, { quoted: m });
                    exec('git fetch origin main && git reset --hard origin/main', async (error, stdout, stderr) => {
                        if (error) {
                            await sock.sendMessage(sender, { text: `❌ Error crítico en rfix:\n\`\`\`${error.message}\`\`\`` }, { quoted: m });
                            return;
                        }
                        await sock.sendMessage(sender, { text: '🔄 Sincronización completa. Reiniciando proceso...' }, { quoted: m });
                        setTimeout(() => process.exit(0), 2000);
                    });
                    break;

                default:
                    console.log(`[AVISO] El comando .${command} no existe.`);
                    break;
            }
        } catch (err) {
            console.log('Error procesando mensaje:', err);
        }
    });
}

startBot();

