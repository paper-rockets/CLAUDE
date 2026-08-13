const https = require('https');

const url = 'https://paper-rockets.github.io/Wanderlust/';

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        // Find all script tags
        const regex = /<script[^>]*src="([^"]*)"/g;
        let match;
        while ((match = regex.exec(data)) !== null) {
            console.log("Script src:", match[1]);
        }
    });
});
