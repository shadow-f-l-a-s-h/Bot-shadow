const { exec } = require('child_process');

module.exports = {
    name: 'fix',
    async execute(sock, m) {
        const sender = m.key.remoteJid;
        await sock.sendMessage(sender, { text: '⬇️ *Conectando con GitHub para buscar parches rápidos...*' }, { quoted: m });
        
        exec('git pull', async (error, stdout) => {
            if (error) {
                await sock.sendMessage(sender, { text: `❌ *Error al aplicar fix:*\n\`\`\`${error.message}\`\`\`` }, { quoted: m });
                return;
            }
            await sock.sendMessage(sender, { text: `✅ *Fix aplicado con éxito:*\n\`\`\`${stdout}\`\`\`` }, { quoted: m });
        });
    }
};

