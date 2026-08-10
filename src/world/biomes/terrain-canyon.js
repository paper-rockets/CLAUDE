import * as THREE from 'three';

const colorDeepWater = new THREE.Color(0x114b5f);
const colorRiver     = new THREE.Color(0x2a9d8f);
const colorCanyonWash= new THREE.Color(0xe07a5f);
const colorRockRed1  = new THREE.Color(0xa3321d);
const colorRockRed2  = new THREE.Color(0xc84b31);
const colorOchre     = new THREE.Color(0xd98c36);
const colorCream     = new THREE.Color(0xf4a261);
const colorMahogany  = new THREE.Color(0x5c1d11);
const colorMesaTop   = new THREE.Color(0xe68a4c);

export default {
    name: "⛰️ Badlands Canyon",
    shoreName: "🏜️ Dry Shore",

    getHeight(x, z, snoise) {
        const warpX = snoise(x * 0.0004, z * 0.0004) * 260.0;
        const warpZ = snoise(x * 0.0004 + 120.0, z * 0.0004 + 120.0) * 260.0;
        const wx = x + warpX;
        const wz = z + warpZ;

        const macroNoise = snoise(wx * 0.00035, wz * 0.00035);
        let baseHeight = macroNoise * 42.0 + 42.0;

        const stepSize = 13.0;
        const terraceIdx = Math.floor(baseHeight / stepSize);
        const terraceFrac = (baseHeight % stepSize) / stepSize;
        const tFrac = Math.max(0, Math.min(1, (terraceFrac - 0.28) / 0.44));
        const smoothTerrace = terraceIdx * stepSize + Math.pow(tFrac * tFrac * (3 - 2 * tFrac), 2.2) * stepSize;

        const gorgeNoise = Math.abs(snoise(wx * 0.0011 + 150.0, wz * 0.0011 - 150.0));
        let gorgeCarve = 0;
        if (gorgeNoise < 0.16) {
            const t = 1.0 - (gorgeNoise / 0.16);
            gorgeCarve = t * t * (3.0 - 2.0 * t) * 38.0;
        }

        const gulchNoise = Math.abs(snoise(wx * 0.0028 - 300.0, wz * 0.0028 + 300.0));
        let gulchCarve = 0;
        if (gulchNoise < 0.10) {
            const t2 = 1.0 - (gulchNoise / 0.10);
            gulchCarve = t2 * t2 * (3.0 - 2.0 * t2) * 14.0;
        }

        const hoodooNoise = snoise(wx * 0.0042 + 400.0, wz * 0.0042 - 400.0);
        let hoodooHeight = 0;
        if (hoodooNoise > 0.60) {
            const hFactor = (hoodooNoise - 0.60) / 0.40;
            hoodooHeight = hFactor * hFactor * 32.0;
        }

        let h = smoothTerrace - gorgeCarve - gulchCarve + hoodooHeight + 11.0;
        return Math.max(6.0, h);
    },

    getColor(h, x, z, snoise, tempColor, smoothstep) {
        if (h <= 6.1) {
            tempColor.lerpColors(colorDeepWater, colorRiver, smoothstep(1.0, 6.1, h));
            return;
        }

        if (h < 12.5) {
            tempColor.lerpColors(colorRiver, colorCanyonWash, smoothstep(6.1, 12.5, h));
            return;
        }

        const wavyY = h + snoise(x * 0.006, z * 0.006) * 2.2;
        const strata = Math.sin(wavyY * 0.45);
        const strata2 = Math.cos(wavyY * 0.22 + 10.0);

        let baseColor = colorRockRed1.clone();

        if (strata > 0.40) {
            baseColor.copy(colorCream);
        } else if (strata < -0.35) {
            baseColor.copy(colorMahogany);
        } else if (strata2 > 0.30) {
            baseColor.copy(colorOchre);
        } else {
            baseColor.copy(colorRockRed2);
        }

        if (h < 22.0) {
            tempColor.lerpColors(colorCanyonWash, baseColor, smoothstep(12.5, 22.0, h));
        } else if (h < 70.0) {
            tempColor.copy(baseColor);
        } else {
            tempColor.lerpColors(baseColor, colorMesaTop, smoothstep(70.0, 95.0, h));
        }

        const streakNoise = snoise(x * 0.012 + 70.0, z * 0.012 - 70.0);
        if (streakNoise > 0.58) {
            tempColor.lerp(colorMahogany, (streakNoise - 0.58) * 0.8);
        }
    }
};
