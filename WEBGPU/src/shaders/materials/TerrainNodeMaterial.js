import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    Fn, vec2, vec3, float, sin, dot, mix, clamp, pow, reflect, normalize,
    positionWorld, color, texture, max, step, smoothstep, fract, normalWorld,
    cameraPosition, positionLocal, attribute
} from 'three/tsl';

const hash = Fn(([p]) => {
    return fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453123));
});

const noise = Fn(([p]) => {
    const i = p.floor();
    const f = p.fract();
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    return mix(
        mix(hash(i.add(vec2(0.0, 0.0))), hash(i.add(vec2(1.0, 0.0))), u.x),
        mix(hash(i.add(vec2(0.0, 1.0))), hash(i.add(vec2(1.0, 1.0))), u.x),
        u.y
    );
});

const fbm = Fn(([p]) => {
    let f = float(0.0).toVar();
    let currP = vec2(p).toVar();
    f.addAssign(noise(currP).mul(0.5000)); currP.mulAssign(2.02);
    f.addAssign(noise(currP).mul(0.2500)); currP.mulAssign(2.03);
    f.addAssign(noise(currP).mul(0.1250));
    return f;
});

export const createTerrainMaterial = (uTime, uSunDir, uSandNoiseMap, uShimmerMult) => {
    const terrainMat = new MeshStandardNodeMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.05
    });

    const aBiomeType = attribute('aBiomeType', 'float');

    terrainMat.colorNode = Fn(() => {
        let baseColor = attribute('color', 'vec3').toVar();
        
        // Realistic terrain macro-detail noise overlay
        const macroUV = positionWorld.xz.mul(0.04);
        const macroNoise = texture(uSandNoiseMap, macroUV).r;
        const microNoise = texture(uSandNoiseMap, positionWorld.xz.mul(0.15)).g;
        const detailBlend = macroNoise.mul(0.6).add(microNoise.mul(0.4)).mul(0.3).sub(0.15);
        
        baseColor.rgb.assign(clamp(baseColor.rgb.add(detailBlend), 0.0, 1.0));

        // Animated Cloud Shadows
        const cloudUV = positionWorld.xz.mul(0.0015).add(uTime.mul(0.05));
        const cloudNoiseVal = fbm(cloudUV);
        const cloudShadow = smoothstep(0.35, 0.65, cloudNoiseVal).mul(0.35);
        
        baseColor.rgb.mulAssign(float(1.0).sub(cloudShadow));
        
        return baseColor;
    })();

    // To add the specular/rim glow we modify the emissiveNode or construct custom lighting.
    // In MeshStandardNodeMaterial, modifying emissiveNode is the standard way to add extra light.
    terrainMat.emissiveNode = Fn(() => {
        const viewDir = normalize(cameraPosition.sub(positionWorld));
        const norm = normalize(normalWorld);
        const lightDir = normalize(uSunDir);
        const halfDir = normalize(lightDir.add(viewDir));
        const ref = reflect(viewDir.negate(), norm);

        const isSand = step(0.9, aBiomeType).mul(step(aBiomeType, 1.1));
        const isCanyon = step(2.9, aBiomeType).mul(step(aBiomeType, 3.1));
        
        const rim = float(1.0).sub(clamp(dot(norm, viewDir), 0.0, 1.0));
        const rimStrength = pow(rim, 4.5).mul(0.5);
        const rimGlow = vec3(1.0, 0.72, 0.38).mul(rimStrength);

        const mainSpecRaw = clamp(dot(ref, halfDir), 0.0, 1.0);
        const mainSpec = pow(mainSpecRaw, 20.0).mul(4.5).toVar();

        const sandUV1 = positionWorld.xz.mul(0.07).add(uTime.mul(0.003));
        const sandUV2 = positionWorld.xz.mul(0.18).sub(uTime.mul(0.006));
        
        let textureGlitter = texture(uSandNoiseMap, sandUV1).r.mul(0.7).add(texture(uSandNoiseMap, sandUV2).g.mul(0.5));
        textureGlitter = pow(clamp(textureGlitter, 0.0, 1.0), 2.2);
        
        mainSpec.mulAssign(textureGlitter);

        const rimSpec = pow(rim, 2.2).mul(textureGlitter).mul(2.5);
        const specColor = mainSpec.add(rimSpec).mul(vec3(1.0, 0.82, 0.55)).mul(uShimmerMult);

        const finalSandGlow = rimGlow.mul(0.5).add(specColor); // Scaled rim down slightly for balance in emissive
        
        // Canyon warm terracotta-golden rim light on cliff edges
        const canyonRimStrength = pow(rim, 4.0).mul(0.35);
        const canyonRimGlow = vec3(1.0, 0.60, 0.32).mul(canyonRimStrength);

        return finalSandGlow.mul(isSand).add(canyonRimGlow.mul(isCanyon));
    })();

    return terrainMat;
};
