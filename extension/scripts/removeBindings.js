const fs = require('node:fs');
const path = require('node:path');

/**
 * Removes all files with .node extension from the specified directory
 */
function removeNodeBindings() {
    const outDir = path.join(__dirname, '../out');

    try {
        if (!fs.existsSync(outDir)) {
            console.log('Output directory does not exist');
            return;
        }

        const files = fs.readdirSync(outDir);

        const nodeFiles = files.filter(file => path.extname(file) === '.node');

        if (nodeFiles.length === 0) {
            console.log('No .node files found');
            return;
        }

        // biome-ignore lint/complexity/noForEach: <explanation>
        nodeFiles.forEach(file => {
            const filePath = path.join(outDir, file);
            fs.unlinkSync(filePath);
            console.log(`Removed: ${file}`);
        });

        console.log(`Successfully removed ${nodeFiles.length} .node file(s)`);

    } catch (error) {
        console.error('Error removing .node files:', error.message);
        process.exit(1);
    }
}

removeNodeBindings();