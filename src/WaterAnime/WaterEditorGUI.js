import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

export class WaterEditorGUI {
    constructor(waterSystem, parentGui = null) {
        this.waterSystem = waterSystem;
        const ctrls = this.waterSystem.controls;
        
        if (parentGui) {
            this.gui = parentGui.addFolder('Anime Water Controls');
        } else {
            this.gui = new GUI({ title: 'Anime Water Controls' });
        }
        
        // Hide by default if embedded
        if (parentGui) this.gui.hide();
        
        // Water Floor
        const wf = this.gui.addFolder('Water Floor');
        wf.add(ctrls, 'waterScale', 0.001, 0.05, 0.001).name('Scale');
        wf.add(ctrls, 'cellSmoothness', 0, 2, 0.01).name('Cell Smoothness');
        wf.add(ctrls, 'edgeThreshold', 0, 0.3, 0.005).name('Edge Threshold');
        wf.add(ctrls, 'edgeSoftness', 0, 0.1, 0.005).name('Edge Softness');
        wf.add(ctrls, 'flowX', -0.5, 0.5, 0.01).name('Flow X');
        wf.add(ctrls, 'flowZ', -0.5, 0.5, 0.01).name('Flow Z');
        wf.add(ctrls, 'cellSpeed', 0, 3, 0.05).name('Cell Anim Speed');
        wf.add(ctrls, 'noiseScale', 0.001, 0.1, 0.001).name('Noise Scale');
        wf.add(ctrls, 'noiseFlowSpeed', 0, 2, 0.01).name('Noise Flow Speed');
        wf.add(ctrls, 'distortAmount', 0, 3, 0.01).name('Distort Amount');
        wf.addColor(ctrls, 'deepColor').name('Deep Color');
        wf.addColor(ctrls, 'midColor').name('Mid Color');
        wf.add(ctrls, 'midPos', 0.001, 0.999, 0.001).name('Mid Pos');
        wf.addColor(ctrls, 'highlightColor').name('Highlight Color');
        wf.add(ctrls, 'opacity', 0, 1, 0.01).name('Opacity');
        wf.add(ctrls, 'deepOpacity', 0, 1, 0.01).name('Deep Opacity');
        wf.add(ctrls, 'fadeDistance', 10, 5000, 50).name('Fade Distance');
        wf.add(ctrls, 'fadeStrength', 0.1, 5, 0.1).name('Fade Strength');
        wf.close();

        // Seabed
        const sb = this.gui.addFolder('Seabed');
        sb.add(ctrls, 'seabedDepth', -100, -1, 1).name('Depth Y');
        sb.add(ctrls, 'seabedScale', 0.001, 0.02, 0.001).name('Scale');
        sb.add(ctrls, 'seabedCellSpeed', 0, 2, 0.01).name('Cell Speed');
        sb.add(ctrls, 'seabedFlowX', -0.5, 0.5, 0.005).name('Flow X');
        sb.add(ctrls, 'seabedFlowZ', -0.5, 0.5, 0.005).name('Flow Z');
        sb.add(ctrls, 'seabedEdgeThreshold', 0, 0.3, 0.005).name('Edge Threshold');
        sb.add(ctrls, 'seabedEdgeSoftness', 0, 0.1, 0.005).name('Edge Softness');
        sb.addColor(ctrls, 'seabedDeepColor').name('Deep Color');
        sb.addColor(ctrls, 'seabedHighlightColor').name('Highlight Color');
        sb.add(ctrls, 'seabedFadeDistance', 10, 5000, 50).name('Fade Distance');
        sb.add(ctrls, 'seabedFadeStrength', 0.1, 5, 0.1).name('Fade Strength');
        sb.close();

        // Sparkles
        const sp = this.gui.addFolder('Water Sparkles');
        sp.add(ctrls, 'sparkleCount', 0, 500, 1).name('Count');
        sp.add(ctrls, 'sparkleSpread', 100, 3000, 10).name('Spread Radius');
        sp.add(ctrls, 'sparkleHeightOffset', 0, 2, 0.01).name('Height Offset');
        const spSize = sp.addFolder('Size');
        spSize.add(ctrls, 'sparkleMinSize', 1, 150, 1).name('Min Size');
        spSize.add(ctrls, 'sparkleMaxSize', 1, 300, 1).name('Max Size');
        const spLife = sp.addFolder('Lifetime');
        spLife.add(ctrls, 'sparkleMinLife', 0.1, 10, 0.1).name('Min Life (s)');
        spLife.add(ctrls, 'sparkleMaxLife', 0.1, 15, 0.1).name('Max Life (s)');
        const spApp = sp.addFolder('Appearance');
        spApp.addColor(ctrls, 'sparkleColor').name('Color');
        spApp.add(ctrls, 'sparkleIntensity', 0.1, 15, 0.1).name('Intensity');
        spApp.add(ctrls, 'sparkleArmSharpness', 1, 40, 0.5).name('Arm Sharpness');
        spApp.add(ctrls, 'sparkleArmFalloff', 0.1, 8, 0.1).name('Arm Falloff');
        spApp.add(ctrls, 'sparkleGlowRadius', 0.5, 12, 0.1).name('Glow Radius');
        sp.close();

        // Intersection
        const intF = this.gui.addFolder('Intersection');
        intF.add(ctrls, 'intersectionEnabled').name('Enabled');
        intF.add(ctrls, 'intersectionLineWidth', 1.0, 50.0, 0.5).name('Line Width (world)');
        intF.add(ctrls, 'intersectionGlowWidth', 1.0, 200.0, 1.0).name('Glow Width (world)');
        const intLine = intF.addFolder('Line');
        intLine.addColor(ctrls, 'intersectionLineColor').name('Color');
        intLine.add(ctrls, 'intersectionLineOpacity', 0, 1, 0.01).name('Opacity');
        const intGlow = intF.addFolder('Glow');
        intGlow.addColor(ctrls, 'intersectionGlowColor').name('Color');
        intGlow.add(ctrls, 'intersectionGlowOpacity', 0, 1, 0.01).name('Opacity');
        intF.close();

        // Waves Simulation
        const wav = this.gui.addFolder('Wave Simulation');
        wav.add(ctrls, 'waveEnabled').name('Enabled');
        const wavProp = wav.addFolder('Propagation');
        wavProp.add(ctrls, 'waveSpeed', 0.005, 0.49, 0.001).name('Wave Speed');
        wavProp.add(ctrls, 'waveDamping', 0.90, 0.9999, 0.0001).name('Damping');
        wavProp.add(ctrls, 'waveBorderWidth', 0.1, 10.0, 0.1).name('Border Absorption');
        const wavInj = wav.addFolder('Injection');
        wavInj.add(ctrls, 'waveInjectStr', 0.0, 1.0, 0.01).name('Strength');
        wavInj.add(ctrls, 'waveInjectAmp', 0.1, 1.0, 0.01).name('Amplitude');
        wavInj.add(ctrls, 'waveInjectInterval', 0.1, 5.0, 0.1).name('Interval (s)');
        wavInj.add(ctrls, 'waveBandWidth', 1.0, 500.0, 1.0).name('Band Width (world)');
        const wavDisp = wav.addFolder('Display');
        wavDisp.add(ctrls, 'waveGradScale', 0.5, 60.0, 0.5).name('Grad Scale');
        wavDisp.add(ctrls, 'waveRingThreshold', 0.05, 1.0, 0.01).name('Ring Threshold');
        wavDisp.add(ctrls, 'waveEdgeSharpness', 0.0, 1.0, 0.01).name('Edge Sharpness');
        wavDisp.add(ctrls, 'waveSizeMul', 1.0, 10.0, 0.1).name('Region Size');
        wavDisp.addColor(ctrls, 'waveColor').name('Color');
        wavDisp.add(ctrls, 'waveOpacity', 0.0, 1.0, 0.01).name('Opacity');
        wav.close();

        // Ripples (Manual trigger)
        const ripF = this.gui.addFolder('Ripples');
        ripF.add(ctrls, 'rippleSpeed').name('Speed');
        ripF.add(ctrls, 'rippleWidth').name('Width');
        ripF.add(ctrls, 'rippleDecay').name('Decay');
        ripF.add(ctrls, 'rippleStrength').name('Strength');
        ripF.add(ctrls, 'rippleRings').name('Rings');
        ripF.add(ctrls, 'rippleSpacing').name('Spacing');
        
        // Debug manual trigger button
        const rippleDebug = {
            trigger: () => {
                const pos = {x: (Math.random()-0.5)*20, z: (Math.random()-0.5)*20};
                this.waterSystem.emitRipple(pos.x, pos.z, performance.now() / 1000);
            }
        };
        ripF.add(rippleDebug, 'trigger').name('Trigger Random Ripple');
        ripF.close();
    }

    show() {
        if (this.gui) this.gui.show();
    }

    hide() {
        if (this.gui) this.gui.hide();
    }
}
