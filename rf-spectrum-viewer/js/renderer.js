/**
 * 3D Canvas Waterfall Visualization for RF Spectrum Viewer
 * Adapted from an existing working prototype.
 */

(function(window) {
    /**
     * @constructor
     * @param {HTMLCanvasElement} canvasElement - The canvas to render onto
     * @param {HTMLElement} tooltipElement - The tooltip container element
     * @param {HTMLElement} ttfEl - The tooltip element for frequency text
     * @param {HTMLElement} ttpEl - The tooltip element for power text
     * @param {HTMLElement} ttcEl - The tooltip element for channel/band text
     */
    window.Renderer = function(canvasElement, tooltipElement, ttfEl, ttpEl, ttcEl) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.tt = tooltipElement;
        this.ttf = ttfEl;
        this.ttp = ttpEl;
        this.ttc = ttcEl;
        
        this.width = 0;
        this.height = 0;
        
        // Data state
        this.data = { freqs: [], times: [], powers: [], pMin: -100, pMax: -20 };
        this.renderedData = [];
        this.pulseTime = 0;
        this.hoverPoint = null;
        this.spacingX = 40;
        this.spacingZ = 32;

        // Scene box. Every axis is normalized into this cube regardless of how
        // many frequency bins / time slices the capture has, so the camera never
        // sees a scene it was not built for.
        this.sceneSize = 480;   // X and Z extent, world units
        this.heightScale = 260; // Y extent at full power
        this.extentX = this.sceneSize;
        this.extentZ = this.sceneSize;

        // Level of detail. Canvas2D is a software rasterizer: the cell count is
        // the hard performance ceiling, so the render grid is capped and the
        // source bins are aggregated down to it.
        this.maxCols = 160; // frequency bins actually drawn
        this.maxRows = 120; // time slices actually drawn

        // How many cells get the expensive decorations (absolute counts, not
        // percentiles — a percentile of a 100k grid is tens of thousands of
        // radial gradients and text labels per frame).
        this.glowCount = 200;
        this.peakCount = 40;
        this.labelCount = 12;

        // Colour range, recomputed from the decimated grid.
        this.pLo = -100;
        this.pHi = -20;

        // Settings
        this.mode = 0; // 0: surface, 1: bars, 2: wireframe
        this.autoRotate = true;
        this.showGrid = true;
        this.showLabels = true;

        // Camera / Projection
        this.angleY = 0;
        this.angleX = Math.PI / 6; // Initial tilt
        this.zoom = 1;
        this.camDist = 800;
        this.focal = 600;
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
        this.mouseX = 0;
        this.mouseY = 0;

        // Per-frame camera cache (trig is hoisted out of _project).
        this._cam = { cosY: 1, sinY: 0, cosX: 1, sinX: 0, k: 1 };
        
        // Animation Loop
        this.animId = null;
        this.isRunning = false;
        this.lastTime = 0;
        
        this._bindEvents();
        this.resize();
    };
    
    window.Renderer.prototype = {
        /**
         * Update the spectrum data
         * @param {Object} data - Formatted data { freqs, times, powers, pMin, pMax }
         */
        setData: function(data) {
            this.data = data;
            this._buildRenderData();
        },
        
        /** Set visualization mode: 0 (surface), 1 (bars), 2 (wireframe) */
        setMode: function(m) { this.mode = m; },
        
        /** Enable or disable auto rotation */
        setAutoRotate: function(bool) { this.autoRotate = bool; },
        
        /** Enable or disable grid lines */
        setGrid: function(bool) { this.showGrid = bool; },
        
        /** Enable or disable axis labels */
        setLabels: function(bool) { this.showLabels = bool; },
        
        getMode: function() { return this.mode; },
        getAutoRotate: function() { return this.autoRotate; },
        getGrid: function() { return this.showGrid; },
        getLabels: function() { return this.showLabels; },
        
        /** Start the rendering animation loop */
        start: function() {
            if (this.isRunning) return;
            this.isRunning = true;
            this.lastTime = performance.now();
            this._loop();
        },
        
        /** Stop the rendering animation loop */
        stop: function() {
            this.isRunning = false;
            if (this.animId) {
                cancelAnimationFrame(this.animId);
                this.animId = null;
            }
        },
        
        /** Handle canvas resize and scaling for crisp pixels */
        resize: function() {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            this.width = rect.width;
            this.height = rect.height;
            
            this.canvas.width = this.width * dpr;
            this.canvas.height = this.height * dpr;
            this.canvas.style.width = this.width + 'px';
            this.canvas.style.height = this.height + 'px';
            
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        },
        
        /** Clean up resources and event listeners */
        destroy: function() {
            this.stop();
            this.canvas.removeEventListener('mousedown', this._onMouseDown);
            window.removeEventListener('mousemove', this._onMouseMoveGlobal);
            window.removeEventListener('mouseup', this._onMouseUp);
            this.canvas.removeEventListener('mousemove', this._onMouseMove);
            this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
            this.canvas.removeEventListener('wheel', this._onWheel);
        },
        
        _bindEvents: function() {
            this._onMouseDown = this._onMouseDown.bind(this);
            this._onMouseMoveGlobal = this._onMouseMoveGlobal.bind(this);
            this._onMouseUp = this._onMouseUp.bind(this);
            this._onMouseMove = this._onMouseMove.bind(this);
            this._onMouseLeave = this._onMouseLeave.bind(this);
            this._onWheel = this._onWheel.bind(this);

            this.canvas.addEventListener('mousedown', this._onMouseDown);
            window.addEventListener('mousemove', this._onMouseMoveGlobal);
            window.addEventListener('mouseup', this._onMouseUp);

            this.canvas.addEventListener('mousemove', this._onMouseMove);
            this.canvas.addEventListener('mouseleave', this._onMouseLeave);
            this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        },

        _onWheel: function(e) {
            e.preventDefault();
            const f = Math.exp(-e.deltaY * 0.0015);
            this.zoom = Math.max(0.25, Math.min(6, this.zoom * f));
        },
        
        _onMouseDown: function(e) {
            this.isDragging = true;
            this.autoRotate = false;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        },
        
        _onMouseMoveGlobal: function(e) {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            
            // Both axes fully unclamped 360 rotation
            this.angleY -= dx * 0.01;
            this.angleX += dy * 0.01;
            
            this.lastMouse = { x: e.clientX, y: e.clientY };
        },
        
        _onMouseUp: function() {
            this.isDragging = false;
            this.canvas.style.cursor = 'grab';
        },
        
        _onMouseMove: function(e) {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        },
        
        _onMouseLeave: function() {
            this.hoverPoint = null;
            if (this.tt) this.tt.style.opacity = '0';
        },
        
        _loop: function(time) {
            if (!this.isRunning) return;
            
            if (this.autoRotate && !this.isDragging) {
                this.angleY += 0.003;
            }
            
            this.pulseTime += 0.05;
            this._draw();
            
            this.animId = requestAnimationFrame(this._loop.bind(this));
        },
        
        _pNorm: function(p) {
            const range = this.pHi - this.pLo;
            if (range === 0) return 0;
            const t = (p - this.pLo) / range;
            return Math.max(0, Math.min(1, t));
        },
        
        _pColor: function(p, alpha) {
            const t = this._pNorm(p);
            const stops = [
                { t: 0.00, r: 30, g: 27, b: 75 },
                { t: 0.15, r: 49, g: 46, b: 129 },
                { t: 0.30, r: 6, g: 133, b: 200 },
                { t: 0.45, r: 16, g: 185, b: 129 },
                { t: 0.60, r: 77, g: 217, b: 56 },
                { t: 0.70, r: 234, g: 179, b: 8 },
                { t: 0.80, r: 249, g: 115, b: 22 },
                { t: 0.90, r: 239, g: 68, b: 68 },
                { t: 1.00, r: 244, g: 63, b: 94 }
            ];
            
            let s1 = stops[0], s2 = stops[stops.length - 1];
            for (let i = 0; i < stops.length - 1; i++) {
                if (t >= stops[i].t && t <= stops[i+1].t) {
                    s1 = stops[i];
                    s2 = stops[i+1];
                    break;
                }
            }
            
            const trange = s2.t - s1.t;
            const f = trange === 0 ? 0 : (t - s1.t) / trange;
            
            const r = Math.round(s1.r + (s2.r - s1.r) * f);
            const g = Math.round(s1.g + (s2.g - s1.g) * f);
            const b = Math.round(s1.b + (s2.b - s1.b) * f);
            
            return `rgba(${r},${g},${b},${alpha})`;
        },
        
        _pHeight: function(p) {
            // Relief is scaled against the scene box, so peaks stand up instead
            // of being flattened into the surface.
            return this._pNorm(p) * this.heightScale + 2;
        },
        
        /**
         * Refresh the per-frame camera cache. Called once per frame so that
         * _project does no trigonometry of its own.
         */
        _updateCamera: function() {
            const c = this._cam;
            c.cosY = Math.cos(this.angleY);
            c.sinY = Math.sin(this.angleY);
            c.cosX = Math.cos(this.angleX);
            c.sinX = Math.sin(this.angleX);
            // Uniform on both axes: scaling X and Y by different factors shears
            // the scene instead of rotating it. Fit to the tighter dimension.
            c.k = Math.min(this.width / 1000, this.height / 640) * this.zoom;
        },

        _project: function(x, y, z) {
            const c = this._cam;

            // Y rotation (horizontal)
            const rx = x * c.cosY - z * c.sinY;
            const rz = x * c.sinY + z * c.cosY;

            // X rotation (vertical)
            const ry = y * c.cosX - rz * c.sinX;
            const rz2 = y * c.sinX + rz * c.cosX;

            // Near-plane clip. Without this, points that rotate behind the
            // camera give a negative scale, which mirrors the geometry and
            // throws it across the screen as long streaks.
            const denom = rz2 + this.camDist;
            const NEAR = 1;
            const visible = denom > NEAR;
            const scale = this.focal / (visible ? denom : NEAR);

            const sx = this.width / 2 + rx * scale * c.k;
            const sy = this.height / 2 - ry * scale * c.k;

            return { x: sx, y: sy, depth: rz2, scale: scale, visible: visible };
        },
        
        /**
         * Aggregate the source grid down to at most maxCols x maxRows.
         *
         * Values are dB, so a group is combined by averaging in the LINEAR power
         * domain and converting back — the same thing a spectrum analyser does
         * when it bins. Averaging the dB values directly understates strong
         * bins, and taking the max turns every noise-floor outlier into a spike,
         * which buries real structure in grass.
         * @param {Object} d Source data { freqs, times, powers }
         * @returns {Object} Decimated grid of the same shape
         */
        _decimate: function(d) {
            const NF0 = d.freqs.length;
            const NT0 = d.times.length;
            const fStep = Math.max(1, Math.ceil(NF0 / this.maxCols));
            const tStep = Math.max(1, Math.ceil(NT0 / this.maxRows));
            if (fStep === 1 && tStep === 1) return d;

            const freqs = [];
            const times = [];
            const powers = [];

            for (let f0 = 0; f0 < NF0; f0 += fStep) {
                // Label the group by its centre bin, since the value is a max
                // taken across the whole group.
                freqs.push(d.freqs[Math.min(f0 + (fStep >> 1), NF0 - 1)]);
            }

            for (let t0 = 0; t0 < NT0; t0 += tStep) {
                const tEnd = Math.min(t0 + tStep, NT0);
                const row = [];
                for (let f0 = 0; f0 < NF0; f0 += fStep) {
                    const fEnd = Math.min(f0 + fStep, NF0);
                    let lin = 0;
                    let n = 0;
                    for (let t = t0; t < tEnd; t++) {
                        const src = d.powers[t];
                        for (let f = f0; f < fEnd; f++) {
                            lin += Math.pow(10, src[f] / 10);
                            n++;
                        }
                    }
                    row.push(n ? 10 * Math.log10(lin / n) : -200);
                }
                powers.push(row);
                times.push(d.times[t0]);
            }

            return { freqs, times, powers };
        },

        _buildRenderData: function() {
            const d = this.data;
            if (!d || !d.freqs || !d.freqs.length || !d.times || !d.times.length) return;

            const g = this._decimate(d);
            const NF = g.freqs.length;
            const NT = g.times.length;
            this.grid = g;

            // Normalize the scene into a fixed box on every axis. The previous
            // Math.max(8, ...) floor defeated this: any capture with more than
            // ~60 bins saturated at 8 units per bin and grew without bound (a
            // 1024-bin FFT produced an 8192-unit-wide scene for a camera built
            // for 480), which is what stretched the surface into a ribbon.
            this.spacingX = this.sceneSize / Math.max(NF - 1, 1);
            this.spacingZ = this.sceneSize / Math.max(NT - 1, 1);
            this.extentX = this.spacingX * Math.max(NF - 1, 1);
            this.extentZ = this.spacingZ * Math.max(NT - 1, 1);

            const spacingX = this.spacingX;
            const spacingZ = this.spacingZ;

            // Colour/height range from the decimated grid. Use a low percentile
            // rather than the raw minimum so a few dead bins cannot compress the
            // whole colour ramp into its top end.
            const allP = [];
            for (let ti = 0; ti < NT; ti++) {
                for (let fi = 0; fi < NF; fi++) allP.push(g.powers[ti][fi]);
            }
            if (allP.length === 0) return;
            const sorted = allP.slice().sort((a, b) => a - b);
            this.pLo = sorted[Math.floor(sorted.length * 0.02)];
            this.pHi = sorted[sorted.length - 1];
            if (this.pHi <= this.pLo) this.pHi = this.pLo + 1;

            this.renderedData = [];

            for (let ti = 0; ti < NT - 1; ti++) {
                for (let fi = 0; fi < NF - 1; fi++) {
                    const p1 = g.powers[ti][fi];
                    const p2 = g.powers[ti][fi+1];
                    const p3 = g.powers[ti+1][fi+1];
                    const p4 = g.powers[ti+1][fi];

                    const avgP = (p1 + p2 + p3 + p4) / 4;

                    const x1 = (fi - (NF - 1) / 2) * spacingX;
                    const x2 = (fi + 1 - (NF - 1) / 2) * spacingX;
                    const z1 = (ti - (NT - 1) / 2) * spacingZ;
                    const z2 = (ti + 1 - (NT - 1) / 2) * spacingZ;

                    const h1 = this._pHeight(p1);
                    const h2 = this._pHeight(p2);
                    const h3 = this._pHeight(p3);
                    const h4 = this._pHeight(p4);

                    this.renderedData.push({
                        type: 'cell',
                        ti, fi,
                        pts: [
                            {x: x1, y: h1, z: z1},
                            {x: x2, y: h2, z: z1},
                            {x: x2, y: h3, z: z2},
                            {x: x1, y: h4, z: z2}
                        ],
                        cx: (x1+x2)/2,
                        cy: (h1+h2+h3+h4)/4,
                        cz: (z1+z2)/2,
                        avgP: avgP,
                        isPeak: false,
                        isGlow: false,
                        isLabel: false,
                        freq: g.freqs[fi],
                        time: g.times[ti]
                    });
                }
            }

            // Decorate only the strongest N cells. Ranking once here keeps the
            // draw loop free of percentile tests over the whole grid.
            const ranked = this.renderedData.slice().sort((a, b) => b.avgP - a.avgP);
            const glowN  = Math.min(this.glowCount,  ranked.length);
            const peakN  = Math.min(this.peakCount,  ranked.length);
            const labelN = Math.min(this.labelCount, ranked.length);
            for (let i = 0; i < glowN; i++)  ranked[i].isGlow  = true;
            for (let i = 0; i < peakN; i++)  ranked[i].isPeak  = true;
            for (let i = 0; i < labelN; i++) ranked[i].isLabel = true;
        },
        
        _draw: function() {
            const ctx = this.ctx;
            const W = this.width;
            const H = this.height;

            this._updateCamera();

            ctx.clearRect(0, 0, W, H);
            
            // 1. Radial background glow
            const bgGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)/1.2);
            bgGrad.addColorStop(0, '#10101a');
            bgGrad.addColorStop(1, '#050508');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);
            
            let renderList = [];
            
            // 2. Grid lines — spans the actual scene footprint rather than a
            // fixed multiple of the bin spacing (which no longer tracks the
            // scene size now that spacing is normalized).
            if (this.showGrid) {
                const divs = 10;
                const hx = this.extentX / 2;
                const hz = this.extentZ / 2;
                for (let i = 0; i <= divs; i++) {
                    const gx = -hx + (this.extentX * i) / divs;
                    const gz = -hz + (this.extentZ * i) / divs;
                    renderList.push({ type: 'gridLine', pts: [
                        {x: gx, y: 0, z: -hz}, {x: gx, y: 0, z: hz}
                    ]});
                    renderList.push({ type: 'gridLine', pts: [
                        {x: -hx, y: 0, z: gz}, {x: hx, y: 0, z: gz}
                    ]});
                }
            }

            // 3. Collect renderable items, dropping anything behind the camera.
            this.renderedData.forEach(cell => {
                const cProj = this._project(cell.cx, cell.cy, cell.cz);
                if (!cProj.visible) return;

                const proj = cell.pts.map(p => this._project(p.x, p.y, p.z));
                for (let i = 0; i < proj.length; i++) {
                    if (!proj[i].visible) return;
                }

                renderList.push({
                    type: 'cell',
                    cell: cell,
                    proj: proj,
                    cProj: cProj,
                    depth: cProj.depth
                });
            });
            
            // Project grid lines to find their depths
            renderList.forEach(item => {
                if (item.type === 'gridLine') {
                    let sumD = 0;
                    let ok = true;
                    item.proj = item.pts.map(p => {
                        const pr = this._project(p.x, p.y, p.z);
                        if (!pr.visible) ok = false;
                        sumD += pr.depth;
                        return pr;
                    });
                    item.depth = sumD / item.pts.length;
                    item.clipped = !ok;
                }
            });
            renderList = renderList.filter(item => !item.clipped);

            // 4. Sort back-to-front
            renderList.sort((a, b) => b.depth - a.depth);
            
            let hoverCandidate = null;
            let minDist = 30; // Tooltip threshold
            
            // 5. Render each item
            renderList.forEach(item => {
                if (item.type === 'gridLine') {
                    ctx.beginPath();
                    item.proj.forEach((p, i) => {
                        if (i === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    });
                    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } else if (item.type === 'cell') {
                    const c = item.cell;
                    const p = item.proj;
                    const cp = item.cProj;
                    
                    if (this.mode === 0 || this.mode === 2) {
                        ctx.beginPath();
                        ctx.moveTo(p[0].x, p[0].y);
                        ctx.lineTo(p[1].x, p[1].y);
                        ctx.lineTo(p[2].x, p[2].y);
                        ctx.lineTo(p[3].x, p[3].y);
                        ctx.closePath();
                        
                        if (this.mode === 0) { // Surface quads
                            ctx.fillStyle = this._pColor(c.avgP, 0.85);
                            ctx.fill();
                            ctx.strokeStyle = this._pColor(c.avgP, 0.35);
                            ctx.lineWidth = 0.5;
                            ctx.stroke();
                        } else { // Wireframe quads
                            ctx.strokeStyle = this._pColor(c.avgP, 0.7);
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                    } else if (this.mode === 1) { // Bars
                        const baseProj = this._project(c.cx, 0, c.cz);
                        const topProj = cp;
                        const w = 15 * cp.scale;
                        
                        // Linear gradient from bottom to top
                        const grad = ctx.createLinearGradient(baseProj.x, baseProj.y, topProj.x, topProj.y);
                        grad.addColorStop(0, this._pColor(c.avgP, 0.3));
                        grad.addColorStop(1, this._pColor(c.avgP, 0.9));
                        
                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.moveTo(baseProj.x - w, baseProj.y);
                        ctx.lineTo(baseProj.x + w, baseProj.y);
                        ctx.lineTo(topProj.x + w, topProj.y);
                        ctx.lineTo(topProj.x - w, topProj.y);
                        ctx.closePath();
                        ctx.fill();
                        
                        // Top cap
                        ctx.fillStyle = this._pColor(c.avgP, 1);
                        ctx.beginPath();
                        ctx.ellipse(topProj.x, topProj.y, w, w * 0.4, 0, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    
                    // Peak glow (items > 75th percentile)
                    if (c.isGlow && this.mode !== 1) {
                        const r = 20 * cp.scale;
                        if (r > 0) {
                            const glow = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, r);
                            glow.addColorStop(0, this._pColor(c.avgP, 0.4));
                            glow.addColorStop(1, 'rgba(0,0,0,0)');
                            ctx.fillStyle = glow;
                            ctx.beginPath();
                            ctx.arc(cp.x, cp.y, r, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                    
                    // 6. Peak markers (top 10%)
                    if (c.isPeak) {
                        const r = (2 + Math.sin(this.pulseTime) * 1) * cp.scale;
                        if (r > 0) {
                            // Pulsing red dots
                            ctx.fillStyle = 'rgba(244,63,94,1)'; 
                            ctx.beginPath();
                            ctx.arc(cp.x, cp.y, r, 0, Math.PI*2);
                            ctx.fill();
                            
                            // Halo
                            ctx.strokeStyle = 'rgba(244,63,94,0.5)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.arc(cp.x, cp.y, r * 2.5, 0, Math.PI*2);
                            ctx.stroke();
                            
                            // Label — only the few strongest cells, so the
                            // readout stays readable instead of becoming a wall
                            // of overlapping numbers.
                            if (this.showLabels && c.isLabel) {
                                ctx.fillStyle = '#fff';
                                ctx.font = `${Math.max(9, 11*cp.scale)}px sans-serif`;
                                ctx.textAlign = 'left';
                                ctx.fillText(c.avgP.toFixed(1), cp.x + 6, cp.y - 6);
                            }
                        }
                    }
                    
                    // Interaction check
                    if (cp.scale > 0) {
                        const dx = this.mouseX - cp.x;
                        const dy = this.mouseY - cp.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist < minDist) {
                            minDist = dist;
                            hoverCandidate = { cell: c, proj: cp };
                        }
                    }
                }
            });
            
            // 7. Axis labels — driven by the decimated grid that was actually
            // drawn, so tick positions line up with the rendered surface.
            const g = this.grid;
            if (this.showLabels && g && g.freqs && g.freqs.length) {
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = '500 11px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';

                const NF = g.freqs.length;
                const spacingX = this.spacingX;
                const zEdge = -this.extentZ / 2;

                const step = Math.max(1, Math.floor(NF / 6));
                for (let i = 0; i < NF; i += step) {
                    const x = (i - (NF - 1) / 2) * spacingX;
                    const p = this._project(x, 0, zEdge - 18);
                    if (p.visible) ctx.fillText(g.freqs[i].toFixed(1), p.x, p.y);
                }

                ctx.font = '600 12px "Inter", sans-serif';
                const titleF = this._project(0, 0, zEdge - 52);
                if (titleF.visible) ctx.fillText('FREQUENCY (MHz)', titleF.x, titleF.y);

                const titleT = this._project(this.extentX / 2 + 42, 0, 0);
                if (titleT.visible) ctx.fillText('TIME →', titleT.x, titleT.y);
            }
            
            // 8. Hover highlight
            if (hoverCandidate) {
                const p = hoverCandidate.proj;
                const c = hoverCandidate.cell;
                
                const floorProj = this._project(c.cx, 0, c.cz);
                
                // Dashed vertical line to floor
                ctx.beginPath();
                ctx.setLineDash([4, 4]);
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(floorProj.x, floorProj.y);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.setLineDash([]);
                
                // White circle
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
                ctx.fillStyle = '#fff';
                ctx.fill();
                ctx.strokeStyle = '#000';
                ctx.stroke();
                
                this._updateTooltip(hoverCandidate, p.x, p.y);
                this.hoverPoint = hoverCandidate;
            } else {
                if (this.tt) this.tt.style.opacity = '0';
                this.hoverPoint = null;
            }
        },
        
        _updateTooltip: function(hc, px, py) {
            if (!this.tt) return;
            const c = hc.cell;
            
            this.ttf.textContent = `${c.freq.toFixed(1)} MHz`;
            this.ttp.textContent = `${c.avgP.toFixed(1)} dBm`;
            this.ttc.textContent = 'RF Signal';
            
            // Convert canvas-relative to viewport coords for position:fixed tooltip
            const rect = this.canvas.getBoundingClientRect();
            this.tt.style.left = (rect.left + px + 15) + 'px';
            this.tt.style.top = (rect.top + py - 15) + 'px';
            this.tt.style.opacity = '1';
        }
    };
})(window);
