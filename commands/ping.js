module.exports = {
    name: 'ping',
    async execute(sock, m) {
        const sender = m.key.remoteJid;
        const start = Date.now();
        
        const text = `
╭━━━✦ *SHADOW-BOT* ✦━━━╮
┃ 🏓 *PONG!*
┃ ⚡ Estado: *Activo & Estable*
┃ ⏱️ Latencia: \`${Date.now() - start} ms\`
╰━━━━━━━━━━━━━━━━━━━╯`.trim();

        await sock.sendMessage(sender, { text }, { quoted: m });
    }
};

