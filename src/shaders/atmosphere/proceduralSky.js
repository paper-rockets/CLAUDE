import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    Fn, vec2, vec3, vec4, uniform, positionWorld, cameraPosition, normalize,
    dot, clamp, mix, pow, smoothstep, float, sin, fract, abs, max, If
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

// 3D gradient noise hash (https://www.shadertoy.com/view/Xsl3Dl)
const hash3D = Fn(([p]) => {
    const sinInput = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(sinInput).mul(43758.5453123)).mul(2.0).sub(1.0);
});

const noise3D = Fn(([p]) => {
    const i = p.floor().toVar();
    const f = p.fract().toVar();
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    return mix(
        mix(
            mix(dot(hash3D(i.add(vec3(0,0,0))), f.sub(vec3(0,0,0))),
                dot(hash3D(i.add(vec3(1,0,0))), f.sub(vec3(1,0,0))), u.x),
            mix(dot(hash3D(i.add(vec3(0,1,0))), f.sub(vec3(0,1,0))),
                dot(hash3D(i.add(vec3(1,1,0))), f.sub(vec3(1,1,0))), u.x), u.y),
        mix(
            mix(dot(hash3D(i.add(vec3(0,0,1))), f.sub(vec3(0,0,1))),
                dot(hash3D(i.add(vec3(1,0,1))), f.sub(vec3(1,0,1))), u.x),
            mix(dot(hash3D(i.add(vec3(0,1,1))), f.sub(vec3(0,1,1))),
                dot(hash3D(i.add(vec3(1,1,1))), f.sub(vec3(1,1,1))), u.x), u.y),
        u.z
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
    const uSkyColorZenith = uniform(new THREE.Color(0x4a90d9));
    const uSkyColorHorizon = uniform(new THREE.Color(0xb8d4e8));
    const uSunColor = uniform(new THREE.Color(0xfffaeb));
    const uCloudColor = uniform(new THREE.Color(0xfff8f0));
    const uCloudShadowColor = uniform(new THREE.Color(0x8898a8));
    const uCloudCoverage = uniform(0.45);
    const uCloudEdge = uniform(0.07);
    const uCloudSpeed = uniform(0.02);
    const uCloudTurbulence = uniform(0.0);
    const uCloudOpacity = uniform(1.0);
    const uStarDensity = uniform(0.0);
    const uStormDarken = uniform(0.0);
    const uNightFactor = uniform(0.0);
    const uDuskFactor = uniform(0.0);

    const material = new MeshBasicNodeMaterial({
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        fog: false
    });

    material.colorNode = Fn(() => {
        const dir = normalize(positionWorld.sub(cameraPosition));
        const sunDir = normalize(uSunPosition);
        const sunDot = dot(dir, sunDir);

        // Height-based atmospheric horizon to zenith blend
        const h = clamp(dir.y.mul(1.5), 0.0, 1.0);
        const baseSky = mix(uSkyColorHorizon, uSkyColorZenith, pow(h, 0.6));

        // Sun disc and golden corona glow
        const sunDisc = smoothstep(0.998, 0.9995, sunDot).mul(uSunColor).mul(3.0);
        const sunGlow = pow(clamp(sunDot, 0.0, 1.0), 12.0).mul(uSunColor).mul(0.5);

        // Dusk / sunset horizon gradient
        const horizonBand = pow(clamp(float(1.0).sub(abs(dir.y)), 0.0, 1.0), 3.0);
        const duskGlow = horizonBand.mul(vec3(1.0, 0.45, 0.25)).mul(uDuskFactor).mul(1.2);

        // Night sky gradient with procedural starfield (only computed at night)
        const nightBase = vec3(0.015, 0.02, 0.06);
        const starVal = float(0.0).toVar();
        If(uNightFactor.greaterThan(0.01), () => {
            const starsBase = pow(clamp(noise3D(dir.mul(400.0)), 0.0, 1.0), float(25.0)).mul(500.0);
            const starsFlicker = mix(float(0.4), float(1.4), noise3D(dir.mul(200.0).add(vec3(uTime, uTime, uTime))));
            starVal.assign(starsBase.mul(starsFlicker));
        });
        const nightSky = nightBase.add(vec3(starVal).mul(uNightFactor));

        // Blend Day -> Dusk -> Night
        let sky = mix(baseSky.add(sunGlow).add(sunDisc), duskGlow.add(baseSky.mul(0.5)), uDuskFactor);
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
        const compositeSky = mix(sky, finalCloudCol, finalAlpha);

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
            uTime, uSunPosition, uSkyColorZenith, uSkyColorHorizon, uSunColor,
            uCloudColor, uCloudShadowColor, uCloudCoverage, uCloudEdge, uCloudSpeed,
            uCloudTurbulence, uCloudOpacity, uStarDensity, uStormDarken, uNightFactor, uDuskFactor
        }
    };
}
