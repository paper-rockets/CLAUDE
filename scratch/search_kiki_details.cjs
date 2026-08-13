const https = require('https');

const url = 'https://paper-rockets.github.io/Wanderlust/assets/index-C4tjk2sY.js';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        const index = data.indexOf('kiki-lowpoly.glb');
        if (index !== -1) {
            console.log("Found kiki-lowpoly.glb at index:", index);
            console.log("--- CONTEXT FOR kiki-lowpoly.glb ---");
            console.log(data.substring(index - 100, index + 800));
        } else {
            console.log("kiki-lowpoly.glb NOT found.");
        }
    });
});
