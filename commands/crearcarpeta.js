const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ==========================================
// CONFIGURACIÓN DE TU REPOSITORIO DE GITHUB
// ==========================================
const GITHUB_USER = 'shadow-f-l-a-s-h';
const REPO_NAME = 'Bot-shadow';
const GITHUB_TOKEN = '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'; // <-- Reemplaza esto con tu token de GitHub (ej: ghp_xxxxxxxxxxxx)

module.exports = {
    name: 'crear',
    aliases: ['crearcarpeta'],
    async execute(sock, m, args) {
        const fullText = args.join(' ');

        if (!fullText) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Uso incorrecto. Ejemplo:\n*!crear commands/ejemplo.js | console.log("Hola mundo");*' 
            }, { quoted: m });
            return;
        }

        // Separar la ruta y el contenido usando la barra vertical '|'
        const parts = fullText.split('|');
        const targetPath = parts[0].trim();
        const fileContent = parts[1] ? parts[1].trim() : '';

        try {
            const absolutePath = path.resolve(process.cwd(), targetPath);

            // 1. CREAR CARPETA O ARCHIVO FÍSICAMENTE EN TERMUX
            if (targetPath.endsWith('/') || (!targetPath.includes('.') && !fileContent)) {
                // Es una carpeta
                fs.mkdirSync(absolutePath, { recursive: true });
            } else {
                // Es un archivo
                const dir = path.dirname(absolutePath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                const contentToWrite = fileContent ? fileContent.replace(/\\n/g, '\n') : `// Creado automáticamente por Shadow Bot\n`;
                fs.writeFileSync(absolutePath, contentToWrite, 'utf8');
            }

            await sock.sendMessage(m.key.remoteJid, { 
                text: `📁 ¡Creado localmente con éxito!\n\`${targetPath}\`\n\n🔄 Sincronizando con GitHub...` 
            }, { quoted: m });

            // 2. CONFIGURAR GIT Y SUBIR AUTOMÁTICAMENTE USANDO EL TOKEN
            let gitCommand = `git config user.name "${GITHUB_USER}" && ` +
                             `git config user.email "shadow@bot.com" && ` +
                             `git add . && ` +
                             `git commit -m "Bot: Creado automáticamente ${targetPath}" && ` +
                             `git push https://${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git main`;

            exec(gitCommand, async (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error en Git push: ${error.message}`);
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: `⚠️ Creado localmente, pero falló el push a GitHub:\n\`${error.message}\`` 
                    });
                    return;
                }

                await sock.sendMessage(m.key.remoteJid, { 
                    text: `🚀 ¡Archivo creado y subido a GitHub con éxito por el bot!` 
                });
            });

        } catch (error) {
            console.error('Error al crear:', error);
            await sock.sendMessage(m.key.remoteJid, { text: `❌ Error al ejecutar: ${error.message}` }, { quoted: m });
        }
    }
};
                
