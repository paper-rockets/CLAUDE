// High-Performance Archipelago Terrain Generator

import * as THREE from 'three';
import { snoise } from './Noise.js';
import { ZONES } from './BiomeManager.js';

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// Fast multi-frequency trigonometric noise from tree_viewer_sandbox
function islandNoise(x, z, s = 100) {
    let val = Math.sin(x * 0.032 + s * 0.1) * Math.cos(z * 0.032 - s * 0.1) * 8.0;
    val += Math.cos(x * 0.078 - s * 0.15) * Math.sin(z * 0.078 + s * 0.2) * 3.5;
    val += Math.sin(x * 0.19 + s * 0.3) * Math.cos(z * 0.19 - s * 0.25) * 1.2;
    val += Math.cos(x * 0.42 + s * 0.5) * Math.sin(z * 0.42 + s * 0.4) * 0.4;
    return val / 13.1;
}

export const WATER_LEVEL = 2.4;
const SEABED_LEVEL = -6.0;

// Active Handcrafted Island Definitions
export let activeIslands = [
    {
        id: 'isl_main',
        name: 'Main Atoll',
        x: 0,
        z: 0,
        radius: 220,
        heightScale: 1.5,
        karstScale: 1.2,
        roughness: 1.15,
        riverDepth: 0.8,
        seed: 4521
    },
    {
        id: 'isl_north_karst',
        name: 'North Karst Pinnacle',
        x: 180,
        z: -340,
        radius: 140,
        heightScale: 1.8,
        karstScale: 2.2,
        roughness: 1.25,
        riverDepth: 0.2,
        seed: 5678
    },
    {
        id: 'isl_south_lagoon',
        name: 'South Lagoon',
        x: -240,
        z: 280,
        radius: 160,
        heightScale: 1.1,
        karstScale: 0.6,
        roughness: 0.95,
        riverDepth: 1.3,
        seed: 9012
    },
    {
        id: 'isl_volcano',
        name: 'Volcanic Peak',
        x: 480,
        z: 320,
        radius: 190,
        heightScale: 2.4,
        karstScale: 1.6,
        roughness: 1.35,
        riverDepth: 0.4,
        seed: 8844
    },
    {
        id: 'isl_west_atoll',
        name: 'West Emerald Chain',
        x: -460,
        z: -260,
        radius: 170,
        heightScale: 1.3,
        karstScale: 1.0,
        roughness: 1.1,
        riverDepth: 0.9,
        seed: 3311
    }
];

export function setIslandPreset(preset) {
    if (preset === 'atoll') {
        activeIslands = [
            { id: 'isl_1', name: 'Main Atoll', x: 0, z: 0, radius: 240, heightScale: 1.4, karstScale: 1.1, roughness: 1.15, riverDepth: 0.8, seed: 4521 }
        ];
    } else if (preset === 'tropical') {
        activeIslands = [
            { id: 'isl_1', name: 'Center Island', x: 0, z: 0, radius: 200, heightScale: 1.3, karstScale: 0.9, roughness: 1.0, riverDepth: 0.7, seed: 1234 },
            { id: 'isl_2', name: 'North Karst', x: 160, z: -280, radius: 130, heightScale: 1.7, karstScale: 2.0, roughness: 1.2, riverDepth: 0.3, seed: 5678 },
            { id: 'isl_3', name: 'South Lagoon', x: -180, z: 240, radius: 150, heightScale: 1.0, karstScale: 0.6, roughness: 0.9, riverDepth: 1.2, seed: 9012 }
        ];
    } else if (preset === 'volcanic') {
        activeIslands = [
            { id: 'isl_1', name: 'Volcano Peak', x: 0, z: 0, radius: 260, heightScale: 2.5, karstScale: 1.8, roughness: 1.4, riverDepth: 0.4, seed: 8844 },
            { id: 'isl_2', name: 'Ridge Outpost', x: 220, z: 200, radius: 120, heightScale: 1.2, karstScale: 1.2, roughness: 1.1, riverDepth: 0.3, seed: 3311 }
        ];
    } else if (preset === 'karst') {
        activeIslands = [
            { id: 'isl_1', name: 'Pinnacle Tower', x: 0, z: 0, radius: 170, heightScale: 2.6, karstScale: 3.0, roughness: 1.3, riverDepth: 0.0, seed: 7722 }
        ];
    }
    clearIslandCache();
}

function getIslandContribution(wx, wz, isl) {
    const dx = wx - isl.x;
    const dz = wz - isl.z;
    const dist = Math.hypot(dx, dz);
    const u = dist / isl.radius;
    if (u >= 1.35) return SEABED_LEVEL;

    const radial = Math.max(0.0, 1.0 - Math.pow(u, 1.7));
    if (radial <= 0.001) return SEABED_LEVEL;

    const nBase = islandNoise(wx * 0.4, wz * 0.4, isl.seed) * 34.0;
    const nHills = islandNoise(wx * 1.2 + 100, wz * 1.2 + 400, isl.seed + 20) * 16.0;
    const nDetail = islandNoise(wx * 2.8 + 300, wz * 2.8 + 600, isl.seed + 40) * 4.0;

    const riverN = Math.abs(islandNoise(wx * 0.6 + 250, wz * 0.6 - 250, isl.seed + 80));
    let riverCarve = 0;
    if (riverN < 0.16) {
        let t = 1.0 - (riverN / 0.16);
        riverCarve = smoothstep(0, 1, t) * 16.0 * isl.riverDepth;
    }

    const karstN = islandNoise(wx * 0.85 - 500, wz * 0.85 + 500, isl.seed + 150);
    let karstElevation = 0;
    if (karstN > 0.32) {
        let k = smoothstep(0.32, 0.72, karstN);
        karstElevation = k * 38.0 * isl.karstScale;
    }

    const rawHeight = (nBase + nHills + nDetail) * isl.roughness - riverCarve + karstElevation + 18.0;
    let finalH = rawHeight * radial * isl.heightScale;

    if (finalH < WATER_LEVEL) {
        // Smooth underwater shelf into ocean floor
        finalH = WATER_LEVEL - (WATER_LEVEL - finalH) * 1.2;
    }
    return Math.max(SEABED_LEVEL, finalH);
}

// Procedural macro island grid for infinite open-sea flight exploration
function getProceduralMacroIslandHeight(wx, wz) {
    const GRID_SIZE = 1400.0;
    const gx = Math.floor((wx + GRID_SIZE * 0.5) / GRID_SIZE);
    const gz = Math.floor((wz + GRID_SIZE * 0.5) / GRID_SIZE);

    // Skip center origin grid cell (handled by activeIslands)
    if (Math.abs(gx) <= 0 && Math.abs(gz) <= 0) return SEABED_LEVEL;

    let maxH = SEABED_LEVEL;

    for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
            const cx = gx + ox;
            const cz = gz + oz;
            if (cx === 0 && cz === 0) continue;

            const seed = (Math.sin(cx * 127.1 + cz * 311.7) * 43758.5453) % 1.0;
            const absSeed = Math.abs(seed);

            // 65% probability of an island in a macro cell
            if (absSeed > 0.35) {
                const posX = cx * GRID_SIZE + (absSeed * 0.5 - 0.25) * GRID_SIZE * 0.6;
                const posZ = cz * GRID_SIZE + (((absSeed * 17.3) % 1.0) * 0.5 - 0.25) * GRID_SIZE * 0.6;
                const radius = 120.0 + ((absSeed * 31.7) % 1.0) * 110.0;
                const heightScale = 1.0 + ((absSeed * 47.9) % 1.0) * 1.1;
                const karstScale = 0.6 + ((absSeed * 73.1) % 1.0) * 1.8;

                const isl = {
                    x: posX,
                    z: posZ,
                    radius,
                    heightScale,
                    karstScale,
                    roughness: 1.1,
                    riverDepth: 0.8,
                    seed: Math.floor(absSeed * 10000)
                };

                const h = getIslandContribution(wx, wz, isl);
                if (h > maxH) maxH = h;
            }
        }
    }
    return maxH;
}

export function getGlobalTerrainHeight(wx, wz) {
    let maxH = SEABED_LEVEL;
    let sum = 0;
    let count = 0;

    for (const isl of activeIslands) {
        const h = getIslandContribution(wx, wz, isl);
        if (h > SEABED_LEVEL) {
            if (h > maxH) maxH = h;
            sum += h;
            count++;
        }
    }

    if (count > 1) {
        maxH = Math.max(maxH, sum * 0.72);
    }

    // Check procedural macro archipelago if not high on center islands
    if (maxH < WATER_LEVEL + 5.0) {
        const macroH = getProceduralMacroIslandHeight(wx, wz);
        if (macroH > maxH) maxH = macroH;
    }

    return maxH;
}

// Keyed spatial cache to maximize hit rate for normals and physics probes
const _islandCache = new Map();
const ISLAND_CACHE_LIMIT = 96000;

export function clearIslandCache() {
    _islandCache.clear();
}

export function getWorldHeight(worldX, worldZ) {
    const key = Math.round(worldX * 2) * 4194304 + (Math.round(worldZ * 2) + 2097152);
    const hit = _islandCache.get(key);
    if (hit !== undefined) return hit;

    const h = getGlobalTerrainHeight(worldX, worldZ);
    if (_islandCache.size >= ISLAND_CACHE_LIMIT) {
        let toDrop = _islandCache.size >> 1;
        for (const k of _islandCache.keys()) {
            _islandCache.delete(k);
            if (--toDrop <= 0) break;
        }
    }
    _islandCache.set(key, h);
    return h;
}

export function getTerrainNormal(worldX, worldZ) {
    const eps = 0.6;
    const hL = getWorldHeight(worldX - eps, worldZ);
    const hR = getWorldHeight(worldX + eps, worldZ);
    const hD = getWorldHeight(worldX, worldZ - eps);
    const hU = getWorldHeight(worldX, worldZ + eps);
    return new THREE.Vector3(hL - hR, 2.0 * eps, hD - hU).normalize();
}

const ZONE_ARCHIPELAGO = ZONES.find(z => z.name.includes('Archipelago')) || {
    name: 'Archipelago',
    treesOk: true,
    module: null
};

export function getBiomeAt(worldX, worldZ) {
    const h = getWorldHeight(worldX, worldZ);
    return {
        name: h > WATER_LEVEL ? 'Archipelago' : 'Open Ocean',
        treesOk: h > (WATER_LEVEL + 1.2) && h < (WATER_LEVEL + 45.0),
        waterLevel: WATER_LEVEL
    };
}

export function getIslandData(worldX, worldZ) {
    const h = getWorldHeight(worldX, worldZ);
    const isLand = h > WATER_LEVEL;
    return {
        mask: isLand ? 1.0 : 0.0,
        mainBiome: ZONE_ARCHIPELAGO,
        elev: h,
        temp: 0.5,
        moist: 0.5,
        b1: ZONE_ARCHIPELAGO,
        b2: ZONE_ARCHIPELAGO,
        w1: 1.0,
        w2: 0.0
    };
}

// Fallback color sampler matching the GPU shader palette for any CPU consumers
const cSandWet = new THREE.Color(0.72, 0.58, 0.38);
const cSand = new THREE.Color(0.88, 0.77, 0.52);
const cGrassLow = new THREE.Color(0.24, 0.72, 0.08);
const cGrassMid = new THREE.Color(0.12, 0.56, 0.30);
const cGrassHigh = new THREE.Color(0.06, 0.40, 0.22);
const cRock = new THREE.Color(0.38, 0.33, 0.27);

export function getWorldColor(h, worldX, worldZ, targetColor) {
    if (h < WATER_LEVEL + 0.4) {
        const t = smoothstep(WATER_LEVEL - 1.8, WATER_LEVEL + 0.4, h);
        targetColor.lerpColors(cSandWet, cSand, t);
    } else if (h < WATER_LEVEL + 3.2) {
        const t = smoothstep(WATER_LEVEL + 0.4, WATER_LEVEL + 3.2, h);
        targetColor.lerpColors(cSand, cGrassLow, t);
    } else if (h < WATER_LEVEL + 22.0) {
        const t = smoothstep(WATER_LEVEL + 3.2, WATER_LEVEL + 22.0, h);
        targetColor.lerpColors(cGrassLow, cGrassMid, t);
    } else if (h < WATER_LEVEL + 52.0) {
        const t = smoothstep(WATER_LEVEL + 22.0, WATER_LEVEL + 52.0, h);
        targetColor.lerpColors(cGrassMid, cGrassHigh, t);
    } else {
        const t = smoothstep(WATER_LEVEL + 52.0, WATER_LEVEL + 80.0, h);
        targetColor.lerpColors(cGrassHigh, cRock, t);
    }
}

