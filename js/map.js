/* ============================================
   HANSE - Enhanced Map Renderer
   Phase 3: Terrain, atmosphere, visual polish
   ============================================ */

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

    init() {
        this.canvas = document.getElementById('game-map');
        this.ctx = this.canvas.getContext('2d');
        // Off-screen canvas for land (static, drawn once)
        this.landCanvas = document.createElement('canvas');
        this.landCtx = this.landCanvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => { this.resize(); this.landDirty = true; });
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
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
        this.scaleX = this.width / CONFIG.MAP_WIDTH;
        this.scaleY = this.height / CONFIG.MAP_HEIGHT;
        this.scale = Math.min(this.scaleX, this.scaleY);
        this.offsetX = (this.width - CONFIG.MAP_WIDTH * this.scale) / 2;
        this.offsetY = (this.height - CONFIG.MAP_HEIGHT * this.scale) / 2;
        this.landDirty = true;
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

        // Seasonal tint factor (month 1-12)
        const month = gameState && gameState.date ? gameState.date.month : 6;
        const seasonDark = this._getSeasonalDarkness(month);

        // Deep ocean gradient background with seasonal tint
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        const r0 = Math.round(7 * (1 - seasonDark * 0.3));
        const g0 = Math.round(26 * (1 - seasonDark * 0.2));
        const b0 = Math.round(48 * (1 - seasonDark * 0.15));
        grad.addColorStop(0, `rgb(${r0},${g0},${b0})`);
        grad.addColorStop(0.3, `rgb(${Math.round(12*(1-seasonDark*0.25))},${Math.round(40*(1-seasonDark*0.15))},${Math.round(68*(1-seasonDark*0.1))})`);
        grad.addColorStop(0.6, `rgb(${Math.round(14*(1-seasonDark*0.2))},${Math.round(48*(1-seasonDark*0.12))},${Math.round(88*(1-seasonDark*0.08))})`);
        grad.addColorStop(1, `rgb(${Math.round(10*(1-seasonDark*0.25))},${Math.round(34*(1-seasonDark*0.15))},${Math.round(64*(1-seasonDark*0.1))})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Animated water
        this.drawSea(ctx);

        // Sea sparkles
        this.drawSparkles(ctx);

        // Clouds (behind everything else, atmospheric)
        this.drawClouds(ctx);

        // Draw sea routes
        this.drawRoutes(ctx, gameState);

        // Pre-rendered land
        if (this.landDirty) {
            this.renderLandToBuffer();
            this.landDirty = false;
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

        // Cities on top
        this.drawCities(ctx, gameState);

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
            ctx.fillStyle = `rgba(5, 10, 25, ${seasonDark * 0.15})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        // Compass rose
        this.drawCompass(ctx, gameState);
    },

    _getSeasonalDarkness(month) {
        // 0 = summer (bright), 1 = deep winter (dark)
        // Month 6-7 = summer (0), Month 12-1 = winter (1)
        const distFromSummer = Math.abs(((month - 1 + 6) % 12) - 6);
        return distFromSummer / 6;
    },

    drawSea(ctx) {
        const t = this.animFrame;

        // Layer 1: large slow waves
        ctx.strokeStyle = 'rgba(20, 70, 130, 0.15)';
        ctx.lineWidth = 1.5;
        for (let y = -10; y < this.height + 10; y += 28) {
            ctx.beginPath();
            for (let x = 0; x < this.width; x += 4) {
                const wy = y
                    + Math.sin((x * 0.008) + t * 0.012) * 6
                    + Math.sin((x * 0.015) + t * 0.02 + y * 0.01) * 3;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }

        // Layer 2: smaller faster ripples
        ctx.strokeStyle = 'rgba(40, 100, 170, 0.08)';
        ctx.lineWidth = 0.8;
        for (let y = 5; y < this.height; y += 16) {
            ctx.beginPath();
            for (let x = 0; x < this.width; x += 3) {
                const wy = y
                    + Math.sin((x * 0.02) + t * 0.03 + y * 0.005) * 2
                    + Math.cos((x * 0.03) + t * 0.015) * 1.5;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }

        // Layer 3: foam highlights on crests
        ctx.strokeStyle = 'rgba(120, 180, 230, 0.06)';
        ctx.lineWidth = 2;
        for (let y = 0; y < this.height; y += 45) {
            ctx.beginPath();
            const wavePhase = t * 0.01 + y * 0.02;
            for (let x = 0; x < this.width; x += 5) {
                const wy = y + Math.sin((x * 0.007) + wavePhase) * 8;
                const brightness = Math.max(0, Math.sin((x * 0.007) + wavePhase));
                if (brightness > 0.85) {
                    ctx.globalAlpha = (brightness - 0.85) * 4;
                    ctx.fillStyle = 'rgba(180, 220, 255, 0.15)';
                    ctx.fillRect(x, wy - 1, 6, 2);
                }
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.globalAlpha = 1;
        }
    },

    drawSparkles(ctx) {
        const t = this.animFrame;
        this.sparkles.forEach(s => {
            const brightness = (Math.sin(t * s.speed + s.phase) + 1) * 0.5;
            if (brightness > 0.7) {
                const sx = s.x * this.width;
                const sy = s.y * this.height;
                ctx.globalAlpha = (brightness - 0.7) * 3;
                ctx.fillStyle = '#b8d8f8';
                ctx.beginPath();
                ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;
    },

    renderLandToBuffer() {
        const ctx = this.landCtx;
        ctx.clearRect(0, 0, this.width, this.height);

        // --- Shallow water zone (drawn first, behind land) ---
        ctx.save();
        const shallowGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        shallowGrad.addColorStop(0, 'rgba(30, 90, 140, 0.5)');
        shallowGrad.addColorStop(0.5, 'rgba(35, 100, 150, 0.5)');
        shallowGrad.addColorStop(1, 'rgba(28, 85, 130, 0.5)');
        ctx.fillStyle = shallowGrad;
        ctx.strokeStyle = 'rgba(50, 120, 170, 0.3)';
        ctx.lineWidth = 1;
        this.drawAllLandMasses(ctx, false, 12);
        // Inner lighter band
        ctx.fillStyle = 'rgba(50, 130, 180, 0.25)';
        this.drawAllLandMasses(ctx, false, 6);
        ctx.restore();

        // --- Main land with gradient ---
        const landGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        landGrad.addColorStop(0, '#2a5e2a');
        landGrad.addColorStop(0.3, '#336633');
        landGrad.addColorStop(0.6, '#3a7035');
        landGrad.addColorStop(1, '#2a5a28');

        ctx.fillStyle = landGrad;
        ctx.strokeStyle = '#4a8a4a';
        ctx.lineWidth = 1.5;
        this.drawAllLandMasses(ctx);

        // Coastline shadow
        ctx.shadowColor = 'rgba(0, 20, 40, 0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.strokeStyle = 'rgba(60, 100, 60, 0.5)';
        ctx.lineWidth = 1;
        this.drawAllLandMasses(ctx, true);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // --- Terrain texture (subtle dots) ---
        ctx.fillStyle = 'rgba(50, 110, 50, 0.2)';
        for (let i = 0; i < 300; i++) {
            const tx = Math.random() * this.width;
            const ty = Math.random() * this.height;
            ctx.beginPath();
            ctx.arc(tx, ty, 0.8 + Math.random(), 0, Math.PI * 2);
            ctx.fill();
        }

        // --- Rivers ---
        this.drawRivers(ctx);

        // --- Mountains ---
        this.drawMountains(ctx);

        // --- Forests ---
        this.drawForests(ctx);
    },

    drawRivers(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(60, 130, 190, 0.6)';
        ctx.lineWidth = 1.5 * this.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Elbe - flows into Hamburg from south
        const elbe = [[430, 600], [432, 540], [428, 490], [430, 450], [432, 420], [430, 370]];
        this.drawRiverPath(ctx, elbe, 1.5);

        // Oder - flows into Stettin from south
        const oder = [[610, 600], [615, 530], [618, 480], [615, 440], [616, 400], [615, 370]];
        this.drawRiverPath(ctx, oder, 1.3);

        // Weichsel/Vistula - flows into Danzig from south
        const weichsel = [[718, 600], [722, 530], [725, 470], [720, 420], [720, 380], [720, 340]];
        this.drawRiverPath(ctx, weichsel, 1.4);

        // Weser - flows near Bremen
        const weser = [[388, 600], [390, 520], [392, 460], [390, 385]];
        this.drawRiverPath(ctx, weser, 1.0);

        ctx.restore();
    },

    drawRiverPath(ctx, points, widthMul) {
        if (points.length < 2) return;
        ctx.beginPath();
        const p0 = this.worldToScreen(points[0][0], points[0][1]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < points.length; i++) {
            const p = this.worldToScreen(points[i][0], points[i][1]);
            if (i < points.length - 1) {
                const pn = this.worldToScreen(points[i+1][0], points[i+1][1]);
                const cx = (p.x + pn.x) / 2;
                const cy = (p.y + pn.y) / 2;
                ctx.quadraticCurveTo(p.x, p.y, cx, cy);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.lineWidth = widthMul * this.scale;
        ctx.strokeStyle = 'rgba(50, 120, 180, 0.5)';
        ctx.stroke();
        // Highlight
        ctx.lineWidth = widthMul * 0.5 * this.scale;
        ctx.strokeStyle = 'rgba(80, 160, 220, 0.3)';
        ctx.stroke();
    },

    drawMountains(ctx) {
        if (!this.terrainSeed) return;
        ctx.save();

        this.terrainSeed.mountains.forEach(m => {
            const p = this.worldToScreen(m.x, m.y);
            const s = m.size * this.scale * 6;

            // Mountain shadow
            ctx.fillStyle = 'rgba(20, 50, 20, 0.35)';
            ctx.beginPath();
            ctx.moveTo(p.x - s * 0.9, p.y + s * 0.35);
            ctx.lineTo(p.x + s * 0.2, p.y - s * 0.8);
            ctx.lineTo(p.x + s * 1.1, p.y + s * 0.35);
            ctx.closePath();
            ctx.fill();

            // Mountain body
            ctx.fillStyle = 'rgba(60, 90, 50, 0.7)';
            ctx.beginPath();
            ctx.moveTo(p.x - s * 0.8, p.y + s * 0.3);
            ctx.lineTo(p.x, p.y - s * 0.9);
            ctx.lineTo(p.x + s * 0.8, p.y + s * 0.3);
            ctx.closePath();
            ctx.fill();

            // Lighter face
            ctx.fillStyle = 'rgba(80, 120, 60, 0.5)';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - s * 0.9);
            ctx.lineTo(p.x + s * 0.8, p.y + s * 0.3);
            ctx.lineTo(p.x + s * 0.1, p.y + s * 0.15);
            ctx.closePath();
            ctx.fill();

            // Snow cap
            if (m.snow) {
                ctx.fillStyle = 'rgba(220, 230, 240, 0.7)';
                ctx.beginPath();
                ctx.moveTo(p.x - s * 0.2, p.y - s * 0.55);
                ctx.lineTo(p.x, p.y - s * 0.9);
                ctx.lineTo(p.x + s * 0.2, p.y - s * 0.55);
                ctx.quadraticCurveTo(p.x, p.y - s * 0.45, p.x - s * 0.2, p.y - s * 0.55);
                ctx.closePath();
                ctx.fill();
            }
        });
        ctx.restore();
    },

    drawForests(ctx) {
        if (!this.terrainSeed) return;
        ctx.save();

        this.terrainSeed.forests.forEach(f => {
            for (let t = 0; t < f.count; t++) {
                const ox = (t - f.count / 2) * 5 * f.size;
                const oy = ((t % 2) - 0.5) * 3 * f.size;
                const p = this.worldToScreen(f.x + ox, f.y + oy);
                const s = f.size * this.scale * 4;

                // Tree shadow
                ctx.fillStyle = 'rgba(15, 40, 15, 0.25)';
                ctx.beginPath();
                ctx.ellipse(p.x + s * 0.15, p.y + s * 0.45, s * 0.45, s * 0.15, 0, 0, Math.PI * 2);
                ctx.fill();

                // Tree trunk
                ctx.fillStyle = 'rgba(80, 55, 30, 0.6)';
                ctx.fillRect(p.x - s * 0.05, p.y + s * 0.1, s * 0.1, s * 0.3);

                // Tree canopy (dark triangle)
                ctx.fillStyle = 'rgba(30, 70, 25, 0.65)';
                ctx.beginPath();
                ctx.moveTo(p.x - s * 0.35, p.y + s * 0.15);
                ctx.lineTo(p.x, p.y - s * 0.5);
                ctx.lineTo(p.x + s * 0.35, p.y + s * 0.15);
                ctx.closePath();
                ctx.fill();

                // Lighter top layer
                ctx.fillStyle = 'rgba(50, 100, 40, 0.45)';
                ctx.beginPath();
                ctx.moveTo(p.x - s * 0.25, p.y - s * 0.05);
                ctx.lineTo(p.x, p.y - s * 0.5);
                ctx.lineTo(p.x + s * 0.25, p.y - s * 0.05);
                ctx.closePath();
                ctx.fill();
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

        SEA_ROUTES.forEach(route => {
            const from = CITIES_DATA[route.from];
            const to = CITIES_DATA[route.to];
            if (!from || !to) return;
            const p1 = this.worldToScreen(from.x, from.y);
            const p2 = this.worldToScreen(to.x, to.y);

            // Check if any player ship is on this route
            let isActive = false;
            if (gameState && gameState.player) {
                isActive = gameState.player.ships.some(s => {
                    if (s.status !== 'sailing' || !s.route) return false;
                    for (let i = 0; i < s.route.length - 1; i++) {
                        if ((s.route[i] === route.from && s.route[i+1] === route.to) ||
                            (s.route[i] === route.to && s.route[i+1] === route.from)) return true;
                    }
                    return false;
                });
            }

            if (isActive) {
                // Animated dashes for active routes
                ctx.strokeStyle = 'rgba(230, 168, 23, 0.35)';
                ctx.lineWidth = 2;
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
        });

        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
    },

    drawCities(ctx, gameState) {
        const t = this.animFrame;

        CITY_IDS.forEach(id => {
            const city = CITIES_DATA[id];
            const pos = this.worldToScreen(city.x, city.y);
            const isSelected = this.selectedCity === id;
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

            // City name with shadow
            const fontSize = Math.max(10, Math.round((city.importance >= 4 ? 12 : 11) * this.scale));
            ctx.font = `${isSelected || city.importance >= 4 ? 'bold ' : ''}${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = isSelected ? '#ffd700' : (isHovered ? '#fff' : (city.importance >= 4 ? '#e8dcc0' : '#c8c0a8'));
            const nameY = city.importance >= 3 ? pos.y - radius - 10 : pos.y - radius - 5;
            ctx.fillText(city.displayName, pos.x, nameY);
            ctx.shadowBlur = 0;

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

    // Enhanced ship rendering with wakes
    drawShips(ctx, gameState) {
        if (!gameState || !gameState.player) return;
        const t = this.animFrame;

        // Player ships
        gameState.player.ships.forEach(ship => {
            if (ship.status !== 'sailing' || !ship.route || ship.route.length < 2) return;
            const pos = this.getShipScreenPos(ship, t);
            if (!pos) return;

            // Add wake particles
            if (t % 3 === 0) {
                this.wakes.push({
                    x: pos.x - Math.cos(pos.angle) * 8,
                    y: pos.y - Math.sin(pos.angle) * 8,
                    life: 1.0, size: 3, decay: 0.015
                });
            }

            this.drawDetailedShip(ctx, pos.x, pos.y, pos.angle, ship, '#e6a817', '#fff', true);

            // Ship name label
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 3;
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(ship.name, pos.x, pos.y - 16);
            ctx.shadowBlur = 0;

            // Hull bar if damaged
            if (ship.hull < ship.maxHull) {
                const barW = 24;
                const barH = 3;
                const hullPct = ship.hull / ship.maxHull;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(pos.x - barW/2, pos.y + 10, barW, barH);
                ctx.fillStyle = hullPct > 0.5 ? '#27ae60' : (hullPct > 0.25 ? '#f39c12' : '#c0392b');
                ctx.fillRect(pos.x - barW/2, pos.y + 10, barW * hullPct, barH);
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

                    this.drawDetailedShip(ctx, pos.x, pos.y, pos.angle, ship, '#778899', '#ccc', false);
                });
            });
        }
    },

    getShipScreenPos(ship, t) {
        const fromCity = CITIES_DATA[ship.route[ship.routeIndex]];
        const toIdx = Math.min(ship.routeIndex + 1, ship.route.length - 1);
        const toCity = CITIES_DATA[ship.route[toIdx]];
        if (!fromCity || !toCity) return null;

        const p1 = this.worldToScreen(fromCity.x, fromCity.y);
        const p2 = this.worldToScreen(toCity.x, toCity.y);
        const prog = ship.progress;

        const x = Utils.lerp(p1.x, p2.x, prog);
        const y = Utils.lerp(p1.y, p2.y, prog)
            + Math.sin(t * 0.08) * 2.5
            + Math.cos(t * 0.12) * 1;
        const angle = Utils.angle(p1.x, p1.y, p2.x, p2.y);

        return { x, y, angle };
    },

    drawDetailedShip(ctx, x, y, angle, ship, hullColor, sailColor, isPlayer) {
        const t = this.animFrame;
        const s = isPlayer ? 1.3 : 0.9;

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

        // --- Square Sail (Rahsegel) - the Kogge trademark ---
        const flutter = Math.sin(t * 0.08) * 1.5 * s;
        const flutter2 = Math.sin(t * 0.08 + 1) * 1.0 * s;
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

        // Storm effect when wind is very strong
        if (windStrength > 2.0) {
            const stormIntensity = (windStrength - 2.0) / 1.0;
            const windAngle = gameState.wind.direction * Math.PI / 4;

            // Rain streaks
            ctx.strokeStyle = `rgba(150, 180, 210, ${stormIntensity * 0.12})`;
            ctx.lineWidth = 0.8;
            for (let i = 0; i < 40 * stormIntensity; i++) {
                const rx = ((i * 37 + t * 3) % this.width);
                const ry = ((i * 53 + t * 5) % this.height);
                const len = 8 + stormIntensity * 12;
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(rx + Math.cos(windAngle + 1.2) * len, ry + Math.sin(windAngle + 1.2) * len);
                ctx.stroke();
            }

            // Misty overlay
            ctx.fillStyle = `rgba(100, 120, 140, ${stormIntensity * 0.06})`;
            ctx.fillRect(0, 0, this.width, this.height);
        }

        // Calm/good weather: subtle sun rays (when wind is gentle)
        if (windStrength < 1.0) {
            const calmness = (1.0 - windStrength);
            // Subtle warm overlay in upper-right
            const sunGrd = ctx.createRadialGradient(
                this.width * 0.85, this.height * 0.05, 0,
                this.width * 0.85, this.height * 0.05, this.width * 0.5
            );
            sunGrd.addColorStop(0, `rgba(255, 240, 200, ${calmness * 0.04})`);
            sunGrd.addColorStop(0.4, `rgba(255, 230, 180, ${calmness * 0.02})`);
            sunGrd.addColorStop(1, 'rgba(255, 230, 180, 0)');
            ctx.fillStyle = sunGrd;
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
            ctx.globalAlpha = cloud.opacity;
            ctx.fillStyle = 'rgba(200, 210, 225, 0.5)';

            cloud.blobs.forEach(b => {
                ctx.beginPath();
                ctx.ellipse(cx + b.ox * sc, cy + b.oy * sc, b.rx * sc, b.ry * sc, 0, 0, Math.PI * 2);
                ctx.fill();
            });

            // Highlight on top
            ctx.fillStyle = 'rgba(230, 240, 255, 0.3)';
            cloud.blobs.forEach(b => {
                ctx.beginPath();
                ctx.ellipse(cx + b.ox * sc, cy + (b.oy - 2) * sc, b.rx * sc * 0.7, b.ry * sc * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.globalAlpha = 1;
            ctx.restore();
        });
    },

    drawCompass(ctx, gameState) {
        if (!gameState) return;
        const cx = this.width - 45;
        const cy = this.height - 45;
        const r = 28;
        const t = this.animFrame;

        // Background circle
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = 'rgba(20, 35, 60, 0.85)';
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 160, 100, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Cardinal points
        const dirs = ['N', 'O', 'S', 'W'];
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        dirs.forEach((d, i) => {
            const a = (i * Math.PI / 2) - Math.PI / 2;
            ctx.fillStyle = d === 'N' ? '#c0392b' : '#a09070';
            ctx.fillText(d, cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
        });

        // Wind arrow
        const windAngle = (gameState.wind.direction * Math.PI / 4) - Math.PI / 2;
        const windLen = 12 + gameState.wind.strength * 4;
        ctx.strokeStyle = '#5dade2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(windAngle) * windLen, cy + Math.sin(windAngle) * windLen);
        ctx.stroke();

        // Arrowhead
        const ax = cx + Math.cos(windAngle) * windLen;
        const ay = cy + Math.sin(windAngle) * windLen;
        ctx.fillStyle = '#5dade2';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(windAngle - 0.4) * 5, ay - Math.sin(windAngle - 0.4) * 5);
        ctx.lineTo(ax - Math.cos(windAngle + 0.4) * 5, ay - Math.sin(windAngle + 0.4) * 5);
        ctx.closePath();
        ctx.fill();
    },

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        this.hoveredCity = null;

        for (const id of CITY_IDS) {
            const city = CITIES_DATA[id];
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
                // Show top produced goods
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
            tooltip.classList.add('hidden');
        }

        this.canvas.style.cursor = this.hoveredCity ? 'pointer' : 'crosshair';
    },

    onClick(e) {
        if (this.hoveredCity) {
            this.selectCity(this.hoveredCity);
        }
    },

    selectCity(cityId) {
        this.selectedCity = cityId;
        if (typeof UI !== 'undefined') {
            UI.onCitySelected(cityId);
        }
    }
};
