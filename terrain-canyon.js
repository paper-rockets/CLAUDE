import * as THREE from 'three';

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// Rich Grand Canyon & Zion Badlands Palette
const colorDeepWater = new THREE.Color(0x114b5f); // Deep canyon river teal
const colorRiver     = new THREE.Color(0x2a9d8f); // Vibrant canyon stream shore
const colorCanyonWash= new THREE.Color(0xe07a5f); // Terracotta canyon wash sand
const colorRockRed1  = new THREE.Color(0xa3321d); // Deep iron oxide red sandstone
const colorRockRed2  = new THREE.Color(0xc84b31); // Bright vermilion cliff face
const colorOchre     = new THREE.Color(0xd98c36); // Sunlit golden copper ochre
const colorCream     = new THREE.Color(0xf4a261); // Cream limestone strata band
const colorMahogany  = new THREE.Color(0x5c1d11); // Dark mahogany ravine shadow
const colorMesaTop   = new THREE.Color(0xe68a4c); // Plateau top desert clay

export default {
    name: "⛰️ Badlands Canyon",
    shoreName: "🏜️ Dry Shore",

    // Overhaul: Multi-tiered step terraces, deep slot canyon gorges, isolated mesa buttes & hoodoos
    getHeight(x, z, snoise) {
        // 1. Domain warping for wind-sculpted curving canyon walls
        const warpX = snoise(x * 0.0004, z * 0.0004) * 260.0;
        const warpZ = snoise(x * 0.0004 + 120.0, z * 0.0004 + 120.0) * 260.0;
        const wx = x + warpX;
        const wz = z + warpZ;

        // 2. Macro landscape elevation
        const macroNoise = snoise(wx * 0.00035, wz * 0.00035);
        let baseHeight = macroNoise * 42.0 + 42.0;

        // 3. Stepped Terrace Quantization (creates multi-level geological Mesa benches)
        const stepSize = 13.0;
        const terraceIdx = Math.floor(baseHeight / stepSize);
        const terraceFrac = (baseHeight % stepSize) / stepSize;
        const smoothTerrace = terraceIdx * stepSize + Math.pow(smoothstep(0.28, 0.72, terraceFrac), 2.2) * stepSize;

        // 4. Narrow Slot Canyons & Deep Gorge Carving
        const gorgeNoise = Math.abs(snoise(wx * 0.0011 + 150.0, wz * 0.0011 - 150.0));
        let gorgeCarve = 0;
        if (gorgeNoise < 0.16) {
            const t = 1.0 - (gorgeNoise / 0.16);
            gorgeCarve = t * t * (3.0 - 2.0 * t) * 38.0;
        }

        // 5. Secondary Winding Gulch Tributaries
        const gulchNoise = Math.abs(snoise(wx * 0.0028 - 300.0, wz * 0.0028 + 300.0));
        let gulchCarve = 0;
        if (gulchNoise < 0.10) {
            const t2 = 1.0 - (gulchNoise / 0.10);
            gulchCarve = t2 * t2 * (3.0 - 2.0 * t2) * 14.0;
        }

        // 6. Isolated Mesa Buttes & Hoodoo Spire Outcrops on Canyon Floors
        const hoodooNoise = snoise(wx * 0.0042 + 400.0, wz * 0.0042 - 400.0);
        let hoodooHeight = 0;
        if (hoodooNoise > 0.60) {
            const hFactor = (hoodooNoise - 0.60) / 0.40;
            hoodooHeight = hFactor * hFactor * 32.0;
        }

        let h = smoothTerrace - gorgeCarve - gulchCarve + hoodooHeight + 11.0;

        return Math.max(6.0, h);
    },

    // Overhaul: Multi-band horizontal iron-oxide rock strata, mahogany shadow seams, and cream limestone highlights
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        if (h <= 6.1) {
            tempColor.lerpColors(colorDeepWater, colorRiver, smoothstep(1.0, 6.1, h));
            return;
        }

        if (h < 12.5) {
            tempColor.lerpColors(colorRiver, colorCanyonWash, smoothstep(6.1, 12.5, h));
            return;
        }

        // Horizontal Rock Strata Layers (Wavy iron oxide sandstone bands)
        const wavyY = h + snoise(x * 0.006, z * 0.006) * 2.2;
        const strata = Math.sin(wavyY * 0.45);
        const strata2 = Math.cos(wavyY * 0.22 + 10.0);

        let baseColor = colorRockRed1.clone();

        if (strata > 0.40) {
            baseColor.copy(colorCream); // Cream limestone strata band
        } else if (strata < -0.35) {
            baseColor.copy(colorMahogany); // Deep mahogany shadow band
        } else if (strata2 > 0.30) {
            baseColor.copy(colorOchre); // Golden copper ochre band
        } else {
            baseColor.copy(colorRockRed2); // Vermilion sandstone
        }

        // Transition from Canyon Wash -> Strata Walls -> Mesa Tops
        if (h < 22.0) {
            tempColor.lerpColors(colorCanyonWash, baseColor, smoothstep(12.5, 22.0, h));
        } else if (h < 70.0) {
            tempColor.copy(baseColor);
        } else {
            // High Mesa Plateau Tops
            tempColor.lerpColors(baseColor, colorMesaTop, smoothstep(70.0, 95.0, h));
        }

        // Add subtle streak noise for weathered canyon walls
        const streakNoise = snoise(x * 0.012 + 70.0, z * 0.012 - 70.0);
        if (streakNoise > 0.58) {
            tempColor.lerp(colorMahogany, (streakNoise - 0.58) * 0.8);
        }
    }
};
