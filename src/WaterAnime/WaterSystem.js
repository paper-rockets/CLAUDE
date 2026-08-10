import { WaterFloor } from './WaterFloor.js';
import { SeabedFloor } from './SeabedFloor.js';
import { WaterDepthIntersection } from './WaterDepthIntersection.js';
import { WaterSparkles } from './WaterSparkles.js';
import { WaterWaveSimulation } from './WaterWaveSimulation.js';
import { RippleStore } from './RippleStore.js';

export class WaterSystem {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;

        // Shared stores and config
        this.rippleStore = new RippleStore();

        // Defaults mapping from Leva configurations
        this.controls = {
            waterScale: 0.025,
            cellSmoothness: 0.55,
            edgeThreshold: 0.067,
            edgeSoftness: 0.01,
            flowX: 0,
            flowZ: 0.05,
            cellSpeed: 0.30,
            noiseScale: 0.015,
            noiseFlowSpeed: 0.20,
            distortAmount: 0.30,
            deepColor: "#1a3a5c",
            midColor: "#59c0e8",
            midPos: 0.084,
            highlightColor: "#ffffff",
            opacity: 1.0,
            deepOpacity: 0.45,
            fadeDistance: 2500,
            fadeStrength: 1.4,
            
            // Seabed
            seabedDepth: -30.0,
            seabedScale: 0.0035,
            seabedCellSpeed: 0.49,
            seabedFlowX: 0.0,
            seabedFlowZ: -0.11,
            seabedEdgeThreshold: 0.06,
            seabedEdgeSoftness: 0.03,
            seabedDeepColor: "#1aaae8",
            seabedHighlightColor: "#177096",
            seabedFadeDistance: 2500,
            seabedFadeStrength: 2,

            // Sparkles
            sparkleCount: 100,
            sparkleSpread: 1000,
            sparkleHeightOffset: 0.97,
            sparkleMinSize: 3,
            sparkleMaxSize: 6,
            sparkleMinLife: 0.7,
            sparkleMaxLife: 2.8,
            sparkleColor: "#e5d2d2",
            sparkleIntensity: 1.8,
            sparkleArmSharpness: 27.0,
            sparkleArmFalloff: 4.8,
            sparkleGlowRadius: 12,

            // Intersection
            intersectionEnabled: true,
            intersectionLineWidth: 10.0,
            intersectionGlowWidth: 40.0,
            intersectionLineColor: "#ffffff",
            intersectionLineOpacity: 1.0,
            intersectionGlowColor: "#88ccff",
            intersectionGlowOpacity: 0.25,

            // Waves Simulation
            waveEnabled: true,
            waveSpeed: 0.08,
            waveDamping: 0.993,
            waveBorderWidth: 2.5,
            waveInjectStr: 0.21,
            waveInjectAmp: 1,
            waveInjectInterval: 0.8,
            waveBandWidth: 200.0,
            waveGradScale: 1.0,
            waveRingThreshold: 0.54,
            waveEdgeSharpness: 0.91,
            waveSizeMul: 2.7,
            waveColor: "#ffffff",
            waveOpacity: 0.75,
            
            // Ripple store config
            rippleSpeed: 60.0,
            rippleWidth: 5.0,
            rippleDecay: 1.6,
            rippleStrength: 5.5,
            rippleRings: 2,
            rippleSpacing: 40.0
        };

        // Initialize components
        this.seabed = new SeabedFloor(this.scene);
        this.waterFloor = new WaterFloor(this.scene);
        this.intersection = new WaterDepthIntersection(this.scene, this.renderer);
        this.sparkles = new WaterSparkles(this.scene);
        this.waves = new WaterWaveSimulation(this.scene, this.renderer);
        
        this.visible = false;
        this.setVisible(false);
    }

    setVisible(visible) {
        this.visible = visible;
        if (this.seabed && this.seabed.mesh) this.seabed.mesh.visible = visible;
        if (this.waterFloor && this.waterFloor.mesh) this.waterFloor.mesh.visible = visible;
        if (this.intersection && this.intersection.mesh) this.intersection.mesh.visible = visible;
        if (this.sparkles && this.sparkles.mesh) this.sparkles.mesh.visible = visible;
        if (this.waves && this.waves.mesh) this.waves.mesh.visible = visible;
    }

    addIntersectingMesh(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                this.intersection.addMeshToIntersect(child);
                this.waves.addMeshToIntersect(child);
            }
        });
    }

    emitRipple(x, z, t) {
        this.rippleStore.add(x, z, t);
    }

    update(dt, elapsedTime, camera) {
        if (!this.visible) return;
        try {
            // Map controls to ripple config
            this.rippleStore.setConfig({
                speed: this.controls.rippleSpeed,
                width: this.controls.rippleWidth,
                decay: this.controls.rippleDecay,
                strength: this.controls.rippleStrength,
                rings: this.controls.rippleRings,
                spacing: this.controls.rippleSpacing
            });

            // 1. Update Seabed
            if (this.seabed) {
                this.seabed.update(dt, elapsedTime, camera, {
                    seabedScale: this.controls.seabedScale,
                    cellSpeed: this.controls.seabedCellSpeed,
                    flowX: this.controls.seabedFlowX,
                    flowZ: this.controls.seabedFlowZ,
                    edgeThreshold: this.controls.seabedEdgeThreshold,
                    edgeSoftness: this.controls.seabedEdgeSoftness,
                    deepColor: this.controls.seabedDeepColor,
                    highlightColor: this.controls.seabedHighlightColor,
                    fadeDistance: this.controls.seabedFadeDistance,
                    fadeStrength: this.controls.seabedFadeStrength,
                    seabedDepth: this.controls.seabedDepth
                });
            }

            // 2. Update Main Water Floor
            if (this.waterFloor && this.waterFloor.material) {
                const wfU = this.waterFloor.material.uniforms;
                if (wfU) {
                    if (wfU.uScale) wfU.uScale.value = this.controls.waterScale;
                    if (wfU.uSmoothness) wfU.uSmoothness.value = this.controls.cellSmoothness;
                    if (wfU.uEdgeThreshold) wfU.uEdgeThreshold.value = this.controls.edgeThreshold;
                    if (wfU.uEdgeSoftness) wfU.uEdgeSoftness.value = this.controls.edgeSoftness;
                    if (wfU.uFlowX) wfU.uFlowX.value = this.controls.flowX;
                    if (wfU.uFlowZ) wfU.uFlowZ.value = this.controls.flowZ;
                    if (wfU.uCellSpeed) wfU.uCellSpeed.value = this.controls.cellSpeed;
                    if (wfU.uNoiseScale) wfU.uNoiseScale.value = this.controls.noiseScale;
                    if (wfU.uNoiseFlowSpeed) wfU.uNoiseFlowSpeed.value = this.controls.noiseFlowSpeed;
                    if (wfU.uDistortAmount) wfU.uDistortAmount.value = this.controls.distortAmount;
                    if (wfU.uDeepColor) wfU.uDeepColor.value.set(this.controls.deepColor);
                    if (wfU.uMidColor) wfU.uMidColor.value.set(this.controls.midColor);
                    if (wfU.uMidPos) wfU.uMidPos.value = this.controls.midPos;
                    if (wfU.uHighlight) wfU.uHighlight.value.set(this.controls.highlightColor);
                    if (wfU.uOpacity) wfU.uOpacity.value = this.controls.opacity;
                    if (wfU.uDeepOpacity) wfU.uDeepOpacity.value = this.controls.deepOpacity;
                    if (wfU.uFadeDistance) wfU.uFadeDistance.value = this.controls.fadeDistance;
                    if (wfU.uFadeStrength) wfU.uFadeStrength.value = this.controls.fadeStrength;
                }
                this.waterFloor.update(dt, elapsedTime, camera, this.rippleStore);
            }

            // 3. Update Sparkles
            if (this.sparkles) {
                this.sparkles.update(dt, elapsedTime, camera, {
                    count: this.controls.sparkleCount,
                    spread: this.controls.sparkleSpread,
                    heightOffset: this.controls.sparkleHeightOffset,
                    minSize: this.controls.sparkleMinSize,
                    maxSize: this.controls.sparkleMaxSize,
                    minLife: this.controls.sparkleMinLife,
                    maxLife: this.controls.sparkleMaxLife,
                    color: this.controls.sparkleColor,
                    intensity: this.controls.sparkleIntensity,
                    armSharpness: this.controls.sparkleArmSharpness,
                    armFalloff: this.controls.sparkleArmFalloff,
                    glowRadius: this.controls.sparkleGlowRadius
                });
            }

            // 4. Update Depth Intersection Render
            if (this.intersection) {
                this.intersection.updateAndRender(camera, {
                    enabled: this.controls.intersectionEnabled,
                    lineWidth: this.controls.intersectionLineWidth,
                    glowWidth: this.controls.intersectionGlowWidth,
                    lineColor: this.controls.intersectionLineColor,
                    lineOpacity: this.controls.intersectionLineOpacity,
                    glowColor: this.controls.intersectionGlowColor,
                    glowOpacity: this.controls.intersectionGlowOpacity
                });
            }

            // 5. Update Wave Simulation
            if (this.waves) {
                this.waves.updateAndRender(dt, elapsedTime, camera, {
                    enabled: this.controls.waveEnabled,
                    speed: this.controls.waveSpeed,
                    damping: this.controls.waveDamping,
                    borderWidth: this.controls.waveBorderWidth,
                    injectStr: this.controls.waveInjectStr,
                    injectAmp: this.controls.waveInjectAmp,
                    injectInterval: this.controls.waveInjectInterval,
                    bandWidth: this.controls.waveBandWidth,
                    gradScale: this.controls.waveGradScale,
                    ringThreshold: this.controls.waveRingThreshold,
                    edgeSharpness: this.controls.waveEdgeSharpness,
                    waveSizeMul: this.controls.waveSizeMul,
                    color: this.controls.waveColor,
                    opacity: this.controls.waveOpacity
                });
            }
        } catch (err) {
            console.error("WaterSystem update error:", err);
        }
    }

    dispose() {
        this.seabed.dispose(this.scene);
        this.waterFloor.dispose(this.scene);
        this.intersection.dispose(this.scene);
        this.sparkles.dispose(this.scene);
        this.waves.dispose(this.scene);
    }
}
