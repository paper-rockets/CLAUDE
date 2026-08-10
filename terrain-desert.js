import * as THREE from 'three';

function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

// Rich Journey-inspired Desert Palette
export const desertColors = {
    deepWater:    new THREE.Color(0x0d5c75), // Deep turquoise oasis pool
    oasisWater:   new THREE.Color(0x14b8a6), // Vibrant crystal teal shore
    oasisGrass:   new THREE.Color(0x22c55e), // Lush emerald palm foliage
    oasisEdge:    new THREE.Color(0x84cc16), // Bright lime grass boundary
    oasisSand:    new THREE.Color(0xd97706), // Warm golden shore sand
    valleyShadow: new THREE.Color(0x7a2e19), // Burnt terracotta / mahogany valley shadow
    sandBase:     new THREE.Color(0xd96d27), // Deep warm amber sand
    duneSlope:    new THREE.Color(0xf5a047), // Vibrant glowing gold dune slope
    duneCrest:    new THREE.Color(0xfcd385), // Radiant sunlit crest
    peakHighlight:new THREE.Color(0xfef0d2)  // Warm ivory-peach razor peak
};

export default {
    name: "🏜️ Desert Dunes",
    shoreName: "🏝️ Desert Shore",
    getHeight(x, z, snoise) {
        // 1. Macro landscape rolling elevation
        const macroNoise = snoise(x * 0.00008, z * 0.00008);
        const macroHeight = macroNoise * 35.0 + 35.0;
        
        // 2. Domain warping for wind-sculpted curved barchan dunes
        const warpX = snoise(x * 0.0004, z * 0.0004) * 150.0;
        const warpZ = snoise(x * 0.0004 + 120.0, z * 0.0004 + 120.0) * 150.0;
        
        // 3. Primary smooth sweeping dune crests
        const duneRaw = snoise((x + warpX) * 0.0010, (z + warpZ) * 0.0010);
        const ridge = Math.max(0.0, 1.0 - Math.abs(duneRaw));
        const smoothRidge = ridge * ridge * (3.0 - 2.0 * ridge);
        const duneRidge = Math.pow(smoothRidge, 1.4);
        
        // 4. Secondary cross-dunes
        const duneRaw2 = snoise((x - warpZ) * 0.0020 + 50.0, (z + warpX) * 0.0020 + 50.0);
        const ridge2 = Math.max(0.0, 1.0 - Math.abs(duneRaw2));
        const smoothRidge2 = ridge2 * ridge2 * (3.0 - 2.0 * ridge2);
        const duneRidge2 = Math.pow(smoothRidge2, 1.2) * 0.35;
        
        let h = macroHeight + duneRidge * 60.0 + duneRidge2 * 20.0;
        
        // 6. Natural Oasis basins
        const oasisNoise = snoise(x * 0.0003, z * 0.0003);
        if (oasisNoise > 0.60) {
            const bowl = (oasisNoise - 0.60) / 0.40;
            const smoothBowl = Math.pow(Math.sin(bowl * Math.PI * 0.5), 2.0);
            const oasisDepth = smoothBowl * 70.0;
            h -= oasisDepth;
        }
        
        return Math.max(6.0, h);
    },
    getColor(h, x, z, snoise, tempColor, smoothstep) {
        const oasisNoise = snoise(x * 0.0003, z * 0.0003);
        
        // Oasis Water Body
        if (h <= 6.1 && oasisNoise > 0.60) {
            tempColor.lerpColors(desertColors.deepWater, desertColors.oasisWater, smoothstep(5.0, 6.1, h));
            return;
        }
        
        // Standard Water Edge
        if (h <= 6.1) {
            tempColor.lerpColors(desertColors.deepWater, desertColors.oasisWater, smoothstep(1.0, 6.1, h));
            return;
        }
        
        // Oasis Vegetation Terraces
        if (oasisNoise > 0.60 && h < 16.0) {
            if (h < 9.0) {
                tempColor.lerpColors(desertColors.oasisWater, desertColors.oasisGrass, smoothstep(6.1, 9.0, h));
            } else if (h < 13.0) {
                tempColor.lerpColors(desertColors.oasisGrass, desertColors.oasisEdge, smoothstep(9.0, 13.0, h));
            } else {
                tempColor.lerpColors(desertColors.oasisEdge, desertColors.oasisSand, smoothstep(13.0, 16.0, h));
            }
            return;
        }

        // Sweeping Sand Dune Gradient (Valley Shadow -> Base -> Slope -> Crest -> Peak)
        // Add subtle procedural variation per dune
        const colVar = snoise(x * 0.002, z * 0.002) * 0.08;
        
        if (h < 22.0) {
            tempColor.lerpColors(desertColors.valleyShadow, desertColors.sandBase, smoothstep(6.1, 22.0, h));
        } else if (h < 50.0) {
            tempColor.lerpColors(desertColors.sandBase, desertColors.duneSlope, smoothstep(22.0, 50.0, h));
        } else if (h < 85.0) {
            tempColor.lerpColors(desertColors.duneSlope, desertColors.duneCrest, smoothstep(50.0, 85.0, h));
        } else {
            tempColor.lerpColors(desertColors.duneCrest, desertColors.peakHighlight, smoothstep(85.0, 130.0, h));
        }
        
        if (colVar !== 0) {
            tempColor.r = Math.max(0, Math.min(1, tempColor.r + colVar));
            tempColor.g = Math.max(0, Math.min(1, tempColor.g + colVar * 0.6));
        }
    }
};

