
const { exec } = require('child_process');

module.exports = {
    name: 'rfix',
    async execute(sock, m) {
        const sender = m.key.remoteJid;
        await sock.sendMessage(sender, { text: '⚡ *Sincronización profunda con la rama Main iniciada...*' }, { quoted: m });
        
        exec('git fetch origin main && git reset --hard origin/main', async (error) => {
            if (error) {
                await sock.sendMessage(sender, { text: `❌ *Error crítico en rfix:*\n\`\`\`${error.message}\`\`\`` }, { quoted: m });
                return;
            }
            await sock.sendMessage(sender, { text: '🔄 *Sistema sincronizado perfectamente a la última versión. Reiniciando...*' }, { quoted: m });
            setTimeout(() => process.exit(0), 2000);
        });
    }
};

