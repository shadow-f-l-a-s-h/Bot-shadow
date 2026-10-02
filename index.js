const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Configuración global del Bot
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

    // Sistema de emparejamiento avanzado por Código (Pairing Code)
    if (!sock.authState.creds.registered) {
        const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        const question = (text) => new Promise((resolve) => readline.question(text, resolve));
        
        console.log('\n=========================================');
        console.log('🔗 ASISTENTE DE VINCULACIÓN POR CÓDIGO');
        console.log('=========================================');
        const phoneNumber = await question('📱 Ingresa el número de WhatsApp del bot (con código de país, sin + ni espacios):\nEjemplo (Perú): 51912345678\n-> ');
        readline.close();

        setTimeout(async () => {
            try {
                console.log('\n⏳ Solicitando código de emparejamiento a WhatsApp...');
                let code = await sock.requestPairingCode(phoneNumber.trim());
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                
                console.log('\n-----------------------------------------');
                console.log(`🔑 CÓDIGO DE VINCULACIÓN: [ ${code} ]`);
                console.log('-----------------------------------------');
                console.log('Instrucciones para vincularlo:');
                console.log('1. Abre WhatsApp en tu celular.');
                console.log('2. Ve a Configuración / Ajustes > Dispositivos vinculados.');
                console.log('3. Toca en "Vincular dispositivo" y luego en "Vincular con el número de teléfono".');
                console.log('4. Introduce el código de 8 dígitos que aparece arriba.\n');
            } catch (err) {
                console.error('❌ Error al solicitar el código de emparejamiento:', err.message);
            }
        }, 4000);
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

    // Handler Principal de Mensajes (Robusto y con alertas claras)
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages.at(0);
        if (!m.message || m.key.fromMe) return;

        const messageType = Object.keys(m.message)[0];
        const body = messageType === 'conversation' ? m.message.conversation :
                     messageType === 'extendedTextMessage' ? m.message.extendedTextMessage.text :
                     messageType === 'imageMessage' ? m.message.imageMessage.caption : '';

        if (!body) return;

        const senderJid = m.key.remoteJid;
        const pushName = m.pushName || 'Usuario';

        // 1. Validar si el usuario olvidó poner el prefijo pero escribió un comando válido
        if (!body.startsWith(CONFIG.prefix)) {
            const firstWord = body.trim().split(/ +/)[0].toLowerCase();
            if (sock.commands.has(firstWord)) {
                console.log(`[AVISO] ⚠️ ${pushName} intentó usar '${firstWord}' sin el prefijo (${CONFIG.prefix}).`);
                await sock.sendMessage(senderJid, { 
                    text: `⚠️️ *¡Olvidaste el prefijo!*\nPara ejecutar comandos debes usar el símbolo *${CONFIG.prefix}* adelante.\n\nEjemplo: \`${CONFIG.prefix}${body}\`` 
                }, { quoted: m });
            }
            return;
        }

        // 2. Procesamiento de comandos con prefijo
        const args = body.slice(CONFIG.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        const command = sock.commands.get(commandName);

        // 3. Si el comando NO existe, notifica tanto en consola como en WhatsApp
        if (!command) {
            console.log(`[CMD LOG] ❌ Comando inexistente: "${commandName}" intentado por ${pushName}`);
            await sock.sendMessage(senderJid, { 
                text: `❌ El comando \`${CONFIG.prefix}${commandName}\` no existe. Usa \`${CONFIG.prefix}ayuda\` o verifica el nombre.` 
            }, { quoted: m });
            return;
        }

        // 4. Ejecución exitosa registrada en consola
        console.log(`[CMD LOG] ⚡ Ejecutando [ ${commandName} ] solicitado por 👤 ${pushName}`);

        try {
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
                        
