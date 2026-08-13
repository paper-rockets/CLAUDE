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
  updateWaveUniforms
} from './OpenSeaOcean.js';

export class WaterEditorGUI {
    constructor(waterSystem, parentGui = null) {
        this.waterSystem = waterSystem;

        if (parentGui) {
            this.gui = parentGui.addFolder('🌊 Open Sea Ocean Editor');
        } else {
            this.gui = new GUI({ title: '🌊 Open Sea Ocean Editor' });
        }

        // Color helpers (hex strings for lil-gui)
        const colors = {
            deep: '#' + deepColorUniform.value.getHexString(),
            shallow: '#' + shallowColorUniform.value.getHexString(),
            horizon: '#' + horizonColorUniform.value.getHexString(),
            zenith: '#' + zenithColorUniform.value.getHexString(),
            sun: '#' + sunColorUniform.value.getHexString(),
            heightY: waterSystem.openSeaMesh ? waterSystem.openSeaMesh.position.y : 2.4
        };

        // 1. Ocean Dynamics & Waves
        const fWaves = this.gui.addFolder('🌊 Waves & Dynamics');
        fWaves.add(seaUniform, 'value', 0.0, 2.0, 0.01).name('Sea State / Wave Intensity');
        fWaves.add(waveHeightUniform, 'value', 0.0, 3.0, 0.05).name('Wave Height Mult');
        fWaves.add(speedUniform, 'value', 0.0, 3.0, 0.05).name('Wave Speed');
        fWaves.add(oceanScaleUniform, 'value', 0.1, 3.0, 0.05).name('Wave Scale');
        fWaves.add(swellWavelengthUniform, 'value', 0.2, 3.0, 0.05).name('Swell Wavelength');
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
        const fSpectrum = this.gui.addFolder('📊 Spectral Swell Waves (10 Waves)');
        WAVE_PARAMS.forEach((p, i) => {
            const sub = fSpectrum.addFolder(`Wave ${i + 1} (${p.wavelength.toFixed(1)}m)`);
            sub.add(p, 'wavelength', 0.5, 150.0, 0.5).name('Wavelength').onChange(() => updateWaveUniforms(i));
            sub.add(p, 'steepness', 0.0, 0.25, 0.005).name('Steepness').onChange(() => updateWaveUniforms(i));
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
