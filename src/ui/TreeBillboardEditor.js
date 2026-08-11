import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Tree presets definition
export const TREE_PRESETS = [
    {
        key: 'pine_ultra_fast',
        name: 'Pine (Ultra Fast)',
        glbPath: 'assets/Pine_ultra_fast.glb',
        billboardPath: 'assets/tree_billboard_1.png',
        targetHeight: 22.0,
        baseColorHex: '#52c439'
    },
    {
        key: 'pine_1_ultra_fast',
        name: 'Pine Alt (Ultra Fast 1)',
        glbPath: 'assets/Pine_1_ultra_fast.glb',
        billboardPath: 'assets/tree_billboard_2.png',
        targetHeight: 22.0,
        baseColorHex: '#2ea84b'
    },
    {
        key: 'pine_crystal',
        name: 'Pine Crystal',
        glbPath: 'assets/Pine_Crystal.glb',
        billboardPath: 'assets/pine light.png',
        targetHeight: 24.0,
        baseColorHex: '#44c838'
    },
    {
        key: 'tree_oak1',
        name: 'Oak 1',
        glbPath: 'assets/tree_oak1.glb',
        billboardPath: 'assets/tree_billboard_3.png',
        targetHeight: 18.0,
        baseColorHex: '#64d848'
    },
    {
        key: 'tree_oak2',
        name: 'Oak 2',
        glbPath: 'assets/tree_oak2.glb',
        billboardPath: 'assets/tree_billboard_4.png',
        targetHeight: 18.0,
        baseColorHex: '#38b000'
    },
    {
        key: 'tree_oak3',
        name: 'Oak 3',
        glbPath: 'assets/tree_oak3.glb',
        billboardPath: 'assets/tree_billboard_1.png',
        targetHeight: 18.0,
        baseColorHex: '#52c439'
    },
    {
        key: 'normal_tree_5',
        name: 'Normal Tree 5',
        glbPath: 'assets/NormalTree_5.glb',
        billboardPath: 'assets/tree_billboard_2.png',
        targetHeight: 20.0,
        baseColorHex: '#2ea84b'
    },
    {
        key: 'palm1_var5',
        name: 'Palm 1 VAR5',
        glbPath: 'assets/Palm1_VAR5/Palm1_VAR5.glb',
        billboardPath: 'assets/Palm1_VAR5/preview.png',
        targetHeight: 20.0,
        baseColorHex: '#2ea84b'
    }
];

// Dynamically discover other tree assets from the public/assets directory
try {
    const glbModules = import.meta.glob('/public/assets/*.glb', { query: '?url', import: 'default', eager: true });
    const pngModules = import.meta.glob('/public/assets/*.png', { query: '?url', import: 'default', eager: true });

    const isPathPreset = (path, type) => {
        const norm = path.toLowerCase().replace(/^\//, '');
        return TREE_PRESETS.some(p => {
            const pPath = (type === 'glb' ? p.glbPath : p.billboardPath).toLowerCase();
            return norm === pPath || norm === 'public/' + pPath;
        });
    };

    Object.keys(glbModules).forEach(glbKey => {
        const glbUrl = glbModules[glbKey];
        if (isPathPreset(glbKey, 'glb')) return; // Skip if already defined

        const filename = glbKey.split('/').pop();
        const baseName = filename.substring(0, filename.lastIndexOf('.'));
        const cleanBase = baseName.toLowerCase();

        // Search for a matching PNG billboard texture
        let matchedPngUrl = null;
        Object.keys(pngModules).forEach(pngKey => {
            const pngFilename = pngKey.split('/').pop();
            const pngBase = pngFilename.substring(0, pngFilename.lastIndexOf('.')).toLowerCase();
            if (pngBase === cleanBase || pngBase === cleanBase + '_billboard' || pngBase === cleanBase + '_bb' || pngBase === cleanBase + '-billboard') {
                matchedPngUrl = pngModules[pngKey];
            }
        });

        if (!matchedPngUrl) {
            // Check if name contains it
            Object.keys(pngModules).forEach(pngKey => {
                const pngFilename = pngKey.split('/').pop().toLowerCase();
                if (pngFilename.includes(cleanBase)) {
                    matchedPngUrl = pngModules[pngKey];
                }
            });
        }

        const finalPngUrl = matchedPngUrl || 'assets/tree_billboard_1.png';

        TREE_PRESETS.push({
            key: cleanBase.replace(/[^a-z0-9]/g, '_'),
            name: baseName.replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            glbPath: glbUrl.replace(/^\//, '').replace(/^public\//, ''),
            billboardPath: typeof finalPngUrl === 'string' ? finalPngUrl.replace(/^\//, '').replace(/^public\//, '') : finalPngUrl,
            targetHeight: 20.0,
            baseColorHex: '#52c439'
        });
    });
} catch (e) {
    console.warn('Dynamic tree preset scanning failed:', e);
}

// Helper: RGB (0..1) to HSL (0..1)
export function rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h, s, l];
}

// Helper: HSL (0..1) to RGB (0..1)
export function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return [r, g, b];
}

// Helper: Safe material cloning
export function cloneMat(mat) {
    if (!mat) return mat;
    if (Array.isArray(mat)) {
        return mat.map(m => (m && typeof m.clone === 'function') ? m.clone() : m);
    }
    return (typeof mat.clone === 'function') ? mat.clone() : mat;
}

export function getColorHSL(colorObj) {
    const target = { h: 0, s: 0, l: 0 };
    if (colorObj === null || colorObj === undefined) return target;

    try {
        if (typeof colorObj.getHSL === 'function') {
            colorObj.getHSL(target);
            return target;
        }
        const c = new THREE.Color(colorObj);
        c.getHSL(target);
        return target;
    } catch (e) {
        return target;
    }
}

function applySingleMatHSL(mat, origMat, hShift, sShift, lShift) {
    if (!mat) return mat;
    const newMat = (typeof mat.clone === 'function') ? mat.clone() : mat;
    if (newMat.color !== undefined && newMat.color !== null) {
        const origColor = (origMat && origMat.color !== undefined) ? origMat.color : newMat.color;
        const origHSL = getColorHSL(origColor);

        let nh = (origHSL.h + hShift) % 1.0;
        if (nh < 0) nh += 1.0;
        let ns = Math.max(0.0, Math.min(1.0, origHSL.s + sShift));
        let nl = Math.max(0.0, Math.min(1.0, origHSL.l + lShift));

        if (typeof newMat.color.setHSL === 'function') {
            newMat.color.setHSL(nh, ns, nl);
        } else {
            newMat.color = new THREE.Color().setHSL(nh, ns, nl);
        }
    }
    return newMat;
}

export function applyMatHSL(mat, origMat, hShift, sShift, lShift) {
    if (!mat) return mat;
    if (Array.isArray(mat)) {
        const origArr = Array.isArray(origMat) ? origMat : [origMat];
        return mat.map((m, i) => applySingleMatHSL(m, origArr[i] || m, hShift, sShift, lShift));
    }
    return applySingleMatHSL(mat, origMat || mat, hShift, sShift, lShift);
}

// Helper: Apply separate HSL shifts to HTML5 Canvas ImageData for Leaves and Bark
export function applyHSLToCanvas(sourceImg, targetCanvas, leafHueShift, leafSatShift, leafLitShift, barkHueShift, barkSatShift, barkLitShift) {
    const ctx = targetCanvas.getContext('2d');
    const width = sourceImg.naturalWidth || sourceImg.width || 512;
    const height = sourceImg.naturalHeight || sourceImg.height || 512;

    targetCanvas.width = width;
    targetCanvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(sourceImg, 0, 0, width, height);

    if (leafHueShift === 0 && leafSatShift === 0 && leafLitShift === 0 &&
        barkHueShift === 0 && barkSatShift === 0 && barkLitShift === 0) {
        return;
    }

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const lhShift = leafHueShift / 360.0;
    const lsShift = leafSatShift / 100.0;
    const llShift = leafLitShift / 100.0;

    const bhShift = barkHueShift / 360.0;
    const bsShift = barkSatShift / 100.0;
    const blShift = barkLitShift / 100.0;

    for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 5) continue;

        const r = data[i] / 255.0;
        const g = data[i + 1] / 255.0;
        const b = data[i + 2] / 255.0;

        const [h, s, l] = rgbToHsl(r, g, b);

        // Classification: Green/yellowish/redish colors are leaves, others are bark
        // The green leaves in presets have hues in range [0.12, 0.55]
        const isLeaf = (h >= 0.12 && h <= 0.55);

        const hShift = isLeaf ? lhShift : bhShift;
        const sShift = isLeaf ? lsShift : bsShift;
        const lShift = isLeaf ? llShift : blShift;

        let nh = (h + hShift) % 1.0;
        if (nh < 0) nh += 1.0;

        let ns = Math.max(0.0, Math.min(1.0, s + sShift));
        let nl = Math.max(0.0, Math.min(1.0, l + lShift));

        const [nr, ng, nb] = hslToRgb(nh, ns, nl);

        data[i]     = Math.round(nr * 255.0);
        data[i + 1] = Math.round(ng * 255.0);
        data[i + 2] = Math.round(nb * 255.0);
    }

    ctx.putImageData(imgData, 0, 0);
}

export class TreeBillboardEditor {
    static instance = null;

    constructor(mainScene, mainCamera, gltfLoader) {
        if (TreeBillboardEditor.instance) {
            return TreeBillboardEditor.instance;
        }
        TreeBillboardEditor.instance = this;

        this.mainScene = mainScene;
        this.mainCamera = mainCamera;
        this.gltfLoader = gltfLoader || new GLTFLoader();

        this.currentPresetKey = TREE_PRESETS[0].key;
        this.leafHueShift = 0;
        this.leafSatShift = 0;
        this.leafLitShift = 0;
        this.barkHueShift = 0;
        this.barkSatShift = 0;
        this.barkLitShift = 0;

        // Map storing variants: presetKey -> Array of variant objects (max 4)
        this.variantsMap = new Map();
        TREE_PRESETS.forEach(preset => {
            const defaultColor = new THREE.Color(preset.baseColorHex);
            this.variantsMap.set(preset.key, [
                {
                    id: 'orig_' + preset.key,
                    name: 'Original Base',
                    leafHueShift: 0,
                    leafSatShift: 0,
                    leafLitShift: 0,
                    barkHueShift: 0,
                    barkSatShift: 0,
                    barkLitShift: 0,
                    colorHex: preset.baseColorHex,
                    colorObj: defaultColor.clone(),
                    isDefault: true
                }
            ]);
        });

        this.offscreenCanvas = document.createElement('canvas');
        this.loadedBillboards = new Map(); // path -> HTMLImageElement
        this.loadedGLTFScenes = new Map(); // key -> THREE.Group cloneable

        this.isPanelVisible = false;
        this.applyCallbacks = [];

        this.initUI();
        this.initPreviewScene();
        this.loadCurrentPreset();
    }

    static getInstance() {
        return TreeBillboardEditor.instance;
    }

    initUI() {
        // Inject minimal terminal CSS styling
        const styleEl = document.createElement('style');
        styleEl.id = 'tbe-styles';
        styleEl.textContent = `
            #tbe-panel {
                position: fixed;
                top: 20px;
                left: 20px;
                width: 420px;
                max-height: 90vh;
                overflow-y: auto;
                background: rgba(8, 12, 10, 0.95);
                border: 1px solid #00ff66;
                box-shadow: 0 0 15px rgba(0, 255, 102, 0.15);
                font-family: 'Courier New', Consolas, Monaco, monospace;
                color: #00ff66;
                padding: 12px;
                box-sizing: border-box;
                z-index: 2000;
                display: none;
                user-select: none;
            }
            #tbe-panel::-webkit-scrollbar {
                width: 6px;
            }
            #tbe-panel::-webkit-scrollbar-thumb {
                background: #00ff66;
            }
            #tbe-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #00ff66;
                padding-bottom: 6px;
                margin-bottom: 10px;
                font-size: 13px;
                font-weight: bold;
                letter-spacing: 1px;
            }
            #tbe-close-btn {
                background: transparent;
                border: none;
                color: #00ff66;
                cursor: pointer;
                font-family: monospace;
                font-size: 14px;
                font-weight: bold;
            }
            #tbe-close-btn:hover {
                color: #ffffff;
            }
            .tbe-label {
                font-size: 11px;
                color: #88ffaa;
                display: block;
                margin-bottom: 4px;
                text-transform: uppercase;
            }
            .tbe-select {
                width: 100%;
                background: #000;
                border: 1px solid #00ff66;
                color: #00e5ff;
                font-family: monospace;
                padding: 6px;
                margin-bottom: 10px;
                outline: none;
                cursor: pointer;
            }
            .tbe-box {
                border: 1px dashed #225533;
                padding: 8px;
                margin-bottom: 10px;
                background: rgba(0, 20, 10, 0.3);
            }
            .tbe-slider-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
                font-size: 11px;
            }
            .tbe-slider-row span {
                width: 80px;
            }
            .tbe-slider {
                flex: 1;
                accent-color: #00ff66;
                cursor: pointer;
            }
            .tbe-val {
                width: 45px;
                text-align: right;
                color: #00e5ff;
            }
            #tbe-viewport {
                width: 100%;
                height: 180px;
                border: 1px solid #00ff66;
                background: #040605;
                margin-bottom: 10px;
                position: relative;
            }
            #tbe-viewport-legend {
                position: absolute;
                bottom: 4px;
                left: 6px;
                font-size: 9px;
                color: #55aa77;
                pointer-events: none;
            }
            .tbe-btn-row {
                display: flex;
                gap: 6px;
                margin-bottom: 10px;
            }
            .tbe-btn {
                background: #00ff66;
                color: #000000;
                border: none;
                padding: 7px 10px;
                font-family: monospace;
                font-size: 11px;
                font-weight: bold;
                cursor: pointer;
                text-transform: uppercase;
                transition: background 0.15s;
            }
            .tbe-btn:hover {
                background: #66ffaa;
            }
            .tbe-btn-sec {
                background: #113322;
                color: #00ff66;
                border: 1px solid #00ff66;
                padding: 6px 10px;
                font-family: monospace;
                font-size: 11px;
                cursor: pointer;
            }
            .tbe-btn-sec:hover {
                background: #00ff66;
                color: #000;
            }
            .tbe-variant-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid #225533;
                padding: 4px 8px;
                font-size: 11px;
            }
            .tbe-swatch {
                width: 14px;
                height: 14px;
                border: 1px solid #00ff66;
                display: inline-block;
                margin-right: 6px;
                vertical-align: middle;
            }
            .tbe-del-btn {
                background: transparent;
                border: 1px solid #ff4444;
                color: #ff4444;
                cursor: pointer;
                font-family: monospace;
                font-size: 10px;
                padding: 1px 4px;
            }
            .tbe-del-btn:hover {
                background: #ff4444;
                color: #000;
            }
        `;
        document.head.appendChild(styleEl);

        // Inject Panel Markup
        const panel = document.createElement('div');
        panel.id = 'tbe-panel';
        panel.innerHTML = `
            <div id="tbe-header">
                <span>[DEV_DEBUG :: TREE_BILLBOARD_EDITOR]</span>
                <button id="tbe-close-btn">[X]</button>
            </div>

            <label class="tbe-label">&gt; SELECT_BASE_TREE_GLB:</label>
            <select id="tbe-tree-select" class="tbe-select">
                ${TREE_PRESETS.map(p => `<option value="${p.key}">${p.name}</option>`).join('')}
            </select>

            <div class="tbe-box">
                <span class="tbe-label">&gt; LEAVES_COLOR_SHIFT (HSL):</span>
                <div class="tbe-slider-row">
                    <span>Hue Shift:</span>
                    <input type="range" id="tbe-leaf-hue" class="tbe-slider" min="-180" max="180" value="0">
                    <span id="tbe-leaf-hue-val" class="tbe-val">0°</span>
                </div>
                <div class="tbe-slider-row">
                    <span>Saturation:</span>
                    <input type="range" id="tbe-leaf-sat" class="tbe-slider" min="-100" max="100" value="0">
                    <span id="tbe-leaf-sat-val" class="tbe-val">0%</span>
                </div>
                <div class="tbe-slider-row">
                    <span>Lightness:</span>
                    <input type="range" id="tbe-leaf-lit" class="tbe-slider" min="-100" max="100" value="0">
                    <span id="tbe-leaf-lit-val" class="tbe-val">0%</span>
                </div>
            </div>

            <div class="tbe-box">
                <span class="tbe-label">&gt; TRUNK_COLOR_SHIFT (HSL):</span>
                <div class="tbe-slider-row">
                    <span>Hue Shift:</span>
                    <input type="range" id="tbe-bark-hue" class="tbe-slider" min="-180" max="180" value="0">
                    <span id="tbe-bark-hue-val" class="tbe-val">0°</span>
                </div>
                <div class="tbe-slider-row">
                    <span>Saturation:</span>
                    <input type="range" id="tbe-bark-sat" class="tbe-slider" min="-100" max="100" value="0">
                    <span id="tbe-bark-sat-val" class="tbe-val">0%</span>
                </div>
                <div class="tbe-slider-row">
                    <span>Lightness:</span>
                    <input type="range" id="tbe-bark-lit" class="tbe-slider" min="-100" max="100" value="0">
                    <span id="tbe-bark-lit-val" class="tbe-val">0%</span>
                </div>
            </div>

            <div id="tbe-viewport">
                <div id="tbe-viewport-legend">LEFT: 3D GLB MESH | RIGHT: 2D BILLBOARD CANVAS</div>
            </div>

            <div class="tbe-btn-row">
                <button id="tbe-save-btn" class="tbe-btn" style="flex:1;">[+ SAVE AS VARIANT]</button>
                <button id="tbe-reset-btn" class="tbe-btn-sec">[RESET HSL]</button>
            </div>

            <div class="tbe-box">
                <span class="tbe-label">&gt; SAVED_VARIANTS (<span id="tbe-var-count">1</span>/4 MAX):</span>
                <div id="tbe-variants-list" style="display:flex; flex-direction:column; gap:4px; margin-top:6px;"></div>
            </div>

            <button id="tbe-apply-btn" class="tbe-btn" style="width:100%; background:#00e5ff;">[ APPLY VARIANTS TO TERRAIN BIOMES ]</button>
        `;
        document.body.appendChild(panel);

        this.panelEl = panel;
        this.selectEl = document.getElementById('tbe-tree-select');
        this.leafHueInput = document.getElementById('tbe-leaf-hue');
        this.leafSatInput = document.getElementById('tbe-leaf-sat');
        this.leafLitInput = document.getElementById('tbe-leaf-lit');
        this.leafHueValEl = document.getElementById('tbe-leaf-hue-val');
        this.leafSatValEl = document.getElementById('tbe-leaf-sat-val');
        this.leafLitValEl = document.getElementById('tbe-leaf-lit-val');

        this.barkHueInput = document.getElementById('tbe-bark-hue');
        this.barkSatInput = document.getElementById('tbe-bark-sat');
        this.barkLitInput = document.getElementById('tbe-bark-lit');
        this.barkHueValEl = document.getElementById('tbe-bark-hue-val');
        this.barkSatValEl = document.getElementById('tbe-bark-sat-val');
        this.barkLitValEl = document.getElementById('tbe-bark-lit-val');

        this.varCountEl = document.getElementById('tbe-var-count');
        this.varListEl = document.getElementById('tbe-variants-list');
        this.viewportContainer = document.getElementById('tbe-viewport');

        // Event listeners
        document.getElementById('tbe-close-btn').onclick = () => this.togglePanel(false);

        this.selectEl.onchange = (e) => {
            this.currentPresetKey = e.target.value;
            this.resetSliders();
            this.loadCurrentPreset();
        };

        const onSliderChange = () => {
            this.leafHueShift = parseInt(this.leafHueInput.value, 10);
            this.leafSatShift = parseInt(this.leafSatInput.value, 10);
            this.leafLitShift = parseInt(this.leafLitInput.value, 10);
            this.barkHueShift = parseInt(this.barkHueInput.value, 10);
            this.barkSatShift = parseInt(this.barkSatInput.value, 10);
            this.barkLitShift = parseInt(this.barkLitInput.value, 10);

            this.leafHueValEl.textContent = `${this.leafHueShift}°`;
            this.leafSatValEl.textContent = `${this.leafSatShift}%`;
            this.leafLitValEl.textContent = `${this.leafLitShift}%`;

            this.barkHueValEl.textContent = `${this.barkHueShift}°`;
            this.barkSatValEl.textContent = `${this.barkSatShift}%`;
            this.barkLitValEl.textContent = `${this.barkLitShift}%`;

            this.updatePreviews();
        };

        this.leafHueInput.oninput = onSliderChange;
        this.leafSatInput.oninput = onSliderChange;
        this.leafLitInput.oninput = onSliderChange;
        this.barkHueInput.oninput = onSliderChange;
        this.barkSatInput.oninput = onSliderChange;
        this.barkLitInput.oninput = onSliderChange;

        document.getElementById('tbe-reset-btn').onclick = () => {
            this.resetSliders();
            this.updatePreviews();
        };

        document.getElementById('tbe-save-btn').onclick = () => {
            this.saveCurrentVariant();
        };

        document.getElementById('tbe-apply-btn').onclick = () => {
            this.notifyApplyCallbacks();
        };
    }

    initPreviewScene() {
        this.previewScene = new THREE.Scene();
        this.previewScene.background = new THREE.Color(0x060a08);

        this.previewCamera = new THREE.PerspectiveCamera(45, 400 / 180, 0.1, 100);
        this.previewCamera.position.set(0, 3, 10);

        this.previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.previewRenderer.setSize(this.viewportContainer.clientWidth, this.viewportContainer.clientHeight);
        this.previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
        this.viewportContainer.appendChild(this.previewRenderer.domElement);

        this.previewControls = new OrbitControls(this.previewCamera, this.previewRenderer.domElement);
        this.previewControls.enableDamping = true;
        this.previewControls.dampingFactor = 0.05;
        this.previewControls.target.set(0, 2, 0);

        // Lighting for preview
        const ambLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.previewScene.add(ambLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
        dirLight.position.set(5, 10, 7);
        this.previewScene.add(dirLight);

        // Preview containers
        this.preview3DGroup = new THREE.Group();
        this.preview3DGroup.position.set(-2.5, 0, 0);
        this.previewScene.add(this.preview3DGroup);

        this.previewBillboardGroup = new THREE.Group();
        this.previewBillboardGroup.position.set(2.5, 0, 0);
        this.previewScene.add(this.previewBillboardGroup);

        // Create Preview Billboard Mesh
        const planeGeo = new THREE.PlaneGeometry(3.2, 5.76);
        planeGeo.translate(0, 2.88, 0);
        this.billboardCanvasTexture = new THREE.CanvasTexture(this.offscreenCanvas);
        this.billboardCanvasTexture.colorSpace = THREE.SRGBColorSpace;

        const planeMat = new THREE.MeshBasicMaterial({
            map: this.billboardCanvasTexture,
            transparent: true,
            side: THREE.DoubleSide
        });
        this.previewBillboardMesh = new THREE.Mesh(planeGeo, planeMat);
        this.previewBillboardGroup.add(this.previewBillboardMesh);

        // Grid helper
        const grid = new THREE.GridHelper(12, 12, 0x00ff66, 0x114422);
        grid.position.y = -0.01;
        this.previewScene.add(grid);

        // Animation loop for preview viewport
        const animate = () => {
            requestAnimationFrame(animate);
            if (this.isPanelVisible) {
                this.preview3DGroup.rotation.y += 0.005;
                this.previewControls.update();
                this.previewRenderer.render(this.previewScene, this.previewCamera);
            }
        };
        animate();
    }

    resetSliders() {
        this.leafHueShift = 0;
        this.leafSatShift = 0;
        this.leafLitShift = 0;
        this.barkHueShift = 0;
        this.barkSatShift = 0;
        this.barkLitShift = 0;

        this.leafHueInput.value = 0;
        this.leafSatInput.value = 0;
        this.leafLitInput.value = 0;
        this.barkHueInput.value = 0;
        this.barkSatInput.value = 0;
        this.barkLitInput.value = 0;

        this.leafHueValEl.textContent = '0°';
        this.leafSatValEl.textContent = '0%';
        this.leafLitValEl.textContent = '0%';
        this.barkHueValEl.textContent = '0°';
        this.barkSatValEl.textContent = '0%';
        this.barkLitValEl.textContent = '0%';
    }

    togglePanel(visible) {
        this.isPanelVisible = visible !== undefined ? visible : !this.isPanelVisible;
        this.panelEl.style.display = this.isPanelVisible ? 'block' : 'none';
        if (this.isPanelVisible) {
            this.previewRenderer.setSize(this.viewportContainer.clientWidth, this.viewportContainer.clientHeight);
            this.previewCamera.aspect = this.viewportContainer.clientWidth / this.viewportContainer.clientHeight;
            this.previewCamera.updateProjectionMatrix();
        }
    }

    getCurrentPreset() {
        return TREE_PRESETS.find(p => p.key === this.currentPresetKey) || TREE_PRESETS[0];
    }

    async loadCurrentPreset() {
        const preset = this.getCurrentPreset();

        // Load 2D Billboard Image
        if (!this.loadedBillboards.has(preset.billboardPath)) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve) => {
                img.onload = () => {
                    this.loadedBillboards.set(preset.billboardPath, img);
                    resolve();
                };
                img.onerror = resolve;
                img.src = preset.billboardPath;
            });
        }

        // Load 3D GLB Model
        if (!this.loadedGLTFScenes.has(preset.key)) {
            await new Promise((resolve) => {
                this.gltfLoader.load(preset.glbPath, (gltf) => {
                    const scene = gltf.scene;
                    const bbox = new THREE.Box3().setFromObject(scene);
                    const h = bbox.max.y - bbox.min.y;
                    const sc = h > 0 ? (4.5 / h) : 1.0;
                    scene.scale.set(sc, sc, sc);
                    scene.position.y = -bbox.min.y * sc;

                    // Deep clone and store original materials & vertex colors
                    scene.traverse((child) => {
                        if (child.isMesh) {
                            if (child.material) {
                                child.userData.origMaterial = cloneMat(child.material);
                            }
                            if (child.geometry && child.geometry.attributes.color) {
                                child.userData.origVertexColors = new Float32Array(child.geometry.attributes.color.array);
                            }
                        }
                    });

                    this.loadedGLTFScenes.set(preset.key, scene);
                    resolve();
                }, undefined, () => resolve());
            });
        }

        // Update 3D Preview Mesh
        while (this.preview3DGroup.children.length > 0) {
            this.preview3DGroup.remove(this.preview3DGroup.children[0]);
        }
        const cachedGLTF = this.loadedGLTFScenes.get(preset.key);
        if (cachedGLTF) {
            this.current3DMesh = cachedGLTF.clone(true);
            // Re-bind original materials on clone
            this.current3DMesh.traverse((child) => {
                if (child.isMesh && child.userData.origMaterial) {
                    child.material = cloneMat(child.userData.origMaterial);
                }
            });
            this.preview3DGroup.add(this.current3DMesh);
        }

        this.updatePreviews();
        this.renderVariantList();
    }

    updatePreviews() {
        const preset = this.getCurrentPreset();

        // 1. Update 3D Model Materials (Requirement 2)
        if (this.current3DMesh) {
            this.current3DMesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    const childName = (child.name || '').toLowerCase();
                    const origMat = child.userData.origMaterial || child.material;
                    const matName = (origMat && origMat.name) ? origMat.name.toLowerCase() : '';
                    const isBark = matName.includes('bark') || matName.includes('trunk') || matName.includes('wood') || childName.includes('bark') || childName.includes('trunk') || childName.includes('wood');

                    const hShift = (isBark ? this.barkHueShift : this.leafHueShift) / 360.0;
                    const sShift = (isBark ? this.barkSatShift : this.leafSatShift) / 100.0;
                    const lShift = (isBark ? this.barkLitShift : this.leafLitShift) / 100.0;

                    child.material = applyMatHSL(child.material, origMat, hShift, sShift, lShift);

                    if (child.geometry && child.geometry.attributes.color && child.userData.origVertexColors) {
                        const origColors = child.userData.origVertexColors;
                        const colors = child.geometry.attributes.color.array;
                        for (let i = 0; i < origColors.length; i += 3) {
                            const [h, s, l] = rgbToHsl(origColors[i], origColors[i + 1], origColors[i + 2]);
                            let nh = (h + hShift) % 1.0;
                            if (nh < 0) nh += 1.0;
                            let ns = Math.max(0.0, Math.min(1.0, s + sShift));
                            let nl = Math.max(0.0, Math.min(1.0, l + lShift));
                            const [nr, ng, nb] = hslToRgb(nh, ns, nl);
                            colors[i] = nr;
                            colors[i + 1] = ng;
                            colors[i + 2] = nb;
                        }
                        child.geometry.attributes.color.needsUpdate = true;
                    }
                }
            });
        }

        // 2. Update 2D Billboard Canvas (Requirement 3)
        const billboardImg = this.loadedBillboards.get(preset.billboardPath);
        if (billboardImg) {
            applyHSLToCanvas(
                billboardImg, 
                this.offscreenCanvas, 
                this.leafHueShift, this.leafSatShift, this.leafLitShift,
                this.barkHueShift, this.barkSatShift, this.barkLitShift
            );
            if (this.billboardCanvasTexture) {
                this.billboardCanvasTexture.needsUpdate = true;
            }
        }
    }

    saveCurrentVariant() {
        const variants = this.variantsMap.get(this.currentPresetKey) || [];
        if (variants.length >= 4) {
            alert('Maximum of 4 variants reached for this tree type!');
            return;
        }

        const preset = this.getCurrentPreset();
        const baseColor = new THREE.Color(preset.baseColorHex);
        const baseHSL = { h: 0, s: 0, l: 0 };
        baseColor.getHSL(baseHSL);

        let nh = (baseHSL.h + this.leafHueShift / 360.0) % 1.0;
        if (nh < 0) nh += 1.0;
        let ns = Math.max(0.0, Math.min(1.0, baseHSL.s + this.leafSatShift / 100.0));
        let nl = Math.max(0.0, Math.min(1.0, baseHSL.l + this.leafLitShift / 100.0));

        const varColorObj = new THREE.Color().setHSL(nh, ns, nl);
        const varColorHex = '#' + varColorObj.getHexString();

        const newVariant = {
            id: 'var_' + Date.now(),
            name: `Variant ${variants.length}`,
            leafHueShift: this.leafHueShift,
            leafSatShift: this.leafSatShift,
            leafLitShift: this.leafLitShift,
            barkHueShift: this.barkHueShift,
            barkSatShift: this.barkSatShift,
            barkLitShift: this.barkLitShift,
            colorHex: varColorHex,
            colorObj: varColorObj.clone(),
            isDefault: false
        };

        variants.push(newVariant);
        this.variantsMap.set(this.currentPresetKey, variants);
        this.renderVariantList();
        this.notifyApplyCallbacks();
    }

    deleteVariant(id) {
        const variants = this.variantsMap.get(this.currentPresetKey) || [];
        const filtered = variants.filter(v => v.id !== id || v.isDefault);
        this.variantsMap.set(this.currentPresetKey, filtered);
        this.renderVariantList();
        this.notifyApplyCallbacks();
    }

    renderVariantList() {
        const variants = this.variantsMap.get(this.currentPresetKey) || [];
        this.varCountEl.textContent = variants.length;
        this.varListEl.innerHTML = '';

        variants.forEach((v) => {
            const item = document.createElement('div');
            item.className = 'tbe-variant-item';
            item.innerHTML = `
                <div>
                    <span class="tbe-swatch" style="background:${v.colorHex};"></span>
                    <span>${v.name} ${v.isDefault ? '(Original)' : `[L: H:${v.leafHueShift}° S:${v.leafSatShift}% L:${v.leafLitShift}%] [B: H:${v.barkHueShift}° S:${v.barkSatShift}% L:${v.barkLitShift}%]`}</span>
                </div>
                ${!v.isDefault ? `<button class="tbe-del-btn" data-id="${v.id}">DEL</button>` : ''}
            `;
            this.varListEl.appendChild(item);
        });

        this.varListEl.querySelectorAll('.tbe-del-btn').forEach(btn => {
            btn.onclick = () => this.deleteVariant(btn.getAttribute('data-id'));
        });
    }

    onApply(callback) {
        if (typeof callback === 'function') {
            this.applyCallbacks.push(callback);
        }
    }

    notifyApplyCallbacks() {
        const preset = this.getCurrentPreset();
        const variants = this.variantsMap.get(this.currentPresetKey) || [];
        this.applyCallbacks.forEach(cb => cb(preset, variants));
    }

    getActiveVariants(presetKey) {
        return this.variantsMap.get(presetKey || this.currentPresetKey) || [];
    }
}
