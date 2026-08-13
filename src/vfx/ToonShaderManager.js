import * as THREE from 'three';

export class ToonShaderManager {
    constructor() {
        this.enabled = false;
        
        // Create a 3-step toon gradient map (shadow, mid, highlight)
        const colors = new Uint8Array(3);
        colors[0] = 100; // Shadow
        colors[1] = 200; // Mid
        colors[2] = 255; // Highlight
        this.gradientMap = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
        this.gradientMap.needsUpdate = true;
        this.gradientMap.minFilter = THREE.NearestFilter;
        this.gradientMap.magFilter = THREE.NearestFilter;
    }

    /**
     * Toggles the toon shader on or off for the entire scene.
     */
    toggle(scene, enable) {
        this.enabled = enable;
        
        scene.traverse((child) => {
            if (child.isMesh && child.material) {
                // If turning ON
                if (this.enabled) {
                    // Check if it's already a toon material
                    if (child.material.type === 'MeshToonMaterial') return;
                    
                    // Store original material so we can restore it later
                    if (!child.userData.originalMaterial) {
                        child.userData.originalMaterial = child.material;
                    }

                    // Create equivalent Toon Material
                    const origMat = child.material;
                    const toonMat = new THREE.MeshToonMaterial({
                        color: origMat.color,
                        map: origMat.map,
                        normalMap: origMat.normalMap,
                        vertexColors: origMat.vertexColors,
                        transparent: origMat.transparent,
                        opacity: origMat.opacity,
                        side: origMat.side,
                        alphaTest: origMat.alphaTest,
                        gradientMap: this.gradientMap
                    });
                    
                    child.material = toonMat;
                } 
                // If turning OFF
                else {
                    if (child.userData.originalMaterial) {
                        child.material = child.userData.originalMaterial;
                        // Don't delete userData.originalMaterial in case they toggle it again
                    }
                }
            }
        });
    }
}
