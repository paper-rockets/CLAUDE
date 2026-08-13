const https = require('https');

const url = 'https://paper-rockets.github.io/Wanderlust/kiki-lowpoly.glb';

https.get(url, (res) => {
    console.log("Status Code for kiki-lowpoly.glb:", res.statusCode);
    console.log("Content-Length:", res.headers['content-length']);
}).on('error', (err) => {
    console.error("Error:", err);
});
