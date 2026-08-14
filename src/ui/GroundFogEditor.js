export class GroundFogEditor {
    constructor() {
        this.isMinimized = false;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.el = null;
        this.visible = false;
        this.presets = {
            'Default':        { intensity: 0.80, opacity: 0.80, heightOffset: 0,  layerSpacing: 15, driftSpeed: 1.0, turbulence: 1.0, nearFade: 10,  farFade: 1700, color: '#ffffff' },
            'Morning Mist':   { intensity: 0.50, opacity: 0.90, heightOffset: -5,  layerSpacing: 10, driftSpeed: 0.5, turbulence: 0.8, nearFade: 5,   farFade: 1400, color: '#fff5e6' },
            'Deep Forest':    { intensity: 1.20, opacity: 0.85, heightOffset: -10, layerSpacing: 8,  driftSpeed: 0.3, turbulence: 1.5, nearFade: 5,   farFade: 1000, color: '#c8e6c9' },
            'Ethereal Wisps': { intensity: 0.35, opacity: 0.60, heightOffset: 10,  layerSpacing: 25, driftSpeed: 2.0, turbulence: 2.5, nearFade: 20,  farFade: 1600, color: '#e8d5f5' },
            'Alpine Cloud':   { intensity: 0.90, opacity: 0.95, heightOffset: 15,  layerSpacing: 20, driftSpeed: 1.5, turbulence: 1.2, nearFade: 15,  farFade: 1800, color: '#e0f0ff' },
            'Desert Mirage':  { intensity: 0.25, opacity: 0.40, heightOffset: -3,  layerSpacing: 30, driftSpeed: 3.0, turbulence: 3.0, nearFade: 30,  farFade: 1200, color: '#ffe4b5' },
            'Midnight Gloom': { intensity: 1.50, opacity: 0.70, heightOffset: -8,  layerSpacing: 12, driftSpeed: 0.4, turbulence: 0.6, nearFade: 5,   farFade: 1500, color: '#7b8fa1' },
        };
        this.state = { ...this.presets['Default'], enabled: true };
        this.build();
    }

    build() {
        const el = document.createElement('div');
        el.id = 'ground-fog-editor';
        el.innerHTML = `
<style>
#ground-fog-editor {
    position: fixed; right: 20px; top: 100px; width: 290px; z-index: 120;
    background: rgba(12, 14, 20, 0.82); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
    color: #e8ecf0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    font-size: 12px; box-shadow: 0 12px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);
    display: none; user-select: none; overflow: hidden;
    transition: height 0.25s ease, opacity 0.2s ease;
}
#ground-fog-editor * { box-sizing: border-box; }
#gfe-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; cursor: grab; border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
}
#gfe-header:active { cursor: grabbing; }
#gfe-title { font-size: 13px; font-weight: 600; letter-spacing: 0.3px; display: flex; align-items: center; gap: 7px; }
#gfe-biome-badge {
    font-size: 10px; padding: 2px 8px; border-radius: 20px;
    background: rgba(100,180,255,0.15); color: #8ec5ff; font-weight: 500;
}
#gfe-header-btns { display: flex; gap: 6px; }
#gfe-header-btns button {
    background: rgba(255,255,255,0.08); border: none; color: #aab; font-size: 14px;
    width: 26px; height: 26px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
}
#gfe-header-btns button:hover { background: rgba(255,255,255,0.16); }
#gfe-body { padding: 10px 14px 14px; }
#gfe-body.minimized { display: none; }

.gfe-section { margin-bottom: 10px; }
.gfe-section-title {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.35);
    margin-bottom: 6px; font-weight: 600;
}
.gfe-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px; }
.gfe-row label { flex: 0 0 auto; white-space: nowrap; color: #bcc3cc; font-size: 11px; }
.gfe-row input[type="range"] { flex: 1; height: 4px; accent-color: #64b5f6; cursor: pointer; }
.gfe-row .gfe-val { width: 42px; text-align: right; font-size: 10px; color: #8899aa; font-variant-numeric: tabular-nums; }

.gfe-toggle-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.gfe-toggle {
    position: relative; width: 38px; height: 20px; border-radius: 10px; cursor: pointer;
    background: rgba(255,255,255,0.12); transition: background 0.2s;
}
.gfe-toggle.on { background: #43a047; box-shadow: 0 0 8px rgba(67,160,71,0.4); }
.gfe-toggle-knob {
    position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
    background: #fff; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.gfe-toggle.on .gfe-toggle-knob { transform: translateX(18px); }
.gfe-toggle-label { font-size: 12px; font-weight: 500; }

.gfe-color-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.gfe-color-input {
    width: 32px; height: 24px; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
    cursor: pointer; background: transparent; padding: 0;
}
.gfe-color-input::-webkit-color-swatch-wrapper { padding: 2px; }
.gfe-color-input::-webkit-color-swatch { border-radius: 4px; border: none; }
.gfe-palette { display: flex; gap: 4px; flex-wrap: wrap; }
.gfe-swatch {
    width: 22px; height: 22px; border-radius: 5px; cursor: pointer; border: 1.5px solid rgba(255,255,255,0.1);
    transition: transform 0.12s, border-color 0.15s;
}
.gfe-swatch:hover { transform: scale(1.15); border-color: rgba(255,255,255,0.4); }

.gfe-presets { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.gfe-preset-btn {
    padding: 4px 9px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.05); color: #c0c8d0; font-size: 10px; cursor: pointer;
    transition: all 0.15s; white-space: nowrap;
}
.gfe-preset-btn:hover { background: rgba(100,180,255,0.15); border-color: rgba(100,180,255,0.3); color: #fff; }

.gfe-actions { display: flex; gap: 6px; margin-top: 8px; }
.gfe-actions button {
    flex: 1; padding: 6px 0; border-radius: 7px; border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.06); color: #b0b8c4; font-size: 11px; cursor: pointer;
    transition: all 0.15s; font-weight: 500;
}
.gfe-actions button:hover { background: rgba(100,180,255,0.12); color: #fff; }

.gfe-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 0; }
</style>

<div id="gfe-header">
    <div id="gfe-title">🌫️ Ground Fog <span id="gfe-biome-badge">📍 —</span></div>
    <div id="gfe-header-btns">
        <button id="gfe-minimize" title="Minimize">—</button>
        <button id="gfe-close" title="Close">✕</button>
    </div>
</div>
<div id="gfe-body">
    <div class="gfe-section">
        <div class="gfe-toggle-row">
            <div class="gfe-toggle on" id="gfe-enable"><div class="gfe-toggle-knob"></div></div>
            <span class="gfe-toggle-label">Fog Active</span>
        </div>
    </div>

    <div class="gfe-section">
        <div class="gfe-section-title">Primary</div>
        <div class="gfe-row"><label>Intensity</label><input type="range" id="gfe-intensity" min="0.10" max="5.00" step="0.05" value="0.80"><span class="gfe-val" id="gfe-intensity-val">0.80</span></div>
        <div class="gfe-row"><label>Opacity</label><input type="range" id="gfe-opacity" min="0.00" max="1.00" step="0.02" value="0.80"><span class="gfe-val" id="gfe-opacity-val">0.80</span></div>
    </div>

    <div class="gfe-section">
        <div class="gfe-section-title">Fog Tint</div>
        <div class="gfe-color-row">
            <input type="color" class="gfe-color-input" id="gfe-color" value="#ffffff">
            <div class="gfe-palette">
                <div class="gfe-swatch" data-color="#ffffff" style="background:#ffffff" title="White"></div>
                <div class="gfe-swatch" data-color="#fff5e6" style="background:#fff5e6" title="Dawn Mist"></div>
                <div class="gfe-swatch" data-color="#c8e6c9" style="background:#c8e6c9" title="Forest Teal"></div>
                <div class="gfe-swatch" data-color="#e0f0ff" style="background:#e0f0ff" title="Alpine Frost"></div>
                <div class="gfe-swatch" data-color="#e8d5f5" style="background:#e8d5f5" title="Twilight Violet"></div>
                <div class="gfe-swatch" data-color="#ffe4b5" style="background:#ffe4b5" title="Desert Mirage"></div>
            </div>
        </div>
    </div>

    <div class="gfe-divider"></div>

    <div class="gfe-section">
        <div class="gfe-section-title">Advanced</div>
        <div class="gfe-row"><label>Height Y</label><input type="range" id="gfe-height" min="-50" max="50" step="1" value="0"><span class="gfe-val" id="gfe-height-val">0m</span></div>
        <div class="gfe-row"><label>Layer Gap</label><input type="range" id="gfe-spacing" min="2" max="50" step="1" value="15"><span class="gfe-val" id="gfe-spacing-val">15m</span></div>
        <div class="gfe-row"><label>Drift Speed</label><input type="range" id="gfe-drift" min="0.0" max="5.0" step="0.1" value="1.0"><span class="gfe-val" id="gfe-drift-val">1.0x</span></div>
        <div class="gfe-row"><label>Turbulence</label><input type="range" id="gfe-turbulence" min="0.5" max="4.0" step="0.1" value="1.0"><span class="gfe-val" id="gfe-turbulence-val">1.0x</span></div>
        <div class="gfe-row"><label>Near Fade</label><input type="range" id="gfe-near" min="1" max="100" step="1" value="10"><span class="gfe-val" id="gfe-near-val">10</span></div>
        <div class="gfe-row"><label>Far Fade</label><input type="range" id="gfe-far" min="500" max="2500" step="50" value="1700"><span class="gfe-val" id="gfe-far-val">1700</span></div>
    </div>

    <div class="gfe-divider"></div>

    <div class="gfe-section">
        <div class="gfe-section-title">Presets</div>
        <div class="gfe-presets" id="gfe-presets"></div>
    </div>

    <div class="gfe-actions">
        <button id="gfe-copy-json" title="Copy config to clipboard">📋 Copy JSON</button>
        <button id="gfe-save-biome" title="Save preset for current biome">💾 Save Biome</button>
    </div>
</div>`;
        document.body.appendChild(el);
        this.el = el;
        this.bindEvents();
        this.buildPresetButtons();
    }

    bindEvents() {
        const $ = (id) => document.getElementById(id);

        // Toggle enable
        $('gfe-enable').addEventListener('click', () => {
            this.state.enabled = !this.state.enabled;
            $('gfe-enable').classList.toggle('on', this.state.enabled);
            if (window.fogGroup) window.fogGroup.visible = this.state.enabled;
        });

        // Sliders
        const sliders = [
            { id: 'gfe-intensity',   key: 'intensity',    valId: 'gfe-intensity-val',   fmt: v => parseFloat(v).toFixed(2) },
            { id: 'gfe-opacity',     key: 'opacity',      valId: 'gfe-opacity-val',     fmt: v => parseFloat(v).toFixed(2) },
            { id: 'gfe-height',      key: 'heightOffset', valId: 'gfe-height-val',      fmt: v => `${v}m` },
            { id: 'gfe-spacing',     key: 'layerSpacing', valId: 'gfe-spacing-val',     fmt: v => `${v}m` },
            { id: 'gfe-drift',       key: 'driftSpeed',   valId: 'gfe-drift-val',       fmt: v => `${parseFloat(v).toFixed(1)}x` },
            { id: 'gfe-turbulence',  key: 'turbulence',   valId: 'gfe-turbulence-val',  fmt: v => `${parseFloat(v).toFixed(1)}x` },
            { id: 'gfe-near',        key: 'nearFade',     valId: 'gfe-near-val',        fmt: v => v },
            { id: 'gfe-far',         key: 'farFade',      valId: 'gfe-far-val',         fmt: v => v },
        ];

        sliders.forEach(s => {
            const input = $(s.id);
            const valEl = $(s.valId);
            input.addEventListener('input', () => {
                const v = parseFloat(input.value);
                this.state[s.key] = v;
                valEl.textContent = s.fmt(input.value);
                this.applyToScene();
            });
        });

        // Color
        $('gfe-color').addEventListener('input', (e) => {
            this.state.color = e.target.value;
            this.applyToScene();
        });

        // Swatches
        this.el.querySelectorAll('.gfe-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                const c = sw.dataset.color;
                this.state.color = c;
                $('gfe-color').value = c;
                this.applyToScene();
            });
        });

        // Close / minimize
        $('gfe-close').addEventListener('click', () => this.toggle(false));
        $('gfe-minimize').addEventListener('click', () => {
            this.isMinimized = !this.isMinimized;
            $('gfe-body').classList.toggle('minimized', this.isMinimized);
            $('gfe-minimize').textContent = this.isMinimized ? '+' : '—';
        });

        // Drag
        const header = $('gfe-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            this.isDragging = true;
            const rect = this.el.getBoundingClientRect();
            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.el.style.left = (e.clientX - this.dragOffsetX) + 'px';
            this.el.style.top = (e.clientY - this.dragOffsetY) + 'px';
            this.el.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => { this.isDragging = false; });

        // Copy JSON
        $('gfe-copy-json').addEventListener('click', () => {
            const json = JSON.stringify(this.state, null, 2);
            navigator.clipboard.writeText(json).then(() => {
                const btn = $('gfe-copy-json');
                btn.textContent = '✓ Copied';
                setTimeout(() => { btn.textContent = '📋 Copy JSON'; }, 1500);
            });
        });

        // Save biome preset
        $('gfe-save-biome').addEventListener('click', () => {
            const biomeName = this.getCurrentBiome();
            if (!biomeName) return;
            const saved = JSON.parse(localStorage.getItem('wl_fog_biome_presets') || '{}');
            saved[biomeName] = { ...this.state };
            localStorage.setItem('wl_fog_biome_presets', JSON.stringify(saved));
            const btn = $('gfe-save-biome');
            btn.textContent = `✓ Saved (${biomeName})`;
            setTimeout(() => { btn.textContent = '💾 Save Biome'; }, 2000);
        });
    }

    buildPresetButtons() {
        const container = document.getElementById('gfe-presets');
        Object.keys(this.presets).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'gfe-preset-btn';
            btn.textContent = name;
            btn.addEventListener('click', () => this.loadPreset(name));
            container.appendChild(btn);
        });
    }

    loadPreset(name) {
        const p = this.presets[name];
        if (!p) return;
        Object.assign(this.state, p);
        this.syncUI();
        this.applyToScene();
    }

    syncUI() {
        const $ = (id) => document.getElementById(id);
        $('gfe-intensity').value = this.state.intensity;
        $('gfe-intensity-val').textContent = this.state.intensity.toFixed(2);
        $('gfe-opacity').value = this.state.opacity;
        $('gfe-opacity-val').textContent = this.state.opacity.toFixed(2);
        $('gfe-height').value = this.state.heightOffset;
        $('gfe-height-val').textContent = `${this.state.heightOffset}m`;
        $('gfe-spacing').value = this.state.layerSpacing;
        $('gfe-spacing-val').textContent = `${this.state.layerSpacing}m`;
        $('gfe-drift').value = this.state.driftSpeed;
        $('gfe-drift-val').textContent = `${this.state.driftSpeed.toFixed(1)}x`;
        $('gfe-turbulence').value = this.state.turbulence;
        $('gfe-turbulence-val').textContent = `${this.state.turbulence.toFixed(1)}x`;
        $('gfe-near').value = this.state.nearFade;
        $('gfe-near-val').textContent = this.state.nearFade;
        $('gfe-far').value = this.state.farFade;
        $('gfe-far-val').textContent = this.state.farFade;
        $('gfe-color').value = this.state.color;
        $('gfe-enable').classList.toggle('on', this.state.enabled);
    }

    applyToScene() {
        if (!window.fogGroup) return;
        const fg = window.fogGroup;
        fg.visible = this.state.enabled;

        if (window.fogMat) {
            window.fogMat.opacity = this.state.opacity;
            window.fogMat.color.set(this.state.color);
        }

        const children = fg.children;
        for (let i = 0; i < children.length; i++) {
            children[i].position.y = 12 + i * this.state.layerSpacing;
        }

        if (window.fogEditorState) {
            Object.assign(window.fogEditorState, this.state);
        } else {
            window.fogEditorState = { ...this.state };
        }

        if (window.biomeFogSettings) {
            const biome = this.getCurrentBiome();
            if (biome) window.biomeFogSettings[biome] = this.state.heightOffset;
        }
    }

    getCurrentBiome() {
        if (typeof window.getBiomeAt === 'function' && window.playerGrp) {
            return window.getBiomeAt(window.playerGrp.position.x, window.playerGrp.position.z).name;
        }
        return null;
    }

    updateBiomeBadge() {
        const badge = document.getElementById('gfe-biome-badge');
        if (!badge) return;
        const biome = this.getCurrentBiome();
        badge.textContent = biome ? `📍 ${biome}` : '📍 —';
    }

    startBiomePolling() {
        setInterval(() => {
            if (this.visible) this.updateBiomeBadge();
        }, 800);
    }

    toggle(forceState) {
        this.visible = forceState !== undefined ? forceState : !this.visible;
        this.el.style.display = this.visible ? 'block' : 'none';
        if (this.visible) {
            this.updateBiomeBadge();
            this.syncUI();
        }
    }
}
