import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');

const start = html.indexOf('const _permP');
const end = html.indexOf('function _drawWorldMap');
let code = html.substring(start, end);

const smoothstep = (min, max, value) => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
};

const dummyModule = { getHeight: () => 10, getColor: () => {} };
const setup = `
var document = { getElementById: () => null, addEventListener: () => {} };
var window = { addEventListener: () => {} };
var THREE = { Color: class { constructor() {} setHex() { return this; } lerp() { return this; } copy() { return this; } } };
var terrainArch = ${JSON.stringify(dummyModule)};
var terrainGhibli = ${JSON.stringify(dummyModule)};
var terrainPlains = ${JSON.stringify(dummyModule)};
var terrainMtn = ${JSON.stringify(dummyModule)};
var terrainJungle = ${JSON.stringify(dummyModule)};
var terrainCrystal = ${JSON.stringify(dummyModule)};
var terrainDesert = ${JSON.stringify(dummyModule)};
var terrainCanyon = ${JSON.stringify(dummyModule)};
var terrainNorthPole = ${JSON.stringify(dummyModule)};
`;

// Replace Layer A in _computeIslandData with 3-octave fBm (0.52 - 0.56 threshold)
code = code.replace(
    /const normElev = snoise\(wx \/ 120000\.0, wz \/ 120000\.0\) \* 0\.5 \+ 0\.5;[\s\S]*?const elev = Math\.pow\(normElev, 1\.5\) - channelNoise;/,
    `const octave1 = snoise(wx / 120000.0, wz / 120000.0) * 0.55;
     const octave2 = snoise(wx / 45000.0 + 80.0, wz / 45000.0 - 80.0) * 0.30;
     const octave3 = snoise(wx / 15000.0 + 240.0, wz / 15000.0 + 240.0) * 0.15;
     const rawElev = (octave1 + octave2 + octave3) * 0.5 + 0.5;
     const elev = Math.pow(Math.max(0.0, rawElev), 1.3);`
).replace(
    'if (elev < 0.65)',
    'if (elev < 0.52)'
).replace(
    'let mask = smoothstep(0.65, 0.70, elev);',
    'let mask = smoothstep(0.52, 0.56, elev);'
).replace(
    'if (elev < 0.70)',
    'if (elev < 0.56)'
);

const fn = new Function('smoothstep', setup + code + '; return { getIslandData, _computeIslandData, snoise };');
const { getIslandData, _computeIslandData, snoise } = fn(smoothstep);

console.log('Testing 3-Octave fBm Island Generation (74% Water):');
const res = 40;
const radarSize = 200000;
const step = radarSize / res;

let grid = '';
let oceanCount = 0, islandCount = 0;
for (let j = 0; j < res; j++) {
    let row = '';
    for (let i = 0; i < res; i++) {
        const sampleX = -100000 + i * step;
        const sampleZ = -100000 + j * step;
        const data = _computeIslandData(sampleX, sampleZ);
        if (data.mask === 0) { row += ' '; oceanCount++; }
        else if (data.mask >= 1.0) { row += '#'; islandCount++; }
        else { row += '.'; islandCount++; }
    }
    grid += row + '\n';
}

console.log(grid);
console.log(`Water percentage: ${((oceanCount / (res*res)) * 100).toFixed(1)}%`);
