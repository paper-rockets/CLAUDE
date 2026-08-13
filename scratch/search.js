const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../dist/assets/index-DLtRHMF1.js');
if (!fs.existsSync(filePath)) {
    console.log("File does not exist:", filePath);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
console.log("Length of file:", content.length);

const queries = ['kiki', 'Princess', 'FLIGHT_MODELS_EXPORTED', 'glbPath', 'gltfLoader'];
queries.forEach(q => {
    const index = content.indexOf(q);
    if (index !== -1) {
        console.log(`Found "${q}" at index ${index}. Context: "${content.substring(Math.max(0, index - 50), index + q.length + 50)}"`);
    } else {
        console.log(`"${q}" NOT found.`);
    }
});
