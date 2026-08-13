import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LOW_GFX } from '../config/constants.js';
import { renderer, scene, camera } from './Engine.js';

export const composer = new EffectComposer(renderer);
export const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const _bloomRes = LOW_GFX ? new THREE.Vector2(window.innerWidth * 0.5, window.innerHeight * 0.5) : new THREE.Vector2(window.innerWidth, window.innerHeight);
export const bloomPass = new UnrealBloomPass(_bloomRes, 0.30, 0.3, 0.82);
bloomPass.enabled = false;
composer.addPass(bloomPass);

export const GhibliSummerShader = {
    uniforms: {
        tDiffuse: { value: null }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;

        void main() {
            vec4 texel = texture2D( tDiffuse, vUv );
            vec3 col = texel.rgb;

            float lum = dot(col, vec3(0.299, 0.587, 0.114));

            vec3 warmGold = col * vec3(1.07, 1.02, 0.92);
            vec3 azureShadow = col * vec3(0.93, 0.98, 1.07);
            col = mix(azureShadow, warmGold, smoothstep(0.2, 0.75, lum));

            col = mix(vec3(lum), col, 1.18);
            col += max(vec3(0.0), col - 0.55) * vec3(0.12, 0.09, 0.02);

            vec2 uv = (vUv - 0.5) * 2.0;
            float vign = clamp(1.0 - dot(uv, uv) * 0.14, 0.0, 1.0);
            col *= vign;

            gl_FragColor = vec4(col, texel.a);
        }
    `
};

export const GodRaysShader = {
    uniforms: {
        tDiffuse: { value: null },
        uSunScreenPos: { value: new THREE.Vector2(0.5, 0.5) },
        uIntensity: { value: 0.15 },
        uDecay: { value: 0.90 },
        uDensity: { value: 0.40 },
        uWeight: { value: 0.30 },
        uSunVisible: { value: 1.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 uSunScreenPos;
        uniform float uIntensity;
        uniform float uDecay;
        uniform float uDensity;
        uniform float uWeight;
        uniform float uSunVisible;
        varying vec2 vUv;

        float pseudoRand(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            
            vec2 deltaUV = (vUv - uSunScreenPos);
            float dist = length(deltaUV);
            deltaUV *= (1.0 / 32.0) * uDensity; 

            float dither = pseudoRand(gl_FragCoord.xy);
            vec2 sampleUV = vUv - (deltaUV * dither);
            
            float illumination = 0.0;
            float currentWeight = uWeight;
            
            for(int i = 0; i < 32; i++) {
                sampleUV -= deltaUV;
                vec4 samp = texture2D(tDiffuse, sampleUV);
                float lum = dot(samp.rgb, vec3(0.299, 0.587, 0.114));
                float bright = smoothstep(0.70, 0.95, lum);
                illumination += bright * currentWeight;
                currentWeight *= uDecay;
            }
            
            float edgeFade = 1.0 - smoothstep(0.4, 1.5, dist);
            vec3 rayColor = vec3(1.0, 0.95, 0.85) * illumination * uIntensity * edgeFade * uSunVisible;
            
            gl_FragColor = vec4(texel.rgb + rayColor, texel.a);
        }
    `
};

export const godRaysPass = new ShaderPass(GodRaysShader);
godRaysPass.enabled = !LOW_GFX;
composer.addPass(godRaysPass);

export const summerPass = new ShaderPass(GhibliSummerShader);
summerPass.enabled = false;
composer.addPass(summerPass);

export const outputPass = new OutputPass();
composer.addPass(outputPass);

export let isSummerFilterOn = false;

export function initPostProcessingUI() {
    const summerBtn = document.getElementById('summer-toggle');
    if (summerBtn) {
        summerBtn.addEventListener('click', () => {
            isSummerFilterOn = !isSummerFilterOn;
            summerPass.enabled = isSummerFilterOn;
            if (typeof window.params !== 'undefined') window.params.summerFilter = isSummerFilterOn;
        });
    }
}
