import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function setupGodMode(scene, cameraBase, renderer, playerGrp) {
    const godCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 2.0, 30000);
    godCamera.position.set(0, 150, 400);
    cameraBase.add(godCamera);

    const godControls = new OrbitControls(godCamera, renderer.domElement);
    godControls.maxDistance = 25000;
    godControls.maxPolarAngle = Math.PI / 2 + 0.1;
    godControls.zoomSpeed = 3.0;
    godControls.panSpeed = 2.0;
    godControls.enabled = false;
    
    // We update the target initially
    godControls.target.copy(playerGrp.position);
    godControls.update();

    return { godCamera, godControls };
}

export function toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, updateWaterCamera) {
    if (isGodMode) {
        godCamera.position.copy(camera.position);
        godCamera.quaternion.copy(camera.quaternion);
        godControls.enabled = true;
        godControls.target.copy(playerGrp.position);
        godControls.update();
        if (updateWaterCamera) updateWaterCamera(godCamera);
    } else {
        godControls.enabled = false;
        if (updateWaterCamera) updateWaterCamera(camera);
    }
}
