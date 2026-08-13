import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import http from 'http';

const __dirname = path.resolve();

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url.split('?')[0]);
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <script type="importmap">
                {
                    "imports": {
                        "three": "https://cdn.jsdelivr.net/npm/three@0.185.0/build/three.module.js",
                        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/"
                    }
                }
                </script>
            </head>
            <body>
                <script type="module" src="/scratch/browser_painter.js"></script>
            </body>
            </html>
        `);
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end(JSON.stringify(err));
            return;
        }
        if (filePath.endsWith('.glb')) res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
        else if (filePath.endsWith('.js')) res.writeHead(200, { 'Content-Type': 'application/javascript' });
        else res.writeHead(200);
        res.end(data);
    });
});

server.listen(8089, async () => {
    console.log('Server listening on http://localhost:8089');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));
    
    await page.goto('http://localhost:8089/');
    
    try {
        const result = await page.evaluate(async () => {
            return new Promise((resolve, reject) => {
                window.onPaintComplete = (base64Glb, info) => resolve({ base64Glb, info });
                window.onPaintError = (err) => reject(err);
            });
        });
        
        const buffer = Buffer.from(result.base64Glb, 'base64');
        fs.writeFileSync('./assets/gltf_Sunflowers/gltf_Sunflowers.glb', buffer);
        fs.writeFileSync('./assets/gltf_Sunflowers/gltf_Sunflowers_painted.glb', buffer);
        console.log('Saved painted GLB successfully!', result.info);
    } catch(e) {
        console.error('Failed painting:', e);
    } finally {
        await browser.close();
        server.close();
        process.exit(0);
    }
});
