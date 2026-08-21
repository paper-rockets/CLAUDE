import * as THREE from 'three';

const colorDeepWater   = new THREE.Color(0x0d4f8c);
const colorShallows    = new THREE.Color(0x1a9e8c);   // vivid teal shallows
const colorWetSand     = new THREE.Color(0xc8b58a);   // darker wet sand
const colorSand        = new THREE.Color(0xf5dfa0);   // warm golden sand
const colorDrySand     = new THREE.Color(0xfaebba);   // bleached dry sand crest
const colorIslandGrass = new THREE.Color(0x76d149);
const colorEmeraldGrass= new THREE.Color(0x56b847);
const colorOliveGrass  = new THREE.Color(0x8cc440);
const colorHigh        = new THREE.Color(0x89e05e);
const colorIslandRock  = new THREE.Color(0x8a725a);
const colorDirt        = new THREE.Color(0xdcb58a);
const colorBeachSparkle= new THREE.Color(0xfff8e8);   // warm pearl sparkle

export default {
    name: "🌊 Water Archipelago",
    shoreName: "🌊 Water Archipelago",
    getHeight(x, z, snoise, zone) {
        const archNoise = snoise(x * 0.002, z * 0.002);
        let y = archNoise * 6.0 - 4.5;
        const distFromCenter = Math.abs(zone - 1.0);
        const islandThreshold = 0.88 - distFromCenter * 0.15;
        if (archNoise > islandThreshold) {
            y += (archNoise - islandThreshold) * 80.0;
        }
        return y;
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const meadowNoise = snoise(x * 0.0035, z * 0.0035);
        const oliveNoise  = snoise(x * 0.008 + 200, z * 0.008 + 200);
        // Fine-grain beach sparkle noise (two octaves for depth)
        const sparkle1    = snoise(x * 0.055 + 300.0, z * 0.055 - 200.0) * 0.5 + 0.5;
        const sparkle2    = snoise(x * 0.11  - 100.0, z * 0.11  + 400.0) * 0.5 + 0.5;
        const sparkleVal  = sparkle1 * 0.6 + sparkle2 * 0.4;

        if (h < 1.0) {
            tempColor.copy(colorDeepWater);
        } else if (h < 2.0) {
            // Teal shallows glow
            tempColor.lerpColors(colorDeepWater, colorShallows, smoothstep(1.0, 2.0, h));
        } else if (h < 2.8) {
            // Wet sand — dark, packed look
            tempColor.lerpColors(colorShallows, colorWetSand, smoothstep(2.0, 2.8, h));
        } else if (h < 4.5) {
            // Dry golden sand beach face
            tempColor.lerpColors(colorWetSand, colorSand, smoothstep(2.8, 4.5, h));
            // Beach sparkle on the dry face
            if (sparkleVal > 0.62) {
                tempColor.lerp(colorBeachSparkle, (sparkleVal - 0.62) * 1.5 * smoothstep(2.8, 4.5, h));
            }
        } else if (h < 6.2) {
            // Bleached dry-sand crest, extra sparkle
            tempColor.lerpColors(colorSand, colorDrySand, smoothstep(4.5, 6.2, h));
            if (sparkleVal > 0.58) {
                tempColor.lerp(colorBeachSparkle, (sparkleVal - 0.58) * 1.2);
            }
            // Transition into grass
            tempColor.lerp(colorIslandGrass, smoothstep(5.4, 6.2, h) * 0.55);
        } else if (h < 25) {
            const patchColor = colorIslandGrass.clone();
            if (meadowNoise > 0.15) patchColor.lerp(colorEmeraldGrass, Math.min(1, (meadowNoise - 0.15) * 2.5));
            if (oliveNoise > 0.2)   patchColor.lerp(colorOliveGrass,   Math.min(1, (oliveNoise  - 0.2)  * 2.5));
            tempColor.lerpColors(patchColor, colorHigh, smoothstep(6.2, 25, h));
        } else if (h < 38) {
            tempColor.lerpColors(colorHigh, colorIslandRock, smoothstep(25, 38, h));
        } else {
            tempColor.lerpColors(colorIslandRock, colorDirt, smoothstep(38, 55, h));
        }
    }
};

