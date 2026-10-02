const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'crear', // Comando para usar como: !crear carpeta nombre_de_carpeta
    async execute(sock, m, args) {
        // Obtenemos el tipo (carpeta o archivo) y el nombre/ruta
        const tipo = args[0]; // 'carpeta' o 'file'
        const targetPath = args.slice(1).join(' ');

        if (!tipo || !targetPath) {
            await sock.sendMessage(m.key.remoteJid, { 
                text: '❌ Uso incorrecto. Ejemplo:\n*!crear carpeta nombre_de_carpeta*\n*!crear archivo ruta/archivo.txt*' 
            }, { quoted: m });
            return;
        }

        try {
            if (tipo === 'carpeta') {
                // Crear carpeta (incluso si está dentro de subrutas)
                const dirPath = path.join(process.cwd(), targetPath);
                fs.mkdirSync(dirPath, { recursive: true });
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `📁 Carpeta creada con éxito:\n\`${targetPath}\`` 
                }, { quoted: m });

            } else if (tipo === 'archivo') {
                // Crear archivo vacío o con texto base
                const filePath = path.join(process.cwd(), targetPath);
                const dir = path.dirname(filePath);
                
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, '');
                await sock.sendMessage(m.key.remoteJid, { 
                    text: `📄 Archivo creado con éxito:\n\`${targetPath}\`` 
                }, { quoted: m });
            } else {
                await sock.sendMessage(m.key.remoteJid, { 
                    text: '❌ Solo puedes crear tipo "carpeta" o "archivo".' 
                }, { quoted: m });
            }
        } catch (error) {
            console.error(error);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `❌ Error al crear: ${error.message}` 
            }, { quoted: m });
        }
    }
};
              
