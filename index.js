const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');

// Interfaz para leer desde la consola si se requiere el código de emparejamiento
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    // Guarda la sesión en una carpeta llamada 'auth_info'
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false, // Desactivamos el QR para usar código de dígitos
        logger: pino({ level: 'silent' })
    });

    // Si el dispositivo no está registrado, solicitamos el código de vinculación por 8 dígitos
    if (!sock.authState.creds.registered) {
        const phoneNumber = await question('Por favor, ingresa tu número de WhatsApp con código de país (ej. 51912345678): ');
        
        // Esperamos unos segundos para que la conexión inicialice
        setTimeout(async () => {
            const code = await sock.requestPairingCode(phoneNumber.trim());
            console.log(`\n🔑 Tu código de vinculación de 8 dígitos es: ${code}\n`);
            console.log('Ve a WhatsApp > Dispositivos vinculados > Vincular un dispositivo > Vincular con el número de teléfono.\n');
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
            console.log('Conexión cerrada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('¡Bot conectado exitosamente a WhatsApp!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Escuchar mensajes entrantes para pruebas
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const textMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

        console.log(`Mensaje recibido de ${sender}: ${textMessage}`);

        // Respuesta automática de prueba
        if (textMessage && textMessage.toLowerCase() === 'ping') {
            await sock.sendMessage(sender, { text: '¡Pong! 🤖 El bot en GitHub/Cloud está funcionando correctamente.' });
        }
    });
}

startBot();

