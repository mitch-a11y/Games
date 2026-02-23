/* ============================================
   HANSE - Cinematic Intro & Title Screen v2

   Phase 1: Dramatic map reveal with vignette
   Phase 2: Story text crawl over darkened map
   Phase 3: Title reveal with parchment menu panel

   Designed to match the in-game panel aesthetic
   (warm parchment, gold accents, watercolor map)
   ============================================ */

const Intro = {
    canvas: null,
    ctx: null,
    frame: 0,
    phase: 'idle', // idle, mapreveal, story, title
    startTime: 0,
    animId: null,

    // Assets
    mapImg: null,
    mapLoaded: false,
    bgImages: {}, // optional Leonardo images

    // Map reveal
    revealRadius: 0,
    revealTarget: 0,
    mapOffsetX: 0,
    mapOffsetY: 0,
    mapScale: 1,

    // Story
    storyLines: [
        { text: 'Anno Domini 1370', style: 'date', delay: 0 },
        { text: '', style: 'gap', delay: 0 },
        { text: 'Die Ostsee — ein Meer der Möglichkeiten.', style: 'normal', delay: 2.0 },
        { text: 'Hansekoggen tragen Waren von Lübeck bis Nowgorod,', style: 'normal', delay: 4.0 },
        { text: 'von Bergen bis Brügge.', style: 'normal', delay: 5.8 },
        { text: '', style: 'gap', delay: 0 },
        { text: 'Doch das Meer ist unbarmherzig.', style: 'normal', delay: 8.0 },
        { text: 'Piraten lauern. Stürme toben.', style: 'normal', delay: 9.5 },
        { text: '', style: 'gap', delay: 0 },
        { text: 'Du bist ein junger Kaufmann.', style: 'normal', delay: 11.5 },
        { text: 'Mit einer Kogge und großen Träumen.', style: 'normal', delay: 13.0 },
        { text: '', style: 'gap', delay: 0 },
        { text: 'Deine Geschichte beginnt jetzt...', style: 'final', delay: 15.0 },
    ],
    storyStart: 0,

    // Title state
    titleAlpha: 0,
    menuAlpha: 0,
    panelAlpha: 0,

    // Particles (dust motes, embers)
    particles: [],

    // Floating ships on title
    titleShips: [],

    // Compass rose rotation
    compassAngle: 0,

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Preload map image
        this.mapImg = new Image();
        this.mapImg.onload = () => { this.mapLoaded = true; };
        this.mapImg.src = 'assets/map.jpg';

        // Try loading optional Leonardo background
        const titleBg = new Image();
        titleBg.onload = () => { this.bgImages.title = titleBg; };
        titleBg.onerror = () => {}; // graceful fallback
        titleBg.src = 'assets/bg-title.jpg';

        // Load Leonardo menu panel image
        const menuPanel = new Image();
        menuPanel.onload = () => { this.bgImages.menuPanel = menuPanel; };
        menuPanel.onerror = () => {};
        menuPanel.src = 'assets/ui/menu_panel.jpg';

        // Try loading intro scene images
        ['intro-1-map', 'intro-2-ship', 'intro-3-port'].forEach(name => {
            const img = new Image();
            img.onload = () => { this.bgImages[name] = img; };
            img.onerror = () => {};
            img.src = `assets/${name}.jpg`;
        });
    },

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    // ==========================================
    // START SEQUENCES
    // ==========================================
    startIntro() {
        this.phase = 'mapreveal';
        this.frame = 0;
        this.startTime = performance.now();
        this.revealRadius = 0;
        this.titleAlpha = 0;
        this.menuAlpha = 0;
        this.panelAlpha = 0;

        this._initParticles();
        this._initTitleShips();

        // Calculate map positioning (fill screen with slight zoom)
        if (this.mapLoaded) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            const imgRatio = this.mapImg.width / this.mapImg.height;
            const screenRatio = w / h;
            if (screenRatio > imgRatio) {
                this.mapScale = (w / this.mapImg.width) * 1.15;
            } else {
                this.mapScale = (h / this.mapImg.height) * 1.15;
            }
            // Center on Baltic Sea area
            this.mapOffsetX = (w - this.mapImg.width * this.mapScale) * 0.45;
            this.mapOffsetY = (h - this.mapImg.height * this.mapScale) * 0.35;
        }

        this.revealTarget = Math.max(this.canvas.width, this.canvas.height) * 0.9;

        // Hide HTML overlay initially
        const titleContent = document.getElementById('title-content');
        if (titleContent) titleContent.style.opacity = '0';
        const menu = document.querySelector('.title-menu');
        if (menu) menu.style.opacity = '0';
        const credit = document.querySelector('.title-credit');
        if (credit) credit.style.opacity = '0';

        // Music — start menu ambient track (with synth fallback)
        setTimeout(() => {
            if (typeof Sound !== 'undefined') {
                Sound.init();
                Sound.resume();
                Sound.startMenuMusic();
            }
        }, 1200);

        if (this.animId) cancelAnimationFrame(this.animId);
        this._loop();
    },

    startTitle() {
        this.phase = 'title';
        this.frame = 0;
        this.startTime = performance.now();
        this.titleAlpha = 0;
        this.menuAlpha = 0;
        this.panelAlpha = 0;
        this.revealRadius = this.revealTarget;

        this._initParticles();
        this._initTitleShips();

        // Map positioning
        if (this.mapLoaded) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            const imgRatio = this.mapImg.width / this.mapImg.height;
            const screenRatio = w / h;
            if (screenRatio > imgRatio) {
                this.mapScale = (w / this.mapImg.width) * 1.15;
            } else {
                this.mapScale = (h / this.mapImg.height) * 1.15;
            }
            this.mapOffsetX = (w - this.mapImg.width * this.mapScale) * 0.45;
            this.mapOffsetY = (h - this.mapImg.height * this.mapScale) * 0.35;
        }

        if (this.animId) cancelAnimationFrame(this.animId);
        this._loop();
    },

    skipIntro() {
        if (this.phase === 'mapreveal' || this.phase === 'story') {
            this.phase = 'title';
            this.startTime = performance.now();
            this.titleAlpha = 0;
            this.menuAlpha = 0;
            this.panelAlpha = 0;
            this.revealRadius = this.revealTarget;
        }
    },

    // ==========================================
    // PARTICLES
    // ==========================================
    _initParticles() {
        this.particles = [];
        const w = this.canvas.width;
        const h = this.canvas.height;
        // Dust motes
        for (let i = 0; i < 40; i++) {
            this.particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: 0.8 + Math.random() * 2.5,
                speedX: (Math.random() - 0.5) * 0.3,
                speedY: -0.15 - Math.random() * 0.4,
                alpha: 0.08 + Math.random() * 0.15,
                drift: Math.random() * Math.PI * 2,
                type: 'dust'
            });
        }
        // Ember sparks (fewer, brighter)
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: Math.random() * w,
                y: h * 0.6 + Math.random() * h * 0.4,
                size: 1 + Math.random() * 1.5,
                speedX: (Math.random() - 0.5) * 0.6,
                speedY: -0.5 - Math.random() * 0.8,
                alpha: 0.3 + Math.random() * 0.4,
                drift: Math.random() * Math.PI * 2,
                life: 1.0,
                type: 'ember'
            });
        }
    },

    _initTitleShips() {
        this.titleShips = [];
        const w = this.canvas.width;
        const h = this.canvas.height;
        // Small ships drifting across
        for (let i = 0; i < 3; i++) {
            this.titleShips.push({
                x: w * 0.3 + Math.random() * w * 0.5,
                y: h * 0.5 + Math.random() * h * 0.2,
                speed: 0.05 + Math.random() * 0.15,
                size: 0.4 + Math.random() * 0.3,
                bob: Math.random() * Math.PI * 2
            });
        }
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

        // === MAP REVEAL ===
        if (this.phase === 'mapreveal') {
            // Circular reveal expanding from center
            const revealDuration = 5;
            const progress = Math.min(1, elapsed / revealDuration);
            this.revealRadius = this.revealTarget * this._easeOutCubic(progress);

            // Slow Ken Burns zoom
            if (this.mapLoaded) {
                this.mapScale += 0.00003;
            }

            // Transition to story after reveal complete + pause
            if (elapsed > revealDuration + 1.5) {
                this.phase = 'story';
                this.storyStart = performance.now();
            }
        }

        // === STORY ===
        if (this.phase === 'story') {
            // Keep slow zoom
            if (this.mapLoaded) {
                this.mapScale += 0.00002;
            }

            const storyElapsed = (performance.now() - this.storyStart) / 1000;
            const lastLineDelay = this.storyLines[this.storyLines.length - 1].delay;
            if (storyElapsed > lastLineDelay + 3) {
                this.phase = 'title';
                this.startTime = performance.now();
                this.titleAlpha = 0;
                this.menuAlpha = 0;
                this.panelAlpha = 0;
            }
        }

        // === TITLE ===
        if (this.phase === 'title') {
            // Slow Ken Burns
            if (this.mapLoaded) {
                this.mapScale += 0.000008;
                this.mapOffsetX -= 0.02;
            }

            // Staggered fade-in
            if (this.panelAlpha < 1) this.panelAlpha = Math.min(1, this.panelAlpha + 0.015);
            if (this.panelAlpha > 0.4 && this.titleAlpha < 1) this.titleAlpha = Math.min(1, this.titleAlpha + 0.02);
            if (this.titleAlpha > 0.6 && this.menuAlpha < 1) this.menuAlpha = Math.min(1, this.menuAlpha + 0.022);
        }

        // Compass rotation
        this.compassAngle += 0.002;

        // Particles
        for (const p of this.particles) {
            p.x += p.speedX + Math.sin(t * 0.5 + p.drift) * 0.2;
            p.y += p.speedY;
            if (p.type === 'ember') {
                p.life -= 0.003;
                p.alpha = Math.max(0, p.life * 0.5);
                if (p.life <= 0) {
                    p.x = Math.random() * w;
                    p.y = h + 10;
                    p.life = 1.0;
                }
            }
            if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
            if (p.x < -10) p.x = w + 10;
            if (p.x > w + 10) p.x = -10;
        }

        // Title ships
        for (const ship of this.titleShips) {
            ship.x += ship.speed;
            ship.bob += 0.02;
            if (ship.x > w + 100) {
                ship.x = -80;
                ship.y = h * 0.45 + Math.random() * h * 0.25;
            }
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

        if (this.phase === 'mapreveal') {
            this._drawMapBackground(ctx, w, h, t);
            this._drawMapRevealMask(ctx, w, h);
            this._drawDustParticles(ctx, w, h, t);
            this._drawVignette(ctx, w, h, 0.65);
            this._drawSkipHint(ctx, w, h, t, this.frame > 90);
        }
        else if (this.phase === 'story') {
            this._drawMapBackground(ctx, w, h, t);
            this._drawStoryOverlay(ctx, w, h, t);
            this._drawDustParticles(ctx, w, h, t);
            this._drawVignette(ctx, w, h, 0.5);
            this._drawSkipHint(ctx, w, h, t, true);
        }
        else if (this.phase === 'title') {
            if (this.bgImages.menuPanel) {
                // Leonardo image has its own map — skip canvas map
                ctx.fillStyle = '#1a1510';
                ctx.fillRect(0, 0, w, h);
                this._drawTitlePanel(ctx, w, h, t);
                this._drawDustParticles(ctx, w, h, t);
                this._drawVignette(ctx, w, h, 0.35);
            } else {
                // Fallback: canvas-drawn map + panel
                this._drawMapBackground(ctx, w, h, t);
                this._drawTitleDarken(ctx, w, h);
                this._drawTitleShips(ctx, w, h, t);
                this._drawDustParticles(ctx, w, h, t);
                this._drawVignette(ctx, w, h, 0.55);
                this._drawTitlePanel(ctx, w, h, t);
                this._drawCompassRose(ctx, w, h, t);
            }
        }
    },

    // ==========================================
    // MAP BACKGROUND (shared across all phases)
    // ==========================================
    _drawMapBackground(ctx, w, h, t) {
        // Dark base
        ctx.fillStyle = '#1a1510';
        ctx.fillRect(0, 0, w, h);

        if (this.mapLoaded) {
            ctx.save();
            // Warm tint overlay for parchment feel
            ctx.globalAlpha = 0.9;
            ctx.drawImage(
                this.mapImg,
                this.mapOffsetX, this.mapOffsetY,
                this.mapImg.width * this.mapScale,
                this.mapImg.height * this.mapScale
            );
            ctx.restore();
        } else {
            // Fallback: parchment gradient
            const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.7);
            grad.addColorStop(0, '#c4b48a');
            grad.addColorStop(0.6, '#a89870');
            grad.addColorStop(1, '#6a5a40');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }
    },

    // ==========================================
    // MAP REVEAL (circular wipe from center)
    // ==========================================
    _drawMapRevealMask(ctx, w, h) {
        if (this.revealRadius >= this.revealTarget) return;

        ctx.save();
        // Draw a dark overlay with a circular hole
        ctx.fillStyle = 'rgba(18, 14, 8, 0.97)';
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        // Cut out the reveal circle
        ctx.arc(w * 0.5, h * 0.5, this.revealRadius, 0, Math.PI * 2, true);
        ctx.fill();

        // Soft edge glow on the reveal border
        const glowGrad = ctx.createRadialGradient(
            w * 0.5, h * 0.5, Math.max(0, this.revealRadius - 60),
            w * 0.5, h * 0.5, this.revealRadius + 20
        );
        glowGrad.addColorStop(0, 'transparent');
        glowGrad.addColorStop(0.5, 'rgba(200, 160, 80, 0.15)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.5, this.revealRadius + 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    // ==========================================
    // STORY TEXT OVERLAY
    // ==========================================
    _drawStoryOverlay(ctx, w, h, t) {
        ctx.save();
        const storyElapsed = (performance.now() - this.storyStart) / 1000;

        // Darken map
        const darkAlpha = Math.min(0.65, storyElapsed * 0.12);
        ctx.fillStyle = `rgba(12, 8, 4, ${darkAlpha})`;
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';

        for (const line of this.storyLines) {
            if (!line.text) continue;
            const lineElapsed = storyElapsed - line.delay;
            if (lineElapsed < 0) continue;

            let alpha = 0;
            if (lineElapsed < 1.0) alpha = lineElapsed / 1.0;
            else if (lineElapsed < 4.5) alpha = 1;
            else if (lineElapsed < 5.5) alpha = 1 - (lineElapsed - 4.5);
            if (alpha <= 0) continue;

            const slideY = Math.max(0, 10 * (1 - Math.min(1, lineElapsed / 0.8)));

            if (line.style === 'date') {
                ctx.font = `italic ${Math.round(w * 0.035)}px Georgia, "Palatino Linotype", serif`;
                ctx.fillStyle = `rgba(220, 175, 70, ${alpha})`;
                ctx.shadowColor = `rgba(220, 165, 20, ${alpha * 0.5})`;
                ctx.shadowBlur = 30;
                ctx.fillText(line.text, w / 2, h * 0.32 + slideY);
                ctx.shadowBlur = 0;
            } else if (line.style === 'final') {
                ctx.font = `italic ${Math.round(w * 0.028)}px Georgia, "Palatino Linotype", serif`;
                ctx.fillStyle = `rgba(230, 195, 90, ${alpha})`;
                ctx.shadowColor = `rgba(220, 168, 23, ${alpha * 0.6})`;
                ctx.shadowBlur = 35;
                ctx.fillText(line.text, w / 2, h * 0.52 + slideY);
                ctx.shadowBlur = 0;
            } else {
                ctx.font = `${Math.round(w * 0.018)}px Georgia, "Palatino Linotype", serif`;
                ctx.fillStyle = `rgba(210, 195, 160, ${alpha * 0.9})`;
                ctx.fillText(line.text, w / 2, h * 0.38 + (line.delay - 2.0) * 13 + slideY);
            }
        }

        ctx.restore();
    },

    // ==========================================
    // TITLE DARKEN + WARM OVERLAY
    // ==========================================
    _drawTitleDarken(ctx, w, h) {
        // Darken map for readability
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#0c0804';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // Warm amber light from upper right
        const lightGrad = ctx.createRadialGradient(w * 0.8, h * 0.15, 0, w * 0.8, h * 0.15, w * 0.7);
        lightGrad.addColorStop(0, 'rgba(200, 150, 60, 0.08)');
        lightGrad.addColorStop(0.5, 'rgba(180, 120, 40, 0.03)');
        lightGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(0, 0, w, h);
    },

    // ==========================================
    // TITLE PANEL (Parchment style, left side)
    // ==========================================
    _drawTitlePanel(ctx, w, h, t) {
        // Update HTML overlay
        const titleContent = document.getElementById('title-content');
        const menu = document.querySelector('.title-menu');
        const credit = document.querySelector('.title-credit');
        const hasLeonardo = !!this.bgImages.menuPanel;

        if (hasLeonardo) {
            // Leonardo mode: use extracted button images
            if (titleContent) {
                titleContent.style.opacity = String(this.menuAlpha);
                titleContent.classList.add('leonardo-mode');
            }
            if (menu) menu.style.opacity = String(this.menuAlpha);
            if (credit) credit.style.opacity = String(this.menuAlpha * 0.4);

            // Compute actual image draw rectangle (cover-fit, left-aligned)
            const img = this.bgImages.menuPanel;
            const imgRatio = img.width / img.height;
            const screenRatio = w / h;
            let drawW, drawH, drawX, drawY;
            if (screenRatio > imgRatio) {
                drawW = w; drawH = w / imgRatio; drawX = 0; drawY = (h - drawH) / 2;
            } else {
                drawH = h; drawW = h * imgRatio; drawX = 0; drawY = 0;
            }

            // Button source positions in the original 2752x1536 image
            // Neues Spiel: (280, 740) to (758, 823) -> relative: x=0.1017, y=0.4818, w=0.1738, h=0.0540
            // Spiel Laden: (260, 898) to (758, 978) -> relative: x=0.0945, y=0.5846, w=0.1810, h=0.0521
            // Anleitung:   (260, 1056) to (758,1138) -> relative: x=0.0945, y=0.6875, w=0.1810, h=0.0534
            const btnDefs = [
                { rx: 0.1017, ry: 0.4818, rw: 0.1738, rh: 0.0540 },
                { rx: 0.0945, ry: 0.5846, rw: 0.1810, rh: 0.0521 },
                { rx: 0.0945, ry: 0.6875, rw: 0.1810, rh: 0.0534 },
            ];

            // Map button images to button elements
            const btnImages = [
                'assets/ui/buttons/btn_neues_spiel.png',
                'assets/ui/buttons/btn_spiel_laden.png',
                'assets/ui/buttons/btn_anleitung.png',
            ];

            const buttons = menu ? menu.querySelectorAll('.title-btn') : [];
            buttons.forEach((btn, i) => {
                if (!btnDefs[i]) return;
                const def = btnDefs[i];
                const bx = drawX + drawW * def.rx;
                const by = drawY + drawH * def.ry;
                const bw = drawW * def.rw;
                const bh = drawH * def.rh;

                btn.style.position = 'fixed';
                btn.style.left = bx + 'px';
                btn.style.top = by + 'px';
                btn.style.width = bw + 'px';
                btn.style.height = bh + 'px';
                btn.style.backgroundImage = `url('${btnImages[i]}')`;
                btn.style.backgroundSize = '100% 100%';
                btn.style.backgroundRepeat = 'no-repeat';
                btn.style.padding = '0';
                btn.style.margin = '0';
            });
        } else {
            if (titleContent) {
                titleContent.style.opacity = String(this.titleAlpha);
                titleContent.classList.remove('leonardo-mode');
            }
            if (menu) menu.style.opacity = String(this.menuAlpha);
            if (credit) credit.style.opacity = String(this.menuAlpha * 0.6);
        }

        if (this.panelAlpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.panelAlpha;

        // === LEONARDO MENU PANEL IMAGE ===
        if (this.bgImages.menuPanel) {
            // Draw full-width image covering the entire canvas
            // The image has the map + panel built in — use it as the full background
            const img = this.bgImages.menuPanel;
            const imgRatio = img.width / img.height;
            const screenRatio = w / h;

            let drawW, drawH, drawX, drawY;
            if (screenRatio > imgRatio) {
                // Screen is wider than image — fit width
                drawW = w;
                drawH = w / imgRatio;
                drawX = 0;
                drawY = (h - drawH) / 2;
            } else {
                // Screen is taller — fit height
                drawH = h;
                drawW = h * imgRatio;
                drawX = 0; // Align left so panel stays visible
                drawY = 0;
            }

            ctx.drawImage(img, drawX, drawY, drawW, drawH);

            // Subtle dark overlay on the right side to blend with game map
            const blendGrad = ctx.createLinearGradient(w * 0.5, 0, w, 0);
            blendGrad.addColorStop(0, 'transparent');
            blendGrad.addColorStop(0.6, 'rgba(14, 10, 6, 0.3)');
            blendGrad.addColorStop(1, 'rgba(14, 10, 6, 0.6)');
            ctx.fillStyle = blendGrad;
            ctx.fillRect(0, 0, w, h);
        } else {
            // Fallback: generated panel (no image loaded)
            const panelW = Math.min(460, w * 0.4);
            const edgeX = panelW + 40;

            const panelGrad = ctx.createLinearGradient(0, 0, edgeX, 0);
            panelGrad.addColorStop(0, 'rgba(28, 22, 14, 0.94)');
            panelGrad.addColorStop(0.6, 'rgba(32, 26, 16, 0.88)');
            panelGrad.addColorStop(0.85, 'rgba(24, 18, 10, 0.7)');
            panelGrad.addColorStop(1, 'rgba(20, 14, 8, 0)');
            ctx.fillStyle = panelGrad;
            ctx.fillRect(0, 0, edgeX, h);

            // Gold accent line
            const lineGrad = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.9);
            lineGrad.addColorStop(0, 'transparent');
            lineGrad.addColorStop(0.2, 'rgba(200, 155, 50, 0.35)');
            lineGrad.addColorStop(0.5, 'rgba(220, 170, 60, 0.2)');
            lineGrad.addColorStop(0.8, 'rgba(200, 155, 50, 0.35)');
            lineGrad.addColorStop(1, 'transparent');
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(panelW, h * 0.08);
            ctx.lineTo(panelW, h * 0.92);
            ctx.stroke();
        }

        ctx.restore();
    },

    // ==========================================
    // COMPASS ROSE (bottom right)
    // ==========================================
    _drawCompassRose(ctx, w, h, t) {
        if (this.panelAlpha < 0.3) return;
        ctx.save();

        const cx = w * 0.85;
        const cy = h * 0.82;
        const size = Math.min(w, h) * 0.08;

        ctx.globalAlpha = this.panelAlpha * 0.25;
        ctx.translate(cx, cy);
        ctx.rotate(this.compassAngle);

        // Outer ring
        ctx.strokeStyle = 'rgba(180, 150, 80, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.stroke();

        // Cardinal points
        const dirs = ['N', 'O', 'S', 'W'];
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2) - Math.PI / 2;
            // Main arrow
            ctx.fillStyle = i === 0 ? 'rgba(180, 50, 40, 0.5)' : 'rgba(180, 150, 80, 0.35)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle - 0.12) * size * 0.3, Math.sin(angle - 0.12) * size * 0.3);
            ctx.lineTo(Math.cos(angle) * size * 0.95, Math.sin(angle) * size * 0.95);
            ctx.lineTo(Math.cos(angle + 0.12) * size * 0.3, Math.sin(angle + 0.12) * size * 0.3);
            ctx.closePath();
            ctx.fill();
        }

        // Intercardinal
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2) - Math.PI / 4;
            ctx.fillStyle = 'rgba(180, 150, 80, 0.15)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle - 0.08) * size * 0.2, Math.sin(angle - 0.08) * size * 0.2);
            ctx.lineTo(Math.cos(angle) * size * 0.55, Math.sin(angle) * size * 0.55);
            ctx.lineTo(Math.cos(angle + 0.08) * size * 0.2, Math.sin(angle + 0.08) * size * 0.2);
            ctx.closePath();
            ctx.fill();
        }

        // Center dot
        ctx.fillStyle = 'rgba(200, 160, 60, 0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    },

    // ==========================================
    // TITLE SHIPS (small silhouettes)
    // ==========================================
    _drawTitleShips(ctx, w, h, t) {
        if (this.panelAlpha < 0.2) return;

        for (const ship of this.titleShips) {
            ctx.save();
            const bobY = Math.sin(ship.bob) * 2;
            ctx.translate(ship.x, ship.y + bobY);
            ctx.scale(ship.size, ship.size);
            ctx.globalAlpha = this.panelAlpha * 0.15;

            // Simple ship silhouette
            ctx.fillStyle = '#1a1208';
            // Hull
            ctx.beginPath();
            ctx.moveTo(-20, 0);
            ctx.quadraticCurveTo(-18, 8, -10, 10);
            ctx.lineTo(18, 10);
            ctx.quadraticCurveTo(25, 6, 28, 0);
            ctx.lineTo(-20, 0);
            ctx.closePath();
            ctx.fill();
            // Mast + sail
            ctx.fillRect(-1, -35, 2, 38);
            ctx.beginPath();
            ctx.moveTo(-12, -32);
            ctx.lineTo(12, -32);
            ctx.lineTo(10, -6);
            ctx.lineTo(-10, -6);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    },

    // ==========================================
    // UTILITIES
    // ==========================================
    _drawDustParticles(ctx, w, h, t) {
        ctx.save();
        for (const p of this.particles) {
            if (p.type === 'ember') {
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = '#d4a030';
                ctx.shadowColor = 'rgba(220, 160, 40, 0.5)';
                ctx.shadowBlur = 6;
            } else {
                ctx.globalAlpha = p.alpha * (0.5 + 0.5 * Math.sin(t + p.drift));
                ctx.fillStyle = '#c4a060';
                ctx.shadowBlur = 0;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.restore();
    },

    _drawVignette(ctx, w, h, strength) {
        const vGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.22, w * 0.5, h * 0.5, w * 0.72);
        vGrad.addColorStop(0, 'transparent');
        vGrad.addColorStop(1, `rgba(8, 5, 2, ${strength})`);
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, w, h);
    },

    _drawSkipHint(ctx, w, h, t, show) {
        if (!show) return;
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 2);
        ctx.fillStyle = '#8a7a55';
        ctx.font = '12px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Klicke zum Überspringen', w / 2, h - 25);
        ctx.restore();
    },

    _easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); },
    _easeInOutQuad(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; },
};
