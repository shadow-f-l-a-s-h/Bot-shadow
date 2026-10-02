const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// CONFIGURACIÓN DE GITHUB INTEGRADA
const GITHUB_USER = 'shadow-f-l-a-s-h';
const REPO_NAME = 'Bot-shadow';
// Si quieres, puedes poner aquí tu token directamente entre las comillas para máxima seguridad:
const GITHUB_TOKEN = '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'

module.exports = {
    name: 'crear',
    aliases: ['crearcarpeta'],
    async execute(sock, m, args) {
        const fullText = args.join(' ');

        if (!fullText) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Uso incorrecto. Ejemplo:\n*!crear commands/ejemplo.js | console.log("Hola");*' 
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
                text: `📁 Creado localmente:\n\`${targetPath}\`\n\n🔄 Sincronizando con GitHub de forma autónoma...` 
            }, { quoted: m });

            // Configuramos identidad por seguridad antes del commit
            let gitCommand = `git config user.name "${GITHUB_USER}" && ` +
                             `git config user.email "shadow@bot.com" && ` +
                             `git add . && ` +
                             `git commit -m "Bot: Creado ${targetPath}"`;

            // Si hay token configurado en el código, forzamos la autenticación por URL
            if (GITHUB_TOKEN) {
                gitCommand += ` && git push https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git main`;
            } else {
                gitCommand += ` && git push origin main`;
            }

            exec(gitCommand, async (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error Git: ${error.message}`);
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: `⚠️ Creado localmente, pero el push a GitHub falló:\n\`${error.message}\`` 
                    });
                    return;
                }

                await sock.sendMessage(m.key.remoteJid, { 
                    text: `🚀 ¡Creado y subido a GitHub con éxito por el bot!` 
                });
            });

        } catch (error) {
            console.error('Error al crear:', error);
            await sock.sendMessage(m.key.remoteJid, { text: `❌ Error: ${error.message}` }, { quoted: m });
        }
    }
};
    
