import * as THREE from 'three';
import { LOW_GFX } from '../config/constants.js';

const container = document.getElementById('app');

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8cbce6);
scene.fog = new THREE.Fog(0x8cbce6, 100, 1800);

export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 2.0, 30000);
camera.position.set(0, 9, 26);

export const renderer = new THREE.WebGLRenderer({ 
    antialias: !LOW_GFX, 
    preserveDrawingBuffer: false, 
    powerPreference: 'high-performance', 
    logarithmicDepthBuffer: false 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(LOW_GFX ? 0.5 : Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = !LOW_GFX;
renderer.shadowMap.type = LOW_GFX ? THREE.BasicShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.8;

if (container) {
    container.appendChild(renderer.domElement);
}

export const clock = new THREE.Clock();
