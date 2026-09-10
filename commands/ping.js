module.exports = {
    name: 'ping',
    description: 'Mide la velocidad de respuesta',
    async execute(sock, m, args) {
        const sender = m.key.remoteJid;
        console.log('[COMANDO] Ejecutando .ping desde archivo separado');
        await sock.sendMessage(sender, { text: 'Pong! 🏓 (Desde archivo modular)' }, { quoted: m });
    }
};

