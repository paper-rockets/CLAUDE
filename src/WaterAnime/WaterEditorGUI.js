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

        const fWaves = this.gui.addFolder('🌊 Waves & Scale');
        fWaves.add(oceanScaleUniform, 'value', 0.1, 4.0, 0.05).name('Ocean Scale (Density)');
        fWaves.add(waveHeightUniform, 'value', 0.0, 4.0, 0.05).name('Global Wave Height');
        fWaves.add(swellWavelengthUniform, 'value', 0.2, 4.0, 0.05).name('Swell Wavelength');
        fWaves.add(seaUniform, 'value', 0.0, 2.0, 0.01).name('Sea State (Intensity)');
        fWaves.add(speedUniform, 'value', 0.0, 3.0, 0.05).name('Wave Speed');
        fWaves.add(colors, 'windAngle', 0, 360, 1).name('Wind Direction').onChange(v => {
            setWindDirection(v, colors.windSpread);
        });
        fWaves.add(colors, 'windSpread', 0, 100, 1).name('Directional Spread').onChange(v => {
            setWindDirection(colors.windAngle, v);
        });
        fWaves.add(colors, 'heightY', -20.0, 50.0, 0.1).name('Water Level Y').onChange(v => {
            waterSystem.setHeight(v);
        });

        const fColors = this.gui.addFolder('🎨 Ocean Colors');
        fColors.addColor(colors, 'deep').name('Deep Abyss Color').onChange(c => deepColorUniform.value.set(c));
        fColors.addColor(colors, 'shallow').name('Shallow Crest Color').onChange(c => shallowColorUniform.value.set(c));
        fColors.addColor(colors, 'horizon').name('Horizon Blend Color').onChange(c => horizonColorUniform.value.set(c));
        fColors.addColor(colors, 'zenith').name('Zenith Sky Color').onChange(c => zenithColorUniform.value.set(c));
        fColors.addColor(colors, 'sun').name('Sun Specular Color').onChange(c => sunColorUniform.value.set(c));

        const fSurface = this.gui.addFolder('✨ Surface & Foam');
        fSurface.add(waterOpacityUniform, 'value', 0.1, 1.0, 0.01).name('Water Opacity');
        fSurface.add(detailAmountUniform, 'value', 0.0, 3.0, 0.05).name('Capillary Choppiness');
        fSurface.add(foamAmountUniform, 'value', 0.0, 3.0, 0.05).name('Foam Amount');
        fSurface.add(chopPatchinessUniform, 'value', 0.0, 3.0, 0.05).name('Chop Patchiness');
        fSurface.add(foamEnabledUniform, 'value', 0.0, 1.0, 1.0).name('Foam Enabled (0/1)');

        const fSpectrum = this.gui.addFolder('📊 Spectral Waves');
        fSpectrum.add({ randomize: () => {
            randomizeSeaSpectrum();
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
