const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

module.exports = {
    name: 'crearcarpeta',
    async execute(sock, m, args) {
        const fullText = args.join(' ');

        if (!fullText) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Uso incorrecto.\nEjemplo:\n*!crearcarpeta commands/test.js | console.log("Hola");*' 
            }, { quoted: m });
            return;
        }

        const parts = fullText.split('|');
        const targetPath = parts[0].trim();
        const fileContent = parts[1] ? parts[1].trim() : '';

        try {
            const absolutePath = path.resolve(process.cwd(), targetPath);

            // Crear carpeta o archivo localmente
            if (targetPath.endsWith('/') || (!targetPath.includes('.') && !fileContent)) {
                fs.mkdirSync(absolutePath, { recursive: true });
            } else {
                const dir = path.dirname(absolutePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                const contentToWrite = fileContent ? fileContent.replace(/\\n/g, '\n') : `// Creado automáticamente por Shadow Bot\n`;
                fs.writeFileSync(absolutePath, contentToWrite, 'utf8');
            }

            await sock.sendMessage(m.key.remoteJid, { 
                text: `📁 Creado localmente:\n\`${targetPath}\`\n\n🔄 Subiendo a GitHub automáticamente...` 
            }, { quoted: m });

            // Sincronizar automáticamente con GitHub usando Git desde Termux
            exec(`git add . && git commit -m "Bot: Auto-creación de ${targetPath}" && git push origin main`, async (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error en Git push: ${error.message}`);
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: `⚠️ Creado localmente, pero falló el push a GitHub: \`${error.message}\`` 
                    });
                    return;
                }

                console.log(`[GITHUB] Cambios subidos correctamente: ${stdout}`);
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `🚀 ¡Y subido a GitHub con éxito!\n🌐 Repositorio actualizado por el bot.` 
                });
            });

        } catch (error) {
            console.error('Error:', error);
            await sock.sendMessage(m.key.remoteJid, { text: `❌ Error: ${error.message}` }, { quoted: m });
        }
    }
};
  
