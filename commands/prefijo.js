module.exports = {
    name: 'prefijo',
    async execute(sock, m, args, prefix) {
        const sender = m.key.remoteJid;
        
        const text = `
╭━━━✦ *CONFIGURACIÓN* ✦━━━╮
┃ ⚙️ Prefijo actual: *${prefix}*
┃ 🤖 Sistema: *Node.js / Baileys*
┃ 🚀 Estado: *Optimizado (Prime)*
╰━━━━━━━━━━━━━━━━━━━━━━╯`.trim();

        await sock.sendMessage(sender, { text }, { quoted: m });
    }
};

