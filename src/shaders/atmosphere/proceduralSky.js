import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    Fn, vec2, vec3, vec4, uniform, positionWorld, cameraPosition, normalize,
    dot, clamp, mix, pow, smoothstep, float, sin, fract, abs, max
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
    f.addAssign(noise(currP).mul(0.1250)); currP.mulAssign(2.01);
    f.addAssign(noise(currP).mul(0.0625));
    return f;
});

export function createProceduralSky() {
    const uTime = uniform(0.0);
    const uSunPosition = uniform(new THREE.Vector3(0.0, 0.5, -0.866).normalize());
    const uSkyColorZenith = uniform(new THREE.Color(0x2a5090));
    const uSkyColorMid = uniform(new THREE.Color(0xc85078));
    const uSkyColorHorizon = uniform(new THREE.Color(0xffa07a));
    const uSunColor = uniform(new THREE.Color(0xffaa00));
    const uGradientPower = uniform(1.2);
    const uGradientMidOffset = uniform(0.22);
    const uGradientSkyEnabled = uniform(1.0);
    const uSunCoronaIntensity = uniform(0.7);
    const uCloudColor = uniform(new THREE.Color(0xfffaec));
    const uCloudShadowColor = uniform(new THREE.Color(0xa89888));
    const uCloudCoverage = uniform(0.45);
    const uCloudEdge = uniform(0.06);
    const uCloudSpeed = uniform(0.018);
    const uCloudTurbulence = uniform(0.0);
    const uCloudOpacity = uniform(1.0);
    const uStormDarken = uniform(0.0);
    const uNightFactor = uniform(0.0);
    const uDuskFactor = uniform(1.0);
    const uHorizonGlow = uniform(0.45);
    const uEnableProceduralClouds = uniform(1.0);

    const material = new MeshBasicNodeMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true,
        fog: false
    });

    material.colorNode = Fn(() => {
        const dir = normalize(positionWorld.sub(cameraPosition));
        const sunDir = normalize(uSunPosition);
        const sunDot = dot(dir, sunDir);

        // Vertical altitude angle: 0.0 at horizon, 1.0 directly overhead
        const alt = clamp(dir.y, 0.0, 1.0);

        // 3-stop vertical atmospheric gradient (Horizon -> Mid-Sky -> Zenith)
        const tLower = clamp(alt.div(max(uGradientMidOffset, float(0.01))), 0.0, 1.0);
        const tUpper = clamp(alt.sub(uGradientMidOffset).div(max(float(1.0).sub(uGradientMidOffset), float(0.01))), 0.0, 1.0);

        const curveLower = pow(tLower, uGradientPower);
        const curveUpper = pow(tUpper, uGradientPower);

        const lowerSky = mix(uSkyColorHorizon, uSkyColorMid, curveLower);
        const gradientSky = mix(lowerSky, uSkyColorZenith, curveUpper);

        // Backward-compatible 2-stop simple curve for baseSky
        const h = clamp(dir.y.mul(1.5), 0.0, 1.0);
        const twoStopSky = mix(uSkyColorHorizon, uSkyColorZenith, pow(h, 0.6));
        const baseAtmosphere = mix(twoStopSky, gradientSky, uGradientSkyEnabled);

        // Sun disc and forward atmospheric corona glow
        const sunDisc = smoothstep(0.9985, 0.9997, sunDot).mul(uSunColor).mul(3.0);
        const sunCorona = pow(clamp(sunDot, 0.0, 1.0), 16.0).mul(uSunColor).mul(uSunCoronaIntensity);
        const sunHaze = pow(clamp(sunDot, 0.0, 1.0), 4.0).mul(uSkyColorHorizon).mul(0.35);

        // Horizon subtle warm rim
        const horizonBand = pow(clamp(float(1.0).sub(abs(dir.y)), 0.0, 1.0), 3.0);
        const duskGlow = horizonBand.mul(uSkyColorHorizon).mul(uHorizonGlow).mul(uDuskFactor);

        // Night sky base
        const nightBase = vec3(0.015, 0.02, 0.06);
        const nightSky = nightBase;

        // Composite atmospheric sky
        let sky = baseAtmosphere.add(sunCorona).add(sunHaze).add(sunDisc).add(duskGlow);
        sky = mix(sky, nightSky, uNightFactor);

        // Storm darkening for base sky
        sky = mix(sky, vec3(0.12, 0.14, 0.18), uStormDarken);

        // ==========================================
        // PROCEDURAL CLOUDS LAYER (TSL)
        // ==========================================
        // Upper hemisphere dome projection
        const skyDomeDist = float(1.0).div(max(dir.y.add(0.15), float(0.08)));
        const cloudUV = dir.xz.mul(skyDomeDist).mul(0.45);

        // Wind drift & movement
        const windOffset = vec2(uTime.mul(uCloudSpeed).mul(0.15), uTime.mul(uCloudSpeed).mul(0.08));
        const uvSample = cloudUV.add(windOffset);

        // Billowy Anime / Ghibli FBM Cloud Density with Domain Warping
        const q = vec2(fbm(uvSample), fbm(uvSample.add(vec2(5.2, 1.3))));
        const warpedUV = uvSample.add(q.mul(0.8).add(q.mul(uCloudTurbulence)));
        const cloudNoise = fbm(warpedUV);

        // Biome Coverage & Soft Edge Thresholding
        const lowThreshold = float(1.0).sub(uCloudCoverage);
        const highThreshold = lowThreshold.add(max(uCloudEdge, float(0.02)));
        const cloudAlpha = smoothstep(lowThreshold, highThreshold, cloudNoise);

        // Horizon fade so clouds blend cleanly above the horizon
        const horizonFade = smoothstep(0.02, 0.22, dir.y);
        const finalAlpha = cloudAlpha.mul(horizonFade).mul(uCloudOpacity);

        // Cloud Lighting & Rim / Silver Lining
        const sunDiffuse = clamp(sunDot.mul(0.5).add(0.5), 0.0, 1.0);
        const silverLining = pow(clamp(sunDot, 0.0, 1.0), 4.0).mul(0.4);

        // Base cloud color with directional shading
        const dayCloudCol = mix(uCloudShadowColor, uCloudColor, sunDiffuse.add(silverLining));

        // Sunset & Dusk tinting
        const sunsetCloudCol = mix(dayCloudCol, vec3(1.0, 0.6, 0.45), uDuskFactor.mul(0.7));

        // Night sky darkening
        const nightCloudCol = mix(sunsetCloudCol, vec3(0.04, 0.05, 0.1), uNightFactor.mul(0.85));

        // Storm darkening
        const finalCloudCol = mix(nightCloudCol, vec3(0.1, 0.12, 0.15), uStormDarken.mul(0.8));

        // Composite procedural clouds over sky
        const cloudContribution = finalAlpha.mul(uEnableProceduralClouds);
        const compositeSky = mix(sky, finalCloudCol, cloudContribution);

        return vec4(compositeSky, 1.0);
    })();

    const geometry = new THREE.SphereGeometry(20000, 64, 32);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -1000;
    mesh.frustumCulled = false;

    return {
        mesh,
        material,
        uniforms: {
            uTime, uSunPosition, uSkyColorZenith, uSkyColorMid, uSkyColorHorizon, uSunColor,
            uGradientPower, uGradientMidOffset, uGradientSkyEnabled, uSunCoronaIntensity, uHorizonGlow,
            uCloudColor, uCloudShadowColor, uCloudCoverage, uCloudEdge, uCloudSpeed,
            uCloudTurbulence, uCloudOpacity, uStormDarken, uNightFactor, uDuskFactor, uEnableProceduralClouds
        }
    };
}
