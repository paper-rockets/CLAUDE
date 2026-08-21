/**
 * OpenSeaOcean.js — Realtime WebGPU / TSL Gerstner Ocean Simulation
 *
 * Core Three.js TSL wave & FBM micro-surface shader adapted from:
 * "Open Sea — Realtime Ocean" (Kimi AI Prototype)
 * https://qdtipu6rd2myk.ok.kimi.link/?id=2077778000455245824&share_id=19f6b13b-b432-8eb2-8000-0000c67df4cd
 *
 * Enhanced for Wanderlust with:
 * - Dynamic interactive GUI & modal editor controls
 * - Dynamic object ripples & Kelvin V-wake shockwave physics
 * - Realtime CPU wave height/normal buoyancy calculations for player & aircraft
 * - Horizon concealment & biome lighting integration
 */

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec2, vec3, vec4,
  sin, cos, atan, abs, dot, cross, normalize, length, mix, pow, max, clamp,
  fract, floor, smoothstep, distance, reflect, step,
  positionLocal, positionWorld, cameraPosition, texture
} from 'three/tsl';

/* ============================================================
   Uniforms — Shared across ocean TSL nodes and GUI Editor
   ============================================================ */
export const timeUniform = uniform(0.00001);
export const seaUniform = uniform(0.45);
export const speedUniform = uniform(1.0);
export const detailAmountUniform = uniform(1.0);
export const foamAmountUniform = uniform(1.0);
export const waterOpacityUniform = uniform(0.92);
export const foamEnabledUniform = uniform(1.0);
export const chopPatchinessUniform = uniform(1.0);
// Gerstner horizontal displacement (Q). Was hardcoded to 0.35, which put the effective Q*ka at
// ~3% of the value where a crest begins to sharpen -- so the surface was a pure sinusoid, and
// waveNormal shaded it as if Q were 1.0. Now a real uniform, and both paths use it.
export const chopStrengthUniform = uniform(0.75);
export const waveHeightUniform = uniform(1.0);
export const oceanScaleUniform = uniform(1.0);
export const swellWavelengthUniform = uniform(1.0);
export const foamDecayUniform = uniform(1.0);
export const qualityModeUniform = uniform(1.0); // 1.0 = High / Cinematic, 0.0 = Performance (High FPS)
export const distanceLodUniform = uniform(1.0); // 1.0 = Distance LOD active, 0.0 = Off
export const lodDistanceThresholdUniform = uniform(1800.0);

export const sunDirUniform = uniform(new THREE.Vector3(0, 1, 0));
export const sunColorUniform = uniform(new THREE.Color(1, 1, 1));
export const horizonColorUniform = uniform(new THREE.Color(0.52, 0.68, 0.82));
export const zenithColorUniform = uniform(new THREE.Color(0.07, 0.2, 0.42));
export const deepColorUniform = uniform(new THREE.Color(0.015, 0.09, 0.11));
export const shallowColorUniform = uniform(new THREE.Color(0.06, 0.32, 0.36));

// Object reaction uniforms
export const objPosUniform = uniform(new THREE.Vector3(0, 0, 0));
export const objRadiusUniform = uniform(2.0);
export const objActiveUniform = uniform(0.0);
export const objRippleStrengthUniform = uniform(1.0);
export const foamSpreadUniform = uniform(0.65);
export const foamOpacityUniform = uniform(1.0);

/* ============================================================
   Shoreline Depth Field — CPU-baked terrain height texture
   (Phase 1 infrastructure. Populated by WaterAnime/TerrainDepthField.js
    via WaterSystem; consumed by the shore shading in colorNode.)

   Sampling contract for the shore shading pass:
     const fieldUv = positionWorld.xz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform);
     const terrainH = terrainDepthTexNode.sample(fieldUv).r;
     const depth    = waterLevelUniform.sub(terrainH);
   `terrainDepthTexNode` is a stable node created at module load, so the
   graph can never capture null. Its bound DataTexture is swapped in by
   setTerrainDepthTexture() before createOpenSeaMaterial() runs.
   Out of bounds the texture clamps to edge, so also mask on fieldUv
   being inside 0..1 and on depthFieldValidUniform before applying shore FX.
   Until the first bake completes every texel reads DEPTH_FIELD_SENTINEL
   (-1000.0) => "very deep", so all shore effects fall away naturally.
   ============================================================ */

// Sentinel height written into unbaked texels. Anything at/below this is "no data".
export const DEPTH_FIELD_SENTINEL = -1000.0;

// 1x1 placeholder so the TSL graph always has a valid, correctly-formatted
// texture bound. Must match the real field's format/type/filters/wrapping so
// the generated WGSL is identical when the real texture is swapped in.
const _depthFieldPlaceholder = new THREE.DataTexture(
  new Float32Array([DEPTH_FIELD_SENTINEL]), 1, 1, THREE.RedFormat, THREE.FloatType
);
_depthFieldPlaceholder.minFilter = THREE.LinearFilter;
_depthFieldPlaceholder.magFilter = THREE.LinearFilter;
_depthFieldPlaceholder.wrapS = THREE.ClampToEdgeWrapping;
_depthFieldPlaceholder.wrapT = THREE.ClampToEdgeWrapping;
_depthFieldPlaceholder.generateMipmaps = false;
_depthFieldPlaceholder.flipY = false;
_depthFieldPlaceholder.unpackAlignment = 1;
_depthFieldPlaceholder.needsUpdate = true;

// Stable texture node. Never reassigned - only its bound texture value changes,
// which THREE.NodeSampledTexture.update() picks up automatically each frame.
export const terrainDepthTexNode = texture(_depthFieldPlaceholder);
// Alias under the name used in WATER_SHORE_PLAN.md; same node object.
export const terrainDepthTexUniform = terrainDepthTexNode;

// Separate node for the VERTEX stage. The vertex shader has no implicit derivatives, so it
// must sample with an explicit LOD; keeping that on its own node avoids forcing the fragment
// path to do the same. Both nodes are rebound together by setTerrainDepthTexture().
export const terrainDepthTexNodeVS = texture(_depthFieldPlaceholder);

/**
 * Binds the baked terrain-height DataTexture to the shared depth-field node.
 * Call this BEFORE createOpenSeaMaterial() so the graph is built against the
 * real texture (a later call still works - the binding is refreshed per frame).
 * @param {THREE.DataTexture} tex
 */
export function setTerrainDepthTexture(tex) {
  if (!tex) return;
  terrainDepthTexNode.value = tex;
  terrainDepthTexNodeVS.value = tex;
}

export const depthFieldOriginUniform  = uniform(new THREE.Vector2(0, 0));
export const depthFieldSizeUniform    = uniform(4000.0);
export const depthFieldValidUniform   = uniform(0.0);   // 0 until the first bake completes
export const waterLevelUniform        = uniform(2.4);   // mirrors openSeaMesh.position.y

export const sandColorUniform         = uniform(new THREE.Color(0.85, 0.80, 0.62));
export const shoreShallowColorUniform = uniform(new THREE.Color(0.32, 0.72, 0.70));
export const shoreDepthUniform        = uniform(6.0);
export const shoreOpacityUniform      = uniform(0.10);
export const shoreFoamWidthUniform    = uniform(2.2);
export const shoreFoamSpeedUniform    = uniform(0.8);
export const shoreFoamStrengthUniform = uniform(1.0);
export const shoreRefractionUniform   = uniform(0.35);

/* ============================================================
   Gerstner Swell — 5 Multi-directional Spectral Components
   ============================================================ */
export let WAVE_PARAMS = [
  // Re-authored 2026-08-21. The previous spectrum (160/88/42/20/9.5 m) put THREE of five
  // components below the Nyquist limit of the 31.25 m vertex grid. Sub-Nyquist waves do not
  // disappear -- they fold back into large coherent ridge families (the 20 m chop aliased into
  // a 139 m ridge train at 7.1 deg, almost exactly along the Z grid axis). That was the
  // corduroy. See WATER_DIAGNOSIS.md part 1.1.
  //
  // Now: the three longest waves carry the geometry (4.5-10.9 samples per wavelength), and
  // everything shorter contributes to the NORMAL only, where there is no vertex grid to alias
  // against. Ridge axes are spread with a 17 deg minimum separation (was 9 deg, which produced
  // near-parallel reinforcing doublets).
  { dir: [ 0.927,  0.375], wavelength: 340.0, steepness: 0.100, phase: 0.0 },  // primary swell
  { dir: [ 0.454,  0.891], wavelength: 215.0, steepness: 0.090, phase: 1.4 },  // secondary swell
  { dir: [ 0.998,  0.070], wavelength: 141.0, steepness: 0.075, phase: 2.8 },  // tertiary swell
  { dir: [-0.087,  0.996], wavelength:  83.0, steepness: 0.060, phase: 4.1 },  // wind wave (partial geo)
  { dir: [-0.743,  0.669], wavelength:  44.0, steepness: 0.050, phase: 5.5 },  // chop (normals only)
  { dir: [-0.906,  0.423], wavelength:  19.0, steepness: 0.038, phase: 2.1 }   // fine chop (normals only)
];

// Vertex spacing of the ocean mesh (16000 / 512). Anything shorter than ~4x this cannot be
// represented in geometry without aliasing.
export const OCEAN_VERTEX_SPACING = 16000.0 / 512.0;   // 31.25 m

const _smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * How much of a wave may be expressed in GEOMETRY.
 * 0 below the Nyquist wavelength, ramping to 1 at 4x the vertex spacing.
 * Waves below the cut still shade (via waveNormal) -- they just stop aliasing the mesh.
 */
export function geometryWeightFor(wavelength) {
  return _smoothstep(2.0 * OCEAN_VERTEX_SPACING, 4.0 * OCEAN_VERTEX_SPACING, wavelength);
}

/**
 * Deep-water phase speed. c = sqrt(g / k), NOT sqrt(g * k).
 *
 * The original code used sqrt(9.8 * k), which is exactly g / c_true -- an INVERTED dispersion
 * relation. It made the 340 m swell travel at 0.62 m/s with a 258 second period, i.e. a still
 * image. This one-line error was the whole of "the water doesn't move".
 */
function phaseSpeedFor(k) {
  return Math.sqrt(9.8 / k);
}

export let WAVES = WAVE_PARAMS.map(({ dir, wavelength, steepness, phase }) => {
  const len = Math.hypot(dir[0], dir[1]) || 1.0;
  const k = (2 * Math.PI) / wavelength;
  return {
    dx: uniform(dir[0] / len),
    dz: uniform(dir[1] / len),
    k: uniform(k),
    c: uniform(phaseSpeedFor(k)),
    steepness: uniform(steepness),
    phase: uniform(phase || 0.00001),
    geo: uniform(geometryWeightFor(wavelength))
  };
});

export function updateWaveUniforms(i) {
  const p = WAVE_PARAMS[i];
  const w = WAVES[i];
  const len = Math.hypot(p.dir[0], p.dir[1]) || 1.0;
  const k = (2 * Math.PI) / p.wavelength;

  w.dx.value = p.dir[0] / len;
  w.dz.value = p.dir[1] / len;
  w.k.value = k;
  w.c.value = phaseSpeedFor(k);
  w.steepness.value = p.steepness;
  w.phase.value = p.phase;
  w.geo.value = geometryWeightFor(p.wavelength);
}

export function randomizeSeaSpectrum() {
  // Previously produced exactly TWO direction clusters and three sub-Nyquist wavelengths.
  // Now: golden-angle direction spread (never clusters) and a wavelength ladder whose top
  // three entries always stay above the geometry cut.
  const base = Math.random() * Math.PI * 2;
  const ladder = [340, 215, 141, 83, 44, 19];
  for (let i = 0; i < WAVES.length; i++) {
    const angle = base + i * 2.39996323 + (Math.random() - 0.5) * 0.35;  // golden angle
    const wavelength = (ladder[i] !== undefined ? ladder[i] : 19) * (0.88 + Math.random() * 0.24);
    const steepness = 0.10 * Math.pow(0.86, i) * (0.85 + Math.random() * 0.3);

    WAVE_PARAMS[i] = {
      dir: [Math.cos(angle), Math.sin(angle)],
      wavelength: Math.max(wavelength, 8.0),
      steepness: Math.max(steepness, 0.01),
      phase: Math.random() * Math.PI * 2
    };
    updateWaveUniforms(i);
  }
}

export function setWindDirection(angleDeg, spreadPercent = 45) {
  // The old version packed all components into a narrow fan with wave 0 exactly on the wind
  // axis -- maximal corduroy, and it permanently discarded the authored directions.
  //
  // Real wind seas ARE directional, but the long swell should stay closest to the wind axis
  // while short chop fans out widest, and no two components should end up near-parallel.
  // Offsets alternate sign and grow with index, scaled to a full +/-75 deg at 100% spread.
  const mainAngleRad = (angleDeg * Math.PI) / 180;
  const spreadFactor = Math.max(0, Math.min(1.5, spreadPercent / 100.0));
  const FAN = [0.10, -0.34, 0.58, -0.82, 1.06, -1.30];   // radians at spread = 1.0
  WAVES.forEach((w, i) => {
    const finalAngle = mainAngleRad + (FAN[i % FAN.length] * spreadFactor);
    WAVE_PARAMS[i].dir[0] = Math.cos(finalAngle);
    WAVE_PARAMS[i].dir[1] = Math.sin(finalAngle);
    w.dx.value = Math.cos(finalAngle);
    w.dz.value = Math.sin(finalAngle);
  });
}

// phase: f = k * (dot(direction, xz) - time * c) + phase
const wavePhase = (w, xz, time) =>
  w.k.mul(dot(vec2(w.dx, w.dz), xz).sub(time.mul(w.c))).add(w.phase);

// displaced surface point for a given parametric xz (sampled in world space for true physical waves)
const wavePosition = Fn(([localXz, time, sea, shallowFade]) => {
  const worldXz = localXz.add(cameraPosition.xz);
  const xz = worldXz.mul(oceanScaleUniform).toVar();
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();
  for (const w of WAVES) {
    // w.geo is 0 for wavelengths the vertex grid cannot represent. Those waves still shade
    // (waveNormal uses them at full strength) but no longer alias the mesh into ridges.
    const a = w.steepness.mul(sea).div(w.k)
      .mul(swellWavelengthUniform).mul(waveHeightUniform)
      .mul(w.geo).mul(shallowFade);
    const f = wavePhase(w, xz, time);
    const q = chopStrengthUniform;
    p.x.addAssign(a.mul(w.dx).mul(cos(f)).mul(q));
    p.y.addAssign(a.mul(sin(f)));
    p.z.addAssign(a.mul(w.dz).mul(cos(f)).mul(q));
  }
  return p;
});

// Outward circular wave ripples and Kelvin V-wake shockwaves produced by object interaction
const objectRippleDisplacement = Fn(([xz, time, objPos, objRadius, objActive, rippleStr]) => {
  const d = xz.sub(objPos.xz);
  const dist = distance(xz, objPos.xz);
  const r = max(dist.sub(objRadius.mul(0.8)), 0.0);
  const fade = smoothstep(16.0, 0.0, r).mul(smoothstep(0.0, 0.3, r));

  const wave1 = sin(dist.mul(2.2).sub(time.mul(3.6)));
  const wave2 = sin(dist.mul(4.8).sub(time.mul(5.2))).mul(0.35);
  const radialPattern = wave1.add(wave2).mul(0.18);

  const vAngle = abs(atan(d.x, d.y));
  const vWakeMask = smoothstep(0.85, 0.25, vAngle).mul(smoothstep(18.0, 0.5, dist));
  const vWakePattern = sin(dist.mul(1.8).sub(time.mul(4.2))).mul(0.26).mul(vWakeMask);

  return radialPattern.add(vWakePattern).mul(fade).mul(objActive).mul(rippleStr);
});

// analytic tangent/binormal derivatives — stable broad normals
const waveNormal = Fn(([rawXz, time, sea, sharpness]) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const tangent = vec3(1.0, 0.0, 0.0).toVar();
  const binormal = vec3(0.0, 0.0, 1.0).toVar();
  for (const w of WAVES) {
    // Now includes swellWavelengthUniform and the real chop strength, so the shading finally
    // describes the surface that is actually being displaced.
    //
    // `sharpness` fades the SHORT waves out with distance. Their normal contribution is what
    // aliases per-pixel into static once a pixel covers more water than a wavelength; the long
    // swell (w.geo == 1) is left untouched so the horizon keeps its shape.
    const shortFade = mix(sharpness, float(1.0), w.geo);
    const q = w.steepness.mul(sea).mul(waveHeightUniform)
      .mul(swellWavelengthUniform).mul(chopStrengthUniform).mul(shortFade);
    const f = wavePhase(w, xz, time);
    const s = sin(f);
    const co = cos(f);
    tangent.x.subAssign(q.mul(w.dx.mul(w.dx)).mul(s));
    tangent.y.addAssign(q.mul(w.dx).mul(co));
    tangent.z.subAssign(q.mul(w.dx.mul(w.dz)).mul(s));
    binormal.x.subAssign(q.mul(w.dx.mul(w.dz)).mul(s));
    binormal.y.addAssign(q.mul(w.dz).mul(co));
    binormal.z.subAssign(q.mul(w.dz.mul(w.dz)).mul(s));
  }
  return normalize(cross(binormal, tangent));
});

// signed crest height, drives tint / subsurface / foam
const waveCrest = Fn(([rawXz, time, sea, shallowFade]) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const h = float(0.0).toVar();
  for (const w of WAVES) {
    const a = w.steepness.mul(sea).div(w.k)
      .mul(swellWavelengthUniform).mul(waveHeightUniform)
      .mul(w.geo).mul(shallowFade);
    h.addAssign(a.mul(sin(wavePhase(w, xz, time))));
  }
  return h;
});

/* ============================================================
   Procedural gradient noise + 3-octave FBM
   ============================================================ */
const hash2 = Fn(([p]) => {
  const h = vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  );
  return fract(sin(h).mul(43758.5453)).mul(2.0).sub(1.0);
});

const gradNoise = Fn(([p]) => {
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));
  const n00 = dot(hash2(i), f);
  const n10 = dot(hash2(i.add(vec2(1.0, 0.0))), f.sub(vec2(1.0, 0.0)));
  const n01 = dot(hash2(i.add(vec2(0.0, 1.0))), f.sub(vec2(0.0, 1.0)));
  const n11 = dot(hash2(i.add(vec2(1.0, 1.0))), f.sub(vec2(1.0, 1.0)));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
});

const fbm = Fn(([p]) =>
  gradNoise(p)
    .add(gradNoise(p.mul(2.04).add(vec2(17.3, 9.1))).mul(0.5))
    .add(gradNoise(p.mul(4.11).add(vec2(42.7, 28.6))).mul(0.25))
);

// animated capillary-scale detail height field
const detailHeight = Fn(([xz, time]) => {
  const driftA = vec2(time.mul(0.55), time.mul(0.32));
  const driftB = vec2(time.mul(-0.4), time.mul(0.5));
  return fbm(xz.mul(0.85).add(driftA)).add(fbm(xz.mul(2.1).add(driftB)).mul(0.45));
});

const skyColor = Fn(([rawDir]) => {
  const dir = normalize(rawDir).toVar();
  const up = clamp(dir.y, -0.15, 1.0);
  const sky = mix(horizonColorUniform, zenithColorUniform, pow(max(up, 0.0), 0.42)).toVar();

  const hazeColor = deepColorUniform.mul(1.4).add(horizonColorUniform.mul(0.25));
  sky.assign(mix(sky, hazeColor, smoothstep(-0.15, 0.0, dir.y).oneMinus()));

  const s = max(dot(dir, sunDirUniform), 0.0);
  sky.addAssign(sunColorUniform.mul(pow(s, 22.0)).mul(0.2));                 
  sky.addAssign(sunColorUniform.mul(smoothstep(0.9994, 0.9998, s)).mul(20.0)); 

  return sky;
});

/* ============================================================
   Shore depth sampling  (Phase 2a — was specified and never written)
   ============================================================ */

/**
 * Water depth in metres at a world XZ, from the CPU-baked terrain height field.
 * Returns a large positive number ("very deep") whenever the field is unavailable, so every
 * shore effect degrades to open ocean rather than popping.
 */
const sampleWaterDepth = Fn(([worldXz]) => {
  const uv = worldXz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform).toVar();
  // The texture clamps to edge, so outside the footprint we must mask explicitly or the
  // border texel would smear a fake shoreline across the whole horizon.
  const inside = step(0.0, uv.x).mul(step(uv.x, 1.0))
    .mul(step(0.0, uv.y)).mul(step(uv.y, 1.0));
  const terrainH = terrainDepthTexNode.sample(uv).r;
  const rawDepth = waterLevelUniform.sub(terrainH);
  // Unbaked texels hold DEPTH_FIELD_SENTINEL (-1000), which yields a huge depth already.
  return mix(float(9999.0), rawDepth, inside.mul(depthFieldValidUniform));
});

/* ============================================================
   Create Open Sea NodeMaterial
   ============================================================ */
export const createOpenSeaMaterial = () => {
  const oceanMaterial = new THREE.MeshBasicNodeMaterial();
  oceanMaterial.transparent = true;
  oceanMaterial.side = THREE.DoubleSide;

  const scaledTime = timeUniform.mul(speedUniform);

  // Waves must die as the water shallows out, or the surface swings several metres up and down
  // through the beach face every cycle (the swinging waterline in WATER_DIAGNOSIS.md 3.7).
  // Sampled at the undisplaced grid position; explicit level 0 because the vertex stage has no
  // derivatives and the field has no mips.
  const vtxWorldXz = positionLocal.xz.add(cameraPosition.xz);
  const vtxUv = vtxWorldXz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform);
  const vtxInside = step(0.0, vtxUv.x).mul(step(vtxUv.x, 1.0))
    .mul(step(0.0, vtxUv.y)).mul(step(vtxUv.y, 1.0));
  const vtxTerrainH = terrainDepthTexNodeVS.sample(vtxUv).level(0).r;
  const vtxDepth = mix(float(9999.0), waterLevelUniform.sub(vtxTerrainH),
                       vtxInside.mul(depthFieldValidUniform));
  const shallowFade = smoothstep(0.0, shoreDepthUniform.mul(0.9), vtxDepth);

  const gerstnerP = wavePosition(positionLocal.xz, scaledTime, seaUniform, shallowFade);
  oceanMaterial.positionNode = vec3(gerstnerP.x, gerstnerP.y, gerstnerP.z);

  oceanMaterial.colorNode = Fn(() => {
    const P = positionWorld.toVar();
    const xz = P.xz;
    const camDist = distance(cameraPosition, P).toVar();

    // Distance LOD factor: 1.0 up close (<250m), smoothly scales down towards distance
    const distLod = smoothstep(lodDistanceThresholdUniform, float(250.0), camDist);
    const effectiveLodFactor = mix(float(1.0), distLod, distanceLodUniform);
    const effectiveQuality = mix(float(0.55), float(1.0), qualityModeUniform);

    // Approximate pixel footprint. Past a few hundred metres a pixel covers more water than a
    // short wavelength, so those normal terms become per-pixel noise. Fading them (rather than
    // leaving them at full strength as before) is the actual fix for the horizon static.
    const footprint = clamp(camDist.div(600.0), 0.0, 1.0).toVar();
    const sharpness = float(1.0).sub(footprint.mul(0.92));

    const depth = sampleWaterDepth(xz).toVar();
    const shallowFadeF = smoothstep(0.0, shoreDepthUniform.mul(0.9), depth).toVar();

    const n0 = waveNormal(xz, scaledTime, seaUniform, sharpness);
    const crest = waveCrest(xz, scaledTime, seaUniform, shallowFadeF).toVar();

    const h0 = detailHeight(xz, scaledTime);
    const hx = detailHeight(xz.add(vec2(0.1, 0.0)), scaledTime);
    const hz = detailHeight(xz.add(vec2(0.0, 0.1)), scaledTime);

    const chopMask = fbm(xz.mul(0.045).add(vec2(scaledTime.mul(0.018), scaledTime.mul(-0.012)))).mul(0.5).add(0.5);
    const nonUniformChop = mix(float(0.35), float(1.65), chopMask.mul(chopPatchinessUniform));
    const crestChopMult = mix(float(0.55), float(1.45), smoothstep(-0.4, 1.1, crest));

    const effectiveDetail = float(1.5)
      .mul(seaUniform.mul(0.6).add(0.4))
      .mul(detailAmountUniform)
      .mul(effectiveLodFactor)
      .mul(effectiveQuality)
      .mul(nonUniformChop)
      .mul(crestChopMult);

    // Divide by the 0.1 m sample epsilon so this is a SLOPE, not a raw height difference --
    // the old form silently scaled the perturbation 10x and tilted normals by up to 35 deg.
    // Also fade it with the pixel footprint so it stops aliasing at distance.
    const detail = vec3(h0.sub(hx), 0.0, h0.sub(hz))
      .mul(effectiveDetail).mul(0.1).mul(sharpness);
    const N = normalize(n0.add(detail)).toVar();

    const V = normalize(cameraPosition.sub(P)).toVar();

    const colorTurbulence = fbm(xz.mul(0.035).add(vec2(scaledTime.mul(0.015), scaledTime.mul(-0.01)))).mul(0.28).mul(effectiveLodFactor);
    const body = mix(
      deepColorUniform,
      shallowColorUniform,
      clamp(crest.mul(0.25).add(0.48).add(colorTurbulence), 0.0, 1.0)
    ).toVar();
    const sss = pow(max(dot(V, sunDirUniform), 0.0), 3.0).mul(max(crest, 0.0)).mul(0.18);
    body.addAssign(mix(shallowColorUniform, sunColorUniform, 0.5).mul(sss));

    // ---- SHORE: depth-graded water colour ----
    // Deep -> shore-shallow -> sand as the bottom rises. Beer-Lambert-ish falloff rather than
    // a linear ramp, so the band hugs the waterline instead of washing halfway out to sea.
    const shoreT = clamp(float(1.0).sub(depth.div(max(shoreDepthUniform, float(0.01)))), 0.0, 1.0).toVar();
    const shoreCurve = shoreT.mul(shoreT).toVar();
    body.assign(mix(body, shoreShallowColorUniform, shoreCurve.mul(0.85)));
    body.assign(mix(body, sandColorUniform, pow(shoreT, 4.0).mul(0.8)));

    const R = reflect(V.negate(), N).toVar();
    R.y.assign(max(R.y, 0.04));
    R.assign(normalize(R));

    const fresnel = float(0.02).add(
      float(0.98).mul(pow(max(dot(N, V), 0.0).oneMinus(), 5.0))
    );
    const color = mix(body, skyColor(R), fresnel).toVar();

    const H = normalize(sunDirUniform.add(V));
    const glitterNoise = fbm(xz.mul(2.1).add(vec2(scaledTime.mul(-0.4), scaledTime.mul(0.5))))
      .mul(0.5).add(0.5);
    // A pow(.,500) lobe is a delta function. Fed a per-pixel-aliased normal it produces
    // isolated blown-out pixels with no coherence -- the TV static. Widen the lobe and drop the
    // gain as the footprint grows, which is the cheap stand-in for proper normal filtering.
    const specPower = mix(float(420.0), float(38.0), footprint);
    const specGain = mix(float(2.6), float(0.30), footprint);
    const NdotH = max(dot(N, H), 0.0).toVar();
    const glitter = pow(NdotH, specPower).mul(mix(float(0.35), specGain, glitterNoise));
    const sheen = pow(NdotH, 48.0).mul(0.12);
    // No 0.4 floor any more -- glitter is allowed to actually fade out at the horizon.
    color.addAssign(sunColorUniform.mul(glitter.add(sheen)).mul(effectiveLodFactor));

    const foamNoise = fbm(xz.mul(1.1).add(vec2(scaledTime.mul(0.22), scaledTime.mul(0.14))))
      .mul(0.5).add(0.5);
    // Open-ocean whitecaps: gated on crest height, as before.
    const capFoam = smoothstep(0.5, 0.95, foamNoise).mul(smoothstep(1.0, 2.0, crest));

    // ---- SHORE: the surf line ----
    // Gated on DEPTH, which is what makes it a shoreline instead of foam that happens to be
    // near the beach. The travelling term gives run-up rather than a static rim.
    const runUp = sin(depth.mul(2.4).sub(scaledTime.mul(shoreFoamSpeedUniform).mul(2.2)))
      .mul(0.5).add(0.5);
    const shoreBand = smoothstep(shoreFoamWidthUniform.mul(2.0), 0.0, depth);
    const waterline = smoothstep(0.35, 0.0, abs(depth)).mul(0.65);
    const shoreFoam = shoreBand.mul(runUp.mul(0.75).add(0.25))
      .mul(foamNoise.mul(0.5).add(0.6))
      .add(waterline)
      .mul(shoreFoamStrengthUniform);

    const foam = capFoam.add(shoreFoam)
      .mul(foamAmountUniform).mul(foamEnabledUniform).mul(foamDecayUniform);

    color.assign(mix(color, vec3(0.92, 0.96, 1.0), clamp(foam.mul(0.85), 0.0, 1.0)));

    // Atmospheric horizon concealment — pushed to far distance to preserve vibrant mid-range ocean
    color.assign(mix(color, horizonColorUniform, smoothstep(8000.0, 15500.0, camDist)));

    // Depth-driven alpha. A flat 0.92 everywhere is why there was no beach: the wet-sand ramp
    // the terrain already paints was sitting under opaque water. Now the water thins out as it
    // shallows, and the land shows through.
    const alpha = mix(shoreOpacityUniform, waterOpacityUniform,
                      smoothstep(0.0, shoreDepthUniform, depth));

    return vec4(color, clamp(alpha, 0.0, 1.0));
  })();

  return oceanMaterial;
};

/* ============================================================
   CPU Wave Physics — for real-time player/boat buoyancy
   ============================================================ */
export function getWaterHeightAt(rawX, rawZ, time, sea) {
  const x = rawX * oceanScaleUniform.value;
  const z = rawZ * oceanScaleUniform.value;
  let y = 0;
  for (const w of WAVES) {
    // Must mirror wavePosition exactly, including the geometry weight -- otherwise buoyancy
    // floats the player on waves the mesh does not actually have.
    const a = (w.steepness.value * sea * swellWavelengthUniform.value * w.geo.value) / w.k.value;
    const f = w.k.value * (w.dx.value * x + w.dz.value * z - time * speedUniform.value * w.c.value) + w.phase.value;
    y += a * Math.sin(f) * waveHeightUniform.value;
  }
  return y;
}

export function getWaterNormalAt(x, z, time, sea) {
  const eps = 0.15;
  const h0 = getWaterHeightAt(x, z, time, sea);
  const hx = getWaterHeightAt(x + eps, z, time, sea);
  const hz = getWaterHeightAt(x, z + eps, time, sea);
  const dx = (hx - h0) / eps;
  const dz = (hz - h0) / eps;
  return new THREE.Vector3(-dx, 1.0, -dz).normalize();
}
