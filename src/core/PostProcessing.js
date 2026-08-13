import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, SSAOEffect, NormalPass, Effect } from 'postprocessing';
import { LOW_GFX } from '../config/constants.js';
import { renderer, scene, camera } from './Engine.js';

export const composer = new EffectComposer(renderer, { multisampling: 0 });
export const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Optional Normal Pass for SSAO
// export const normalPass = new NormalPass(scene, camera);
// composer.addPass(normalPass);

// SSAO Effect
export const ssaoEffect = new SSAOEffect(camera, null, {
    samples: 5,
    rings: 2,
    distanceThreshold: 0.1,
    distanceFalloff: 0.02,
    rangeThreshold: 0.015,
    rangeFalloff: 0.002,
    luminanceInfluence: 0.7,
    radius: 12.0,
    scale: 0.5,
    bias: 0.025,
    intensity: 1.0,
    color: null,
    resolutionScale: 0.5
});
if (LOW_GFX) {
    ssaoEffect.blendMode.opacity.value = 0.0;
}

const _bloomResScale = LOW_GFX ? 0.5 : 1.0;
export const bloomEffect = new BloomEffect({
    intensity: 1.5,
    luminanceThreshold: 0.8,
    luminanceSmoothing: 0.1,
    resolutionScale: _bloomResScale
});

const ghibliSummerFragmentShader = `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 col = inputColor.rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));

    vec3 warmGold = col * vec3(1.07, 1.02, 0.92);
    vec3 azureShadow = col * vec3(0.93, 0.98, 1.07);
    col = mix(azureShadow, warmGold, smoothstep(0.2, 0.75, lum));

    col = mix(vec3(lum), col, 1.18);
    col += max(vec3(0.0), col - 0.55) * vec3(0.12, 0.09, 0.02);

    vec2 centeredUv = (uv - 0.5) * 2.0;
    float vign = clamp(1.0 - dot(centeredUv, centeredUv) * 0.14, 0.0, 1.0);
    col *= vign;

    outputColor = vec4(col, inputColor.a);
}
`;

export class GhibliSummerEffect extends Effect {
    constructor() {
        super("GhibliSummerEffect", ghibliSummerFragmentShader);
    }
}

export const summerEffect = new GhibliSummerEffect();

const godRaysFragmentShader = `
uniform vec2 uSunScreenPos;
uniform float uIntensity;
uniform float uDecay;
uniform float uDensity;
uniform float uWeight;
uniform float uSunVisible;

float pseudoRand(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 deltaUV = (uv - uSunScreenPos);
    float dist = length(deltaUV);
    deltaUV *= (1.0 / 32.0) * uDensity; 

    float dither = pseudoRand(gl_FragCoord.xy);
    vec2 sampleUV = uv - (deltaUV * dither);
    
    float illumination = 0.0;
    float currentWeight = uWeight;
    
    for(int i = 0; i < 32; i++) {
        sampleUV -= deltaUV;
        vec4 samp = texture2D(inputBuffer, sampleUV);
        float lum = dot(samp.rgb, vec3(0.299, 0.587, 0.114));
        float bright = smoothstep(0.45, 0.85, lum);
        illumination += bright * currentWeight;
        currentWeight *= uDecay;
    }
    
    float edgeFade = 1.0 - smoothstep(0.4, 1.5, dist);
    vec3 rayColor = vec3(1.0, 0.9, 0.7) * illumination * uIntensity * edgeFade * uSunVisible;
    
    outputColor = vec4(inputColor.rgb + rayColor, inputColor.a);
}
`;

export class GodRaysEffect extends Effect {
    constructor() {
        super("GodRaysEffect", godRaysFragmentShader, {
            uniforms: new Map([
                ["uSunScreenPos", new THREE.Uniform(new THREE.Vector2(0.5, 0.5))],
                ["uIntensity", new THREE.Uniform(1.0)],
                ["uDecay", new THREE.Uniform(0.927)],
                ["uDensity", new THREE.Uniform(0.50)],
                ["uWeight", new THREE.Uniform(0.75)],
                ["uSunVisible", new THREE.Uniform(1.0)]
            ])
        });
    }
}

export const godRaysEffect = new GodRaysEffect();

const exposureFragmentShader = `
uniform float uExposure;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 color = inputColor.rgb * uExposure;
    
    // ACES Filmic Tone Mapping approximation
    color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
    
    outputColor = vec4(color, inputColor.a);
}
`;

export class ExposureEffect extends Effect {
    constructor(exposure = 1.8) {
        super("ExposureEffect", exposureFragmentShader, {
            uniforms: new Map([
                ["uExposure", new THREE.Uniform(exposure)]
            ])
        });
    }
}

export const exposureEffect = new ExposureEffect(1.8);

export const mainEffectPass = new EffectPass(camera, ssaoEffect, bloomEffect, godRaysEffect, exposureEffect);
composer.addPass(mainEffectPass);

export const summerEffectPass = new EffectPass(camera, summerEffect);
composer.addPass(summerEffectPass);
summerEffectPass.enabled = false;

export let isSummerFilterOn = false;

export function initPostProcessingUI() {
    const summerBtn = document.getElementById('summer-toggle');
    if (summerBtn) {
        summerBtn.addEventListener('click', () => {
            isSummerFilterOn = !isSummerFilterOn;
            summerEffectPass.enabled = isSummerFilterOn;
            if (typeof window.params !== 'undefined') window.params.summerFilter = isSummerFilterOn;
        });
    }
}
