/* ============================================
   HANSE - Enhanced Map Renderer
   Phase 4: Complete visual overhaul
   ============================================ */

// --- Fast 2D Simplex Noise (self-contained) ---
const SimplexNoise = (() => {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const grad3 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
    const perm = new Uint8Array(512);
    const permMod8 = new Uint8Array(512);
    // Seed with deterministic values
    const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,
        69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,
        203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,
        165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,
        92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,
        89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,
        226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,
        182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,
        43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
        228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,
        49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,
        236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
    for (let i = 0; i < 512; i++) {
        perm[i] = p[i & 255];
        permMod8[i] = perm[i] % 8;
    }
    return {
        noise2D(xin, yin) {
            const s = (xin + yin) * F2;
            const i = Math.floor(xin + s);
            const j = Math.floor(yin + s);
            const t = (i + j) * G2;
            const X0 = i - t, Y0 = j - t;
            const x0 = xin - X0, y0 = yin - Y0;
            const i1 = x0 > y0 ? 1 : 0;
            const j1 = x0 > y0 ? 0 : 1;
            const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
            const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
            const ii = i & 255, jj = j & 255;
            let n0 = 0, n1 = 0, n2 = 0;
            let t0 = 0.5 - x0 * x0 - y0 * y0;
            if (t0 >= 0) { t0 *= t0; const g = grad3[permMod8[ii + perm[jj]]]; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
            let t1 = 0.5 - x1 * x1 - y1 * y1;
            if (t1 >= 0) { t1 *= t1; const g = grad3[permMod8[ii + i1 + perm[jj + j1]]]; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
            let t2 = 0.5 - x2 * x2 - y2 * y2;
            if (t2 >= 0) { t2 *= t2; const g = grad3[permMod8[ii + 1 + perm[jj + 1]]]; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
            return 70 * (n0 + n1 + n2);
        },
        // Fractal Brownian Motion for richer textures
        fbm(x, y, octaves, lacunarity, gain) {
            let sum = 0, amp = 1, freq = 1, max = 0;
            for (let i = 0; i < octaves; i++) {
                sum += this.noise2D(x * freq, y * freq) * amp;
                max += amp;
                amp *= gain;
                freq *= lacunarity;
            }
            return sum / max;
        }
    };
})();

// --- Reusable Particle Pool with object pooling ---
class ParticlePool {
    constructor(maxSize = 300) {
        this.pool = [];
        this.active = [];
        this.maxSize = maxSize;
    }

    _create() {
        return { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, decay: 0.01,
                 color: '#fff', alpha: 1, sizeDecay: 0, gravity: 0, windFactor: 0,
                 type: 'circle', rotation: 0, rotSpeed: 0, data: null };
    }

    spawn(opts) {
        let p = this.pool.pop() || this._create();
        p.x = opts.x || 0;
        p.y = opts.y || 0;
        p.vx = opts.vx || 0;
        p.vy = opts.vy || 0;
        p.life = opts.life || 1;
        p.maxLife = opts.life || 1;
        p.size = opts.size || 1;
        p.decay = opts.decay || 0.01;
        p.color = opts.color || '#fff';
        p.alpha = opts.alpha || 1;
        p.sizeDecay = opts.sizeDecay || 0;
        p.gravity = opts.gravity || 0;
        p.windFactor = opts.windFactor || 0;
        p.type = opts.type || 'circle';
        p.rotation = opts.rotation || 0;
        p.rotSpeed = opts.rotSpeed || 0;
        p.data = opts.data || null;
        if (this.active.length < this.maxSize) {
            this.active.push(p);
        } else {
            this.pool.push(p);
        }
        return p;
    }

    update(windX, windY) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            p.life -= p.decay;
            if (p.life <= 0) {
                this.active.splice(i, 1);
                this.pool.push(p);
                continue;
            }
            p.x += p.vx + windX * p.windFactor;
            p.y += p.vy + windY * p.windFactor;
            p.vy += p.gravity;
            p.size = Math.max(0.1, p.size + p.sizeDecay);
            p.rotation += p.rotSpeed;
        }
    }

    draw(ctx, cam) {
        for (let i = 0; i < this.active.length; i++) {
            const p = this.active[i];
            const a = p.alpha * (p.life / p.maxLife);
            if (a < 0.005) continue;
            ctx.globalAlpha = a;
            ctx.fillStyle = p.color;
            if (p.type === 'circle') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            } else if (p.type === 'rect') {
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.4);
            } else if (p.type === 'line') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = p.size * 0.3;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.vx * 4, p.y + p.vy * 4);
                ctx.stroke();
            } else if (p.type === 'flake') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = a * 0.5;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * 1.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    drawWorld(ctx, map) {
        for (let i = 0; i < this.active.length; i++) {
            const p = this.active[i];
            const a = p.alpha * (p.life / p.maxLife);
            if (a < 0.005) continue;
            const sp = map.worldToScreen(p.x, p.y);
            const ss = p.size * map.scale;
            if (sp.x < -20 || sp.x > map.width + 20 || sp.y < -20 || sp.y > map.height + 20) continue;
            ctx.globalAlpha = a;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, ss, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    clear() {
        while (this.active.length > 0) this.pool.push(this.active.pop());
    }

    get count() { return this.active.length; }
}

const GameMap = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    hoveredCity: null,
    selectedCity: null,
    animFrame: 0,
    waveOffset: 0,
    // Pre-rendered layers for performance
    landCanvas: null,
    landCtx: null,
    landDirty: true,
    // Ship wake particles
    wakes: [],
    // Sea sparkle particles
    sparkles: [],
    // Seagulls
    seagulls: [],
    // Clouds
    clouds: [],
    // Compass rose rotation
    compassAngle: 0,
    // Harbor smoke particles
    smokeParticles: [],
    // Ship arrival particles
    arrivalParticles: [],
    // Seeded terrain features (generated once per resize)
    terrainSeed: null,

    // --- Camera system ---
    camera: { x: 600, y: 350, zoom: 1.0 },
    targetCamera: { x: 600, y: 350, zoom: 1.0 },
    cameraSmoothing: 0.12,
    MIN_ZOOM: 0.5,
    MAX_ZOOM: 4.0,
    baseScale: 1,

    // Pan/drag state
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    dragCameraStart: { x: 0, y: 0 },
    lastDragPos: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    hasDragged: false,

    // Ship selection & follow
    selectedShip: null,
    followingShip: false,

    // Minimap
    minimapCanvas: null,
    minimapCtx: null,
    minimapDirty: true,
    MINIMAP_W: 160,
    MINIMAP_H: 94,
    minimapDragging: false,

    // Land buffer cache tracking
    lastLandZoom: 1.0,
    lastLandCameraX: 600,
    lastLandCameraY: 350,

    // Label collision detection
    labelRects: [],

    // Route preview
    routePreview: null,

    // Cached game state for click handlers
    _lastGameState: null,

    // Touch pinch state
    pinchStartDist: 0,
    pinchStartZoom: 1,

    // Particle pools (object-pooled)
    rainPool: new ParticlePool(400),
    snowPool: new ParticlePool(300),
    fogPool: new ParticlePool(30),
    marketPool: new ParticlePool(80),
    cityGlowPool: new ParticlePool(60),

    // Docked ship positions per city (cached)
    _dockedShipCache: {},
    _dockedShipCacheTick: -1,

    init() {
        this.canvas = document.getElementById('game-map');
        this.ctx = this.canvas.getContext('2d');
        // Off-screen canvas for land (static, drawn once)
        this.landCanvas = document.createElement('canvas');
        this.landCtx = this.landCanvas.getContext('2d');
        // Minimap off-screen canvas
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.width = this.MINIMAP_W;
        this.minimapCanvas.height = this.MINIMAP_H;
        this.minimapCtx = this.minimapCanvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => { this.resize(); this.landDirty = true; this.minimapDirty = true; });
        // Full input system
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        // Prevent context menu on canvas for right-click
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        // Seed sparkles
        for (let i = 0; i < 60; i++) {
            this.sparkles.push({
                x: Math.random(), y: Math.random(),
                phase: Math.random() * Math.PI * 2,
                speed: 0.02 + Math.random() * 0.03,
                size: 0.5 + Math.random() * 1.5
            });
        }
        // Seed seagulls
        for (let i = 0; i < 8; i++) {
            this.seagulls.push({
                x: Math.random(),
                y: Math.random() * 0.6,
                speed: 0.0004 + Math.random() * 0.0006,
                wingPhase: Math.random() * Math.PI * 2,
                wingSpeed: 0.08 + Math.random() * 0.06,
                size: 0.6 + Math.random() * 0.5,
                dy: (Math.random() - 0.5) * 0.0002,
                circlePhase: Math.random() * Math.PI * 2,
                circleRadius: 0.005 + Math.random() * 0.01
            });
        }
        // Seed clouds
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random(),
                y: 0.03 + Math.random() * 0.25,
                speed: 0.00008 + Math.random() * 0.00012,
                scale: 0.6 + Math.random() * 0.8,
                opacity: 0.06 + Math.random() * 0.08,
                blobs: this._generateCloudBlobs()
            });
        }
        // Generate terrain seed for deterministic placement
        this.generateTerrainSeed();
    },

    generateTerrainSeed() {
        // Seeded random for consistent terrain
        const rng = (seed) => { let s = seed; return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; }; };
        const r = rng(42);
        this.terrainSeed = {
            mountains: [],
            forests: [],
            treeClusters: []
        };
        // Norwegian mountains (spine along western Scandinavia)
        for (let i = 0; i < 18; i++) {
            this.terrainSeed.mountains.push({
                x: 248 + r() * 25, y: 15 + i * 14 + r() * 8,
                size: 0.6 + r() * 0.6, snow: r() > 0.4
            });
        }
        // Swedish highlands
        for (let i = 0; i < 8; i++) {
            this.terrainSeed.mountains.push({
                x: 320 + r() * 80, y: 140 + i * 18 + r() * 10,
                size: 0.4 + r() * 0.4, snow: r() > 0.6
            });
        }
        // Scandinavian forests
        for (let i = 0; i < 40; i++) {
            this.terrainSeed.forests.push({
                x: 290 + r() * 200, y: 30 + r() * 230,
                size: 0.4 + r() * 0.5, count: 2 + Math.floor(r() * 4)
            });
        }
        // Finnish forests
        for (let i = 0; i < 25; i++) {
            this.terrainSeed.forests.push({
                x: 670 + r() * 200, y: 20 + r() * 160,
                size: 0.35 + r() * 0.4, count: 2 + Math.floor(r() * 3)
            });
        }
        // German/Polish forests
        for (let i = 0; i < 30; i++) {
            this.terrainSeed.forests.push({
                x: 300 + r() * 400, y: 410 + r() * 150,
                size: 0.3 + r() * 0.35, count: 2 + Math.floor(r() * 3)
            });
        }
        // Baltic states forests
        for (let i = 0; i < 15; i++) {
            this.terrainSeed.forests.push({
                x: 770 + r() * 130, y: 380 + r() * 180,
                size: 0.3 + r() * 0.35, count: 2 + Math.floor(r() * 3)
            });
        }
    },

    _generateCloudBlobs() {
        const count = 3 + Math.floor(Math.random() * 4);
        const blobs = [];
        for (let i = 0; i < count; i++) {
            blobs.push({
                ox: (Math.random() - 0.5) * 40,
                oy: (Math.random() - 0.5) * 12,
                rx: 15 + Math.random() * 20,
                ry: 8 + Math.random() * 8
            });
        }
        return blobs;
    },

    resize() {
        const panel = document.getElementById('map-panel');
        this.width = panel.clientWidth;
        this.height = panel.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.landCanvas.width = this.width;
        this.landCanvas.height = this.height;
        // Base scale: how 1200x700 world fits in canvas at zoom=1
        this.baseScale = Math.min(this.width / CONFIG.MAP_WIDTH, this.height / CONFIG.MAP_HEIGHT);
        this.updateCameraOffsets();
        this.landDirty = true;
    },

    updateCameraOffsets() {
        this.scale = this.baseScale * this.camera.zoom;
        // Camera.x/y is the world point at canvas center
        this.offsetX = this.width / 2 - this.camera.x * this.scale;
        this.offsetY = this.height / 2 - this.camera.y * this.scale;
    },

    worldToScreen(x, y) {
        return {
            x: x * this.scale + this.offsetX,
            y: y * this.scale + this.offsetY
        };
    },

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.offsetX) / this.scale,
            y: (sy - this.offsetY) / this.scale
        };
    },

    render(gameState) {
        const ctx = this.ctx;
        this.animFrame++;
        this._lastGameState = gameState;

        // --- Camera animation ---
        this.camera.x += (this.targetCamera.x - this.camera.x) * this.cameraSmoothing;
        this.camera.y += (this.targetCamera.y - this.camera.y) * this.cameraSmoothing;
        this.camera.zoom += (this.targetCamera.zoom - this.camera.zoom) * this.cameraSmoothing;

        // Apply inertia momentum from drag release
        if (!this.isDragging) {
            this.targetCamera.x += this.velocity.x / this.scale;
            this.targetCamera.y += this.velocity.y / this.scale;
            this.velocity.x *= 0.92;
            this.velocity.y *= 0.92;
            if (Math.abs(this.velocity.x) < 0.1) this.velocity.x = 0;
            if (Math.abs(this.velocity.y) < 0.1) this.velocity.y = 0;
        }

        // Ship follow mode
        if (this.followingShip && this.selectedShip) {
            const shipWorld = this.getShipWorldPos(this.selectedShip);
            if (shipWorld) {
                this.targetCamera.x = shipWorld.x;
                this.targetCamera.y = shipWorld.y;
            }
        }

        // Clamp camera to world bounds with margin
        this.targetCamera.x = Utils.clamp(this.targetCamera.x, -100, CONFIG.MAP_WIDTH + 100);
        this.targetCamera.y = Utils.clamp(this.targetCamera.y, -100, CONFIG.MAP_HEIGHT + 100);
        this.targetCamera.zoom = Utils.clamp(this.targetCamera.zoom, this.MIN_ZOOM, this.MAX_ZOOM);

        this.updateCameraOffsets();

        // Seasonal tint factor (month 1-12)
        const month = gameState && gameState.date ? gameState.date.month : 6;
        const seasonDark = this._getSeasonalDarkness(month);

        // Rich deep ocean gradient with seasonal tinting
        const grad = ctx.createLinearGradient(0, 0, this.width * 0.3, this.height);
        const sf = 1 - seasonDark * 0.3;
        grad.addColorStop(0,   `rgb(${Math.round(5*sf)},${Math.round(20*sf)},${Math.round(45*sf)})`);
        grad.addColorStop(0.2, `rgb(${Math.round(8*sf)},${Math.round(30*sf)},${Math.round(58*sf)})`);
        grad.addColorStop(0.5, `rgb(${Math.round(12*sf)},${Math.round(42*sf)},${Math.round(78*sf)})`);
        grad.addColorStop(0.8, `rgb(${Math.round(10*sf)},${Math.round(38*sf)},${Math.round(70*sf)})`);
        grad.addColorStop(1,   `rgb(${Math.round(6*sf)},${Math.round(25*sf)},${Math.round(52*sf)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Subtle radial depth: lighter center, darker edges (vignette on sea)
        const vigR = Math.max(this.width, this.height) * 0.75;
        const seaVig = ctx.createRadialGradient(
            this.width * 0.5, this.height * 0.4, vigR * 0.2,
            this.width * 0.5, this.height * 0.4, vigR
        );
        seaVig.addColorStop(0, 'rgba(20, 60, 100, 0.08)');
        seaVig.addColorStop(1, 'rgba(2, 8, 20, 0.15)');
        ctx.fillStyle = seaVig;
        ctx.fillRect(0, 0, this.width, this.height);

        // Animated water
        this.drawSea(ctx);

        // Wind current lines on water
        this.drawWindCurrents(ctx, gameState);

        // Sea sparkles
        this.drawSparkles(ctx);

        // Clouds (behind everything else, atmospheric)
        this.drawClouds(ctx);

        // Draw sea routes
        this.drawRoutes(ctx, gameState);

        // Pre-rendered land (smart cache invalidation based on zoom/pan)
        const zoomChanged = Math.abs(this.camera.zoom - this.lastLandZoom) > 0.05;
        const panChanged = Math.abs(this.camera.x - this.lastLandCameraX) > 5 ||
                           Math.abs(this.camera.y - this.lastLandCameraY) > 5;
        if (this.landDirty || zoomChanged || panChanged) {
            this.renderLandToBuffer();
            this.landDirty = false;
            this.minimapDirty = true;
            this.lastLandZoom = this.camera.zoom;
            this.lastLandCameraX = this.camera.x;
            this.lastLandCameraY = this.camera.y;
        }
        ctx.drawImage(this.landCanvas, 0, 0);

        // Ship wakes (behind ships)
        this.drawWakes(ctx);

        // Draw ships
        if (gameState) {
            this.drawShips(ctx, gameState);
        }

        // Harbor smoke particles (behind city labels)
        this.drawHarborSmoke(ctx, gameState);

        // City glow (behind cities)
        this.drawCityGlow(ctx, gameState);

        // Pier/dock details
        this.drawPiers(ctx, gameState);

        // Cities on top
        this.drawCities(ctx, gameState);

        // Night windows overlay on cities
        this.drawNightWindows(ctx, gameState);

        // Market activity dots near cities
        this.drawMarketActivity(ctx, gameState);

        // Production icons at high zoom
        this.drawProductionIcons(ctx, gameState);

        // Lighthouse beacons
        this.drawLighthouses(ctx, gameState);

        // Hovered city highlight
        if (this.hoveredCity) {
            this.drawCityHighlight(ctx, this.hoveredCity);
        }

        // Seagulls (on top of everything, in the sky)
        this.drawSeagulls(ctx);

        // Arrival particles
        this.drawArrivalParticles(ctx);

        // Weather effects overlay
        this.drawWeatherEffects(ctx, gameState);

        // Seasonal darkness overlay
        if (seasonDark > 0.1) {
            ctx.fillStyle = `rgba(5, 10, 25, ${seasonDark * 0.18})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        // --- God rays (subtle, from upper-right in good weather) ---
        if (gameState && gameState.wind && gameState.wind.strength < 1.5) {
            const rayAlpha = (1.5 - gameState.wind.strength) * 0.015 * (1 - seasonDark * 0.6);
            if (rayAlpha > 0.002) {
                ctx.save();
                ctx.globalAlpha = rayAlpha;
                const rx = this.width * 0.88;
                const ry = -this.height * 0.1;
                for (let i = 0; i < 5; i++) {
                    const angle = -0.3 + i * 0.15;
                    const len = this.height * 1.4;
                    ctx.beginPath();
                    ctx.moveTo(rx, ry);
                    ctx.lineTo(rx + Math.cos(angle) * len, ry + Math.sin(angle) * len);
                    ctx.lineTo(rx + Math.cos(angle + 0.04) * len, ry + Math.sin(angle + 0.04) * len);
                    ctx.closePath();
                    ctx.fillStyle = `rgba(255, 240, 200, ${0.3 + i * 0.05})`;
                    ctx.fill();
                }
                ctx.globalAlpha = 1;
                ctx.restore();
            }
        }

        // --- Vignette overlay (darkened edges) ---
        const vigSize = Math.max(this.width, this.height) * 0.8;
        const vignette = ctx.createRadialGradient(
            this.width * 0.5, this.height * 0.45, vigSize * 0.35,
            this.width * 0.5, this.height * 0.45, vigSize
        );
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(0.7, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, this.width, this.height);

        // Minimap
        this.drawMinimap(ctx, gameState);

        // Compass rose
        this.drawCompass(ctx, gameState);

        // Zoom level indicator
        if (Math.abs(this.camera.zoom - 1.0) > 0.05) {
            ctx.font = '11px sans-serif';
            ctx.fillStyle = 'rgba(200, 190, 160, 0.5)';
            ctx.textAlign = 'left';
            ctx.fillText(`${Math.round(this.camera.zoom * 100)}%`, 12, 20);
        }

        // Follow indicator
        if (this.followingShip && this.selectedShip) {
            ctx.font = '10px sans-serif';
            ctx.fillStyle = 'rgba(93, 173, 226, 0.7)';
            ctx.textAlign = 'left';
            ctx.fillText(`Following: ${this.selectedShip.name}`, 12, 34);
        }
    },

    _getSeasonalDarkness(month) {
        // 0 = summer (bright), 1 = deep winter (dark)
        // Month 6-7 = summer (0), Month 12-1 = winter (1)
        const distFromSummer = Math.abs(((month - 1 + 6) % 12) - 6);
        return distFromSummer / 6;
    },

    drawSea(ctx) {
        const t = this.animFrame;

        // --- Depth zone overlay: lighter near coasts ---
        // Subtle noise-based depth variation across the sea
        const stepX = 18, stepY = 18;
        for (let sy = 0; sy < this.height; sy += stepY) {
            for (let sx = 0; sx < this.width; sx += stepX) {
                const n = SimplexNoise.fbm(sx * 0.003 + t * 0.0004, sy * 0.003, 3, 2.0, 0.5);
                const depth = (n + 1) * 0.5; // 0..1
                if (depth > 0.55) {
                    ctx.fillStyle = `rgba(25, 80, 140, ${(depth - 0.55) * 0.18})`;
                    ctx.fillRect(sx, sy, stepX, stepY);
                } else if (depth < 0.4) {
                    ctx.fillStyle = `rgba(50, 140, 200, ${(0.4 - depth) * 0.12})`;
                    ctx.fillRect(sx, sy, stepX, stepY);
                }
            }
        }

        // --- Layer 1: deep rolling swells ---
        ctx.strokeStyle = 'rgba(15, 55, 110, 0.18)';
        ctx.lineWidth = 2;
        for (let y = -10; y < this.height + 10; y += 32) {
            ctx.beginPath();
            for (let x = 0; x < this.width; x += 4) {
                const n = SimplexNoise.noise2D(x * 0.004 + t * 0.006, y * 0.006);
                const wy = y
                    + Math.sin((x * 0.006) + t * 0.01) * 7
                    + n * 5
                    + Math.sin((x * 0.012) + t * 0.018 + y * 0.008) * 3;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }

        // --- Layer 2: medium chop ---
        ctx.strokeStyle = 'rgba(30, 90, 160, 0.10)';
        ctx.lineWidth = 1;
        for (let y = 5; y < this.height; y += 18) {
            ctx.beginPath();
            for (let x = 0; x < this.width; x += 3) {
                const wy = y
                    + Math.sin((x * 0.018) + t * 0.028 + y * 0.004) * 2.5
                    + Math.cos((x * 0.025) + t * 0.014) * 1.8
                    + SimplexNoise.noise2D(x * 0.01, y * 0.01 + t * 0.005) * 1.5;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }

        // --- Layer 3: fine surface ripples ---
        ctx.strokeStyle = 'rgba(50, 120, 190, 0.06)';
        ctx.lineWidth = 0.6;
        for (let y = 2; y < this.height; y += 10) {
            ctx.beginPath();
            for (let x = 0; x < this.width; x += 3) {
                const wy = y
                    + Math.sin((x * 0.035) + t * 0.04 + y * 0.008) * 1.2
                    + Math.cos((x * 0.05) + t * 0.025 + y * 0.003) * 0.8;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }

        // --- Caustic light patches (underwater light refraction) ---
        ctx.globalAlpha = 0.04;
        for (let i = 0; i < 25; i++) {
            const cx = ((i * 157 + t * 0.3) % (this.width + 60)) - 30;
            const cy = ((i * 223 + t * 0.2) % (this.height + 60)) - 30;
            const sz = 15 + Math.sin(t * 0.015 + i) * 8;
            const bright = (Math.sin(t * 0.02 + i * 2.1) + 1) * 0.5;
            ctx.fillStyle = `rgba(80, 180, 255, ${bright})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, sz, sz * 0.6, i * 0.7 + t * 0.003, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // --- Foam highlights on wave crests ---
        for (let y = 0; y < this.height; y += 40) {
            const wavePhase = t * 0.01 + y * 0.018;
            for (let x = 0; x < this.width; x += 5) {
                const wy = y + Math.sin((x * 0.007) + wavePhase) * 8;
                const brightness = Math.max(0, Math.sin((x * 0.007) + wavePhase));
                if (brightness > 0.82) {
                    const alpha = (brightness - 0.82) * 3.5;
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = 'rgba(190, 225, 255, 0.2)';
                    ctx.fillRect(x, wy - 1, 8, 2.5);
                    // Foam speckles
                    if (brightness > 0.9) {
                        ctx.fillStyle = 'rgba(220, 240, 255, 0.3)';
                        ctx.fillRect(x + 2, wy - 2, 2, 1.5);
                        ctx.fillRect(x + 6, wy + 0.5, 1.5, 1);
                    }
                }
            }
        }
        ctx.globalAlpha = 1;
    },

    // --- Wind current lines showing wind direction on water ---
    drawWindCurrents(ctx, gameState) {
        if (!gameState || !gameState.wind) return;
        const t = this.animFrame;
        const windAngle = gameState.wind.direction * Math.PI / 4;
        const windStr = gameState.wind.strength;
        if (windStr < 0.3) return; // No visible currents in calm weather

        const dx = Math.cos(windAngle);
        const dy = Math.sin(windAngle);
        const lineCount = Math.floor(8 + windStr * 6);
        const alpha = Utils.clamp(windStr * 0.025, 0.01, 0.06);

        ctx.save();
        ctx.strokeStyle = `rgba(120, 180, 230, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.lineCap = 'round';

        for (let i = 0; i < lineCount; i++) {
            // Distribute lines across the screen using hash-like positioning
            const seed = i * 173 + 37;
            const baseX = ((seed * 7 + t * dx * 1.5) % (this.width + 200)) - 100;
            const baseY = ((seed * 13 + t * dy * 1.5) % (this.height + 200)) - 100;
            const len = 30 + windStr * 20 + Math.sin(seed) * 10;
            const waviness = Math.sin(t * 0.01 + i * 0.8) * 3;

            ctx.beginPath();
            ctx.moveTo(baseX, baseY + waviness);
            ctx.quadraticCurveTo(
                baseX + dx * len * 0.5, baseY + dy * len * 0.5 + waviness * 0.5,
                baseX + dx * len, baseY + dy * len
            );
            ctx.stroke();

            // Small arrow tip
            if (windStr > 1.0) {
                const tipX = baseX + dx * len;
                const tipY = baseY + dy * len;
                ctx.beginPath();
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(tipX - dx * 4 + dy * 3, tipY - dy * 4 - dx * 3);
                ctx.moveTo(tipX, tipY);
                ctx.lineTo(tipX - dx * 4 - dy * 3, tipY - dy * 4 + dx * 3);
                ctx.stroke();
            }
        }
        ctx.restore();
    },

    drawSparkles(ctx) {
        const t = this.animFrame;
        this.sparkles.forEach(s => {
            const brightness = (Math.sin(t * s.speed + s.phase) + 1) * 0.5;
            if (brightness > 0.65) {
                const sx = s.x * this.width;
                const sy = s.y * this.height;
                const alpha = (brightness - 0.65) * 2.5;
                // Outer glow
                ctx.globalAlpha = alpha * 0.3;
                ctx.fillStyle = 'rgba(150, 210, 255, 0.5)';
                ctx.beginPath();
                ctx.arc(sx, sy, s.size * 2.5, 0, Math.PI * 2);
                ctx.fill();
                // Bright core
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#d0eaff';
                ctx.beginPath();
                ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
                ctx.fill();
                // Star cross highlight
                if (brightness > 0.85) {
                    ctx.globalAlpha = (brightness - 0.85) * 4;
                    ctx.strokeStyle = 'rgba(220, 240, 255, 0.6)';
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(sx - s.size * 2, sy);
                    ctx.lineTo(sx + s.size * 2, sy);
                    ctx.moveTo(sx, sy - s.size * 2);
                    ctx.lineTo(sx, sy + s.size * 2);
                    ctx.stroke();
                }
            }
        });
        ctx.globalAlpha = 1;
    },

    renderLandToBuffer() {
        const ctx = this.landCtx;
        ctx.clearRect(0, 0, this.width, this.height);

        // --- Shallow water zones (3 bands for depth transition) ---
        ctx.save();
        // Outermost shallow band - turquoise tint
        ctx.fillStyle = 'rgba(25, 85, 130, 0.35)';
        ctx.strokeStyle = 'rgba(40, 110, 160, 0.2)';
        ctx.lineWidth = 0.5;
        this.drawAllLandMasses(ctx, false, 18);
        // Middle band
        ctx.fillStyle = 'rgba(35, 110, 160, 0.30)';
        this.drawAllLandMasses(ctx, false, 12);
        // Inner shallow band - lighter cyan
        ctx.fillStyle = 'rgba(50, 140, 190, 0.22)';
        this.drawAllLandMasses(ctx, false, 6);
        // Beach/sand strip (narrow warm band)
        ctx.fillStyle = 'rgba(180, 165, 120, 0.18)';
        this.drawAllLandMasses(ctx, false, 3);
        ctx.restore();

        // --- Main land base color with latitude gradient ---
        const landGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        landGrad.addColorStop(0, '#1e4a28');   // dark boreal north
        landGrad.addColorStop(0.2, '#265530');  // taiga
        landGrad.addColorStop(0.4, '#2d6233');  // mixed forest
        landGrad.addColorStop(0.6, '#387038');  // temperate
        landGrad.addColorStop(0.8, '#3a7535');  // southern lowlands
        landGrad.addColorStop(1, '#2e5e2a');    // deep south
        ctx.fillStyle = landGrad;
        ctx.strokeStyle = 'rgba(60, 100, 50, 0.6)';
        ctx.lineWidth = 1.5;
        this.drawAllLandMasses(ctx);

        // --- Noise-based terrain texture overlay ---
        // Clip to land masses so texture only appears on land
        ctx.save();
        ctx.beginPath();
        const masses = this.getLandMasses();
        masses.forEach(pts => {
            if (pts.length < 3) return;
            const first = this.worldToScreen(pts[0][0], pts[0][1]);
            ctx.moveTo(first.x, first.y);
            for (let i = 1; i < pts.length; i++) {
                const p = this.worldToScreen(pts[i][0], pts[i][1]);
                ctx.lineTo(p.x, p.y);
            }
            ctx.closePath();
        });
        ctx.clip();

        // Paint noise texture within the clipped land
        const tStep = 12;
        for (let ty = 0; ty < this.height; ty += tStep) {
            for (let tx = 0; tx < this.width; tx += tStep) {
                const n = SimplexNoise.fbm(tx * 0.008, ty * 0.008, 4, 2.0, 0.5);
                const val = (n + 1) * 0.5; // normalize 0..1
                if (val > 0.55) {
                    // Highland patches (browner)
                    ctx.fillStyle = `rgba(90, 75, 45, ${(val - 0.55) * 0.35})`;
                    ctx.fillRect(tx, ty, tStep, tStep);
                } else if (val < 0.4) {
                    // Lowland meadows (brighter green)
                    ctx.fillStyle = `rgba(60, 120, 50, ${(0.4 - val) * 0.25})`;
                    ctx.fillRect(tx, ty, tStep, tStep);
                }
                // Fine grain detail
                const n2 = SimplexNoise.noise2D(tx * 0.025, ty * 0.025);
                if (n2 > 0.3) {
                    ctx.fillStyle = `rgba(30, 55, 25, ${(n2 - 0.3) * 0.15})`;
                    ctx.fillRect(tx, ty, tStep, tStep);
                }
            }
        }
        ctx.restore();

        // --- Coastline shadow and highlight ---
        ctx.save();
        ctx.shadowColor = 'rgba(0, 15, 35, 0.5)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        ctx.strokeStyle = 'rgba(40, 80, 45, 0.4)';
        ctx.lineWidth = 1.2;
        this.drawAllLandMasses(ctx, true);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.restore();

        // --- Coastal foam dots along shoreline ---
        ctx.save();
        ctx.fillStyle = 'rgba(200, 220, 240, 0.12)';
        masses.forEach(pts => {
            for (let i = 0; i < pts.length; i++) {
                const p = this.worldToScreen(pts[i][0], pts[i][1]);
                for (let d = 0; d < 3; d++) {
                    const ox = (Math.sin(i * 7 + d * 3) * 4 + Math.cos(i * 11) * 3) * this.scale;
                    const oy = (Math.cos(i * 5 + d * 2) * 4 + Math.sin(i * 13) * 3) * this.scale;
                    ctx.beginPath();
                    ctx.arc(p.x + ox, p.y + oy, (0.8 + d * 0.4) * this.scale, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });
        ctx.restore();

        // --- Rivers ---
        this.drawRivers(ctx);

        // --- Mountains ---
        this.drawMountains(ctx);

        // --- Forests ---
        this.drawForests(ctx);
    },

    drawRivers(ctx) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Elbe - flows into Hamburg from south
        const elbe = [[430, 600], [432, 540], [428, 490], [430, 450], [432, 420], [430, 370]];
        this.drawRiverPath(ctx, elbe, 2.0);

        // Oder - flows into Stettin from south
        const oder = [[610, 600], [615, 530], [618, 480], [615, 440], [616, 400], [615, 370]];
        this.drawRiverPath(ctx, oder, 1.7);

        // Weichsel/Vistula - flows into Danzig from south
        const weichsel = [[718, 600], [722, 530], [725, 470], [720, 420], [720, 380], [720, 340]];
        this.drawRiverPath(ctx, weichsel, 1.8);

        // Weser - flows near Bremen
        const weser = [[388, 600], [390, 520], [392, 460], [390, 385]];
        this.drawRiverPath(ctx, weser, 1.3);

        // Dvina - flows toward Riga from east
        const dvina = [[920, 260], [910, 255], [900, 248], [895, 242], [890, 240]];
        this.drawRiverPath(ctx, dvina, 1.2);

        ctx.restore();
    },

    drawRiverPath(ctx, points, widthMul) {
        if (points.length < 2) return;

        // River bank shadow (wider, darker)
        ctx.beginPath();
        const p0b = this.worldToScreen(points[0][0], points[0][1]);
        ctx.moveTo(p0b.x, p0b.y);
        for (let i = 1; i < points.length; i++) {
            const p = this.worldToScreen(points[i][0], points[i][1]);
            if (i < points.length - 1) {
                const pn = this.worldToScreen(points[i+1][0], points[i+1][1]);
                ctx.quadraticCurveTo(p.x, p.y, (p.x + pn.x) / 2, (p.y + pn.y) / 2);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.lineWidth = (widthMul + 1.2) * this.scale;
        ctx.strokeStyle = 'rgba(30, 65, 40, 0.25)';
        ctx.stroke();

        // Main river body
        ctx.beginPath();
        const p0 = this.worldToScreen(points[0][0], points[0][1]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < points.length; i++) {
            const p = this.worldToScreen(points[i][0], points[i][1]);
            if (i < points.length - 1) {
                const pn = this.worldToScreen(points[i+1][0], points[i+1][1]);
                ctx.quadraticCurveTo(p.x, p.y, (p.x + pn.x) / 2, (p.y + pn.y) / 2);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.lineWidth = widthMul * this.scale;
        ctx.strokeStyle = 'rgba(40, 105, 165, 0.55)';
        ctx.stroke();

        // Center highlight (specular reflection)
        ctx.lineWidth = widthMul * 0.35 * this.scale;
        ctx.strokeStyle = 'rgba(90, 170, 230, 0.30)';
        ctx.stroke();
    },

    drawMountains(ctx) {
        if (!this.terrainSeed) return;
        ctx.save();

        // Sort mountains back-to-front (by y) for overlap
        const sorted = [...this.terrainSeed.mountains].sort((a, b) => a.y - b.y);

        sorted.forEach(m => {
            if (!this.isInViewport(m.x, m.y, 80)) return;
            const p = this.worldToScreen(m.x, m.y);
            const s = m.size * this.scale * 8;

            // --- Ground shadow (cast shadow to the right) ---
            ctx.fillStyle = 'rgba(10, 30, 15, 0.25)';
            ctx.beginPath();
            ctx.moveTo(p.x - s * 0.7, p.y + s * 0.35);
            ctx.lineTo(p.x + s * 0.3, p.y - s * 0.7);
            ctx.lineTo(p.x + s * 1.3, p.y + s * 0.4);
            ctx.closePath();
            ctx.fill();

            // --- Dark face (left/shaded side) ---
            const darkR = Math.round(45 + m.size * 15);
            const darkG = Math.round(60 + m.size * 20);
            const darkB = Math.round(40 + m.size * 10);
            ctx.fillStyle = `rgba(${darkR}, ${darkG}, ${darkB}, 0.85)`;
            ctx.beginPath();
            ctx.moveTo(p.x - s * 0.75, p.y + s * 0.3);
            ctx.lineTo(p.x + s * 0.05, p.y - s * 0.95);
            ctx.lineTo(p.x + s * 0.05, p.y + s * 0.2);
            ctx.closePath();
            ctx.fill();

            // --- Light face (right/sunlit side) ---
            const lightR = Math.round(70 + m.size * 25);
            const lightG = Math.round(105 + m.size * 20);
            const lightB = Math.round(55 + m.size * 15);
            ctx.fillStyle = `rgba(${lightR}, ${lightG}, ${lightB}, 0.85)`;
            ctx.beginPath();
            ctx.moveTo(p.x + s * 0.05, p.y - s * 0.95);
            ctx.lineTo(p.x + s * 0.8, p.y + s * 0.3);
            ctx.lineTo(p.x + s * 0.05, p.y + s * 0.2);
            ctx.closePath();
            ctx.fill();

            // --- Ridge line (edge highlight) ---
            ctx.strokeStyle = `rgba(${lightR + 30}, ${lightG + 25}, ${lightB + 20}, 0.4)`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x + s * 0.05, p.y - s * 0.95);
            ctx.lineTo(p.x + s * 0.05, p.y + s * 0.2);
            ctx.stroke();

            // --- Rock striations on dark face ---
            ctx.strokeStyle = `rgba(${darkR - 15}, ${darkG - 10}, ${darkB - 10}, 0.2)`;
            ctx.lineWidth = 0.5;
            for (let i = 1; i <= 3; i++) {
                const frac = i * 0.22;
                ctx.beginPath();
                ctx.moveTo(p.x - s * 0.75 * (1 - frac), p.y + s * 0.3 - s * 0.3 * frac);
                ctx.lineTo(p.x + s * 0.05, p.y - s * 0.95 + s * 1.15 * (1 - frac));
                ctx.stroke();
            }

            // --- Snow cap with gradient melt ---
            if (m.snow) {
                // Snow on sunlit side
                ctx.fillStyle = 'rgba(230, 240, 250, 0.75)';
                ctx.beginPath();
                ctx.moveTo(p.x + s * 0.05, p.y - s * 0.95);
                ctx.lineTo(p.x + s * 0.25, p.y - s * 0.55);
                ctx.quadraticCurveTo(p.x + s * 0.15, p.y - s * 0.50, p.x + s * 0.05, p.y - s * 0.48);
                ctx.closePath();
                ctx.fill();

                // Snow on shaded side (slightly darker/blue)
                ctx.fillStyle = 'rgba(200, 215, 235, 0.65)';
                ctx.beginPath();
                ctx.moveTo(p.x + s * 0.05, p.y - s * 0.95);
                ctx.lineTo(p.x - s * 0.22, p.y - s * 0.52);
                ctx.quadraticCurveTo(p.x - s * 0.08, p.y - s * 0.45, p.x + s * 0.05, p.y - s * 0.48);
                ctx.closePath();
                ctx.fill();

                // Snow drip edge
                ctx.strokeStyle = 'rgba(220, 235, 250, 0.3)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(p.x - s * 0.22, p.y - s * 0.52);
                ctx.quadraticCurveTo(p.x - s * 0.08, p.y - s * 0.44, p.x + s * 0.05, p.y - s * 0.48);
                ctx.quadraticCurveTo(p.x + s * 0.15, p.y - s * 0.49, p.x + s * 0.25, p.y - s * 0.55);
                ctx.stroke();
            }

            // --- Atmospheric haze at base ---
            const hazeGrd = ctx.createLinearGradient(p.x, p.y - s * 0.1, p.x, p.y + s * 0.4);
            hazeGrd.addColorStop(0, 'rgba(45, 65, 40, 0)');
            hazeGrd.addColorStop(1, 'rgba(35, 55, 35, 0.3)');
            ctx.fillStyle = hazeGrd;
            ctx.beginPath();
            ctx.moveTo(p.x - s * 0.8, p.y + s * 0.35);
            ctx.lineTo(p.x + s * 0.85, p.y + s * 0.35);
            ctx.lineTo(p.x + s * 0.5, p.y);
            ctx.lineTo(p.x - s * 0.5, p.y);
            ctx.closePath();
            ctx.fill();
        });
        ctx.restore();
    },

    drawForests(ctx) {
        if (!this.terrainSeed) return;
        ctx.save();

        // Sort forests back-to-front for proper overlap
        const sorted = [...this.terrainSeed.forests].sort((a, b) => a.y - b.y);

        sorted.forEach(f => {
            if (!this.isInViewport(f.x, f.y, 60)) return;
            // Northern forests (y < 260) get conifers, southern get deciduous mix
            const isNorthern = f.y < 260;

            for (let t = 0; t < f.count; t++) {
                const ox = (t - f.count / 2) * 6 * f.size + Math.sin(t * 2.7) * 2;
                const oy = ((t % 2) - 0.5) * 4 * f.size + Math.cos(t * 1.9) * 1.5;
                const p = this.worldToScreen(f.x + ox, f.y + oy);
                const s = f.size * this.scale * 5;
                const treeVariant = (t + Math.floor(f.x)) % 3;

                // --- Ground shadow ---
                ctx.fillStyle = 'rgba(10, 30, 10, 0.20)';
                ctx.beginPath();
                ctx.ellipse(p.x + s * 0.12, p.y + s * 0.4, s * 0.5, s * 0.15, 0, 0, Math.PI * 2);
                ctx.fill();

                if (isNorthern || treeVariant === 0) {
                    // --- CONIFER (spruce/pine) - layered triangles ---
                    // Trunk
                    ctx.fillStyle = 'rgba(65, 45, 25, 0.7)';
                    ctx.fillRect(p.x - s * 0.04, p.y + s * 0.15, s * 0.08, s * 0.25);

                    // Bottom layer (widest)
                    ctx.fillStyle = 'rgba(20, 55, 22, 0.75)';
                    ctx.beginPath();
                    ctx.moveTo(p.x - s * 0.38, p.y + s * 0.2);
                    ctx.lineTo(p.x, p.y - s * 0.08);
                    ctx.lineTo(p.x + s * 0.38, p.y + s * 0.2);
                    ctx.closePath();
                    ctx.fill();

                    // Middle layer
                    ctx.fillStyle = 'rgba(25, 65, 25, 0.75)';
                    ctx.beginPath();
                    ctx.moveTo(p.x - s * 0.3, p.y + s * 0.05);
                    ctx.lineTo(p.x, p.y - s * 0.35);
                    ctx.lineTo(p.x + s * 0.3, p.y + s * 0.05);
                    ctx.closePath();
                    ctx.fill();

                    // Top layer (narrowest)
                    ctx.fillStyle = 'rgba(30, 75, 30, 0.75)';
                    ctx.beginPath();
                    ctx.moveTo(p.x - s * 0.2, p.y - s * 0.15);
                    ctx.lineTo(p.x, p.y - s * 0.6);
                    ctx.lineTo(p.x + s * 0.2, p.y - s * 0.15);
                    ctx.closePath();
                    ctx.fill();

                    // Sunlit highlight on right edges
                    ctx.fillStyle = 'rgba(55, 100, 45, 0.35)';
                    ctx.beginPath();
                    ctx.moveTo(p.x + s * 0.05, p.y - s * 0.35);
                    ctx.lineTo(p.x + s * 0.3, p.y + s * 0.05);
                    ctx.lineTo(p.x + s * 0.12, p.y + s * 0.05);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    // --- DECIDUOUS (round canopy) ---
                    // Trunk
                    ctx.fillStyle = 'rgba(75, 50, 28, 0.65)';
                    ctx.fillRect(p.x - s * 0.05, p.y + s * 0.05, s * 0.1, s * 0.35);

                    // Main canopy (dark base)
                    ctx.fillStyle = 'rgba(35, 75, 30, 0.70)';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y - s * 0.15, s * 0.38, 0, Math.PI * 2);
                    ctx.fill();

                    // Highlight blob (upper right, sunlit)
                    ctx.fillStyle = 'rgba(55, 110, 40, 0.50)';
                    ctx.beginPath();
                    ctx.arc(p.x + s * 0.1, p.y - s * 0.25, s * 0.26, 0, Math.PI * 2);
                    ctx.fill();

                    // Top bright cap
                    ctx.fillStyle = 'rgba(70, 130, 50, 0.35)';
                    ctx.beginPath();
                    ctx.arc(p.x + s * 0.05, p.y - s * 0.32, s * 0.16, 0, Math.PI * 2);
                    ctx.fill();

                    // Depth shadow underneath
                    ctx.fillStyle = 'rgba(15, 35, 12, 0.25)';
                    ctx.beginPath();
                    ctx.arc(p.x - s * 0.05, p.y + s * 0.02, s * 0.28, 0, Math.PI);
                    ctx.fill();
                }
            }
        });
        ctx.restore();
    },

    drawAllLandMasses(ctx, strokeOnly, expand) {
        const masses = this.getLandMasses();
        masses.forEach(pts => {
            this.drawLandMass(ctx, pts, strokeOnly, expand);
        });
    },

    getLandMasses() {
        return [
            // Scandinavian Peninsula (Norway + Sweden)
            [[240,0],[258,60],[275,118],[282,148],[275,205],[295,268],[350,288],[450,268],[515,245],[540,175],[570,85],[600,0]],
            // Finland
            [[660,0],[650,65],[655,135],[672,190],[715,220],[778,205],[838,168],[895,135],[920,108],[920,0]],
            // Jutland (Denmark)
            [[375,290],[388,312],[400,340],[412,368],[422,398],[428,418],[408,422],[388,405],[372,378],[358,342],[368,308]],
            // Funen (Denmark)
            [[438,315],[452,312],[462,320],[460,336],[452,342],[438,338],[433,328],[438,315]],
            // Zealand (Denmark)
            [[468,308],[485,310],[492,322],[490,340],[482,350],[468,348],[460,335],[462,318],[468,308]],
            // Lolland/Falster
            [[470,354],[488,352],[495,358],[492,366],[478,368],[468,362],[470,354]],
            // Britain
            [[168,322],[198,308],[232,328],[248,365],[252,405],[242,438],[225,462],[200,478],[168,482],[148,462],[132,432],[128,398],[138,365],[152,340]],
            // Northern Germany / Poland coast
            [[250,432],[310,418],[365,405],[425,365],[490,355],[548,348],[618,350],[690,358],[750,375],[750,700],[250,700]],
            // Baltic States (Lithuania, Latvia, Estonia)
            [[750,375],[772,358],[798,330],[825,290],[845,248],[860,205],[875,178],[920,158],[920,700],[750,700]],
            // Northwestern Russia
            [[920,158],[942,145],[968,132],[1005,122],[1050,120],[1100,128],[1150,145],[1200,155],[1200,700],[920,700]],
            // Gotland
            [[632,238],[650,242],[655,260],[652,280],[640,290],[628,282],[625,262],[630,245]],
            // Ruegen (near Stralsund)
            [[575,298],[588,294],[596,300],[598,312],[592,318],[580,316],[574,308],[575,298]],
            // Bornholm
            [[548,282],[558,278],[566,284],[565,294],[558,300],[548,296],[545,288],[548,282]],
            // Aaland Islands (between Sweden and Finland)
            [[648,128],[656,125],[662,130],[660,138],[654,142],[648,138],[646,132],[648,128]],
            [[640,140],[646,138],[650,143],[648,148],[642,148],[640,143],[640,140]]
        ];
    },

    drawLandMass(ctx, points, strokeOnly, expand) {
        if (points.length < 3) return;
        ctx.beginPath();
        const first = this.worldToScreen(points[0][0], points[0][1]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < points.length; i++) {
            const p = this.worldToScreen(points[i][0], points[i][1]);
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        if (strokeOnly) {
            ctx.stroke();
        } else {
            ctx.fill();
            ctx.stroke();
        }
    },

    drawRoutes(ctx, gameState) {
        const t = this.animFrame;
        const zoom = this.camera.zoom;

        SEA_ROUTES.forEach(route => {
            const from = CITIES_DATA[route.from];
            const to = CITIES_DATA[route.to];
            if (!from || !to) return;

            // Frustum culling: skip if both endpoints are offscreen
            if (!this.isInViewport(from.x, from.y, 50) && !this.isInViewport(to.x, to.y, 50)) return;

            const p1 = this.worldToScreen(from.x, from.y);
            const p2 = this.worldToScreen(to.x, to.y);

            // Check if any player ship is on this route and calculate trade volume
            let isActive = false;
            let tradeVolume = 0;
            let cargoValue = 0;
            if (gameState && gameState.player) {
                gameState.player.ships.forEach(s => {
                    if (s.status !== 'sailing' || !s.route) return;
                    for (let i = 0; i < s.route.length - 1; i++) {
                        if ((s.route[i] === route.from && s.route[i+1] === route.to) ||
                            (s.route[i] === route.to && s.route[i+1] === route.from)) {
                            isActive = true;
                            tradeVolume += getCargoCount(s);
                            // Estimate cargo value for profitability color
                            for (const goodId in s.cargo) {
                                const good = typeof GOODS !== 'undefined' ? GOODS[goodId] : null;
                                cargoValue += s.cargo[goodId] * (good ? good.basePrice : 50);
                            }
                        }
                    }
                });
            }

            if (isActive) {
                // Route thickness based on trade volume (1-4 px)
                const thickness = Utils.clamp(1.5 + tradeVolume / 50, 1.5, 4.5);

                // Color-code by profitability (estimate: value per distance)
                const profitMetric = cargoValue / (route.distance || 1);
                let routeColor;
                if (profitMetric > 500) {
                    routeColor = 'rgba(46, 204, 113, 0.4)'; // green = profitable
                } else if (profitMetric > 200) {
                    routeColor = 'rgba(230, 168, 23, 0.4)'; // yellow = moderate
                } else {
                    routeColor = 'rgba(231, 76, 60, 0.35)'; // red = low value
                }

                ctx.strokeStyle = routeColor;
                ctx.lineWidth = thickness;
                ctx.setLineDash([6, 8]);
                ctx.lineDashOffset = -t * 0.5;
            } else {
                ctx.strokeStyle = 'rgba(50, 100, 160, 0.18)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 7]);
                ctx.lineDashOffset = 0;
            }

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // --- Goods icons floating along active routes at high zoom ---
            if (isActive && zoom >= 1.5 && typeof GOODS !== 'undefined') {
                // Find the ship(s) on this route to get cargo info
                if (gameState && gameState.player) {
                    gameState.player.ships.forEach(s => {
                        if (s.status !== 'sailing' || !s.route) return;
                        for (let i = 0; i < s.route.length - 1; i++) {
                            if (!((s.route[i] === route.from && s.route[i+1] === route.to) ||
                                  (s.route[i] === route.to && s.route[i+1] === route.from))) continue;

                            // Draw top 2 cargo goods as floating icons
                            const cargoEntries = Object.entries(s.cargo).sort((a, b) => b[1] - a[1]).slice(0, 2);
                            cargoEntries.forEach(([goodId], gi) => {
                                const good = GOODS[goodId];
                                if (!good) return;
                                // Animate icon position along the route
                                const iconProgress = ((t * 0.003 + gi * 0.3) % 1);
                                const ix = p1.x + (p2.x - p1.x) * iconProgress;
                                const iy = p1.y + (p2.y - p1.y) * iconProgress - 8 - gi * 12;
                                ctx.font = `${Math.round(9 * this.scale)}px sans-serif`;
                                ctx.textAlign = 'center';
                                ctx.globalAlpha = 0.6;
                                ctx.fillText(good.icon, ix, iy);
                                ctx.globalAlpha = 1;
                            });
                        }
                    });
                }
            }
        });

        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;

        // Route preview (animated green dashed line when sending a ship)
        if (this.routePreview) {
            const elapsed = performance.now() - this.routePreview.timestamp;
            if (elapsed > 5000) {
                this.routePreview = null;
            } else {
                const from = CITIES_DATA[this.routePreview.from];
                const to = CITIES_DATA[this.routePreview.to];
                if (from && to) {
                    const p1 = this.worldToScreen(from.x, from.y);
                    const p2 = this.worldToScreen(to.x, to.y);
                    ctx.strokeStyle = `rgba(46, 204, 113, ${0.7 - elapsed * 0.00014})`;
                    ctx.lineWidth = 2.5;
                    ctx.setLineDash([8, 6]);
                    ctx.lineDashOffset = -t * 0.5;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        }
    },

    drawCities(ctx, gameState) {
        const t = this.animFrame;
        const zoom = this.camera.zoom;
        this.labelRects = [];

        CITY_IDS.forEach(id => {
            const city = CITIES_DATA[id];

            // Frustum culling
            if (!this.isInViewport(city.x, city.y, 60)) return;

            // LOD: at low zoom, skip unimportant cities
            const isSelected = this.selectedCity === id;
            if (!isSelected) {
                if (zoom < 0.65 && city.importance < 4) return;
                if (zoom < 0.8 && city.importance < 3) return;
            }

            const pos = this.worldToScreen(city.x, city.y);
            const isHovered = this.hoveredCity === id;
            const isHome = gameState && gameState.player && gameState.player.homeCity === id;

            const baseRadius = 4 + city.importance * 1.5;
            const radius = baseRadius * this.scale;

            // Count player ships docked here
            let dockedCount = 0;
            if (gameState && gameState.player) {
                dockedCount = gameState.player.ships.filter(s => s.location === id).length;
            }

            let hasKontor = false;
            if (gameState && gameState.cities && gameState.cities[id]) {
                hasKontor = gameState.cities[id].playerBuildings &&
                    gameState.cities[id].playerBuildings.some(b => b.type === 'kontor');
            }

            // Animated glow for selected city
            if (isSelected) {
                const pulseR = radius + 10 + Math.sin(t * 0.06) * 3;
                const grd = ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, pulseR);
                grd.addColorStop(0, 'rgba(230, 168, 23, 0.5)');
                grd.addColorStop(1, 'rgba(230, 168, 23, 0)');
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, pulseR, 0, Math.PI * 2);
                ctx.fillStyle = grd;
                ctx.fill();
            }

            // Home city golden ring
            if (isHome) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius + 6, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 3]);
                ctx.lineDashOffset = t * 0.3;
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Ship anchor indicator
            if (dockedCount > 0) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(74, 158, 255, 0.5)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // --- Building silhouette for important cities ---
            if (city.importance >= 4) {
                this.drawCitySilhouette(ctx, pos.x, pos.y, radius, city.importance, isSelected, hasKontor);
            } else if (city.importance >= 3) {
                this.drawSmallCitySilhouette(ctx, pos.x, pos.y, radius, isSelected, hasKontor);
            } else {
                // Small cities: simple dot with gradient
                const cityGrad = ctx.createRadialGradient(pos.x - 1, pos.y - 1, 0, pos.x, pos.y, radius);
                if (isSelected) {
                    cityGrad.addColorStop(0, '#ffe060');
                    cityGrad.addColorStop(1, '#c89018');
                } else if (hasKontor) {
                    cityGrad.addColorStop(0, '#6ab8ff');
                    cityGrad.addColorStop(1, '#3080d0');
                } else {
                    cityGrad.addColorStop(0, '#d8c080');
                    cityGrad.addColorStop(1, '#a08040');
                }
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = cityGrad;
                ctx.fill();
                ctx.strokeStyle = isSelected || isHovered ? '#fff' : 'rgba(255,255,255,0.6)';
                ctx.lineWidth = isSelected || isHovered ? 1.5 : 0.8;
                ctx.stroke();
            }

            // City name with smart label rendering
            const showLabel = isSelected || isHovered ||
                              (zoom >= 1.0) ||
                              (zoom >= 0.7 && city.importance >= 3) ||
                              (city.importance >= 4);

            if (showLabel) {
                const fontSize = Utils.clamp(
                    Math.round((city.importance >= 4 ? 12 : 11) * this.scale),
                    8, 22
                );
                const isBold = isSelected || city.importance >= 4;
                ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px sans-serif`;
                ctx.textAlign = 'center';

                const nameY = city.importance >= 3 ? pos.y - radius - 10 : pos.y - radius - 5;
                const textWidth = ctx.measureText(city.displayName).width;

                // Label collision detection
                const labelRect = {
                    x: pos.x - textWidth / 2 - 2,
                    y: nameY - fontSize,
                    w: textWidth + 4,
                    h: fontSize + 4
                };
                const collides = this.labelRects.some(r =>
                    labelRect.x < r.x + r.w && labelRect.x + labelRect.w > r.x &&
                    labelRect.y < r.y + r.h && labelRect.y + labelRect.h > r.y
                );

                if (!collides || isSelected || city.importance >= 4) {
                    this.labelRects.push(labelRect);
                    ctx.shadowColor = 'rgba(0,0,0,0.9)';
                    ctx.shadowBlur = 4;
                    ctx.fillStyle = isSelected ? '#ffd700' : (isHovered ? '#fff' : (city.importance >= 4 ? '#e8dcc0' : '#c8c0a8'));
                    ctx.fillText(city.displayName, pos.x, nameY);
                    ctx.shadowBlur = 0;
                }
            }

            // Small ship count badge
            if (dockedCount > 0) {
                const bx = pos.x + radius + 4;
                const by = pos.y - radius - 2;
                ctx.fillStyle = '#2980b9';
                ctx.beginPath();
                ctx.arc(bx, by, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 8px sans-serif';
                ctx.fillText(dockedCount, bx, by + 3);
            }
        });
    },

    // Draw building silhouette for importance 4-5 cities (church tower + buildings)
    drawCitySilhouette(ctx, x, y, radius, importance, isSelected, hasKontor) {
        const s = this.scale * (importance >= 5 ? 1.4 : 1.15);
        ctx.save();

        // Ground platform
        const baseColor = isSelected ? '#c89018' : (hasKontor ? '#3080d0' : '#8a7040');
        const wallColor = isSelected ? '#e8c050' : (hasKontor ? '#4a98d8' : '#b09060');
        const roofColor = isSelected ? '#c04020' : '#8b3020';

        // Shadow under buildings
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 4 * s, 12 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Left building
        ctx.fillStyle = wallColor;
        ctx.fillRect(x - 10 * s, y - 6 * s, 6 * s, 10 * s);
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.moveTo(x - 11 * s, y - 6 * s);
        ctx.lineTo(x - 7 * s, y - 11 * s);
        ctx.lineTo(x - 3 * s, y - 6 * s);
        ctx.closePath();
        ctx.fill();

        // Center church tower
        ctx.fillStyle = wallColor;
        ctx.fillRect(x - 2.5 * s, y - 8 * s, 5 * s, 12 * s);
        // Tower spire
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.moveTo(x - 3.5 * s, y - 8 * s);
        ctx.lineTo(x, y - 18 * s);
        ctx.lineTo(x + 3.5 * s, y - 8 * s);
        ctx.closePath();
        ctx.fill();
        // Cross on top
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y - 18 * s);
        ctx.lineTo(x, y - 21 * s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 1.5 * s, y - 19.5 * s);
        ctx.lineTo(x + 1.5 * s, y - 19.5 * s);
        ctx.stroke();

        // Right building
        ctx.fillStyle = wallColor;
        ctx.fillRect(x + 4 * s, y - 5 * s, 6 * s, 9 * s);
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.moveTo(x + 3 * s, y - 5 * s);
        ctx.lineTo(x + 7 * s, y - 9 * s);
        ctx.lineTo(x + 11 * s, y - 5 * s);
        ctx.closePath();
        ctx.fill();

        // Window dots
        ctx.fillStyle = 'rgba(255, 220, 100, 0.5)';
        [[x - 8 * s, y - 2 * s], [x - 6 * s, y - 2 * s],
         [x + 6 * s, y - 1 * s], [x + 8 * s, y - 1 * s],
         [x - 0.5 * s, y - 4 * s], [x + 0.5 * s, y - 4 * s]].forEach(([wx, wy]) => {
            ctx.fillRect(wx, wy, 1.2 * s, 1.5 * s);
        });

        // Outline
        ctx.strokeStyle = isSelected ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - 10 * s, y - 6 * s, 6 * s, 10 * s);
        ctx.strokeRect(x - 2.5 * s, y - 8 * s, 5 * s, 12 * s);
        ctx.strokeRect(x + 4 * s, y - 5 * s, 6 * s, 9 * s);

        ctx.restore();
    },

    // Draw smaller building for importance 3 cities
    drawSmallCitySilhouette(ctx, x, y, radius, isSelected, hasKontor) {
        const s = this.scale * 1.0;
        ctx.save();

        const wallColor = isSelected ? '#e8c050' : (hasKontor ? '#4a98d8' : '#b09060');
        const roofColor = isSelected ? '#c04020' : '#8b3020';

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, y + 3 * s, 8 * s, 2.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Single building with peaked roof
        ctx.fillStyle = wallColor;
        ctx.fillRect(x - 4 * s, y - 4 * s, 8 * s, 7 * s);
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.moveTo(x - 5 * s, y - 4 * s);
        ctx.lineTo(x, y - 10 * s);
        ctx.lineTo(x + 5 * s, y - 4 * s);
        ctx.closePath();
        ctx.fill();

        // Small tower/spire
        ctx.fillStyle = roofColor;
        ctx.beginPath();
        ctx.moveTo(x - 1 * s, y - 10 * s);
        ctx.lineTo(x, y - 13 * s);
        ctx.lineTo(x + 1 * s, y - 10 * s);
        ctx.closePath();
        ctx.fill();

        // Window
        ctx.fillStyle = 'rgba(255, 220, 100, 0.4)';
        ctx.fillRect(x - 1 * s, y - 1.5 * s, 2 * s, 2.5 * s);

        ctx.strokeStyle = isSelected ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x - 4 * s, y - 4 * s, 8 * s, 7 * s);

        ctx.restore();
    },

    // --- City glow based on population/importance ---
    drawCityGlow(ctx, gameState) {
        if (!gameState) return;
        const t = this.animFrame;
        const month = gameState.date ? gameState.date.month : 6;
        const seasonDark = this._getSeasonalDarkness(month);
        // Glow more visible at night/winter
        const glowMul = 0.6 + seasonDark * 0.8;

        CITY_IDS.forEach(id => {
            const city = CITIES_DATA[id];
            if (!this.isInViewport(city.x, city.y, 80)) return;
            const pos = this.worldToScreen(city.x, city.y);
            const pop = gameState.cities[id] ? gameState.cities[id].population : city.population;
            const glowR = (15 + city.importance * 8 + (pop / 5000) * 3) * this.scale;
            const alpha = Utils.clamp(0.04 + city.importance * 0.015, 0.02, 0.12) * glowMul;
            const pulse = 1 + Math.sin(t * 0.015 + city.x * 0.1) * 0.1;

            const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR * pulse);
            grd.addColorStop(0, `rgba(255, 220, 140, ${alpha})`);
            grd.addColorStop(0.4, `rgba(255, 200, 100, ${alpha * 0.5})`);
            grd.addColorStop(1, 'rgba(255, 180, 80, 0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowR * pulse, 0, Math.PI * 2);
            ctx.fill();
        });
    },

    // --- Glowing windows at night (warm yellow dots) ---
    drawNightWindows(ctx, gameState) {
        if (!gameState || !gameState.date) return;
        const month = gameState.date.month;
        const seasonDark = this._getSeasonalDarkness(month);
        if (seasonDark < 0.3) return; // Only in darker months
        if (this.camera.zoom < 1.0) return; // Only when zoomed in enough

        const t = this.animFrame;
        const alpha = Utils.clamp(seasonDark - 0.3, 0, 0.7) * 0.8;

        CITY_IDS.forEach(id => {
            const city = CITIES_DATA[id];
            if (!this.isInViewport(city.x, city.y, 40)) return;
            if (city.importance < 2) return;

            const pos = this.worldToScreen(city.x, city.y);
            const s = this.scale;
            const windowCount = city.importance * 2 + 2;

            ctx.fillStyle = `rgba(255, 220, 100, ${alpha})`;
            for (let i = 0; i < windowCount; i++) {
                // Pseudo-random placement around city using deterministic seed
                const seed = (city.x * 7 + city.y * 13 + i * 31) % 97;
                const ox = ((seed % 11) - 5) * 2.5 * s;
                const oy = ((seed % 7) - 3.5) * 2 * s - 3 * s;
                // Flicker
                const flicker = Math.sin(t * 0.03 + seed * 0.7) > -0.2 ? 1 : 0.2;
                ctx.globalAlpha = alpha * flicker;
                ctx.fillRect(pos.x + ox, pos.y + oy, 1.5 * s, 1.8 * s);
            }
        });
        ctx.globalAlpha = 1;
    },

    // --- Market activity: tiny animated dots moving near cities ---
    drawMarketActivity(ctx, gameState) {
        if (!gameState) return;
        if (this.camera.zoom < 1.3) return; // Only when zoomed in

        const t = this.animFrame;
        const windX = gameState.wind ? Math.cos(gameState.wind.direction * Math.PI / 4) * 0.05 : 0;
        const windY = gameState.wind ? Math.sin(gameState.wind.direction * Math.PI / 4) * 0.05 : 0;

        // Spawn market activity particles
        if (t % 12 === 0) {
            CITY_IDS.forEach(id => {
                const city = CITIES_DATA[id];
                if (!this.isInViewport(city.x, city.y, 40)) return;
                if (city.importance < 3) return;
                const pos = this.worldToScreen(city.x, city.y);
                this.marketPool.spawn({
                    x: pos.x + (Math.random() - 0.5) * 20 * this.scale,
                    y: pos.y + (Math.random() - 0.5) * 15 * this.scale,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.3,
                    life: 1.0,
                    decay: 0.015,
                    size: 1 + Math.random() * 1.5,
                    color: Math.random() > 0.5 ? 'rgba(180, 160, 120, 0.6)' : 'rgba(160, 140, 100, 0.5)',
                    alpha: 0.5
                });
            });
        }

        this.marketPool.update(windX, windY);
        this.marketPool.draw(ctx);
    },

    // --- Port area: pier/dock lines near shipyard cities ---
    drawPiers(ctx, gameState) {
        if (this.camera.zoom < 1.2) return; // Only when zoomed in

        CITY_IDS.forEach(id => {
            const city = CITIES_DATA[id];
            if (!city.hasShipyard) return;
            if (!this.isInViewport(city.x, city.y, 40)) return;

            const pos = this.worldToScreen(city.x, city.y);
            const s = this.scale;

            // Draw wooden pier extending into water
            ctx.save();
            ctx.strokeStyle = 'rgba(120, 85, 50, 0.5)';
            ctx.lineWidth = 2 * s;
            ctx.lineCap = 'round';

            // Main pier
            ctx.beginPath();
            ctx.moveTo(pos.x + 8 * s, pos.y + 4 * s);
            ctx.lineTo(pos.x + 25 * s, pos.y + 8 * s);
            ctx.stroke();

            // Cross planks
            ctx.lineWidth = 1 * s;
            for (let i = 0; i < 3; i++) {
                const px = pos.x + (12 + i * 5) * s;
                const py = pos.y + (5 + i * 1.3) * s;
                ctx.beginPath();
                ctx.moveTo(px - 2 * s, py - 2 * s);
                ctx.lineTo(px + 2 * s, py + 2 * s);
                ctx.stroke();
            }

            // Mooring posts
            ctx.fillStyle = 'rgba(90, 65, 35, 0.6)';
            ctx.beginPath();
            ctx.arc(pos.x + 25 * s, pos.y + 8 * s, 1.5 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(pos.x + 8 * s, pos.y + 4 * s, 1.2 * s, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });
    },

    // --- Production icons near cities at high zoom ---
    drawProductionIcons(ctx, gameState) {
        if (!gameState) return;
        if (this.camera.zoom < 2.0) return; // Only at high zoom

        const t = this.animFrame;
        const GOOD_ICONS = typeof GOODS !== 'undefined' ? GOODS : {};

        CITY_IDS.forEach(id => {
            const city = CITIES_DATA[id];
            if (!this.isInViewport(city.x, city.y, 40)) return;

            const produced = Object.entries(city.production)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            if (produced.length === 0) return;

            const pos = this.worldToScreen(city.x, city.y);
            const s = this.scale;
            const startX = pos.x - (produced.length * 8 * s) / 2;
            const iconY = pos.y + (city.importance >= 3 ? 12 : 8) * s;

            ctx.font = `${Math.round(8 * s)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.globalAlpha = 0.7;

            produced.forEach(([goodId], i) => {
                const icon = GOOD_ICONS[goodId] ? GOOD_ICONS[goodId].icon : '?';
                const ix = startX + i * 10 * s;
                // Subtle float animation
                const floatY = Math.sin(t * 0.03 + i * 1.2) * 1.5;
                ctx.fillText(icon, ix, iconY + floatY);
            });
            ctx.globalAlpha = 1;
        });
    },

    drawCityHighlight(ctx, cityId) {
        const city = CITIES_DATA[cityId];
        if (!city) return;
        const pos = this.worldToScreen(city.x, city.y);
        const radius = (4 + city.importance * 1.5) * this.scale;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(240, 200, 80, 0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
    },

    // Enhanced ship rendering with wakes, wind sails, docked ships
    drawShips(ctx, gameState) {
        if (!gameState || !gameState.player) return;
        const t = this.animFrame;
        const windDir = gameState.wind ? gameState.wind.direction * Math.PI / 4 : 0;
        const windStr = gameState.wind ? gameState.wind.strength : 1.0;
        const zoom = this.camera.zoom;

        // --- Docked ships: gentle bobbing in port ---
        gameState.player.ships.forEach(ship => {
            if (ship.status !== 'docked' || !ship.location) return;
            const city = CITIES_DATA[ship.location];
            if (!city || !this.isInViewport(city.x, city.y, 60)) return;
            // Only show docked ships at zoom >= 1.2
            if (zoom < 1.2) return;

            // Offset docked ships slightly from city center (stagger by index)
            const idx = gameState.player.ships.indexOf(ship);
            const ox = 15 + idx * 12;
            const oy = 10 + (idx % 2) * 8;
            const pos = this.worldToScreen(city.x + ox, city.y + oy);
            // Gentle bobbing
            const bob = Math.sin(t * 0.04 + idx * 1.5) * 2 + Math.cos(t * 0.06 + idx * 0.7) * 1;
            const angle = Math.PI * 0.5 + Math.sin(t * 0.02 + idx) * 0.08; // Mostly facing right with gentle sway
            this.drawDetailedShip(ctx, pos.x, pos.y + bob, angle, ship, '#c8922a', '#e8dcc0', true, windDir, windStr * 0.3);

            // Ship name at high zoom
            if (zoom >= 1.5) {
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 2;
                ctx.font = '8px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'rgba(200,180,120,0.7)';
                ctx.fillText(ship.name, pos.x, pos.y + bob - 14);
                ctx.shadowBlur = 0;
            }
        });

        // --- Sailing player ships ---
        gameState.player.ships.forEach(ship => {
            if (ship.status !== 'sailing' || !ship.route || ship.route.length < 2) return;
            const pos = this.getShipScreenPos(ship, t);
            if (!pos) return;

            // Frustum culling
            const worldPos = this.getShipWorldPos(ship);
            if (worldPos && !this.isInViewport(worldPos.x, worldPos.y, 50)) return;

            // Add wake particles
            if (t % 3 === 0) {
                this.wakes.push({
                    x: pos.x - Math.cos(pos.angle) * 8,
                    y: pos.y - Math.sin(pos.angle) * 8,
                    life: 1.0, size: 3, decay: 0.015
                });
            }

            this.drawDetailedShip(ctx, pos.x, pos.y, pos.angle, ship, '#e6a817', '#fff', true, windDir, windStr);

            // Ship name label
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 3;
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(ship.name, pos.x, pos.y - 18 * (this._shipTypeScale[ship.typeId] || 1));
            ctx.shadowBlur = 0;

            // Hull bar if damaged
            if (ship.hull < ship.maxHull) {
                const barW = 24;
                const barH = 3;
                const hullPct = ship.hull / ship.maxHull;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(pos.x - barW/2, pos.y + 12, barW, barH);
                ctx.fillStyle = hullPct > 0.5 ? '#27ae60' : (hullPct > 0.25 ? '#f39c12' : '#c0392b');
                ctx.fillRect(pos.x - barW/2, pos.y + 12, barW * hullPct, barH);
            }

            // Cargo percentage bar at high zoom
            if (zoom >= 1.8) {
                const cargoCount = getCargoCount(ship);
                const cargoPct = cargoCount / ship.capacity;
                const barW = 24;
                const barH = 2.5;
                const barY = ship.hull < ship.maxHull ? 17 : 12;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(pos.x - barW/2, pos.y + barY, barW, barH);
                ctx.fillStyle = cargoPct > 0.8 ? '#f39c12' : '#3498db';
                ctx.fillRect(pos.x - barW/2, pos.y + barY, barW * cargoPct, barH);
                // Cargo percentage text
                if (zoom >= 2.5) {
                    ctx.font = '7px sans-serif';
                    ctx.fillStyle = 'rgba(200,200,200,0.7)';
                    ctx.fillText(Math.round(cargoPct * 100) + '%', pos.x, pos.y + barY + barH + 9);
                }
            }
        });

        // AI ships (simpler)
        if (gameState.aiTraders) {
            gameState.aiTraders.forEach(ai => {
                ai.ships.forEach(ship => {
                    if (ship.status !== 'sailing' || !ship.route || ship.route.length < 2) return;
                    const pos = this.getShipScreenPos(ship, t + ai.ships.indexOf(ship) * 10);
                    if (!pos) return;

                    // Small wake
                    if (t % 5 === 0) {
                        this.wakes.push({
                            x: pos.x - Math.cos(pos.angle) * 5,
                            y: pos.y - Math.sin(pos.angle) * 5,
                            life: 0.6, size: 2, decay: 0.02
                        });
                    }

                    this.drawDetailedShip(ctx, pos.x, pos.y, pos.angle, ship, '#778899', '#ccc', false, windDir, windStr);
                });
            });
        }
    },

    getShipWorldPos(ship) {
        if (!ship || ship.status !== 'sailing' || !ship.route || ship.route.length < 2) return null;
        const fromCity = CITIES_DATA[ship.route[ship.routeIndex]];
        const toIdx = Math.min(ship.routeIndex + 1, ship.route.length - 1);
        const toCity = CITIES_DATA[ship.route[toIdx]];
        if (!fromCity || !toCity) return null;
        return {
            x: Utils.lerp(fromCity.x, toCity.x, ship.progress),
            y: Utils.lerp(fromCity.y, toCity.y, ship.progress)
        };
    },

    getShipScreenPos(ship, t) {
        const world = this.getShipWorldPos(ship);
        if (!world) return null;
        const screen = this.worldToScreen(world.x, world.y);
        const fromCity = CITIES_DATA[ship.route[ship.routeIndex]];
        const toIdx = Math.min(ship.routeIndex + 1, ship.route.length - 1);
        const toCity = CITIES_DATA[ship.route[toIdx]];
        const p1 = this.worldToScreen(fromCity.x, fromCity.y);
        const p2 = this.worldToScreen(toCity.x, toCity.y);
        return {
            x: screen.x,
            y: screen.y + Math.sin(t * 0.08) * 2.5 + Math.cos(t * 0.12) * 1,
            angle: Utils.angle(p1.x, p1.y, p2.x, p2.y)
        };
    },

    // Ship type scale map: small_cog=0.7, cog=1.0, hulk=1.2, caravel=0.9, carrack=1.5, warship=1.1
    _shipTypeScale: { small_cog: 0.7, cog: 1.0, hulk: 1.2, caravel: 0.9, carrack: 1.5, warship: 1.1 },

    drawDetailedShip(ctx, x, y, angle, ship, hullColor, sailColor, isPlayer, windAngle, windStrength) {
        const t = this.animFrame;
        // Ship type scaling
        const typeScale = this._shipTypeScale[ship.typeId] || 1.0;
        const baseS = (isPlayer ? 1.3 : 0.9) * typeScale;
        const shipWorldSize = (isPlayer ? 30 : 20) * typeScale;
        const shipScreenSize = shipWorldSize * this.scale;
        const shipScale = shipScreenSize < 20 ? (20 / shipScreenSize) : 1.0;
        const s = baseS * shipScale;

        // Wind-based sail flutter: sails billow more when wind is behind the ship
        windAngle = windAngle || 0;
        windStrength = windStrength || 1.0;
        const relativeWind = Math.cos(windAngle - angle);
        const windBillow = Utils.clamp(relativeWind * windStrength * 0.5 + 0.5, 0.2, 1.5);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // --- Hull shadow on water ---
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 3 * s, 14 * s, 3.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Hansekogge Hull ---
        // Kogge: high rounded hull, flat bottom, high stern and bow
        const hullDark = isPlayer ? '#8b5e1a' : '#5a6570';
        const hullMid = hullColor;
        const hullLight = isPlayer ? '#c8922a' : '#8a96a0';

        // Main hull body - wide, deep, flat-bottomed
        ctx.beginPath();
        ctx.moveTo(-12 * s, 0);                              // stern waterline
        ctx.lineTo(-11 * s, 3 * s);                          // stern bottom
        ctx.lineTo(-6 * s, 4.5 * s);                         // bottom curve
        ctx.lineTo(6 * s, 4.5 * s);                          // flat bottom
        ctx.lineTo(11 * s, 3 * s);                            // bow bottom
        ctx.lineTo(14 * s, -1 * s);                           // bow rise (high)
        ctx.lineTo(12 * s, -3 * s);                           // bow top (Vorderkastell)
        ctx.lineTo(8 * s, -4 * s);                            // foredeck
        ctx.lineTo(-6 * s, -4 * s);                           // main deck
        ctx.lineTo(-10 * s, -5 * s);                          // stern rise (Achterkastell)
        ctx.lineTo(-13 * s, -3 * s);                          // stern top
        ctx.lineTo(-12 * s, 0);                               // back to stern waterline
        ctx.closePath();
        ctx.fillStyle = hullMid;
        ctx.fill();
        ctx.strokeStyle = hullDark;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Hull planking lines
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.4;
        for (let i = 1; i <= 3; i++) {
            const py = -4 * s + i * 2.2 * s;
            ctx.beginPath();
            ctx.moveTo(-11 * s, py);
            ctx.lineTo(12 * s, py);
            ctx.stroke();
        }

        // Stern castle (Achterkastell) - raised platform at rear
        ctx.fillStyle = hullLight;
        ctx.strokeStyle = hullDark;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(-6 * s, -4 * s);
        ctx.lineTo(-6 * s, -7 * s);
        ctx.lineTo(-12 * s, -7.5 * s);
        ctx.lineTo(-13 * s, -5 * s);
        ctx.lineTo(-10 * s, -5 * s);
        ctx.lineTo(-6 * s, -4 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Stern castle railing
        ctx.strokeStyle = hullDark;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-6 * s, -7 * s);
        ctx.lineTo(-12 * s, -7.5 * s);
        ctx.stroke();

        // Bow rise / forecastle (Vorderkastell)
        ctx.fillStyle = hullLight;
        ctx.beginPath();
        ctx.moveTo(8 * s, -4 * s);
        ctx.lineTo(8 * s, -6 * s);
        ctx.lineTo(13 * s, -5 * s);
        ctx.lineTo(12 * s, -3 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Bowsprit (short spar at front)
        ctx.strokeStyle = '#5c3a1e';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(12 * s, -4 * s);
        ctx.lineTo(17 * s, -6 * s);
        ctx.stroke();

        // --- Mast (single tall center mast, characteristic of Kogge) ---
        ctx.strokeStyle = '#5c3a1e';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(1 * s, -4 * s);
        ctx.lineTo(1 * s, -18 * s);
        ctx.stroke();

        // Crow's nest (Krähennest)
        ctx.fillStyle = '#5c3a1e';
        ctx.strokeStyle = '#3a2510';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-2 * s, -15 * s);
        ctx.lineTo(4 * s, -15 * s);
        ctx.lineTo(3.5 * s, -16 * s);
        ctx.lineTo(-1.5 * s, -16 * s);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Yard (horizontal beam for square sail)
        ctx.strokeStyle = '#5c3a1e';
        ctx.lineWidth = 1.2;
        const yardY = -16 * s;
        ctx.beginPath();
        ctx.moveTo(-8 * s, yardY);
        ctx.lineTo(10 * s, yardY);
        ctx.stroke();

        // --- Square Sail (Rahsegel) - wind-driven billowing ---
        const flutter = Math.sin(t * 0.08) * 1.5 * s * windBillow;
        const flutter2 = Math.sin(t * 0.08 + 1) * 1.0 * s * windBillow;
        ctx.fillStyle = sailColor;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.moveTo(-7.5 * s, yardY);                            // top left
        ctx.quadraticCurveTo(-6 * s + flutter2, -11 * s, -6 * s + flutter, -6 * s);  // left edge billows
        ctx.lineTo(8 * s + flutter, -6 * s);                    // bottom right
        ctx.quadraticCurveTo(8 * s + flutter2, -11 * s, 9.5 * s, yardY);   // right edge
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.6;
        ctx.stroke();

        // Cross on sail (Hanseatic red cross)
        if (isPlayer) {
            ctx.strokeStyle = '#b02020';
            ctx.lineWidth = 1.8 * s;
            ctx.globalAlpha = 0.7;
            const crossCx = 1 * s + flutter * 0.3;
            const crossCy = -11 * s;
            ctx.beginPath();
            ctx.moveTo(crossCx, -14.5 * s);
            ctx.lineTo(crossCx, -7.5 * s);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(crossCx - 4 * s, crossCy);
            ctx.lineTo(crossCx + 4 * s, crossCy);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Rigging lines (shrouds)
        ctx.strokeStyle = 'rgba(90, 60, 30, 0.35)';
        ctx.lineWidth = 0.4;
        // Left shroud
        ctx.beginPath();
        ctx.moveTo(-6 * s, -4 * s);
        ctx.lineTo(1 * s, -15 * s);
        ctx.stroke();
        // Right shroud
        ctx.beginPath();
        ctx.moveTo(8 * s, -4 * s);
        ctx.lineTo(1 * s, -15 * s);
        ctx.stroke();

        // Sheet lines from sail bottom to deck
        ctx.strokeStyle = 'rgba(90, 60, 30, 0.25)';
        ctx.beginPath();
        ctx.moveTo(-6 * s + flutter, -6 * s);
        ctx.lineTo(-5 * s, -4 * s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8 * s + flutter, -6 * s);
        ctx.lineTo(7 * s, -4 * s);
        ctx.stroke();

        // --- Rudder (Steuerruder, at stern) ---
        ctx.strokeStyle = '#5c3a1e';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-13 * s, -2 * s);
        ctx.lineTo(-15 * s, 2 * s);
        ctx.lineTo(-14 * s, 5 * s);
        ctx.stroke();

        // --- Flag at masthead ---
        if (isPlayer) {
            const flagFlutter = Math.sin(t * 0.15) * 1.5;
            ctx.fillStyle = '#c0392b';
            ctx.beginPath();
            ctx.moveTo(1 * s, -18 * s);
            ctx.quadraticCurveTo(5 * s + flagFlutter, -19 * s, 7 * s + flagFlutter, -17.5 * s);
            ctx.lineTo(1 * s, -16.5 * s);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 0.3;
            ctx.stroke();
        } else {
            // AI ships get a smaller neutral pennant
            ctx.fillStyle = '#667788';
            ctx.beginPath();
            ctx.moveTo(1 * s, -18 * s);
            ctx.lineTo(4 * s + Math.sin(t * 0.12) * 0.8, -17.5 * s);
            ctx.lineTo(1 * s, -17 * s);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    },

    drawWakes(ctx) {
        // Update and draw wake particles with foam
        for (let i = this.wakes.length - 1; i >= 0; i--) {
            const w = this.wakes[i];
            w.life -= w.decay;
            w.size += 0.1;

            if (w.life <= 0) {
                this.wakes.splice(i, 1);
                continue;
            }

            // Outer ring
            ctx.globalAlpha = w.life * 0.25;
            ctx.strokeStyle = 'rgba(180, 220, 255, 0.6)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.size, 0, Math.PI * 2);
            ctx.stroke();

            // Inner foam fill (white core that fades)
            if (w.life > 0.5) {
                ctx.globalAlpha = (w.life - 0.5) * 0.4;
                ctx.fillStyle = 'rgba(200, 230, 255, 0.5)';
                ctx.beginPath();
                ctx.arc(w.x, w.y, w.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }

            // Foam specks around wake
            if (w.life > 0.7 && w.size > 2) {
                ctx.globalAlpha = (w.life - 0.7) * 0.6;
                ctx.fillStyle = 'rgba(220, 240, 255, 0.6)';
                for (let j = 0; j < 3; j++) {
                    const angle = (j / 3) * Math.PI * 2 + w.size * 0.5;
                    const fx = w.x + Math.cos(angle) * w.size * 0.8;
                    const fy = w.y + Math.sin(angle) * w.size * 0.8;
                    ctx.beginPath();
                    ctx.arc(fx, fy, 0.6, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1;

        // Cap wake count for performance
        if (this.wakes.length > 250) {
            this.wakes.splice(0, this.wakes.length - 250);
        }
    },

    // --- Harbor smoke: wispy particles rising from cities with docked ships ---
    drawHarborSmoke(ctx, gameState) {
        if (!gameState || !gameState.player) return;
        const t = this.animFrame;

        // Spawn new smoke for cities with docked ships
        CITY_IDS.forEach(id => {
            const dockedCount = gameState.player.ships.filter(s => s.location === id).length;
            if (dockedCount > 0 && t % 8 === 0) {
                const city = CITIES_DATA[id];
                const pos = this.worldToScreen(city.x, city.y);
                this.smokeParticles.push({
                    x: pos.x + (Math.random() - 0.5) * 10,
                    y: pos.y - 8 * this.scale,
                    vx: (Math.random() - 0.5) * 0.2,
                    vy: -0.3 - Math.random() * 0.3,
                    life: 1.0,
                    size: 1.5 + Math.random() * 2
                });
            }
        });

        // Update and draw
        for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
            const p = this.smokeParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx += (Math.random() - 0.5) * 0.05;
            p.life -= 0.012;
            p.size += 0.04;

            if (p.life <= 0) {
                this.smokeParticles.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life * 0.25;
            ctx.fillStyle = 'rgba(180, 180, 170, 0.6)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Cap for performance
        if (this.smokeParticles.length > 150) {
            this.smokeParticles.splice(0, this.smokeParticles.length - 150);
        }
    },

    // --- Lighthouses: animated beacon lights at port cities ---
    drawLighthouses(ctx, gameState) {
        if (!gameState) return;
        const t = this.animFrame;
        const month = gameState.date ? gameState.date.month : 6;
        const seasonDark = this._getSeasonalDarkness(month);

        // Lighthouses are more visible in winter/darker months
        const beaconIntensity = 0.3 + seasonDark * 0.5;

        CITY_IDS.forEach(id => {
            const city = CITIES_DATA[id];
            if (!city.hasShipyard) return; // Only shipyard cities get lighthouses

            const pos = this.worldToScreen(city.x, city.y);
            const beaconPhase = (t * 0.03 + city.x * 0.1) % (Math.PI * 2);
            const beaconBright = Math.max(0, Math.sin(beaconPhase));

            if (beaconBright > 0.3) {
                const bx = pos.x + 12 * this.scale;
                const by = pos.y - 6 * this.scale;
                const intensity = beaconBright * beaconIntensity;

                // Glow
                const glowR = 6 + beaconBright * 8;
                const grd = ctx.createRadialGradient(bx, by, 0, bx, by, glowR);
                grd.addColorStop(0, `rgba(255, 220, 100, ${intensity})`);
                grd.addColorStop(0.5, `rgba(255, 200, 50, ${intensity * 0.4})`);
                grd.addColorStop(1, 'rgba(255, 200, 50, 0)');
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.arc(bx, by, glowR, 0, Math.PI * 2);
                ctx.fill();

                // Bright center
                ctx.fillStyle = `rgba(255, 240, 180, ${intensity * 0.8})`;
                ctx.beginPath();
                ctx.arc(bx, by, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    },

    // --- Weather effects overlay ---
    drawWeatherEffects(ctx, gameState) {
        if (!gameState || !gameState.wind) return;
        const t = this.animFrame;
        const windStrength = gameState.wind.strength;
        const windAngle = gameState.wind.direction * Math.PI / 4;
        const windX = Math.cos(windAngle);
        const windY = Math.sin(windAngle);
        const month = gameState.date ? gameState.date.month : 6;

        // Storm effect when wind is very strong
        if (windStrength > 2.0) {
            const stormIntensity = Math.min((windStrength - 2.0) / 1.0, 1.0);

            // Dark storm sky overlay
            ctx.fillStyle = `rgba(25, 35, 50, ${stormIntensity * 0.08})`;
            ctx.fillRect(0, 0, this.width, this.height);

            // Heavy rain using particle pool
            if (t % 2 === 0) {
                for (let i = 0; i < Math.floor(6 * stormIntensity); i++) {
                    this.rainPool.spawn({
                        x: Math.random() * (this.width + 100) - 50,
                        y: -10,
                        vx: windX * 3 + (Math.random() - 0.5),
                        vy: 4 + Math.random() * 3,
                        life: 1.0,
                        decay: 0.03,
                        size: 0.8 + Math.random() * 0.5,
                        color: `rgba(160, 190, 220, ${0.15 + stormIntensity * 0.15})`,
                        alpha: 0.4 + stormIntensity * 0.3,
                        type: 'line',
                        windFactor: 0.5
                    });
                }
            }

            // Lightning flash (rare, random)
            if (stormIntensity > 0.6 && Math.sin(t * 0.017) > 0.998) {
                ctx.fillStyle = `rgba(200, 210, 230, ${0.08 + Math.random() * 0.06})`;
                ctx.fillRect(0, 0, this.width, this.height);
                // Lightning bolt shape
                const lx = Math.random() * this.width;
                ctx.strokeStyle = `rgba(220, 230, 255, ${0.3 + Math.random() * 0.2})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(lx, 0);
                let ly = 0;
                for (let seg = 0; seg < 5; seg++) {
                    lx + (Math.random() - 0.5) * 40;
                    ly += this.height * 0.15 + Math.random() * this.height * 0.05;
                    ctx.lineTo(lx + (Math.random() - 0.5) * 40, ly);
                }
                ctx.stroke();
            }

            // Misty haze overlay
            ctx.fillStyle = `rgba(90, 110, 130, ${stormIntensity * 0.07})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        // Update and draw rain particles
        this.rainPool.update(windX * 0.5, windY * 0.2);
        this.rainPool.draw(ctx);

        // --- Snow particles in winter months (Nov-Feb) ---
        const isWinter = month >= 11 || month <= 2;
        if (isWinter) {
            const winterIntensity = month === 12 || month === 1 ? 1.0 : 0.5;
            // Spawn snow particles
            if (t % 3 === 0) {
                for (let i = 0; i < Math.floor(3 * winterIntensity); i++) {
                    this.snowPool.spawn({
                        x: Math.random() * (this.width + 60) - 30,
                        y: -5,
                        vx: windX * 0.5 + (Math.random() - 0.5) * 0.3,
                        vy: 0.5 + Math.random() * 0.8,
                        life: 1.0,
                        decay: 0.005 + Math.random() * 0.003,
                        size: 1 + Math.random() * 2,
                        color: 'rgba(230, 240, 255, 0.7)',
                        alpha: 0.4 + Math.random() * 0.3,
                        type: 'flake',
                        windFactor: 0.8,
                        rotSpeed: (Math.random() - 0.5) * 0.05
                    });
                }
            }
            this.snowPool.update(windX * 0.3, 0);
            this.snowPool.draw(ctx);

            // Light snow overlay on ground
            if (winterIntensity > 0.5) {
                ctx.fillStyle = `rgba(220, 230, 245, ${0.02 * winterIntensity})`;
                ctx.fillRect(0, 0, this.width, this.height);
            }
        }

        // --- Fog patches that drift across the map ---
        if (windStrength < 1.5 && (month >= 10 || month <= 3)) {
            const fogChance = (1.5 - windStrength) * (month >= 11 || month <= 2 ? 0.8 : 0.4);
            if (t % 60 === 0 && Math.random() < fogChance && this.fogPool.count < 15) {
                this.fogPool.spawn({
                    x: -100 + Math.random() * 50,
                    y: Math.random() * this.height,
                    vx: 0.2 + windX * 0.3,
                    vy: windY * 0.1 + (Math.random() - 0.5) * 0.05,
                    life: 1.0,
                    decay: 0.001,
                    size: 80 + Math.random() * 120,
                    color: 'rgba(160, 175, 190, 0.08)',
                    alpha: 0.05 + Math.random() * 0.04,
                    windFactor: 0.3,
                    sizeDecay: 0.05
                });
            }
            this.fogPool.update(windX * 0.1, windY * 0.05);
            // Custom fog draw (large ellipses)
            for (let i = 0; i < this.fogPool.active.length; i++) {
                const f = this.fogPool.active[i];
                const a = f.alpha * (f.life / f.maxLife);
                if (a < 0.003) continue;
                const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size);
                grd.addColorStop(0, `rgba(160, 175, 195, ${a})`);
                grd.addColorStop(0.6, `rgba(140, 160, 180, ${a * 0.5})`);
                grd.addColorStop(1, 'rgba(130, 150, 170, 0)');
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.ellipse(f.x, f.y, f.size, f.size * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Calm/good weather: warm golden light
        if (windStrength < 1.0) {
            const calmness = (1.0 - windStrength);
            // Warm sun glow from upper-right
            const sunGrd = ctx.createRadialGradient(
                this.width * 0.88, this.height * 0.02, 0,
                this.width * 0.88, this.height * 0.02, this.width * 0.55
            );
            sunGrd.addColorStop(0, `rgba(255, 235, 180, ${calmness * 0.06})`);
            sunGrd.addColorStop(0.3, `rgba(255, 225, 160, ${calmness * 0.03})`);
            sunGrd.addColorStop(0.7, `rgba(255, 220, 150, ${calmness * 0.01})`);
            sunGrd.addColorStop(1, 'rgba(255, 220, 150, 0)');
            ctx.fillStyle = sunGrd;
            ctx.fillRect(0, 0, this.width, this.height);

            // Subtle warm color grading
            if (calmness > 0.5) {
                ctx.fillStyle = `rgba(255, 245, 220, ${(calmness - 0.5) * 0.02})`;
                ctx.fillRect(0, 0, this.width, this.height);
            }
        }

        // --- Seasonal color tint overlay (summer=warmer, winter=cooler) ---
        const seasonDark = this._getSeasonalDarkness(month);
        if (seasonDark > 0.3) {
            // Winter: cool blue tint
            ctx.fillStyle = `rgba(140, 160, 200, ${(seasonDark - 0.3) * 0.04})`;
            ctx.fillRect(0, 0, this.width, this.height);
        } else if (seasonDark < 0.15 && month >= 5 && month <= 8) {
            // Summer: warm golden tint
            ctx.fillStyle = `rgba(255, 230, 180, ${(0.15 - seasonDark) * 0.06})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }
    },

    // --- Arrival particles when a ship docks ---
    spawnArrivalParticles(cityId) {
        const city = CITIES_DATA[cityId];
        if (!city) return;
        const pos = this.worldToScreen(city.x, city.y);
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 1.5;
            this.arrivalParticles.push({
                x: pos.x, y: pos.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.5,
                life: 1.0,
                size: 1 + Math.random() * 2,
                color: Math.random() > 0.5 ? '#ffd700' : '#5dade2'
            });
        }
    },

    drawArrivalParticles(ctx) {
        for (let i = this.arrivalParticles.length - 1; i >= 0; i--) {
            const p = this.arrivalParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.02; // gravity
            p.life -= 0.02;

            if (p.life <= 0) {
                this.arrivalParticles.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (this.arrivalParticles.length > 200) {
            this.arrivalParticles.splice(0, this.arrivalParticles.length - 200);
        }
    },

    drawSeagulls(ctx) {
        const t = this.animFrame;
        this.seagulls.forEach(gull => {
            // Move seagull forward
            gull.x += gull.speed;
            // Gentle circular drift
            gull.circlePhase += 0.003;
            const driftY = Math.sin(gull.circlePhase) * gull.circleRadius;
            gull.y += gull.dy + driftY * 0.01;

            // Wrap around when leaving screen
            if (gull.x > 1.1) { gull.x = -0.1; gull.y = Math.random() * 0.5; }
            if (gull.y < -0.05 || gull.y > 0.7) { gull.dy = -gull.dy; }

            const sx = gull.x * this.width;
            const sy = gull.y * this.height;
            const wing = Math.sin(t * gull.wingSpeed + gull.wingPhase);
            const sz = gull.size;

            ctx.save();
            ctx.translate(sx, sy);

            // Shadow on water below
            ctx.globalAlpha = 0.08;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.ellipse(3, 12 * sz, 6 * sz, 1.5 * sz, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalAlpha = 0.85;

            // Body
            ctx.fillStyle = '#f0ece4';
            ctx.beginPath();
            ctx.ellipse(0, 0, 3.5 * sz, 1.5 * sz, 0, 0, Math.PI * 2);
            ctx.fill();

            // Left wing
            ctx.strokeStyle = '#e8e0d4';
            ctx.fillStyle = '#f5f2ec';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(-1.5 * sz, 0);
            ctx.quadraticCurveTo(-6 * sz, -4 * wing * sz, -10 * sz, -2 * wing * sz);
            ctx.quadraticCurveTo(-8 * sz, -1 * wing * sz, -1.5 * sz, 0.5 * sz);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Right wing
            ctx.beginPath();
            ctx.moveTo(1.5 * sz, 0);
            ctx.quadraticCurveTo(6 * sz, -4 * wing * sz, 10 * sz, -2 * wing * sz);
            ctx.quadraticCurveTo(8 * sz, -1 * wing * sz, 1.5 * sz, 0.5 * sz);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Wing tips (darker)
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(-9 * sz, -1.8 * wing * sz);
            ctx.lineTo(-10 * sz, -2 * wing * sz);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(9 * sz, -1.8 * wing * sz);
            ctx.lineTo(10 * sz, -2 * wing * sz);
            ctx.stroke();

            // Head
            ctx.fillStyle = '#f0ece4';
            ctx.beginPath();
            ctx.arc(3.5 * sz, -0.5 * sz, 1.2 * sz, 0, Math.PI * 2);
            ctx.fill();

            // Beak
            ctx.fillStyle = '#d4a030';
            ctx.beginPath();
            ctx.moveTo(4.5 * sz, -0.5 * sz);
            ctx.lineTo(6.5 * sz, 0);
            ctx.lineTo(4.5 * sz, 0.2 * sz);
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = 1;
            ctx.restore();
        });
    },

    drawClouds(ctx) {
        this.clouds.forEach(cloud => {
            // Drift slowly
            cloud.x += cloud.speed;
            if (cloud.x > 1.15) { cloud.x = -0.15; cloud.y = 0.03 + Math.random() * 0.25; }

            const cx = cloud.x * this.width;
            const cy = cloud.y * this.height;
            const sc = cloud.scale;

            ctx.save();

            // Cloud shadow on the ground/sea below
            ctx.globalAlpha = cloud.opacity * 0.4;
            ctx.fillStyle = 'rgba(10, 20, 40, 0.3)';
            cloud.blobs.forEach(b => {
                ctx.beginPath();
                ctx.ellipse(cx + b.ox * sc + 15, cy + b.oy * sc + 40, b.rx * sc * 0.9, b.ry * sc * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            });

            // Main cloud body (base layer, slightly dark)
            ctx.globalAlpha = cloud.opacity;
            ctx.fillStyle = 'rgba(185, 200, 220, 0.5)';
            cloud.blobs.forEach(b => {
                ctx.beginPath();
                ctx.ellipse(cx + b.ox * sc, cy + b.oy * sc, b.rx * sc, b.ry * sc, 0, 0, Math.PI * 2);
                ctx.fill();
            });

            // Middle brighter layer
            ctx.fillStyle = 'rgba(210, 220, 235, 0.4)';
            cloud.blobs.forEach(b => {
                ctx.beginPath();
                ctx.ellipse(cx + b.ox * sc, cy + (b.oy - 1) * sc, b.rx * sc * 0.85, b.ry * sc * 0.75, 0, 0, Math.PI * 2);
                ctx.fill();
            });

            // Top highlight (sunlit edge)
            ctx.fillStyle = 'rgba(240, 245, 255, 0.35)';
            cloud.blobs.forEach(b => {
                ctx.beginPath();
                ctx.ellipse(cx + b.ox * sc + 2, cy + (b.oy - 3) * sc, b.rx * sc * 0.6, b.ry * sc * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.globalAlpha = 1;
            ctx.restore();
        });
    },

    drawCompass(ctx, gameState) {
        if (!gameState) return;
        const cx = this.width - 50;
        const cy = this.height - 50;
        const r = 32;
        const t = this.animFrame;

        ctx.save();

        // Outer glow
        ctx.globalAlpha = 0.3;
        const glow = ctx.createRadialGradient(cx, cy, r - 2, cx, cy, r + 8);
        glow.addColorStop(0, 'rgba(180, 160, 100, 0.3)');
        glow.addColorStop(1, 'rgba(180, 160, 100, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
        ctx.fill();

        // Background circle with gradient
        ctx.globalAlpha = 0.8;
        const bgGrad = ctx.createRadialGradient(cx - 4, cy - 4, 0, cx, cy, r + 2);
        bgGrad.addColorStop(0, 'rgba(35, 50, 75, 0.9)');
        bgGrad.addColorStop(1, 'rgba(15, 25, 45, 0.95)');
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.fill();

        // Ornate border rings
        ctx.strokeStyle = 'rgba(190, 170, 110, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(160, 140, 90, 0.3)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Compass star points (8 directions)
        for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI / 4) - Math.PI / 2;
            const isCardinal = i % 2 === 0;
            const len = isCardinal ? r - 8 : r - 14;
            ctx.strokeStyle = isCardinal ? 'rgba(190, 170, 110, 0.5)' : 'rgba(150, 135, 90, 0.25)';
            ctx.lineWidth = isCardinal ? 1 : 0.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
            ctx.stroke();
        }

        // Cardinal point labels
        const dirs = ['N', 'O', 'S', 'W'];
        ctx.font = 'bold 9px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        dirs.forEach((d, i) => {
            const a = (i * Math.PI / 2) - Math.PI / 2;
            ctx.fillStyle = d === 'N' ? '#c0392b' : 'rgba(200, 185, 140, 0.9)';
            ctx.fillText(d, cx + Math.cos(a) * (r - 7), cy + Math.sin(a) * (r - 7));
        });

        // Wind arrow with glow
        const windAngle = (gameState.wind.direction * Math.PI / 4) - Math.PI / 2;
        const windLen = 14 + gameState.wind.strength * 4;

        // Arrow glow
        ctx.shadowColor = 'rgba(93, 173, 226, 0.5)';
        ctx.shadowBlur = 4;
        ctx.strokeStyle = '#5dade2';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(windAngle) * windLen, cy + Math.sin(windAngle) * windLen);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Arrowhead
        const ax = cx + Math.cos(windAngle) * windLen;
        const ay = cy + Math.sin(windAngle) * windLen;
        ctx.fillStyle = '#5dade2';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(windAngle - 0.4) * 6, ay - Math.sin(windAngle - 0.4) * 6);
        ctx.lineTo(ax - Math.cos(windAngle + 0.4) * 6, ay - Math.sin(windAngle + 0.4) * 6);
        ctx.closePath();
        ctx.fill();

        // Center pin
        ctx.fillStyle = 'rgba(200, 180, 120, 0.8)';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    // --- Viewport culling helpers ---
    isInViewport(worldX, worldY, margin) {
        margin = margin || 50;
        const s = this.worldToScreen(worldX, worldY);
        return s.x > -margin && s.x < this.width + margin &&
               s.y > -margin && s.y < this.height + margin;
    },

    getViewportWorldBounds() {
        const tl = this.screenToWorld(0, 0);
        const br = this.screenToWorld(this.width, this.height);
        return { left: tl.x, top: tl.y, right: br.x, bottom: br.y };
    },

    // --- Input: Mouse wheel zoom ---
    onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // World position under cursor before zoom
        const worldBefore = this.screenToWorld(mx, my);

        // Adjust zoom (~15% per scroll step)
        const zoomDelta = e.deltaY > 0 ? 0.85 : 1.18;
        this.targetCamera.zoom = Utils.clamp(
            this.targetCamera.zoom * zoomDelta,
            this.MIN_ZOOM, this.MAX_ZOOM
        );

        // Adjust camera so world point under cursor stays fixed
        const newScale = this.baseScale * this.targetCamera.zoom;
        this.targetCamera.x = worldBefore.x + (this.width / 2 - mx) / newScale;
        this.targetCamera.y = worldBefore.y + (this.height / 2 - my) / newScale;

        this.followingShip = false;
    },

    // --- Input: Mouse down (start drag or minimap click) ---
    onMouseDown(e) {
        if (e.button !== 0) return;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Check minimap click first
        if (this.isInMinimap(mx, my)) {
            this.onMinimapClick(mx, my);
            this.minimapDragging = true;
            return;
        }

        this.isDragging = true;
        this.hasDragged = false;
        this.dragStart = { x: mx, y: my };
        this.lastDragPos = { x: mx, y: my };
        this.dragCameraStart = { x: this.targetCamera.x, y: this.targetCamera.y };
        this.velocity = { x: 0, y: 0 };
    },

    // --- Input: Mouse move (drag pan + hover) ---
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (this.minimapDragging) {
            this.onMinimapClick(mx, my);
            return;
        }

        if (this.isDragging) {
            const dx = mx - this.lastDragPos.x;
            const dy = my - this.lastDragPos.y;

            if (Math.abs(mx - this.dragStart.x) > 4 || Math.abs(my - this.dragStart.y) > 4) {
                this.hasDragged = true;
            }

            // Pan camera in world space (opposite to drag direction)
            this.targetCamera.x -= dx / this.scale;
            this.targetCamera.y -= dy / this.scale;

            // Track velocity for inertia
            this.velocity = { x: -dx, y: -dy };
            this.lastDragPos = { x: mx, y: my };
            this.followingShip = false;
            this.canvas.style.cursor = 'grabbing';

            // Hide tooltip while dragging
            const tooltip = document.getElementById('map-tooltip');
            if (tooltip) tooltip.classList.add('hidden');
            return;
        }

        // Hover detection when not dragging
        this.updateHover(mx, my);
    },

    // --- Input: Mouse up (end drag or handle click) ---
    onMouseUp(e) {
        if (this.minimapDragging) {
            this.minimapDragging = false;
            return;
        }

        const wasDragging = this.isDragging;
        this.isDragging = false;

        if (wasDragging && !this.hasDragged && e && e.clientX !== undefined) {
            // It was a click, not a drag
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            this.handleClick(mx, my);
        }
        // Inertia velocity was set during drag, friction is applied in render()
    },

    // --- Input: Double click to zoom ---
    onDoubleClick(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const worldPos = this.screenToWorld(mx, my);
        this.targetCamera.x = worldPos.x;
        this.targetCamera.y = worldPos.y;
        this.targetCamera.zoom = Utils.clamp(this.targetCamera.zoom * 1.8, this.MIN_ZOOM, this.MAX_ZOOM);
        this.followingShip = false;
    },

    // --- Input: Keyboard shortcuts ---
    onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch (e.key) {
            case 'Home':
            case 'h':
                this.targetCamera = { x: 600, y: 350, zoom: 1.0 };
                this.followingShip = false;
                break;
            case '+':
            case '=':
                this.targetCamera.zoom = Utils.clamp(this.targetCamera.zoom * 1.3, this.MIN_ZOOM, this.MAX_ZOOM);
                break;
            case '-':
                this.targetCamera.zoom = Utils.clamp(this.targetCamera.zoom * 0.77, this.MIN_ZOOM, this.MAX_ZOOM);
                break;
            case 'Escape':
                this.followingShip = false;
                this.selectedShip = null;
                break;
        }
    },

    // --- Input: Touch support ---
    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const t = e.touches[0];
            this.onMouseDown({ button: 0, clientX: t.clientX, clientY: t.clientY });
        } else if (e.touches.length === 2) {
            this.isDragging = false;
            this.pinchStartDist = Utils.distance(
                e.touches[0].clientX, e.touches[0].clientY,
                e.touches[1].clientX, e.touches[1].clientY
            );
            this.pinchStartZoom = this.targetCamera.zoom;
        }
    },

    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            this.onMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
        } else if (e.touches.length === 2) {
            const dist = Utils.distance(
                e.touches[0].clientX, e.touches[0].clientY,
                e.touches[1].clientX, e.touches[1].clientY
            );
            this.targetCamera.zoom = Utils.clamp(
                this.pinchStartZoom * (dist / this.pinchStartDist),
                this.MIN_ZOOM, this.MAX_ZOOM
            );
        }
    },

    onTouchEnd(e) {
        this.onMouseUp({});
    },

    // --- Hover detection (extracted from old onMouseMove) ---
    updateHover(mx, my) {
        this.hoveredCity = null;

        for (const id of CITY_IDS) {
            const city = CITIES_DATA[id];
            if (!this.isInViewport(city.x, city.y, 30)) continue;
            const pos = this.worldToScreen(city.x, city.y);
            const radius = (4 + city.importance * 1.5) * this.scale + 10;
            if (Utils.distance(mx, my, pos.x, pos.y) < radius) {
                this.hoveredCity = id;
                break;
            }
        }

        // Enhanced tooltip
        const tooltip = document.getElementById('map-tooltip');
        if (this.hoveredCity && typeof Game !== 'undefined') {
            const city = CITIES_DATA[this.hoveredCity];
            const cityState = Game.state && Game.state.cities ? Game.state.cities[this.hoveredCity] : null;
            tooltip.classList.remove('hidden');
            tooltip.style.left = Math.min(mx + 15, this.width - 230) + 'px';
            tooltip.style.top = Math.min(my - 10, this.height - 120) + 'px';

            let html = `<h4>${city.displayName}</h4>`;
            html += `<p>${city.description}</p>`;
            if (cityState) {
                html += `<p>Einwohner: ${Utils.formatNumber(cityState.population)}</p>`;
                const produced = Object.entries(city.production).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]).slice(0,3);
                if (produced.length > 0) {
                    html += '<p>Produziert: ' + produced.map(([g]) => GOODS[g].icon).join(' ') + '</p>';
                }
            }
            if (city.hasShipyard) html += '<p>&#9875; Werft</p>';
            const docked = Game.state.player.ships.filter(s => s.location === this.hoveredCity);
            if (docked.length > 0) html += `<p>&#9973; ${docked.length} Schiff(e)</p>`;
            tooltip.innerHTML = html;
        } else {
            if (tooltip) tooltip.classList.add('hidden');
        }

        this.canvas.style.cursor = this.hoveredCity ? 'pointer' : 'grab';
    },

    // --- Click handler (unified: ship click + city click) ---
    handleClick(mx, my) {
        // 1. Check ship click
        const clickedShip = this.getShipAtScreen(mx, my);
        if (clickedShip) {
            this.selectedShip = clickedShip;
            this.followingShip = true;
            this.targetCamera.zoom = Utils.clamp(Math.max(this.targetCamera.zoom, 2.0), this.MIN_ZOOM, this.MAX_ZOOM);
            return;
        }

        // 2. Check city click
        this.updateHover(mx, my);
        if (this.hoveredCity) {
            this.selectCity(this.hoveredCity);
        }
    },

    // --- Ship click detection ---
    getShipAtScreen(mx, my) {
        if (!this._lastGameState || !this._lastGameState.player) return null;
        const t = this.animFrame;
        for (const ship of this._lastGameState.player.ships) {
            if (ship.status !== 'sailing' || !ship.route || ship.route.length < 2) continue;
            const pos = this.getShipScreenPos(ship, t);
            if (!pos) continue;
            if (Utils.distance(mx, my, pos.x, pos.y) < 25) return ship;
        }
        return null;
    },

    selectCity(cityId) {
        this.selectedCity = cityId;
        this.followingShip = false;
        if (typeof UI !== 'undefined') {
            UI.onCitySelected(cityId);
        }
    },

    // --- Minimap ---
    isInMinimap(sx, sy) {
        const mx = 10, my = this.height - this.MINIMAP_H - 10;
        return sx >= mx && sx <= mx + this.MINIMAP_W && sy >= my && sy <= my + this.MINIMAP_H;
    },

    onMinimapClick(sx, sy) {
        const mx = 10, my = this.height - this.MINIMAP_H - 10;
        const ms = this.MINIMAP_W / CONFIG.MAP_WIDTH;
        this.targetCamera.x = Utils.clamp((sx - mx) / ms, 0, CONFIG.MAP_WIDTH);
        this.targetCamera.y = Utils.clamp((sy - my) / ms, 0, CONFIG.MAP_HEIGHT);
        this.followingShip = false;
    },

    renderMinimapBuffer() {
        const ctx = this.minimapCtx;
        const ms = this.MINIMAP_W / CONFIG.MAP_WIDTH;
        ctx.clearRect(0, 0, this.MINIMAP_W, this.MINIMAP_H);

        // Ocean
        ctx.fillStyle = '#0a2840';
        ctx.fillRect(0, 0, this.MINIMAP_W, this.MINIMAP_H);

        // Draw land masses as filled polygons
        ctx.fillStyle = '#2a5e2a';
        const masses = this.getLandMasses();
        masses.forEach(pts => {
            if (pts.length < 3) return;
            ctx.beginPath();
            ctx.moveTo(pts[0][0] * ms, pts[0][1] * ms);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i][0] * ms, pts[i][1] * ms);
            }
            ctx.closePath();
            ctx.fill();
        });
    },

    drawMinimap(ctx, gameState) {
        const mw = this.MINIMAP_W;
        const mh = this.MINIMAP_H;
        const mx = 10;
        const my = this.height - mh - 10;
        const ms = mw / CONFIG.MAP_WIDTH;

        // Background
        ctx.fillStyle = 'rgba(5, 20, 45, 0.85)';
        ctx.fillRect(mx - 1, my - 1, mw + 2, mh + 2);

        // Pre-rendered land
        if (this.minimapDirty) {
            this.renderMinimapBuffer();
            this.minimapDirty = false;
        }
        ctx.drawImage(this.minimapCanvas, mx, my);

        // City dots
        CITY_IDS.forEach(id => {
            const city = CITIES_DATA[id];
            const cx = mx + city.x * ms;
            const cy = my + city.y * ms;
            const r = city.importance >= 4 ? 2 : 1;
            ctx.fillStyle = this.selectedCity === id ? '#ffd700' : '#c8b880';
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        });

        // Ship dots (bright blue for player, grey for AI)
        if (gameState && gameState.player) {
            gameState.player.ships.forEach(ship => {
                let wx, wy;
                if (ship.status === 'sailing') {
                    const world = this.getShipWorldPos(ship);
                    if (world) { wx = world.x; wy = world.y; }
                } else if (ship.location) {
                    const city = CITIES_DATA[ship.location];
                    if (city) { wx = city.x; wy = city.y; }
                }
                if (wx !== undefined) {
                    const isFollowed = this.selectedShip === ship && this.followingShip;
                    ctx.fillStyle = isFollowed ? '#ffd700' : '#5dade2';
                    ctx.beginPath();
                    ctx.arc(mx + wx * ms, my + wy * ms, isFollowed ? 3 : 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        // Viewport rectangle
        const tl = this.screenToWorld(0, 0);
        const br = this.screenToWorld(this.width, this.height);
        const vx = mx + Math.max(0, tl.x) * ms;
        const vy = my + Math.max(0, tl.y) * ms;
        const vw = Math.min(CONFIG.MAP_WIDTH, br.x) * ms - Math.max(0, tl.x) * ms;
        const vh = Math.min(CONFIG.MAP_HEIGHT, br.y) * ms - Math.max(0, tl.y) * ms;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vx, vy, Math.max(vw, 4), Math.max(vh, 4));

        // Border
        ctx.strokeStyle = 'rgba(180, 160, 110, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - 1, my - 1, mw + 2, mh + 2);
    },

    // --- Route preview line ---
    showRoutePreview(ship, targetCityId) {
        this.routePreview = {
            from: ship.location,
            to: targetCityId,
            timestamp: performance.now()
        };
    }
};
