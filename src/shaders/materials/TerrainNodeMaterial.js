import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    Fn, vec2, vec3, float, sin, dot, mix, clamp, pow, reflect, normalize,
    positionWorld, color, texture, max, min, step, smoothstep, fract, normalWorld,
    cameraPosition, uniform
} from 'three/tsl';

const hash2D = Fn(([p]) => {
    return fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453123));
});

const noise2D = Fn(([p]) => {
    const i = p.floor();
    const f = p.fract();
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    return mix(
        mix(hash2D(i.add(vec2(0.0, 0.0))), hash2D(i.add(vec2(1.0, 0.0))), u.x),
        mix(hash2D(i.add(vec2(0.0, 1.0))), hash2D(i.add(vec2(1.0, 1.0))), u.x),
        u.y
    );
});

const fbm2D = Fn(([p]) => {
    let f = float(0.0).toVar();
    let currP = vec2(p).toVar();
    f.addAssign(noise2D(currP).mul(0.5000)); currP.mulAssign(2.02);
    f.addAssign(noise2D(currP).mul(0.2500)); currP.mulAssign(2.03);
    f.addAssign(noise2D(currP).mul(0.1250));
    return f;
});

export const createTerrainMaterial = (uTime, uSunDir, uSandNoiseMap, uShimmerMult, uWaterLevelInput, uSeasonMixInput) => {
    const terrainMat = new MeshStandardNodeMaterial({
        roughness: 0.85,
        metalness: 0.05
    });

    const waterLevel = uWaterLevelInput || uniform(2.4);
    const seasonMix = uSeasonMixInput || uniform(0.0);

    terrainMat.colorNode = Fn(() => {
        const p = positionWorld.xz;
        const norm = normalize(normalWorld);
        const slope = float(1.0).sub(clamp(norm.y, 0.0, 1.0));

        // Procedural multi-frequency 2D noise on GPU
        const n1 = noise2D(p.mul(0.045));
        const n2 = noise2D(p.mul(0.14));
        const n3 = noise2D(p.mul(0.4));
        const combN = n1.mul(0.6).add(n2.mul(0.3)).add(n3.mul(0.1));
        const h = positionWorld.y.add(combN.mul(2.8));

        // Spring / Summer Palette
        const cSandWet = vec3(0.72, 0.58, 0.38);
        const cSand = vec3(0.88, 0.77, 0.52);
        let cGrassLow = vec3(0.24, 0.72, 0.08).toVar();
        let cGrassMid = vec3(0.12, 0.56, 0.30).toVar();
        let cGrassHigh = vec3(0.06, 0.40, 0.22).toVar();
        let cMossYellow = vec3(0.48, 0.90, 0.05).toVar();
        const cRock = vec3(0.38, 0.33, 0.27);
        const cRockDark = vec3(0.24, 0.20, 0.17);

        // Autumn Palette Overrides
        const cGrassLowAutumn = vec3(0.85, 0.62, 0.18);
        const cGrassMidAutumn = vec3(0.75, 0.40, 0.08);
        const cGrassHighAutumn = vec3(0.55, 0.15, 0.06);
        const cMossAutumn = vec3(0.92, 0.50, 0.08);

        cGrassLow.assign(mix(cGrassLow, cGrassLowAutumn, seasonMix));
        cGrassMid.assign(mix(cGrassMid, cGrassMidAutumn, seasonMix));
        cGrassHigh.assign(mix(cGrassHigh, cGrassHighAutumn, seasonMix));
        cMossYellow.assign(mix(cMossYellow, cMossAutumn, seasonMix));

        let surfaceColor = vec3(0.0).toVar();

        // 1. Wet sand to dry sand (below / at shore line)
        const t1 = smoothstep(waterLevel.sub(1.8), waterLevel.add(0.4), h);
        const sandBand = mix(cSandWet, cSand, t1);

        // 2. Sand to Low Grass
        const t2 = smoothstep(waterLevel.add(0.4), waterLevel.add(3.2), h);
        const lowGrassBand = mix(cSand, cGrassLow, t2);

        // 3. Low Grass to Mid Forest Grass with Sunlit Moss patches
        const t3 = smoothstep(waterLevel.add(3.2), waterLevel.add(22.0), h);
        let lushBand = mix(cGrassLow, cGrassMid, t3).toVar();
        const mossBlend = clamp(combN.sub(0.12).mul(0.9), 0.0, 1.0);
        lushBand.assign(mix(lushBand, cMossYellow, mossBlend.mul(step(0.12, combN))));

        // 4. Mid Grass to High Alpine Crest
        const t4 = smoothstep(waterLevel.add(22.0), waterLevel.add(52.0), h);
        const highGrassBand = mix(cGrassMid, cGrassHigh, t4);

        // 5. Alpine Crest to Rock Peak
        const t5 = smoothstep(waterLevel.add(52.0), waterLevel.add(80.0), h);
        const peakRockBand = mix(cGrassHigh, cRock, t5);

        // Elevation blend chain
        surfaceColor.assign(mix(sandBand, lowGrassBand, step(waterLevel.add(0.4), h)));
        surfaceColor.assign(mix(surfaceColor, lushBand, step(waterLevel.add(3.2), h)));
        surfaceColor.assign(mix(surfaceColor, highGrassBand, step(waterLevel.add(22.0), h)));
        surfaceColor.assign(mix(surfaceColor, peakRockBand, step(waterLevel.add(52.0), h)));

        // Cliff Slope Rock Protrusion Mask (Rocks naturally emerge on steep slopes)
        const rockMask = smoothstep(0.36, 0.60, slope.add(combN.mul(0.22)));
        const rockLayer = mix(cRock, cRockDark, clamp(n2.mul(1.5), 0.0, 1.0));
        surfaceColor.assign(mix(surfaceColor, rockLayer, rockMask));

        // Micro texture detail overlay (if noise map provided)
        if (uSandNoiseMap) {
            const macroUV = positionWorld.xz.mul(0.04);
            const macroNoise = texture(uSandNoiseMap, macroUV).r;
            const microNoise = texture(uSandNoiseMap, positionWorld.xz.mul(0.15)).g;
            const detailBlend = macroNoise.mul(0.6).add(microNoise.mul(0.4)).mul(0.25).sub(0.12);
            surfaceColor.assign(clamp(surfaceColor.add(detailBlend), 0.0, 1.0));
        }

        // Dynamic Moving Cloud Shadows
        const cloudUV = positionWorld.xz.mul(0.0015).add(uTime.mul(0.05));
        const cloudNoiseVal = fbm2D(cloudUV);
        const cloudShadow = smoothstep(0.35, 0.65, cloudNoiseVal).mul(0.35);
        surfaceColor.mulAssign(float(1.0).sub(cloudShadow));

        return surfaceColor;
    })();

    terrainMat.emissiveNode = Fn(() => {
        const viewDir = normalize(cameraPosition.sub(positionWorld));
        const norm = normalize(normalWorld);
        const lightDir = normalize(uSunDir);
        const halfDir = normalize(lightDir.add(viewDir));
        const ref = reflect(viewDir.negate(), norm);

        // Rim lighting on island peaks and ridges
        const rim = float(1.0).sub(clamp(dot(norm, viewDir), 0.0, 1.0));
        const rimStrength = pow(rim, 4.5).mul(0.35);
        const rimGlow = vec3(1.0, 0.85, 0.6).mul(rimStrength);

        // Sand shore sparkle reflection
        const isSandShore = step(positionWorld.y, waterLevel.add(4.5));
        const mainSpecRaw = clamp(dot(ref, halfDir), 0.0, 1.0);
        const mainSpec = pow(mainSpecRaw, 24.0).mul(3.5).toVar();

        if (uSandNoiseMap) {
            const sandUV1 = positionWorld.xz.mul(0.07).add(uTime.mul(0.003));
            let textureGlitter = texture(uSandNoiseMap, sandUV1).r;
            textureGlitter = pow(clamp(textureGlitter, 0.0, 1.0), 2.2);
            mainSpec.mulAssign(textureGlitter);
        }

        const specColor = mainSpec.mul(vec3(1.0, 0.9, 0.7)).mul(uShimmerMult || float(1.0));
        return rimGlow.add(specColor.mul(isSandShore));
    })();

    return terrainMat;
};

