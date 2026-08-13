const https = require('https');

const urls = [
    'https://paper-rockets.github.io/Wanderlust/assets/FLIGHT_MODELS_EXPORTED/',
    'https://paper-rockets.github.io/Wanderlust/assets/FLIGHT_MODELS_EXPORTED/index.html',
    'https://paper-rockets.github.io/Wanderlust/assets/FLIGHT_MODELS_EXPORTED/kiki-lowpoly.glb'
];

urls.forEach(url => {
    https.get(url, (res) => {
        console.log(`URL: ${url} -> Status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.log(`URL: ${url} -> Error: ${err.message}`);
    });
});
