import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    Fn, vec2, vec3, vec4, uniform, positionWorld, cameraPosition, normalize,
    dot, clamp, mix, pow, smoothstep, float, sin, fract, abs
} from 'three/tsl';

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
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true,
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

        // Night sky gradient with procedural starfield
        const nightBase = vec3(0.015, 0.02, 0.06);
        const starUV = dir.xz.div(clamp(abs(dir.y).add(0.2), 0.1, 1.0)).mul(300.0);
        const starHash = fract(sin(dot(starUV.floor(), vec2(12.9898, 78.233))).mul(43758.5453));
        const star = smoothstep(0.985, 1.0, starHash).mul(sin(uTime.mul(2.0).add(starHash.mul(10.0))).mul(0.3).add(0.7));
        const nightSky = nightBase.add(star.mul(uNightFactor));

        // Blend Day -> Dusk -> Night
        let sky = mix(baseSky.add(sunGlow).add(sunDisc), duskGlow.add(baseSky.mul(0.5)), uDuskFactor);
        sky = mix(sky, nightSky, uNightFactor);

        // Storm darkening
        sky = mix(sky, vec3(0.12, 0.14, 0.18), uStormDarken);

        return vec4(sky, 1.0);
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
