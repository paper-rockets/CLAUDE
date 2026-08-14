import * as THREE from 'three';
import {
  createOpenSeaMaterial,
  timeUniform,
  seaUniform,
  speedUniform,
  detailAmountUniform,
  foamAmountUniform,
  waterOpacityUniform,
  waveHeightUniform,
  oceanScaleUniform,
  swellWavelengthUniform,
  deepColorUniform,
  shallowColorUniform,
  horizonColorUniform,
  zenithColorUniform,
  sunColorUniform,
  sunDirUniform,
  objPosUniform,
  objActiveUniform,
  getWaterHeightAt,
  getWaterNormalAt
} from './OpenSeaOcean.js';

export class WaterSystem {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;

        // Large high-density ocean plane geometry with 512x512 subdivisions
        const oceanGeometry = new THREE.PlaneGeometry(16000, 16000, 512, 512);
        oceanGeometry.rotateX(-Math.PI / 2);

        this.openSeaMaterial = createOpenSeaMaterial();
        this.openSeaMesh = new THREE.Mesh(oceanGeometry, this.openSeaMaterial);
        this.openSeaMesh.frustumCulled = false;
        this.openSeaMesh.position.y = 2.4;
        this.scene.add(this.openSeaMesh);

        this.visible = true;
    }

    setVisible(visible) {
        this.visible = visible;
        if (this.openSeaMesh) this.openSeaMesh.visible = visible;
    }

    setHeight(y) {
        if (this.openSeaMesh) this.openSeaMesh.position.y = y;
    }

    getWaterHeight(x, z, time = 0) {
        const baseHeight = this.openSeaMesh ? this.openSeaMesh.position.y : 2.4;
        return baseHeight + getWaterHeightAt(x, z, time || timeUniform.value, seaUniform.value);
    }

    getWaterNormal(x, z, time = 0) {
        return getWaterNormalAt(x, z, time || timeUniform.value, seaUniform.value);
    }

    update(dt, elapsedTime, camera, playerPos = null, sunDir = null) {
        if (!this.visible) return;

        timeUniform.value = elapsedTime;

        if (sunDir) {
            sunDirUniform.value.copy(sunDir).normalize();
        }

        // Ocean plane follows camera in XZ for infinite horizon
        if (this.openSeaMesh && camera) {
            this.openSeaMesh.position.x = camera.position.x;
            this.openSeaMesh.position.z = camera.position.z;
        }

        // Player tracking
        if (playerPos) {
            objPosUniform.value.copy(playerPos);
        }
        objActiveUniform.value = 0.0;
    }

    dispose() {
        if (this.openSeaMesh) {
            this.scene.remove(this.openSeaMesh);
            this.openSeaMesh.geometry.dispose();
            this.openSeaMesh.material.dispose();
        }
    }
}
