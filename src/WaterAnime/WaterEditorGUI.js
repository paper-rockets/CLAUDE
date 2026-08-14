import * as THREE from 'three';
import {
  seaUniform,
  speedUniform,
  detailAmountUniform,
  foamAmountUniform,
  waterOpacityUniform,
  waveHeightUniform,
  oceanScaleUniform,
  swellWavelengthUniform,
  foamEnabledUniform,
  chopPatchinessUniform,
  deepColorUniform,
  shallowColorUniform,
  horizonColorUniform,
  zenithColorUniform,
  sunColorUniform,
  WAVE_PARAMS,
  updateWaveUniforms,
  setWindDirection,
  randomizeSeaSpectrum
} from './OpenSeaOcean.js';

export class WaterEditorGUI {
    constructor(waterSystem, parentGui = null) {
        this.waterSystem = waterSystem;

        if (parentGui) {
            this.gui = parentGui.addFolder('🌊 Ocean & Waves (Kimi Sea)');
        } else {
            this.gui = new GUI({ title: '🌊 Ocean & Waves (Kimi Sea)' });
        }

        // Quick button to open full floating modal UI
        this.gui.add({ openModal: () => { if (window.waterModalUI) window.waterModalUI.toggle(); } }, 'openModal').name('🌊 Open Sea Modal (O)');

        // Performance & Quality Controls
        const fPerf = this.gui.addFolder('⚡ Quality & Performance');
        const perfState = {
            quality: 'High (Cinematic)',
            resolution: '512x512 (Ultra)',
            distanceLod: true
        };

        fPerf.add(perfState, 'quality', ['High (Cinematic)', 'Performance (High FPS)']).name('Shader Mode').onChange(v => {
            const mode = v.startsWith('High') ? 'high' : 'performance';
            waterSystem.setQualityMode(mode);
            perfState.resolution = mode === 'high' ? '512x512 (Ultra)' : '128x128 (Fast)';
            if (window.waterModalUI) window.waterModalUI.syncQualityUI();
        });

        fPerf.add(perfState, 'resolution', ['512x512 (Ultra)', '256x256 (Balanced)', '128x128 (Fast)']).name('Mesh Density').onChange(v => {
            const res = v.split('x')[0];
            waterSystem.setMeshResolution(res);
            if (window.waterModalUI) window.waterModalUI.syncQualityUI();
        });

        fPerf.add(perfState, 'distanceLod').name('Distance LOD').onChange(v => {
            waterSystem.setDistanceLod(v);
            if (window.waterModalUI) window.waterModalUI.syncQualityUI();
        });

        // Color helpers (hex strings for lil-gui)
        const colors = {
            deep: '#' + deepColorUniform.value.getHexString(),
            shallow: '#' + shallowColorUniform.value.getHexString(),
            horizon: '#' + horizonColorUniform.value.getHexString(),
            zenith: '#' + zenithColorUniform.value.getHexString(),
            sun: '#' + sunColorUniform.value.getHexString(),
            heightY: waterSystem.openSeaMesh ? waterSystem.openSeaMesh.position.y : 2.4,
            windAngle: 138,
            windSpread: 45
        };

        // 1. Ocean Scale, Dynamics & Waves
        const fWaves = this.gui.addFolder('🌊 Waves & Scale');
        fWaves.add(oceanScaleUniform, 'value', 0.1, 4.0, 0.05).name('Ocean Scale (Density)').onChange(() => {
            const el = document.getElementById('oc-oceanScale');
            const valEl = document.getElementById('oc-oceanScaleVal');
            if (el) el.value = Math.round(oceanScaleUniform.value * 100);
            if (valEl) valEl.textContent = `${Math.round(oceanScaleUniform.value * 100)}%`;
        });
        fWaves.add(waveHeightUniform, 'value', 0.0, 4.0, 0.05).name('Global Wave Height').onChange(() => {
            const el = document.getElementById('oc-waveHeight');
            const valEl = document.getElementById('oc-waveHeightVal');
            if (el) el.value = Math.round(waveHeightUniform.value * 100);
            if (valEl) valEl.textContent = `${Math.round(waveHeightUniform.value * 100)}%`;
        });
        fWaves.add(swellWavelengthUniform, 'value', 0.2, 4.0, 0.05).name('Swell Wavelength').onChange(() => {
            const el = document.getElementById('oc-swellLength');
            const valEl = document.getElementById('oc-swellLengthVal');
            if (el) el.value = Math.round(swellWavelengthUniform.value * 100);
            if (valEl) valEl.textContent = `${Math.round(swellWavelengthUniform.value * 100)}%`;
        });
        fWaves.add(seaUniform, 'value', 0.0, 2.0, 0.01).name('Sea State (Intensity)').onChange(() => {
            const el = document.getElementById('oc-seaState');
            const valEl = document.getElementById('oc-seaStateVal');
            if (el) el.value = Math.round(seaUniform.value * 100);
            if (valEl) valEl.textContent = `${Math.round(seaUniform.value * 100)}`;
        });
        fWaves.add(speedUniform, 'value', 0.0, 3.0, 0.05).name('Wave Speed');
        fWaves.add(colors, 'windAngle', 0, 360, 1).name('Wind Direction').onChange(v => {
            setWindDirection(v, colors.windSpread);
            if (window.waterModalUI) window.waterModalUI.updateSpectrumUI();
        });
        fWaves.add(colors, 'windSpread', 0, 100, 1).name('Directional Spread').onChange(v => {
            setWindDirection(colors.windAngle, v);
            if (window.waterModalUI) window.waterModalUI.updateSpectrumUI();
        });
        fWaves.add(colors, 'heightY', -20.0, 50.0, 0.1).name('Water Level Y').onChange(v => {
            waterSystem.setHeight(v);
        });

        // 2. Water Colors
        const fColors = this.gui.addFolder('🎨 Ocean Colors');
        fColors.addColor(colors, 'deep').name('Deep Abyss Color').onChange(c => deepColorUniform.value.set(c));
        fColors.addColor(colors, 'shallow').name('Shallow Crest Color').onChange(c => shallowColorUniform.value.set(c));
        fColors.addColor(colors, 'horizon').name('Horizon Blend Color').onChange(c => horizonColorUniform.value.set(c));
        fColors.addColor(colors, 'zenith').name('Zenith Sky Color').onChange(c => zenithColorUniform.value.set(c));
        fColors.addColor(colors, 'sun').name('Sun Specular Color').onChange(c => sunColorUniform.value.set(c));

        // 3. Surface, Foam & Shading
        const fSurface = this.gui.addFolder('✨ Surface & Foam');
        fSurface.add(waterOpacityUniform, 'value', 0.1, 1.0, 0.01).name('Water Opacity');
        fSurface.add(detailAmountUniform, 'value', 0.0, 3.0, 0.05).name('Capillary Choppiness');
        fSurface.add(foamAmountUniform, 'value', 0.0, 3.0, 0.05).name('Foam Amount');
        fSurface.add(chopPatchinessUniform, 'value', 0.0, 3.0, 0.05).name('Chop Patchiness');
        fSurface.add(foamEnabledUniform, 'value', 0.0, 1.0, 1.0).name('Foam Enabled (0/1)');

        // 4. Multi-directional Spectral Swell Waves
        const fSpectrum = this.gui.addFolder('📊 Spectral Waves');
        fSpectrum.add({ randomize: () => {
            randomizeSeaSpectrum();
            if (window.waterModalUI) window.waterModalUI.updateSpectrumUI();
        } }, 'randomize').name('🎲 Randomize Wave Spectrum');

        WAVE_PARAMS.forEach((p, i) => {
            const sub = fSpectrum.addFolder(`Wave ${i + 1} (${p.wavelength.toFixed(1)}m)`);
            sub.add(p, 'wavelength', 2.0, 300.0, 1.0).name('Wavelength (m)').onChange(() => updateWaveUniforms(i));
            sub.add(p, 'steepness', 0.0, 0.4, 0.005).name('Steepness').onChange(() => updateWaveUniforms(i));
            sub.add(p, 'phase', 0.0, Math.PI * 2, 0.05).name('Phase').onChange(() => updateWaveUniforms(i));
            sub.close();
        });
        fSpectrum.close();
    }

    show() {
        if (this.gui) this.gui.show();
    }

    hide() {
        if (this.gui) this.gui.hide();
    }
}
