const https = require('https');

const url = 'https://paper-rockets.github.io/Wanderlust/';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log("Full HTML Length:", data.length);
        console.log("Does HTML contain FLIGHT_MODELS_EXPORTED?", data.includes('FLIGHT_MODELS_EXPORTED'));
        console.log("Does HTML contain kiki?", data.includes('kiki'));
        console.log("Does HTML contain Princess?", data.includes('Princess'));
        console.log("Index of kiki:", data.indexOf('kiki'));
        console.log("Index of Princess:", data.indexOf('Princess'));
        console.log("All Script tags:");
        const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        while ((match = regex.exec(data)) !== null) {
            console.log("--- SCRIPT ---");
            console.log(match[0].substring(0, 200));
        }
    });
});
