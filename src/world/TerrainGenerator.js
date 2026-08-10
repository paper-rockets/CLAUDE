// Master Procedural Terrain Generator Algorithm

import * as THREE from 'three';
import { snoise } from './Noise.js';
import { ZONES } from './BiomeManager.js';

function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
}

function getBiomeFromTempMoist(temp, moist) {
    if (temp < 0.33) {
        return (moist > 0.50) 
            ? (ZONES.find(z => z.name.includes('North Pole')) || ZONES[9]) 
            : (ZONES.find(z => z.name.includes('Misty')) || ZONES[3]);
    } else if (temp <= 0.66) {
        return (moist > 0.50) 
            ? (ZONES.find(z => z.name.includes('Ghibli')) || ZONES[1]) 
            : (ZONES.find(z => z.name.includes('Golden')) || ZONES[2]);
    } else {
        if (moist > 0.50) {
            return ZONES.find(z => z.name.includes('Jungle')) || ZONES[4];
        } else {
            return (moist < 0.20) 
                ? (ZONES.find(z => z.name.includes('Canyon')) || ZONES[8]) 
                : (ZONES.find(z => z.name.includes('Desert')) || ZONES[7]);
        }
    }
}

let _cacheIslandX = NaN, _cacheIslandZ = NaN, _cacheIslandResult = null;

export function computeIslandData(worldX, worldZ) {
    const warpX = snoise(worldX / 120000.0, worldZ / 120000.0) * 8000.0;
    const warpZ = snoise(worldX / 120000.0 + 150.0, worldZ / 120000.0 + 150.0) * 8000.0;
    const wx = worldX + warpX;
    const wz = worldZ + warpZ;

    const octave1 = snoise(wx / 120000.0, wz / 120000.0) * 0.55;
    const octave2 = snoise(wx / 45000.0 + 80.0, wz / 45000.0 - 80.0) * 0.30;
    const octave3 = snoise(wx / 15000.0 + 240.0, wz / 15000.0 + 240.0) * 0.15;

    const rawElev = (octave1 + octave2 + octave3) * 0.5 + 0.5;
    const elev = Math.pow(Math.max(0.0, rawElev), 1.3);

    const tempRaw = snoise(wx / 150000.0 + 300.0, wz / 150000.0 - 300.0);
    const temp = tempRaw * 0.5 + 0.5;

    const moistRaw = snoise(wx / 180000.0 + 700.0, wz / 180000.0 + 700.0);
    const moist = moistRaw * 0.5 + 0.5;

    const oceanZone = ZONES.find(z => z.name.includes('Ocean')) || ZONES[0];
    const archipelagoZone = ZONES.find(z => z.name.includes('Archipelago')) || ZONES[0];
    const crystalZone = ZONES.find(z => z.name.includes('Crystal')) || ZONES[5];

    if (elev < 0.52) {
        return { mask: 0.0, b1: oceanZone, b2: oceanZone, w1: 1.0, w2: 0.0, mainBiome: oceanZone, elev, temp, moist };
    }

    let mask = smoothstep(0.52, 0.56, elev);

    const isCrystalPlateau = (elev > 0.78) && (Math.abs(temp - 0.5) < 0.06) && (Math.abs(moist - 0.5) < 0.06);
    if (isCrystalPlateau) {
        return { mask: 1.0, b1: crystalZone, b2: crystalZone, w1: 1.0, w2: 0.0, mainBiome: crystalZone, elev, temp, moist };
    }

    if (elev < 0.56) {
        const shoreBiome = (temp > 0.5) ? archipelagoZone : oceanZone;
        const inlandBiome = getBiomeFromTempMoist(temp, moist);
        const blend = smoothstep(0.52, 0.56, elev);
        return {
            mask,
            b1: shoreBiome,
            b2: inlandBiome,
            w1: 1.0 - blend,
            w2: blend,
            mainBiome: (blend > 0.5) ? inlandBiome : shoreBiome,
            elev, temp, moist
        };
    }

    const b1 = getBiomeFromTempMoist(temp, moist);
    const tempShift = (temp < 0.33) ? temp + 0.15 : ((temp > 0.66) ? temp - 0.15 : (moist > 0.5 ? temp + 0.15 : temp - 0.15));
    const b2 = getBiomeFromTempMoist(tempShift, moist);

    const tempBoundary = (temp < 0.33) ? Math.abs(temp - 0.33) : Math.abs(temp - 0.66);
    const w2 = smoothstep(0.10, 0.0, tempBoundary) * 0.4;
    const w1 = 1.0 - w2;

    return {
        mask: 1.0,
        b1,
        b2,
        w1,
        w2,
        mainBiome: (w1 >= 0.5) ? b1 : b2,
        elev, temp, moist
    };
}

export function getIslandData(worldX, worldZ) {
    if (worldX === _cacheIslandX && worldZ === _cacheIslandZ && _cacheIslandResult) {
        return _cacheIslandResult;
    }
    const res = computeIslandData(worldX, worldZ);
    _cacheIslandX = worldX;
    _cacheIslandZ = worldZ;
    _cacheIslandResult = res;
    return res;
}

export function getBiomeAt(worldX, worldZ) {
    const data = getIslandData(worldX, worldZ);
    if (data.mask === 0) return ZONES.find(z => z.name.includes('Ocean')) || ZONES[0];
    return data.mainBiome;
}

export function getWorldHeight(worldX, worldZ) {
    const data = getIslandData(worldX, worldZ);
    const oceanFloor = -5.0;
    if (data.mask === 0) return oceanFloor;

    let h1 = data.b1.module.getHeight(worldX, worldZ, snoise);
    if (data.b1.archT) h1 = data.b1.module.getHeight(worldX, worldZ, snoise, data.b1.archT(1.0));
    
    let h2 = data.b2.module.getHeight(worldX, worldZ, snoise);
    if (data.b2.archT) h2 = data.b2.module.getHeight(worldX, worldZ, snoise, data.b2.archT(1.0));

    const smoothW = data.w2 * data.w2 * (3.0 - 2.0 * data.w2);

    const tWeight = 4.0 * data.w2 * (1.0 - data.w2);
    const conformFactor = 1.0 - tWeight * 0.65;
    const targetBase = 18.0;

    h1 = targetBase + (h1 - targetBase) * conformFactor;
    h2 = targetBase + (h2 - targetBase) * conformFactor;

    let h = h1 * (1.0 - smoothW) + h2 * smoothW;
    h = (h - oceanFloor) * data.mask + oceanFloor;
    return Math.max(oceanFloor, h);
}

export function getWorldColor(h, worldX, worldZ, targetColor) {
    const data = getIslandData(worldX, worldZ);
    if (data.mask === 0) {
        const oceanZone = ZONES.find(z => z.name.includes('Ocean')) || ZONES[0];
        oceanZone.module.getColor(h, worldX, worldZ, snoise, targetColor, smoothstep);
        return;
    }

    const c1 = new THREE.Color();
    const c2 = new THREE.Color();

    data.b1.module.getColor(h, worldX, worldZ, snoise, c1, smoothstep);
    data.b2.module.getColor(h, worldX, worldZ, snoise, c2, smoothstep);

    const smoothW = data.w2 * data.w2 * (3.0 - 2.0 * data.w2);
    targetColor.copy(c1).lerp(c2, smoothW);
    return;
}
