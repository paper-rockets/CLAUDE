import * as THREE from 'three';
import { PostProcessing } from 'three/webgpu';
import { pass, vec2, vec3, vec4, mix, smoothstep, max, clamp, dot, float, uv, uniform, Loop, fract, sin, length, Fn } from 'three/tsl';
import { LOW_GFX } from '../config/constants.js';
import { renderer, scene, camera } from './Engine.js';
import { buildPortalWarpNode, uWarpIntensity } from '../vfx/PortalWarpPass.js';

export let postProcessing;
export let scenePass;

export function initPostProcessing() {
    postProcessing = new PostProcessing(renderer);
    scenePass = pass(scene, camera);
    updatePostProcessingPipeline();
}

// -- God Rays Settings --
export const uSunScreenPos = uniform(vec2(0.5, 0.5));
export const uIntensity = uniform(0.15);
export const uDecay = uniform(0.90);
export const uDensity = uniform(0.40);
export const uWeight = uniform(0.30);
export const uSunVisible = uniform(1.0);
export let isGodRaysEnabled = !LOW_GFX;

const pseudoRand = (p) => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453123));

const buildGodRaysNode = Fn(([baseTex]) => {
    const vUv = uv();
    // Use varying fragment coordinate for dither (simplified)
    const fragCoord = vUv.mul(1000.0); 

    const deltaUV = vUv.sub(uSunScreenPos).toVar();
    const dist = length(deltaUV);
    deltaUV.mulAssign(float(1.0 / 32.0).mul(uDensity));

    const dither = pseudoRand(fragCoord);
    const sampleUV = vUv.sub(deltaUV.mul(dither)).toVar();

    const illumination = float(0.0).toVar();
    const currentWeight = float(uWeight).toVar();

    Loop({ start: 0, end: 32 }, () => {
        sampleUV.subAssign(deltaUV);
        const samp = scenePass.getTextureNode().sample(sampleUV);
        const lum = dot(samp.rgb, vec3(0.299, 0.587, 0.114));
        const bright = smoothstep(0.70, 0.95, lum);
        illumination.addAssign(bright.mul(currentWeight));
        currentWeight.mulAssign(uDecay);
    });

    const edgeFade = float(1.0).sub(smoothstep(0.4, 1.5, dist));
    const rayColor = vec3(1.0, 0.95, 0.85).mul(illumination).mul(uIntensity).mul(edgeFade).mul(uSunVisible);

    return vec4(baseTex.rgb.add(rayColor), baseTex.a);
});

// -- Ghibli Summer Settings --
export let isSummerFilterOn = false;

const getLuminance = (col) => dot(col, vec3(0.299, 0.587, 0.114));

const buildGhibliSummerNode = Fn(([baseTex]) => {
    const col = baseTex.rgb;
    const lum = getLuminance(col);
    
    const warmGold = col.mul(vec3(1.07, 1.02, 0.92));
    const azureShadow = col.mul(vec3(0.93, 0.98, 1.07));
    let finalCol = mix(azureShadow, warmGold, smoothstep(0.2, 0.75, lum));
    
    finalCol = mix(vec3(lum), finalCol, 1.18);
    finalCol = finalCol.add(max(vec3(0.0), finalCol.sub(0.55)).mul(vec3(0.12, 0.09, 0.02)));
    
    const vUv = uv();
    const centeredUv = vUv.sub(0.5).mul(2.0);
    const vign = clamp(float(1.0).sub(dot(centeredUv, centeredUv).mul(0.14)), 0.0, 1.0);
    finalCol = finalCol.mul(vign);
    
    return vec4(finalCol, baseTex.a);
});


// Main setup loop
export function updatePostProcessingPipeline() {
    let outputNode = scenePass;

    if (isGodRaysEnabled) {
        outputNode = buildGodRaysNode(outputNode);
    }
    
    if (isSummerFilterOn) {
        outputNode = buildGhibliSummerNode(outputNode);
    }
    
    // Always apply warp node at the very end, it manages its own mix intensity
    outputNode = buildPortalWarpNode(outputNode);

    postProcessing.outputNode = outputNode;
    postProcessing.needsUpdate = true;
}

// Initial build removed from here; now called in initPostProcessing()


// Provide exports for main.js compatibility
export const bloomPass = { enabled: false };
export const godRaysPass = { 
    enabled: !LOW_GFX,
    uniforms: {
        uSunScreenPos: uSunScreenPos,
        uIntensity: uIntensity,
        uDecay: uDecay,
        uDensity: uDensity,
        uWeight: uWeight,
        uSunVisible: uSunVisible
    }
};

Object.defineProperty(godRaysPass, 'enabled', {
    get: () => isGodRaysEnabled,
    set: (v) => { isGodRaysEnabled = v; updatePostProcessingPipeline(); }
});

export function initPostProcessingUI() {
    const summerBtn = document.getElementById('summer-toggle');
    if (summerBtn) {
        summerBtn.addEventListener('click', () => {
            isSummerFilterOn = !isSummerFilterOn;
            updatePostProcessingPipeline();
            if (typeof window.params !== 'undefined') window.params.summerFilter = isSummerFilterOn;
        });
    }
}
