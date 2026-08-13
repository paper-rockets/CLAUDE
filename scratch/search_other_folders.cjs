const fs = require('fs');
const path = require('path');

const folders = [
    'c:\\Users\\macie\\OneDrive\\Desktop\\WANDERLUST',
    'c:\\Users\\macie\\OneDrive\\Desktop\\FLIGHT',
    'c:\\Users\\macie\\OneDrive\\Desktop\\flight cleanup',
    'c:\\Users\\macie\\OneDrive\\Desktop\\flight-merged'
];

function searchDir(dir, query) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                searchDir(fullPath, query);
            } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.json') || file.endsWith('.ts'))) {
                const content = fs.readFileSync(fullPath, 'utf8');
                if (content.includes(query)) {
                    console.log(`Found "${query}" in: ${fullPath}`);
                }
            }
        } catch (e) {}
    }
}

folders.forEach(f => {
    console.log("Searching in folder:", f);
    searchDir(f, 'FLIGHT_MODELS_EXPORTED');
});
console.log("Search finished.");
