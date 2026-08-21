// Ghibli Biome Tree System
// =========================================================================================
// Procedural, instanced, LOD'd placement of the three Background_Tree_Atlas cards.
//
// WHY THIS IS A NEW MODULE RATHER THAN AN EXTENSION OF THE PINE SYSTEM
//
// The existing pine recycler in main.js places trees with rejection sampling driven by
// Math.random(): up to 14 attempts per instance, capped at 60 attempts per frame across all
// ten species. That has three structural problems this system avoids:
//
//   1. It is not deterministic. Fly away and come back and the forest is different, so trees
//      visibly pop into new places.
//   2. It is starved. The per-frame attempt cap means dense forest fills in slowly enough to
//      watch it happen.
//   3. It is expensive. Every rejected attempt still pays for getWorldHeight, getBiomeAt and
//      getPathStrength -- the same heavy noise chain the terrain rebuild uses.
//
// Instead, placement here is a pure function of world position: hash the cell coordinates,
// get the same trees back every time, forever. No sampling loop, no popping, and minimum
// spacing comes free from the cell size rather than from a neighbour search.
//
// ASSET NOTES (verified by inspecting the GLBs)
//
//   - 36-109 triangles each. Geometry is a non-issue; ten thousand of these is 700K tris.
//     The real cost is FILL RATE from double-sided alpha-masked overdraw, which is why the
//     LOD bands below cut fragment work rather than triangles.
//   - All three files embed BYTE-IDENTICAL textures (base colour md5 5ae66749...). Loaded
//     naively that is 9 uploads of 1024x1024 instead of 1. We share one.
//   - Normal and roughness maps do nothing under a toon material, which quantises lighting to
//     a gradient ramp. Both are dropped, along with the TANGENT attribute that only existed
//     to support them.
//   - Every mesh already carries a custom `_IS_CANOPY` vertex attribute (0 = trunk, 1 = canopy).
//     GLTFLoader lowercases unknown attributes, so it arrives as `_is_canopy`. That is the
//     trunk/canopy split, supplied by the artist -- no geometry surgery needed.

import * as THREE from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import {
    Fn, vec3, vec4, float, uniform, attribute, texture, uv, mix, clamp,
    smoothstep, positionLocal, positionGeometry, modelWorldMatrix, fract, sin, cos, max
} from 'three/tsl';

const TREE_FILES = [
    { key: 'ghibli_bg_001', path: 'assets/Trees/Ghibli/Background_Tree_Atlas_001_alt.glb', targetHeight: 17.0 },
    { key: 'ghibli_bg_002', path: 'assets/Trees/Ghibli/Background_Tree_Atlas_002_alt.glb', targetHeight: 12.0 },
    { key: 'ghibli_bg_003', path: 'assets/Trees/Ghibli/Background_Tree_Atlas_003_alt.glb', targetHeight: 13.5 }
];

// LOD bands. Note these differ in MATERIAL, not geometry -- at ~100 triangles a mesh there is
// nothing worth decimating, and every millisecond is in the fragment stage.
//
// Raising alphaTest with distance is the important trick: it discards more fragments earlier,
// which directly buys back the fill rate alpha-masked foliage costs, and it reduces the shimmer
// thin alpha edges produce once they are smaller than a pixel.
const LOD_BANDS = [
    { name: 'near', maxDist: 140,  doubleSided: true,  sway: true,  alphaTest: 0.35 },
    { name: 'mid',  maxDist: 420,  doubleSided: false, sway: true,  alphaTest: 0.50 },
    { name: 'far',  maxDist: 1100, doubleSided: false, sway: false, alphaTest: 0.62 }
];

const DEFAULT_CELL_SIZE = 34.0;  // world units; also the effective minimum tree spacing
const REBUILD_DISTANCE = 55.0;   // rebuild the field once the focus has moved this far
const REBUILD_FRAMES = 18;       // spread one rebuild across this many frames

/** Deterministic 0..1 hash. Same cell always yields the same trees, forever. */
function cellHash(cx, cz, slot) {
    let h = Math.imul(cx, 374761393) + Math.imul(cz, 668265263) + Math.imul(slot, 2654435761);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class GhibliTreeSystem {
    constructor(opts) {
        this.scene = opts.scene;
        this.gltfLoader = opts.gltfLoader;
        this.resolveAssetUrl = opts.resolveAssetUrl || ((p) => p);
        this.uTime = opts.uTime;
        this.gradientMap = opts.gradientMap || null;
        this.getWorldHeight = opts.getWorldHeight;
        this.getBiomeAt = opts.getBiomeAt;
        this.getIslandData = opts.getIslandData;
        this.getPathStrength = opts.getPathStrength || (() => 0);
        this.densityScale = opts.densityScale !== undefined ? opts.densityScale : 1.0;

        this.ready = false;
        this.enabled = true;
        this.meshes = [];            // flat list, for visibility toggles
        this._byVariantBand = [];    // [variantIndex][bandIndex] -> InstancedMesh
        this._dummy = new THREE.Object3D();
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._walk = null;          // in-flight sliced cell walk, or null
        this._collected = [];
        this.lastCounts = { near: 0, mid: 0, far: 0 };

        // ----- Editable appearance -----
        // Multiplied against the atlas rather than replacing it, so painted detail survives
        // while the palette stays fully editable.
        this.uCanopyShadow = uniform(new THREE.Color(0x2c5233));
        this.uCanopyLit    = uniform(new THREE.Color(0x6aa34a));
        this.uCanopyTip    = uniform(new THREE.Color(0x9ec96a));
        this.uTrunkBase    = uniform(new THREE.Color(0x3d2b1c));
        this.uTrunkTop     = uniform(new THREE.Color(0x6b4c33));
        this.uTintSpread   = uniform(0.18);
        this.uAtlasMix     = uniform(0.75);   // 0 = flat palette, 1 = raw atlas colours
        this.uWindStrength = uniform(1.0);
        this.uTreeScale    = uniform(1.0);

        // Pool sizes per band, scaled by device tier
        const d = this.densityScale;
        this.poolSizes = {
            near: Math.max(24, Math.round(700 * d)),
            mid:  Math.max(48, Math.round(1600 * d)),
            far:  Math.max(64, Math.round(2800 * d))
        };

        // Placement rules — overridable live from the GUI
        this.minElevation = 6.8;
        this.maxElevation = 58.0;
        this.maxSlope = 0.55;
        this.density = 1.0;
        this.scaleMul = 1.0;
        this.cellSize = DEFAULT_CELL_SIZE;
    }

    // ---------------------------------------------------------------------------------
    // LOADING
    // ---------------------------------------------------------------------------------
    async load() {
        const gltfs = await Promise.all(TREE_FILES.map(f =>
            new Promise((res, rej) => this.gltfLoader.load(this.resolveAssetUrl(f.path), res, undefined, rej))
        ));

        // Share ONE base-colour texture across all three variants. The files embed identical
        // images, so loading them separately would be 9 uploads of 1024x1024 (~48 MB with
        // mips) instead of 1 (~5.3 MB).
        let sharedAtlas = null;
        for (const gltf of gltfs) {
            gltf.scene.traverse(c => {
                if (!sharedAtlas && c.isMesh && c.material && c.material.map) sharedAtlas = c.material.map;
            });
            if (sharedAtlas) break;
        }
        if (sharedAtlas) {
            sharedAtlas.colorSpace = THREE.SRGBColorSpace;
            sharedAtlas.anisotropy = 4;
            sharedAtlas.generateMipmaps = true;
            sharedAtlas.minFilter = THREE.LinearMipmapLinearFilter;
        }
        this.atlas = sharedAtlas;

        gltfs.forEach((gltf, vi) => {
            const geo = this._extractGeometry(gltf, TREE_FILES[vi].targetHeight);
            if (!geo) return;
            const row = [];
            LOD_BANDS.forEach((band) => {
                const mat = this._buildMaterial(band);
                const pool = this.poolSizes[band.name];
                // Split each band's pool across the three variants
                const count = Math.max(8, Math.round(pool / TREE_FILES.length));
                const mesh = new THREE.InstancedMesh(geo, mat, count);
                mesh.name = `${TREE_FILES[vi].key}_${band.name}`;
                mesh.castShadow = false;         // alpha-masked foliage in a shadow map is
                mesh.receiveShadow = true;       // expensive and reads as noise at this scale
                mesh.count = 0;                  // nothing placed yet
                // Explicit bounding sphere: the mesh is recycled around the player so the
                // computed one goes stale instantly. Setting it by hand is what lets us keep
                // frustum culling ON, unlike the pine meshes which switch it off entirely.
                mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), band.maxDist + 60);
                mesh.frustumCulled = false;      // re-enabled once the sphere is positioned
                this.scene.add(mesh);
                row.push(mesh);
                this.meshes.push(mesh);
            });
            this._byVariantBand.push(row);
        });

        this.ready = this._byVariantBand.length > 0;
        return this.ready;
    }

    /**
     * Flatten the GLTF into one geometry: bake node transforms, normalise height, drop the
     * attributes a toon material cannot use, and guarantee `_is_canopy` exists.
     */
    _extractGeometry(gltf, targetHeight) {
        gltf.scene.updateMatrixWorld(true);
        let source = null;
        gltf.scene.traverse(c => { if (!source && c.isMesh) source = c; });
        if (!source) return null;

        const g = source.geometry.clone();
        g.applyMatrix4(source.matrixWorld);

        g.computeBoundingBox();
        const bb = g.boundingBox;
        const h = bb.max.y - bb.min.y;
        const s = h > 0 ? targetHeight / h : 1.0;
        g.translate(0, -bb.min.y, 0);   // sit exactly on the ground
        g.scale(s, s, s);

        // TANGENT exists only to support the normal map, which a toon material ignores.
        // 16 bytes per vertex of pure waste.
        if (g.attributes.tangent) g.deleteAttribute('tangent');
        if (g.attributes.color) g.deleteAttribute('color');

        // GLTFLoader lowercases unknown attributes, so _IS_CANOPY arrives as _is_canopy.
        // Fall back to "everything above the base is canopy" if a file ever ships without it.
        if (!g.attributes._is_canopy) {
            const n = g.attributes.position.count;
            const arr = new Float32Array(n);
            const posArr = g.attributes.position;
            for (let i = 0; i < n; i++) arr[i] = posArr.getY(i) > targetHeight * 0.28 ? 1 : 0;
            g.setAttribute('_is_canopy', new THREE.BufferAttribute(arr, 1));
        }

        g.computeBoundingBox();
        g.computeBoundingSphere();
        return g;
    }

    // ---------------------------------------------------------------------------------
    // MATERIAL
    // ---------------------------------------------------------------------------------
    _buildMaterial(band) {
        const mat = new MeshToonNodeMaterial({
            gradientMap: this.gradientMap || undefined,
            side: band.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
            transparent: false,
            alphaTest: band.alphaTest,
            depthWrite: true,
            dithering: true
        });

        const isCanopy = attribute('_is_canopy', 'float');
        const atlasSample = this.atlas ? texture(this.atlas, uv()) : null;

        mat.colorNode = Fn(() => {
            const localY = clamp(positionLocal.y.div(16.0), 0.0, 1.0);

            // Per-instance hash from the instance's world origin, for subtle tonal variety
            // between neighbouring trees.
            const origin = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
            const instHash = fract(sin(origin.x.mul(12.9898).add(origin.z.mul(78.233))).mul(43758.5453));
            const tint = float(1.0).sub(this.uTintSpread.mul(0.5)).add(instHash.mul(this.uTintSpread));

            // Canopy ramp: shadow at the base of the crown, lit through the middle, bright tips
            const canopyLow = mix(this.uCanopyShadow, this.uCanopyLit, smoothstep(float(0.10), float(0.62), localY));
            const canopyCol = mix(canopyLow, this.uCanopyTip, smoothstep(float(0.58), float(0.98), localY)).mul(tint);

            // Trunk ramp: dark at ground contact, warmer where light reaches it
            const trunkCol = mix(this.uTrunkBase, this.uTrunkTop, smoothstep(float(0.0), float(0.45), localY));

            const palette = mix(trunkCol, canopyCol, isCanopy);

            if (!atlasSample) return palette;
            // Multiply, don't replace: the atlas keeps its painted detail while the ramps
            // above stay fully editable from the GUI.
            const tinted = atlasSample.rgb.mul(palette).mul(2.0);
            return mix(palette, tinted, this.uAtlasMix);
        })();

        if (atlasSample) mat.opacityNode = atlasSample.a;

        if (band.sway) {
            // Sway is weighted by _is_canopy AND by height, so trunks stay rigid and only the
            // crown moves. The whole term is scaled by uWindStrength so it can be turned off.
            mat.positionNode = Fn(() => {
                const p = positionLocal.toVar();
                const origin = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));

                const w1 = sin(this.uTime.mul(1.5).add(origin.x.mul(0.03)).add(origin.z.mul(0.025))).mul(0.055);
                const w2 = cos(this.uTime.mul(2.6).add(origin.x.mul(0.06)).add(origin.z.mul(0.04))).mul(0.028);
                const gust = sin(this.uTime.mul(4.0).add(origin.x.mul(0.12))).mul(0.012);

                const heightF = max(0.0, positionGeometry.y).div(16.0);
                const swayAmt = w1.add(w2).add(gust)
                    .mul(heightF.mul(1.5))
                    .mul(isCanopy)                 // trunk does not move
                    .mul(this.uWindStrength);

                p.x.addAssign(swayAmt);
                p.z.addAssign(swayAmt.mul(0.7));
                return p;
            })();
        }

        return mat;
    }

    // ---------------------------------------------------------------------------------
    // PLACEMENT
    // ---------------------------------------------------------------------------------
    /** True if a tree may stand here. Same tests the pine system uses, plus a slope check. */
    _isValidSite(x, z) {
        const biome = this.getBiomeAt(x, z);
        if (!biome || !biome.name || !biome.name.includes('Ghibli')) return null;

        const island = this.getIslandData(x, z);
        if (!island || island.mask < 0.35) return null;

        const h = this.getWorldHeight(x, z);
        if (h < this.minElevation || h > this.maxElevation) return null;

        if (this.getPathStrength(x, z) >= 0.20) return null;

        // Slope: trees should not grow out of cliff faces. Two taps, not four -- this runs
        // for every candidate and the island cache makes the neighbours nearly free.
        const hx = this.getWorldHeight(x + 8, z);
        const hz = this.getWorldHeight(x, z + 8);
        const slope = Math.max(Math.abs(hx - h), Math.abs(hz - h)) / 8.0;
        if (slope > this.maxSlope) return null;

        return h;
    }

    /**
     * Visit one cell and append any trees it contains to `out`.
     * Pure function of (cx, cz) -- the same cell always produces the same trees.
     */
    _visitCell(cx, cz, focusX, focusZ, maxDistSq, out) {
        // Cheap circular reject before touching any noise
        const ddx = (cx + 0.5) * this.cellSize - focusX;
        const ddz = (cz + 0.5) * this.cellSize - focusZ;
        const distSq = ddx * ddx + ddz * ddz;
        if (distSq > maxDistSq) return;

        // How many trees this cell wants, from its own hash. Density scales the threshold
        // rather than the count, so lowering it thins the forest evenly instead of
        // deleting whole cells.
        const fill = cellHash(cx, cz, 0);
        const d = this.density;
        let slots = 0;
        if (fill < 0.62 * d) slots = 1;
        if (fill < 0.34 * d) slots = 2;
        if (fill < 0.12 * d) slots = 3;
        if (slots <= 0) return;

        for (let s = 0; s < slots; s++) {
            const jx = cellHash(cx, cz, s * 3 + 1);
            const jz = cellHash(cx, cz, s * 3 + 2);
            const x = (cx + jx) * this.cellSize;
            const z = (cz + jz) * this.cellSize;

            const h = this._isValidSite(x, z);
            if (h === null) continue;

            const r = cellHash(cx, cz, s * 3 + 3);
            // Species from a low-frequency field, so you get groves of one type rather
            // than an even shuffle of all three. 18% mixed undergrowth breaks up the edges.
            const grove = Math.sin(x * 0.0016) * Math.cos(z * 0.0013);
            let variant;
            if (r < 0.18) variant = Math.floor(cellHash(cx, cz, s * 3 + 4) * TREE_FILES.length);
            // Thresholds are the measured 33/67 quantiles of sin*cos, so the three species get
            // equal share globally. Locally the field still favours one, which is the point --
            // that is what makes groves instead of an even shuffle.
            else variant = grove < -0.2097 ? 0 : (grove < 0.2093 ? 1 : 2);
            variant = Math.min(TREE_FILES.length - 1, Math.max(0, variant));

            out.push({
                x, y: h, z,
                variant,
                rot: r * Math.PI * 2.0,
                scale: (0.85 + cellHash(cx, cz, s * 3 + 5) * 0.34) * this.scaleMul,
                dist: Math.sqrt(distSq)
            });
        }
    }

    /** Full synchronous collection. Used by tooling and tests; the frame path slices it. */
    _collectCandidates(focusX, focusZ) {
        const maxDist = LOD_BANDS[LOD_BANDS.length - 1].maxDist;
        const R = Math.ceil(maxDist / this.cellSize);
        const baseCX = Math.floor(focusX / this.cellSize);
        const baseCZ = Math.floor(focusZ / this.cellSize);
        const out = [];
        for (let dz = -R; dz <= R; dz++)
            for (let dx = -R; dx <= R; dx++)
                this._visitCell(baseCX + dx, baseCZ + dz, focusX, focusZ, maxDist * maxDist, out);
        return out;
    }

    /** Write the collected candidates into the right InstancedMesh for their distance band. */
    _commit(focusX, focusZ) {
        const perMeshCount = this._byVariantBand.map(row => row.map(() => 0));
        const dummy = this._dummy;

        // Nearest first, so if a pool overflows it is the far trees that get dropped
        this._collected.sort((a, b) => a.dist - b.dist);

        for (const c of this._collected) {
            let band = -1;
            for (let b = 0; b < LOD_BANDS.length; b++) {
                if (c.dist <= LOD_BANDS[b].maxDist) { band = b; break; }
            }
            if (band < 0) continue;

            const row = this._byVariantBand[c.variant];
            if (!row) continue;
            const mesh = row[band];
            if (!mesh) continue;

            const idx = perMeshCount[c.variant][band];
            if (idx >= mesh.instanceMatrix.count) continue;   // pool full; drop the farthest

            dummy.position.set(c.x, c.y, c.z);
            dummy.rotation.set(0, c.rot, 0);
            dummy.scale.setScalar(c.scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(idx, dummy.matrix);
            perMeshCount[c.variant][band] = idx + 1;
        }

        const counts = { near: 0, mid: 0, far: 0 };
        this._byVariantBand.forEach((row, vi) => {
            row.forEach((mesh, bi) => {
                mesh.count = perMeshCount[vi][bi];
                mesh.instanceMatrix.needsUpdate = true;
                // Keep the bounding sphere centred on the focus so culling stays correct
                mesh.boundingSphere.center.set(focusX, 0, focusZ);
                mesh.boundingSphere.radius = LOD_BANDS[bi].maxDist + 60;
                mesh.frustumCulled = true;
                counts[LOD_BANDS[bi].name] += mesh.count;
            });
        });
        this.lastCounts = counts;
    }

    // ---------------------------------------------------------------------------------
    // PER-FRAME
    // ---------------------------------------------------------------------------------
    update(focusX, focusZ) {
        if (!this.ready || !this.enabled) return;

        // ---- Continue an in-flight walk before considering a new one ----
        // Collection is the expensive half (it calls the same noise chain the terrain rebuild
        // uses), so the CELL WALK itself is sliced across frames, not just the buffer write.
        // A full sweep at this radius is ~30ms in one burst; spread over 18 frames it is ~1.7ms
        // and never shows up as a hitch.
        if (this._walk) {
            const w = this._walk;
            const perFrame = Math.ceil(w.total / REBUILD_FRAMES);
            const end = Math.min(w.total, w.i + perFrame);

            for (let i = w.i; i < end; i++) {
                const dx = (i % w.width) - w.radius;
                const dz = ((i / w.width) | 0) - w.radius;
                this._visitCell(w.baseCX + dx, w.baseCZ + dz, w.focusX, w.focusZ, w.maxDistSq, this._collected);
            }
            w.i = end;

            if (w.i >= w.total) {
                // Commit only once the whole field is known, so the instance buffer is never
                // shown half-populated.
                this._commit(w.focusX, w.focusZ);
                this._walk = null;
            }
            return;
        }

        const moved = Math.hypot(focusX - this._lastFocusX, focusZ - this._lastFocusZ);
        if (moved < REBUILD_DISTANCE) return;

        this._lastFocusX = focusX;
        this._lastFocusZ = focusZ;

        const maxDist = LOD_BANDS[LOD_BANDS.length - 1].maxDist;
        const radius = Math.ceil(maxDist / this.cellSize);
        const width = radius * 2 + 1;
        this._collected = [];
        this._walk = {
            baseCX: Math.floor(focusX / this.cellSize),
            baseCZ: Math.floor(focusZ / this.cellSize),
            focusX, focusZ,
            radius, width,
            total: width * width,
            maxDistSq: maxDist * maxDist,
            i: 0
        };
    }

    /**
     * Cell size IS the minimum-spacing guarantee, so the Min Spacing slider maps onto it
     * directly. Clamped: below ~14 the walk visits far more cells for little visual gain.
     */
    setCellSize(v) {
        const next = Math.max(14.0, Math.min(90.0, v));
        if (Math.abs(next - this.cellSize) < 0.01) return;
        this.cellSize = next;
        this.respawn();
    }

    /** Force a full rebuild — used when a placement rule changes from the GUI. */
    respawn() {
        this._lastFocusX = Infinity;
        this._lastFocusZ = Infinity;
        this._walk = null;
        this._collected = [];
    }

    setVisible(v) {
        this.enabled = v;
        this.meshes.forEach(m => { m.visible = v; });
    }

    setColor(which, hex) {
        const u = {
            canopyShadow: this.uCanopyShadow, canopyLit: this.uCanopyLit, canopyTip: this.uCanopyTip,
            trunkBase: this.uTrunkBase, trunkTop: this.uTrunkTop
        }[which];
        if (u) u.value.set(hex);
    }

    dispose() {
        this.meshes.forEach(m => {
            this.scene.remove(m);
            if (m.material) m.material.dispose();
        });
        this.meshes.length = 0;
        this._byVariantBand.length = 0;
    }
}

export { TREE_FILES, LOD_BANDS };
