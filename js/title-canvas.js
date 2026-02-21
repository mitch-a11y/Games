/* ============================================
   HANSE - Animated Title Screen Canvas
   Ocean waves, sailing ship, twinkling stars
   ============================================ */

const TitleCanvas = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    frame: 0,
    running: false,
    stars: [],
    ship: null,

    init() {
        this.canvas = document.getElementById('title-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.generateStars();
        this.initShip();
        this.start();
    },

    resize() {
        if (!this.canvas) return;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    },

    generateStars() {
        this.stars = [];
        for (let i = 0; i < 120; i++) {
            this.stars.push({
                x: Math.random(),
                y: Math.random() * 0.45,
                size: 0.3 + Math.random() * 1.5,
                twinkleSpeed: 0.01 + Math.random() * 0.03,
                phase: Math.random() * Math.PI * 2,
                brightness: 0.3 + Math.random() * 0.7
            });
        }
    },

    initShip() {
        this.ship = {
            x: -0.15,
            speed: 0.00025 + Math.random() * 0.0001,
            y: 0.58,
            bobPhase: Math.random() * Math.PI * 2,
            scale: 0.8 + Math.random() * 0.3
        };
    },

    start() {
        if (this.running) return;
        this.running = true;
        this.loop();
    },

    stop() {
        this.running = false;
    },

    loop() {
        if (!this.running) return;
        this.render();
        this.frame++;
        requestAnimationFrame(() => this.loop());
    },

    render() {
        const ctx = this.ctx;
        const w = this.width;
        const h = this.height;
        const t = this.frame;

        // --- Night sky gradient ---
        const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
        skyGrad.addColorStop(0, '#030810');
        skyGrad.addColorStop(0.3, '#091428');
        skyGrad.addColorStop(0.6, '#0c1e3a');
        skyGrad.addColorStop(1, '#122848');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, h);

        // --- Twinkling stars ---
        this.stars.forEach(star => {
            const twinkle = (Math.sin(t * star.twinkleSpeed + star.phase) + 1) * 0.5;
            const alpha = star.brightness * (0.3 + twinkle * 0.7);
            const sx = star.x * w;
            const sy = star.y * h;

            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#e8e0d0';
            ctx.beginPath();
            ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
            ctx.fill();

            // Star rays for brighter stars
            if (star.size > 1.0 && twinkle > 0.7) {
                ctx.globalAlpha = alpha * 0.3;
                ctx.strokeStyle = '#e8e0d0';
                ctx.lineWidth = 0.3;
                const rayLen = star.size * 2;
                for (let a = 0; a < 4; a++) {
                    const angle = (a / 4) * Math.PI + t * 0.002;
                    ctx.beginPath();
                    ctx.moveTo(sx - Math.cos(angle) * rayLen, sy - Math.sin(angle) * rayLen);
                    ctx.lineTo(sx + Math.cos(angle) * rayLen, sy + Math.sin(angle) * rayLen);
                    ctx.stroke();
                }
            }
        });
        ctx.globalAlpha = 1;

        // --- Moon ---
        const moonX = w * 0.82;
        const moonY = h * 0.12;
        const moonR = Math.min(w, h) * 0.03;
        // Moon glow
        const moonGlow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, moonR * 5);
        moonGlow.addColorStop(0, 'rgba(200, 210, 230, 0.15)');
        moonGlow.addColorStop(0.5, 'rgba(150, 170, 200, 0.05)');
        moonGlow.addColorStop(1, 'rgba(150, 170, 200, 0)');
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR * 5, 0, Math.PI * 2);
        ctx.fill();
        // Moon body
        ctx.fillStyle = '#d8dce8';
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        ctx.fill();
        // Crescent shadow
        ctx.fillStyle = '#091428';
        ctx.beginPath();
        ctx.arc(moonX + moonR * 0.35, moonY - moonR * 0.1, moonR * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // --- Ocean ---
        const waterY = h * 0.55;

        // Water gradient
        const waterGrad = ctx.createLinearGradient(0, waterY, 0, h);
        waterGrad.addColorStop(0, '#0a2040');
        waterGrad.addColorStop(0.2, '#0c2848');
        waterGrad.addColorStop(0.5, '#0a2244');
        waterGrad.addColorStop(1, '#081830');
        ctx.fillStyle = waterGrad;
        ctx.fillRect(0, waterY, w, h - waterY);

        // Moon reflection on water
        ctx.globalAlpha = 0.08;
        for (let ry = 0; ry < 80; ry++) {
            const rWidth = 2 + ry * 0.5 + Math.sin(t * 0.02 + ry * 0.3) * 3;
            const rx = moonX + Math.sin(t * 0.01 + ry * 0.1) * ry * 0.3;
            ctx.fillStyle = '#b8c8e0';
            ctx.fillRect(rx - rWidth / 2, waterY + ry * 2, rWidth, 1.5);
        }
        ctx.globalAlpha = 1;

        // Wave layers
        for (let layer = 0; layer < 5; layer++) {
            const baseY = waterY + layer * 20 + 10;
            const speed = 0.008 + layer * 0.003;
            const amplitude = 4 + layer * 2;
            const freq = 0.003 + layer * 0.001;
            const alpha = 0.08 + layer * 0.03;

            ctx.strokeStyle = `rgba(60, 120, 180, ${alpha})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let x = 0; x <= w; x += 4) {
                const wy = baseY
                    + Math.sin(x * freq + t * speed) * amplitude
                    + Math.sin(x * freq * 1.7 + t * speed * 0.6) * amplitude * 0.4;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();

            // Foam highlights on crests
            if (layer < 3) {
                ctx.fillStyle = `rgba(140, 190, 230, ${alpha * 0.4})`;
                for (let x = 0; x <= w; x += 4) {
                    const wy = baseY + Math.sin(x * freq + t * speed) * amplitude;
                    const crest = Math.sin(x * freq + t * speed);
                    if (crest > 0.85) {
                        ctx.globalAlpha = (crest - 0.85) * 3 * alpha;
                        ctx.fillRect(x, wy - 1, 5, 1.5);
                    }
                }
                ctx.globalAlpha = 1;
            }
        }

        // --- Sailing ship ---
        this.drawTitleShip(ctx, t, w, h, waterY);

        // --- Horizon glow ---
        const horizonGlow = ctx.createLinearGradient(0, waterY - 15, 0, waterY + 15);
        horizonGlow.addColorStop(0, 'rgba(20, 50, 90, 0)');
        horizonGlow.addColorStop(0.5, 'rgba(30, 70, 120, 0.12)');
        horizonGlow.addColorStop(1, 'rgba(20, 50, 90, 0)');
        ctx.fillStyle = horizonGlow;
        ctx.fillRect(0, waterY - 15, w, 30);
    },

    drawTitleShip(ctx, t, w, h, waterY) {
        const ship = this.ship;
        ship.x += ship.speed;
        if (ship.x > 1.2) {
            ship.x = -0.2;
            ship.scale = 0.7 + Math.random() * 0.4;
        }

        const sx = ship.x * w;
        const bob = Math.sin(t * 0.025 + ship.bobPhase) * 4;
        const sy = waterY + 15 + bob;
        const sc = ship.scale;

        ctx.save();
        ctx.translate(sx, sy);

        // Ship shadow on water
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(0, 8 * sc, 30 * sc, 4 * sc, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hull
        ctx.fillStyle = '#6a4420';
        ctx.beginPath();
        ctx.moveTo(-25 * sc, 0);
        ctx.lineTo(-22 * sc, 7 * sc);
        ctx.lineTo(22 * sc, 7 * sc);
        ctx.lineTo(28 * sc, -2 * sc);
        ctx.lineTo(24 * sc, -5 * sc);
        ctx.lineTo(-18 * sc, -5 * sc);
        ctx.lineTo(-25 * sc, -4 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#4a2e10';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Hull planking
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.4;
        for (let i = 1; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(-22 * sc, -5 * sc + i * 4 * sc);
            ctx.lineTo(24 * sc, -5 * sc + i * 4 * sc);
            ctx.stroke();
        }

        // Mast
        ctx.strokeStyle = '#4a2e10';
        ctx.lineWidth = 2.5 * sc;
        ctx.beginPath();
        ctx.moveTo(2 * sc, -5 * sc);
        ctx.lineTo(2 * sc, -38 * sc);
        ctx.stroke();

        // Yard
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-15 * sc, -34 * sc);
        ctx.lineTo(18 * sc, -34 * sc);
        ctx.stroke();

        // Sail with flutter
        const flutter = Math.sin(t * 0.04) * 2 * sc;
        ctx.fillStyle = 'rgba(230, 220, 200, 0.9)';
        ctx.beginPath();
        ctx.moveTo(-14 * sc, -34 * sc);
        ctx.quadraticCurveTo(-12 * sc + flutter, -20 * sc, -11 * sc + flutter * 1.2, -10 * sc);
        ctx.lineTo(16 * sc + flutter * 1.2, -10 * sc);
        ctx.quadraticCurveTo(16 * sc + flutter, -20 * sc, 17 * sc, -34 * sc);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Cross on sail
        ctx.strokeStyle = 'rgba(160, 30, 30, 0.6)';
        ctx.lineWidth = 2 * sc;
        const cxs = 2 * sc + flutter * 0.3;
        ctx.beginPath();
        ctx.moveTo(cxs, -30 * sc);
        ctx.lineTo(cxs, -14 * sc);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cxs - 7 * sc, -22 * sc);
        ctx.lineTo(cxs + 7 * sc, -22 * sc);
        ctx.stroke();

        // Flag
        const flagF = Math.sin(t * 0.08) * 2;
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(2 * sc, -38 * sc);
        ctx.quadraticCurveTo(10 * sc + flagF, -40 * sc, 14 * sc + flagF, -37.5 * sc);
        ctx.lineTo(2 * sc, -35 * sc);
        ctx.closePath();
        ctx.fill();

        // Stern rudder
        ctx.strokeStyle = '#4a2e10';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-25 * sc, -2 * sc);
        ctx.lineTo(-28 * sc, 4 * sc);
        ctx.stroke();

        // Wake trail behind ship
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = 'rgba(180, 220, 255, 0.5)';
        ctx.lineWidth = 0.8;
        for (let i = 1; i < 8; i++) {
            ctx.globalAlpha = 0.15 * (1 - i / 8);
            ctx.beginPath();
            ctx.arc(-25 * sc - i * 6 * sc, 4 * sc + Math.sin(t * 0.03 + i) * 1.5, i * 1.5, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        ctx.restore();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    TitleCanvas.init();
});
