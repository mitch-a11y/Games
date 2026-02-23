/* ============================================
   HANSE - Cinematic Intro & Title Screen
   Phase 1: Blueprint drawing on parchment
   Phase 2: Story text crawl
   Phase 3: Transition to ocean scene + title menu
   ============================================ */

const Intro = {
    canvas: null,
    ctx: null,
    frame: 0,
    phase: 'idle', // idle, blueprint, story, ocean, title
    startTime: 0,
    animId: null,

    // Blueprint ship path segments (Hanseatic Kogge)
    shipPaths: [],
    drawnLength: 0,

    // Story
    storyLines: [
        { text: 'Anno Domini 1370', style: 'date', delay: 0 },
        { text: '', style: 'gap', delay: 0 },
        { text: 'Die Ostsee \u2014 ein Meer der M\u00f6glichkeiten.', style: 'normal', delay: 1.8 },
        { text: 'Hansekoggen tragen Waren von L\u00fcbeck bis Nowgorod,', style: 'normal', delay: 3.6 },
        { text: 'von Bergen bis Br\u00fcgge.', style: 'normal', delay: 5.2 },
        { text: '', style: 'gap', delay: 0 },
        { text: 'Doch das Meer ist unbarmherzig.', style: 'normal', delay: 7.0 },
        { text: 'Piraten lauern. St\u00fcrme toben.', style: 'normal', delay: 8.5 },
        { text: '', style: 'gap', delay: 0 },
        { text: 'Du bist ein junger Kaufmann.', style: 'normal', delay: 10.5 },
        { text: 'Mit einer Kogge und gro\u00dfen Tr\u00e4umen.', style: 'normal', delay: 12.0 },
        { text: '', style: 'gap', delay: 0 },
        { text: 'Deine Geschichte beginnt jetzt...', style: 'final', delay: 14.0 },
    ],
    storyStart: 0,

    // Ocean scene
    stars: [],
    waves: [],
    clouds: [],
    ship: { x: -250, y: 0, bob: 0, angle: 0, targetX: 0 },

    // Title
    titleAlpha: 0,
    menuAlpha: 0,
    panelAlpha: 0,

    // Particles (dust motes for parchment, fireflies for ocean)
    particles: [],

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        this._buildShipPaths();
        window.addEventListener('resize', () => this.resize());
    },

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    // ==========================================
    // SHIP BLUEPRINT PATH DATA
    // ==========================================
    _buildShipPaths() {
        // Hanseatic Kogge blueprint - drawn as sequential line segments
        // Coordinates are relative to center, scaled later
        // Each path = { points: [{x,y},...], style: 'hull'|'mast'|'sail'|'detail'|'rigging' }
        this.shipPaths = [
            // HULL - main body
            { style: 'hull', points: [
                {x:-120,y:10},{x:-115,y:25},{x:-100,y:38},{x:-70,y:48},{x:-30,y:52},{x:20,y:52},{x:70,y:48},{x:100,y:40},{x:130,y:28},{x:145,y:12},{x:140,y:5},{x:130,y:0},{x:100,y:-8},{x:50,y:-12},{x:0,y:-14},{x:-50,y:-12},{x:-100,y:-8},{x:-120,y:0},{x:-120,y:10}
            ]},
            // HULL planking lines
            { style: 'detail', points: [{x:-110,y:5},{x:-60,y:15},{x:0,y:18},{x:60,y:15},{x:120,y:5}] },
            { style: 'detail', points: [{x:-105,y:18},{x:-50,y:30},{x:0,y:33},{x:50,y:30},{x:105,y:20}] },
            { style: 'detail', points: [{x:-95,y:32},{x:-40,y:42},{x:0,y:44},{x:40,y:42},{x:90,y:34}] },
            // KEEL
            { style: 'hull', points: [{x:-110,y:-14},{x:0,y:-18},{x:120,y:-12}] },
            // STERN post
            { style: 'hull', points: [{x:-120,y:10},{x:-135,y:-20},{x:-130,y:-50}] },
            // STERN castle
            { style: 'hull', points: [{x:-135,y:-20},{x:-125,y:-22},{x:-110,y:-8}] },
            { style: 'detail', points: [{x:-132,y:-35},{x:-120,y:-38},{x:-108,y:-20}] },
            // BOW post
            { style: 'hull', points: [{x:145,y:12},{x:155,y:-10},{x:150,y:-40}] },
            // BOW castle
            { style: 'hull', points: [{x:155,y:-10},{x:143,y:-15},{x:130,y:0}] },
            // MAST - main
            { style: 'mast', points: [{x:10,y:-14},{x:10,y:-160}] },
            // MAST - cross beam (yard)
            { style: 'mast', points: [{x:-55,y:-140},{x:75,y:-140}] },
            // SAIL - square
            { style: 'sail', points: [{x:-52,y:-137},{x:-48,y:-45},{x:0,y:-38},{x:48,y:-45},{x:52,y:-137}] },
            // SAIL cross (Hanse emblem)
            { style: 'cross', points: [{x:-25,y:-95},{x:25,y:-95}] },
            { style: 'cross', points: [{x:0,y:-125},{x:0,y:-55}] },
            // RIGGING - shrouds
            { style: 'rigging', points: [{x:10,y:-155},{x:-100,y:-5}] },
            { style: 'rigging', points: [{x:10,y:-155},{x:120,y:0}] },
            { style: 'rigging', points: [{x:10,y:-155},{x:-80,y:-2}] },
            { style: 'rigging', points: [{x:10,y:-155},{x:100,y:-2}] },
            // STAYS
            { style: 'rigging', points: [{x:10,y:-160},{x:150,y:-35}] },
            { style: 'rigging', points: [{x:10,y:-160},{x:-130,y:-45}] },
            // FLAG
            { style: 'cross', points: [{x:10,y:-160},{x:35,y:-155},{x:10,y:-148}] },
            // RUDDER
            { style: 'hull', points: [{x:-125,y:5},{x:-138,y:15},{x:-130,y:40}] },
            // WATERLINE marks
            { style: 'detail', points: [{x:-100,y:-5},{x:0,y:-8},{x:110,y:-3}] },
            // ANCHOR
            { style: 'detail', points: [{x:110,y:-5},{x:115,y:8},{x:118,y:15}] },
            { style: 'detail', points: [{x:112,y:12},{x:122,y:12}] },
            // DECK DETAILS - hatches
            { style: 'detail', points: [{x:-30,y:-12},{x:-30,y:-6},{x:-10,y:-6},{x:-10,y:-12}] },
            { style: 'detail', points: [{x:40,y:-10},{x:40,y:-4},{x:60,y:-4},{x:60,y:-10}] },
        ];

        // Calculate total path length for animation
        let totalLen = 0;
        for (const path of this.shipPaths) {
            let pathLen = 0;
            for (let i = 1; i < path.points.length; i++) {
                const dx = path.points[i].x - path.points[i-1].x;
                const dy = path.points[i].y - path.points[i-1].y;
                pathLen += Math.sqrt(dx * dx + dy * dy);
            }
            path.length = pathLen;
            path.startAt = totalLen;
            totalLen += pathLen;
        }
        this.totalPathLength = totalLen;
    },

    // ==========================================
    // START SEQUENCES
    // ==========================================
    startIntro() {
        this.phase = 'blueprint';
        this.frame = 0;
        this.startTime = performance.now();
        this.drawnLength = 0;
        this.titleAlpha = 0;
        this.menuAlpha = 0;
        this.panelAlpha = 0;
        this.particles = [];

        // Generate dust motes
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: 1 + Math.random() * 2,
                speed: 0.2 + Math.random() * 0.5,
                alpha: 0.1 + Math.random() * 0.2,
                drift: Math.random() * Math.PI * 2
            });
        }

        // Hide HTML overlay initially
        const titleContent = document.getElementById('title-content');
        if (titleContent) titleContent.style.opacity = '0';
        const menu = document.querySelector('.title-menu');
        if (menu) menu.style.opacity = '0';
        const credit = document.querySelector('.title-credit');
        if (credit) credit.style.opacity = '0';

        // Play newgame sound
        setTimeout(() => {
            if (typeof Sound !== 'undefined') {
                Sound.init();
                Sound.resume();
                Sound.play('newgame');
            }
        }, 1500);

        if (this.animId) cancelAnimationFrame(this.animId);
        this._loop();
    },

    startTitle() {
        this.phase = 'title';
        this.frame = 0;
        this.titleAlpha = 0;
        this.menuAlpha = 0;
        this.panelAlpha = 0;
        this._initOceanScene();
        // Ship already in position for title screen
        this.ship.x = this.ship.targetX;
        if (this.animId) cancelAnimationFrame(this.animId);
        this._loop();
    },

    skipIntro() {
        if (this.phase === 'blueprint' || this.phase === 'story') {
            this.phase = 'title';
            this.titleAlpha = 0;
            this.menuAlpha = 0;
            this.panelAlpha = 0;
            this._initOceanScene();
            this.ship.x = this.ship.targetX;
        } else if (this.phase === 'ocean') {
            this.phase = 'title';
            this.titleAlpha = 0;
            this.menuAlpha = 0;
            this.panelAlpha = 0;
            this.ship.x = this.ship.targetX;
        }
    },

    // ==========================================
    // OCEAN SCENE INIT
    // ==========================================
    _initOceanScene() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.stars = [];
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * w,
                y: Math.random() * h * 0.5,
                size: 0.3 + Math.random() * 1.8,
                twinkle: Math.random() * Math.PI * 2,
                speed: 0.3 + Math.random() * 2
            });
        }

        this.waves = [];
        for (let layer = 0; layer < 5; layer++) {
            this.waves.push({
                y: h * 0.58 + layer * 22,
                amplitude: 6 + layer * 5,
                frequency: 0.006 - layer * 0.0008,
                speed: 0.25 + layer * 0.12,
                alpha: 0.6 - layer * 0.08,
                color: layer < 2 ? [14, 30, 56] : [8, 20, 42]
            });
        }

        this.clouds = [];
        for (let i = 0; i < 8; i++) {
            this.clouds.push({
                x: Math.random() * w * 1.5 - w * 0.25,
                y: h * 0.12 + Math.random() * h * 0.25,
                width: 120 + Math.random() * 250,
                height: 25 + Math.random() * 45,
                speed: 0.08 + Math.random() * 0.2,
                alpha: 0.04 + Math.random() * 0.07
            });
        }

        this.ship = {
            x: -300,
            y: h * 0.54,
            bob: 0,
            angle: 0,
            targetX: w * 0.32
        };
    },

    // ==========================================
    // MAIN LOOP
    // ==========================================
    _loop() {
        if (this.phase === 'idle') return;
        this.frame++;
        this._update();
        this._draw();
        this.animId = requestAnimationFrame(() => this._loop());
    },

    _update() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const t = this.frame / 60;
        const elapsed = (performance.now() - this.startTime) / 1000;

        // === BLUEPRINT PHASE ===
        if (this.phase === 'blueprint') {
            // Draw speed: complete in ~8 seconds
            const drawDuration = 8;
            const progress = Math.min(1, elapsed / drawDuration);
            this.drawnLength = this.totalPathLength * this._easeInOutQuad(progress);

            // Transition to story after drawing done + 1.5s pause
            if (elapsed > drawDuration + 1.5) {
                this.phase = 'story';
                this.storyStart = performance.now();
            }
        }

        // === STORY PHASE ===
        if (this.phase === 'story') {
            const storyElapsed = (performance.now() - this.storyStart) / 1000;
            // Transition to ocean after last story line + 2s
            const lastLineDelay = this.storyLines[this.storyLines.length - 1].delay;
            if (storyElapsed > lastLineDelay + 3.5) {
                this.phase = 'ocean';
                this._initOceanScene();
                this.startTime = performance.now();
            }
        }

        // === OCEAN PHASE (ship sailing in, then transition to title) ===
        if (this.phase === 'ocean') {
            const oceanElapsed = (performance.now() - this.startTime) / 1000;
            const progress = Math.min(1, oceanElapsed / 4);
            this.ship.x = -300 + (this.ship.targetX + 300) * this._easeOutCubic(progress);
            this.ship.bob = Math.sin(t * 0.8) * 6;
            this.ship.angle = Math.sin(t * 0.6 + 0.5) * 0.03;

            for (const c of this.clouds) {
                c.x += c.speed;
                if (c.x > w + c.width) c.x = -c.width;
            }

            if (oceanElapsed > 5) {
                this.phase = 'title';
                this.titleAlpha = 0;
                this.menuAlpha = 0;
                this.panelAlpha = 0;
            }
        }

        // === TITLE PHASE ===
        if (this.phase === 'title') {
            this.ship.bob = Math.sin(t * 0.8) * 6;
            this.ship.angle = Math.sin(t * 0.6 + 0.5) * 0.03;
            for (const c of this.clouds) {
                c.x += c.speed;
                if (c.x > w + c.width) c.x = -c.width;
            }

            // Fade in sequence
            if (this.panelAlpha < 1) this.panelAlpha = Math.min(1, this.panelAlpha + 0.012);
            if (this.panelAlpha > 0.3 && this.titleAlpha < 1) this.titleAlpha = Math.min(1, this.titleAlpha + 0.018);
            if (this.titleAlpha > 0.6 && this.menuAlpha < 1) this.menuAlpha = Math.min(1, this.menuAlpha + 0.02);
        }

        // Particles
        for (const p of this.particles) {
            p.y -= p.speed * 0.3;
            p.x += Math.sin(t * 0.3 + p.drift) * 0.3;
            if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        }
    },

    // ==========================================
    // DRAW
    // ==========================================
    _draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const t = this.frame / 60;

        ctx.clearRect(0, 0, w, h);

        if (this.phase === 'blueprint') {
            this._drawParchment(ctx, w, h, t);
            this._drawBlueprint(ctx, w, h, t);
            this._drawDustParticles(ctx, w, h, t);
            this._drawVignette(ctx, w, h, 0.6);
            this._drawSkipHint(ctx, w, h, t, this.frame > 120);
        }
        else if (this.phase === 'story') {
            this._drawParchment(ctx, w, h, t);
            this._drawBlueprint(ctx, w, h, t); // ship stays visible
            this._drawStoryOverlay(ctx, w, h, t);
            this._drawDustParticles(ctx, w, h, t);
            this._drawVignette(ctx, w, h, 0.7);
            this._drawSkipHint(ctx, w, h, t, true);
        }
        else if (this.phase === 'ocean' || this.phase === 'title') {
            this._drawOceanScene(ctx, w, h, t);
            this._drawVignette(ctx, w, h, 0.4);

            if (this.phase === 'title') {
                this._drawTitlePanel(ctx, w, h, t);
            }
        }
    },

    // ==========================================
    // PARCHMENT BACKGROUND
    // ==========================================
    _drawParchment(ctx, w, h, t) {
        // Warm parchment gradient
        const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.7);
        grad.addColorStop(0, '#d4c5a0');
        grad.addColorStop(0.5, '#c4b48a');
        grad.addColorStop(0.8, '#b0a070');
        grad.addColorStop(1, '#8a7a55');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Paper texture noise (subtle)
        ctx.save();
        ctx.globalAlpha = 0.06;
        for (let i = 0; i < 200; i++) {
            const x = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * w;
            const y = (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * h;
            const s = 1 + (Math.sin(i * 419.2) * 0.5 + 0.5) * 6;
            ctx.fillStyle = Math.sin(i * 53.1) > 0 ? '#8a7550' : '#c4b890';
            ctx.fillRect(x, y, s, s);
        }
        ctx.restore();

        // Age stains
        ctx.save();
        ctx.globalAlpha = 0.04;
        for (let i = 0; i < 5; i++) {
            const sx = (Math.sin(i * 73.1 + 17.3) * 0.5 + 0.5) * w;
            const sy = (Math.cos(i * 131.2 + 43.7) * 0.5 + 0.5) * h;
            const sr = 40 + (Math.sin(i * 57.9) * 0.5 + 0.5) * 100;
            const stainGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
            stainGrad.addColorStop(0, 'rgba(100, 80, 40, 0.3)');
            stainGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = stainGrad;
            ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
        }
        ctx.restore();

        // Warm light from top-right (like a desk lamp / window)
        const lightGrad = ctx.createRadialGradient(w * 0.75, h * 0.1, 0, w * 0.75, h * 0.1, w * 0.8);
        lightGrad.addColorStop(0, 'rgba(255, 230, 180, 0.12)');
        lightGrad.addColorStop(0.5, 'rgba(255, 220, 160, 0.05)');
        lightGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(0, 0, w, h);
    },

    // ==========================================
    // BLUEPRINT SHIP DRAWING
    // ==========================================
    _drawBlueprint(ctx, w, h, t) {
        ctx.save();
        const scale = Math.min(w / 600, h / 500) * 0.85;
        const cx = w * 0.5;
        const cy = h * 0.48;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);

        let drawnSoFar = 0;

        for (const path of this.shipPaths) {
            if (drawnSoFar >= this.drawnLength) break;

            const remainingToDraw = this.drawnLength - drawnSoFar;
            const pathDrawn = Math.min(path.length, remainingToDraw);
            const pathProgress = pathDrawn / path.length;

            // Style based on path type
            switch (path.style) {
                case 'hull':
                    ctx.strokeStyle = '#3a2a18';
                    ctx.lineWidth = 2.5;
                    break;
                case 'mast':
                    ctx.strokeStyle = '#3a2a18';
                    ctx.lineWidth = 2;
                    break;
                case 'sail':
                    ctx.strokeStyle = '#4a3a25';
                    ctx.lineWidth = 1.8;
                    break;
                case 'cross':
                    ctx.strokeStyle = '#8a3020';
                    ctx.lineWidth = 2.5;
                    break;
                case 'rigging':
                    ctx.strokeStyle = 'rgba(60, 45, 25, 0.5)';
                    ctx.lineWidth = 0.8;
                    break;
                case 'detail':
                    ctx.strokeStyle = 'rgba(60, 45, 25, 0.4)';
                    ctx.lineWidth = 1;
                    break;
            }

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Draw the path up to current progress
            ctx.beginPath();
            let accumulated = 0;
            ctx.moveTo(path.points[0].x, path.points[0].y);

            for (let i = 1; i < path.points.length; i++) {
                const dx = path.points[i].x - path.points[i-1].x;
                const dy = path.points[i].y - path.points[i-1].y;
                const segLen = Math.sqrt(dx * dx + dy * dy);

                if (accumulated + segLen <= pathDrawn) {
                    ctx.lineTo(path.points[i].x, path.points[i].y);
                    accumulated += segLen;
                } else {
                    // Partial segment
                    const remaining = pathDrawn - accumulated;
                    const frac = remaining / segLen;
                    const px = path.points[i-1].x + dx * frac;
                    const py = path.points[i-1].y + dy * frac;
                    ctx.lineTo(px, py);

                    // Draw "pen tip" indicator
                    if (this.phase === 'blueprint') {
                        ctx.stroke();
                        // Ink dot at pen position
                        ctx.beginPath();
                        ctx.arc(px, py, 2, 0, Math.PI * 2);
                        ctx.fillStyle = '#2a1a08';
                        ctx.fill();
                    }
                    break;
                }
            }
            ctx.stroke();

            drawnSoFar += path.length;
        }

        // Dimension lines and labels (appear after hull is drawn)
        if (this.drawnLength > this.shipPaths[0].length) {
            const labelAlpha = Math.min(1, (this.drawnLength - this.shipPaths[0].length) / 200);
            ctx.globalAlpha = labelAlpha * 0.35;
            ctx.font = 'italic 11px Georgia, serif';
            ctx.fillStyle = '#5a4a30';

            // Ship name label
            ctx.textAlign = 'center';
            ctx.fillText('Hansekogge', 10, 72);

            // Dimension arrows
            ctx.strokeStyle = 'rgba(80, 65, 40, 0.25)';
            ctx.lineWidth = 0.5;
            ctx.setLineDash([4, 4]);
            // Length line
            ctx.beginPath();
            ctx.moveTo(-120, 65);
            ctx.lineTo(145, 65);
            ctx.stroke();
            // Height line
            ctx.beginPath();
            ctx.moveTo(-150, -160);
            ctx.lineTo(-150, 55);
            ctx.stroke();
            ctx.setLineDash([]);

            // Measurements
            ctx.font = 'italic 9px Georgia, serif';
            ctx.fillText('~23m', 10, 62);
            ctx.save();
            ctx.translate(-155, -50);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('~30m', 0, 0);
            ctx.restore();

            ctx.globalAlpha = 1;
        }

        ctx.restore();
    },

    // ==========================================
    // STORY TEXT OVERLAY
    // ==========================================
    _drawStoryOverlay(ctx, w, h, t) {
        // Darken parchment
        ctx.save();
        const storyElapsed = (performance.now() - this.storyStart) / 1000;
        const darkAlpha = Math.min(0.55, storyElapsed * 0.15);
        ctx.fillStyle = `rgba(20, 15, 5, ${darkAlpha})`;
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';

        for (const line of this.storyLines) {
            if (!line.text) continue;
            const lineElapsed = storyElapsed - line.delay;
            if (lineElapsed < 0) continue;

            let alpha = 0;
            if (lineElapsed < 0.8) alpha = lineElapsed / 0.8;
            else if (lineElapsed < 4.0) alpha = 1;
            else if (lineElapsed < 5.0) alpha = 1 - (lineElapsed - 4.0);
            if (alpha <= 0) continue;

            const slideY = Math.max(0, 8 * (1 - Math.min(1, lineElapsed / 0.6)));

            if (line.style === 'date') {
                ctx.font = `italic 32px Georgia, "Palatino Linotype", serif`;
                ctx.fillStyle = `rgba(230, 180, 80, ${alpha})`;
                ctx.shadowColor = `rgba(230, 168, 23, ${alpha * 0.4})`;
                ctx.shadowBlur = 25;
                ctx.fillText(line.text, w / 2, h * 0.3 + slideY);
                ctx.shadowBlur = 0;
            } else if (line.style === 'final') {
                ctx.font = `italic 26px Georgia, "Palatino Linotype", serif`;
                ctx.fillStyle = `rgba(240, 200, 100, ${alpha})`;
                ctx.shadowColor = `rgba(230, 168, 23, ${alpha * 0.5})`;
                ctx.shadowBlur = 30;
                ctx.fillText(line.text, w / 2, h * 0.5 + slideY);
                ctx.shadowBlur = 0;
            } else {
                ctx.font = `19px Georgia, "Palatino Linotype", serif`;
                ctx.fillStyle = `rgba(220, 200, 160, ${alpha * 0.9})`;
                ctx.fillText(line.text, w / 2, h * 0.38 + (line.delay - 1.8) * 14 + slideY);
            }
        }

        ctx.restore();
    },

    // ==========================================
    // OCEAN SCENE
    // ==========================================
    _drawOceanScene(ctx, w, h, t) {
        // Sky
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
        skyGrad.addColorStop(0, '#040810');
        skyGrad.addColorStop(0.2, '#0a1420');
        skyGrad.addColorStop(0.5, '#122240');
        skyGrad.addColorStop(0.8, '#1a3355');
        skyGrad.addColorStop(1, '#253f5f');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // Subtle aurora / northern lights
        ctx.save();
        ctx.globalAlpha = 0.04;
        const auroraGrad = ctx.createLinearGradient(w * 0.2, 0, w * 0.8, h * 0.3);
        auroraGrad.addColorStop(0, '#20aa60');
        auroraGrad.addColorStop(0.5, '#40cc80');
        auroraGrad.addColorStop(1, '#2080a0');
        ctx.fillStyle = auroraGrad;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 5) {
            const y = h * 0.15 + Math.sin(x * 0.003 + t * 0.2) * 40 + Math.sin(x * 0.007 + t * 0.1) * 20;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineTo(w, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Stars
        for (const star of this.stars) {
            const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(t * star.speed + star.twinkle));
            ctx.fillStyle = `rgba(200, 215, 240, ${twinkle * 0.6})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Moon
        const moonX = w * 0.82;
        const moonY = h * 0.1;
        const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 80);
        moonGlow.addColorStop(0, 'rgba(220, 220, 200, 0.2)');
        moonGlow.addColorStop(0.3, 'rgba(180, 180, 160, 0.08)');
        moonGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = moonGlow;
        ctx.fillRect(moonX - 100, moonY - 100, 200, 200);
        ctx.fillStyle = 'rgba(225, 220, 200, 0.5)';
        ctx.beginPath();
        ctx.arc(moonX, moonY, 20, 0, Math.PI * 2);
        ctx.fill();

        // Clouds
        for (const c of this.clouds) {
            ctx.fillStyle = `rgba(35, 50, 75, ${c.alpha})`;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, c.width / 2, c.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(c.x + c.width * 0.3, c.y - c.height * 0.25, c.width * 0.35, c.height * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Horizon glow
        const horizonY = h * 0.56;
        const hGlow = ctx.createRadialGradient(w * 0.5, horizonY, 0, w * 0.5, horizonY, w * 0.5);
        hGlow.addColorStop(0, 'rgba(160, 90, 30, 0.1)');
        hGlow.addColorStop(0.5, 'rgba(100, 60, 20, 0.04)');
        hGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = hGlow;
        ctx.fillRect(0, h * 0.3, w, h * 0.4);

        // Sea
        const seaGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        seaGrad.addColorStop(0, '#0e1e38');
        seaGrad.addColorStop(0.4, '#0a1628');
        seaGrad.addColorStop(1, '#050a14');
        ctx.fillStyle = seaGrad;
        ctx.fillRect(0, horizonY, w, h - horizonY);

        // Moon reflection
        ctx.save();
        ctx.globalAlpha = 0.06;
        for (let i = 0; i < 25; i++) {
            const ry = horizonY + 15 + i * 8;
            const rw = 2 + Math.random() * 15;
            const rx = moonX - 20 + Math.sin(t * 0.4 + i * 0.4) * 12;
            ctx.fillStyle = 'rgba(200, 200, 180, 0.5)';
            ctx.fillRect(rx, ry, rw, 1.5);
        }
        ctx.restore();

        // Waves
        for (const wave of this.waves) {
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let x = 0; x <= w; x += 3) {
                const y = wave.y
                    + Math.sin(x * wave.frequency + t * wave.speed) * wave.amplitude
                    + Math.sin(x * wave.frequency * 1.8 + t * wave.speed * 0.6) * wave.amplitude * 0.35;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            const [r, g, b] = wave.color;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${wave.alpha})`;
            ctx.fill();
        }

        // Ship
        if (this.ship.x > -280) {
            this._drawShip(ctx, this.ship.x, this.ship.y + this.ship.bob, this.ship.angle, t);
        }

        // Bottom fog
        const fogGrad = ctx.createLinearGradient(0, h - 60, 0, h);
        fogGrad.addColorStop(0, 'transparent');
        fogGrad.addColorStop(1, 'rgba(4, 8, 16, 0.85)');
        ctx.fillStyle = fogGrad;
        ctx.fillRect(0, h - 60, w, 60);
    },

    // ==========================================
    // TITLE PANEL (Anno 1800 style - left panel)
    // ==========================================
    _drawTitlePanel(ctx, w, h, t) {
        // Update HTML overlay
        const titleContent = document.getElementById('title-content');
        const menu = document.querySelector('.title-menu');
        const credit = document.querySelector('.title-credit');

        if (titleContent) titleContent.style.opacity = String(this.titleAlpha);
        if (menu) menu.style.opacity = String(this.menuAlpha);
        if (credit) credit.style.opacity = String(this.menuAlpha * 0.5);

        // Dark panel on left side (drawn on canvas for cohesion)
        if (this.panelAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = this.panelAlpha;

            const panelW = Math.min(420, w * 0.38);

            // Panel gradient
            const panelGrad = ctx.createLinearGradient(0, 0, panelW, 0);
            panelGrad.addColorStop(0, 'rgba(6, 10, 20, 0.92)');
            panelGrad.addColorStop(0.7, 'rgba(8, 14, 28, 0.85)');
            panelGrad.addColorStop(1, 'rgba(10, 18, 32, 0)');
            ctx.fillStyle = panelGrad;
            ctx.fillRect(0, 0, panelW + 60, h);

            // Gold accent line on right edge
            const lineGrad = ctx.createLinearGradient(0, h * 0.15, 0, h * 0.85);
            lineGrad.addColorStop(0, 'transparent');
            lineGrad.addColorStop(0.3, 'rgba(230, 168, 23, 0.3)');
            lineGrad.addColorStop(0.5, 'rgba(230, 168, 23, 0.15)');
            lineGrad.addColorStop(0.7, 'rgba(230, 168, 23, 0.3)');
            lineGrad.addColorStop(1, 'transparent');
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(panelW, h * 0.1);
            ctx.lineTo(panelW, h * 0.9);
            ctx.stroke();

            ctx.restore();
        }
    },

    // ==========================================
    // SHIP (Ocean scene)
    // ==========================================
    _drawShip(ctx, x, y, angle, t) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        const scale = Math.min(1, this.canvas.width / 1000) * 1.3;
        ctx.scale(scale, scale);

        // Hull
        ctx.beginPath();
        ctx.moveTo(-65, 0);
        ctx.quadraticCurveTo(-60, 22, -35, 28);
        ctx.lineTo(55, 28);
        ctx.quadraticCurveTo(78, 22, 82, 5);
        ctx.lineTo(78, 0);
        ctx.quadraticCurveTo(65, -6, 45, -6);
        ctx.lineTo(-55, -6);
        ctx.quadraticCurveTo(-65, -3, -65, 0);
        ctx.closePath();
        ctx.fillStyle = '#2e1c10';
        ctx.fill();
        ctx.strokeStyle = '#1e1008';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Hull planks
        ctx.strokeStyle = '#3e2818';
        ctx.lineWidth = 0.5;
        for (let i = -45; i < 65; i += 14) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + 5, 24);
            ctx.stroke();
        }

        // Waterline
        ctx.strokeStyle = 'rgba(230, 168, 23, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-60, 16);
        ctx.quadraticCurveTo(0, 20, 72, 13);
        ctx.stroke();

        // Mast
        ctx.fillStyle = '#4a2e18';
        ctx.fillRect(-2, -100, 5, 105);
        // Yard
        ctx.fillRect(-40, -85, 80, 3);

        // Sail
        const billow = Math.sin(t * 0.5) * 3;
        ctx.beginPath();
        ctx.moveTo(-37, -82);
        ctx.quadraticCurveTo(0, -75 + billow, 37, -82);
        ctx.lineTo(33, -18);
        ctx.quadraticCurveTo(0, -10 + billow * 0.5, -33, -18);
        ctx.closePath();
        ctx.fillStyle = 'rgba(215, 200, 175, 0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(160, 140, 110, 0.4)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Hanse cross on sail
        ctx.strokeStyle = 'rgba(160, 40, 25, 0.55)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-22, -52); ctx.lineTo(22, -52); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -72); ctx.lineTo(0, -28); ctx.stroke();

        // Rigging
        ctx.strokeStyle = 'rgba(100, 80, 55, 0.25)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(1, -98); ctx.lineTo(-55, -2);
        ctx.moveTo(1, -98); ctx.lineTo(65, 0);
        ctx.moveTo(1, -98); ctx.lineTo(80, 5);
        ctx.stroke();

        // Flag
        ctx.fillStyle = 'rgba(180, 35, 25, 0.65)';
        ctx.beginPath();
        ctx.moveTo(3, -100);
        ctx.lineTo(22 + Math.sin(t * 2.5) * 3, -95);
        ctx.lineTo(3, -88);
        ctx.closePath();
        ctx.fill();

        // Bow ornament
        ctx.fillStyle = '#c8960f';
        ctx.beginPath();
        ctx.arc(80, 3, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Water splash
        ctx.save();
        ctx.globalAlpha = 0.12;
        const sx = x + 82 * scale;
        const sy = y + 22 * scale;
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = 'rgba(140, 170, 200, 0.3)';
            ctx.beginPath();
            ctx.ellipse(
                sx + Math.sin(t * 3 + i * 1.5) * 5,
                sy + Math.cos(t * 2 + i) * 3,
                5 + i, 1.5, 0, 0, Math.PI * 2
            );
            ctx.fill();
        }
        ctx.restore();
    },

    // ==========================================
    // UTILITIES
    // ==========================================
    _drawDustParticles(ctx, w, h, t) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(t + p.drift));
            ctx.fillStyle = '#c4a860';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    _drawVignette(ctx, w, h, strength) {
        const vGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.25, w * 0.5, h * 0.5, w * 0.75);
        vGrad.addColorStop(0, 'transparent');
        vGrad.addColorStop(1, `rgba(0, 0, 0, ${strength})`);
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, w, h);
    },

    _drawSkipHint(ctx, w, h, t, show) {
        if (!show) return;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 2);
        ctx.fillStyle = this.phase === 'blueprint' ? '#6a5a40' : '#8a9aaa';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Klicke zum \u00dcberspringen', w / 2, h - 20);
        ctx.restore();
    },

    _easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); },
    _easeInOutQuad(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; },
};
