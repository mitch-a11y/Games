/* ============================================
   HANSE - Map Renderer
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
    shipAnimations: [],

    init() {
        this.canvas = document.getElementById('game-map');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));
    },

    resize() {
        const panel = document.getElementById('map-panel');
        this.width = panel.clientWidth;
        this.height = panel.clientHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.scaleX = this.width / CONFIG.MAP_WIDTH;
        this.scaleY = this.height / CONFIG.MAP_HEIGHT;
        this.scale = Math.min(this.scaleX, this.scaleY);
        this.offsetX = (this.width - CONFIG.MAP_WIDTH * this.scale) / 2;
        this.offsetY = (this.height - CONFIG.MAP_HEIGHT * this.scale) / 2;
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
        this.waveOffset = Math.sin(this.animFrame * 0.02) * 2;

        // Clear
        ctx.fillStyle = '#0e2a47';
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw sea pattern
        this.drawSea(ctx);

        // Draw sea routes
        this.drawRoutes(ctx);

        // Draw land masses (simplified)
        this.drawLand(ctx);

        // Draw ships in transit
        if (gameState) {
            this.drawShips(ctx, gameState);
        }

        // Draw cities
        this.drawCities(ctx, gameState);

        // Draw hovered city highlight
        if (this.hoveredCity) {
            this.drawCityHighlight(ctx, this.hoveredCity);
        }
    },

    drawSea(ctx) {
        // Subtle wave lines
        ctx.strokeStyle = 'rgba(30, 70, 120, 0.3)';
        ctx.lineWidth = 1;
        for (let y = 0; y < this.height; y += 20) {
            ctx.beginPath();
            for (let x = 0; x < this.width; x += 5) {
                const wy = y + Math.sin((x + this.animFrame * 0.5) * 0.03) * 3 + this.waveOffset;
                if (x === 0) ctx.moveTo(x, wy);
                else ctx.lineTo(x, wy);
            }
            ctx.stroke();
        }
    },

    drawLand(ctx) {
        // Simplified land masses - Scandinavia, Baltic coast, Britain
        ctx.fillStyle = '#2d5a2d';
        ctx.strokeStyle = '#3a7a3a';
        ctx.lineWidth = 1;

        // Scandinavian peninsula
        this.drawLandMass(ctx, [
            [280, 0], [300, 40], [320, 80], [340, 100], [300, 130],
            [310, 160], [340, 120], [380, 100], [420, 80], [460, 60],
            [500, 40], [540, 20], [600, 10], [660, 20], [700, 50],
            [730, 80], [750, 100], [770, 80], [790, 40], [820, 20],
            [860, 0], [860, 0], [280, 0]
        ]);

        // Southern Sweden
        this.drawLandMass(ctx, [
            [520, 190], [540, 210], [560, 230], [580, 250],
            [600, 270], [580, 290], [550, 280], [520, 260],
            [500, 240], [490, 220], [500, 200], [520, 190]
        ]);

        // Gotland
        this.drawLandMass(ctx, [
            [690, 195], [710, 200], [715, 220], [710, 240],
            [695, 250], [680, 240], [675, 220], [680, 200], [690, 195]
        ]);

        // Danish peninsula (Jutland)
        this.drawLandMass(ctx, [
            [420, 260], [430, 280], [440, 300], [450, 320],
            [470, 340], [490, 360], [480, 380], [460, 400],
            [440, 410], [420, 420], [400, 410], [390, 390],
            [395, 370], [400, 350], [405, 330], [400, 310],
            [395, 290], [400, 270], [420, 260]
        ]);

        // Danish islands
        this.drawLandMass(ctx, [
            [470, 330], [490, 335], [500, 345], [495, 360],
            [480, 365], [465, 355], [460, 340], [470, 330]
        ]);

        // Northern Germany coast
        this.drawLandMass(ctx, [
            [340, 420], [360, 410], [380, 400], [410, 395],
            [440, 405], [470, 398], [500, 385], [530, 370],
            [560, 360], [590, 355], [620, 360], [650, 370],
            [680, 365], [710, 355], [740, 350], [770, 340],
            [800, 330], [830, 320], [860, 310], [890, 300],
            [920, 280], [950, 260], [980, 240], [1010, 220],
            [1040, 200], [1060, 180], [1080, 160], [1100, 140],
            [1100, 700], [340, 700], [340, 420]
        ]);

        // Britain
        this.drawLandMass(ctx, [
            [140, 340], [160, 330], [180, 340], [200, 360],
            [220, 380], [240, 400], [250, 420], [260, 440],
            [250, 460], [230, 480], [200, 500], [170, 510],
            [150, 500], [140, 480], [130, 460], [120, 440],
            [110, 420], [120, 400], [130, 380], [125, 360],
            [140, 340]
        ]);

        // Low Countries
        this.drawLandMass(ctx, [
            [240, 420], [260, 415], [280, 420], [300, 430],
            [320, 440], [340, 450], [340, 700], [240, 700], [240, 420]
        ]);

        // Norway coast
        this.drawLandMass(ctx, [
            [150, 0], [160, 20], [170, 50], [180, 80],
            [200, 100], [220, 110], [240, 120], [260, 130],
            [270, 145], [260, 160], [250, 180], [240, 200],
            [235, 220], [240, 240], [250, 260], [260, 280],
            [270, 290], [280, 280], [280, 0], [150, 0]
        ]);
    },

    drawLandMass(ctx, points) {
        if (points.length < 3) return;
        ctx.beginPath();
        const first = this.worldToScreen(points[0][0], points[0][1]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < points.length; i++) {
            const p = this.worldToScreen(points[i][0], points[i][1]);
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    },

    drawRoutes(ctx) {
        ctx.strokeStyle = 'rgba(60, 110, 170, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);

        SEA_ROUTES.forEach(route => {
            const from = CITIES_DATA[route.from];
            const to = CITIES_DATA[route.to];
            if (!from || !to) return;
            const p1 = this.worldToScreen(from.x, from.y);
            const p2 = this.worldToScreen(to.x, to.y);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        });

        ctx.setLineDash([]);
    },

    drawCities(ctx, gameState) {
        CITY_IDS.forEach(id => {
            const city = CITIES_DATA[id];
            const pos = this.worldToScreen(city.x, city.y);
            const isSelected = this.selectedCity === id;
            const isHome = gameState && gameState.player && gameState.player.homeCity === id;

            // City dot
            const baseRadius = 4 + city.importance * 1.5;
            const radius = baseRadius * this.scale;

            // Glow for selected
            if (isSelected) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius + 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(230, 168, 23, 0.3)';
                ctx.fill();
            }

            // Home city marker
            if (isHome) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffd700';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Main circle
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

            // Color based on player presence
            let hasKontor = false;
            if (gameState && gameState.cities && gameState.cities[id]) {
                hasKontor = gameState.cities[id].playerBuildings &&
                    gameState.cities[id].playerBuildings.some(b => b.type === 'kontor');
            }

            if (isSelected) {
                ctx.fillStyle = '#e6a817';
            } else if (hasKontor) {
                ctx.fillStyle = '#4a9eff';
            } else {
                ctx.fillStyle = '#c0a060';
            }
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // City name
            ctx.font = `${Math.max(10, 11 * this.scale)}px ${getComputedStyle(document.body).getPropertyValue('--font-main')}`;
            ctx.textAlign = 'center';
            ctx.fillStyle = isSelected ? '#ffd700' : '#d0c8b0';
            ctx.fillText(city.displayName, pos.x, pos.y - radius - 4);
        });
    },

    drawCityHighlight(ctx, cityId) {
        const city = CITIES_DATA[cityId];
        if (!city) return;
        const pos = this.worldToScreen(city.x, city.y);
        const radius = (4 + city.importance * 1.5) * this.scale;

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(240, 192, 64, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
    },

    drawShips(ctx, gameState) {
        if (!gameState || !gameState.player) return;

        gameState.player.ships.forEach(ship => {
            if (ship.status !== 'sailing' || !ship.route || ship.route.length < 2) return;

            const fromCity = CITIES_DATA[ship.route[ship.routeIndex]];
            const toCity = CITIES_DATA[ship.route[Math.min(ship.routeIndex + 1, ship.route.length - 1)]];
            if (!fromCity || !toCity) return;

            const p1 = this.worldToScreen(fromCity.x, fromCity.y);
            const p2 = this.worldToScreen(toCity.x, toCity.y);
            const t = ship.progress;

            const sx = Utils.lerp(p1.x, p2.x, t);
            const sy = Utils.lerp(p1.y, p2.y, t) + Math.sin(this.animFrame * 0.1) * 2;

            // Ship icon
            const angle = Utils.angle(p1.x, p1.y, p2.x, p2.y);

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(angle);

            // Simple ship shape
            ctx.fillStyle = '#e6a817';
            ctx.beginPath();
            ctx.moveTo(-8, -4);
            ctx.lineTo(8, 0);
            ctx.lineTo(-8, 4);
            ctx.lineTo(-5, 0);
            ctx.closePath();
            ctx.fill();

            // Sail
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(-2, -6);
            ctx.lineTo(4, -1);
            ctx.lineTo(-2, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();

            // Ship name label
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#e6a817';
            ctx.fillText(ship.name, sx, sy - 12);
        });

        // Also draw AI ships
        if (gameState.aiTraders) {
            gameState.aiTraders.forEach(ai => {
                ai.ships.forEach(ship => {
                    if (ship.status !== 'sailing' || !ship.route || ship.route.length < 2) return;

                    const fromCity = CITIES_DATA[ship.route[ship.routeIndex]];
                    const toCity = CITIES_DATA[ship.route[Math.min(ship.routeIndex + 1, ship.route.length - 1)]];
                    if (!fromCity || !toCity) return;

                    const p1 = this.worldToScreen(fromCity.x, fromCity.y);
                    const p2 = this.worldToScreen(toCity.x, toCity.y);
                    const t = ship.progress;

                    const sx = Utils.lerp(p1.x, p2.x, t);
                    const sy = Utils.lerp(p1.y, p2.y, t) + Math.sin(this.animFrame * 0.08 + ai.ships.indexOf(ship)) * 2;

                    ctx.fillStyle = '#888';
                    ctx.beginPath();
                    const angle = Utils.angle(p1.x, p1.y, p2.x, p2.y);
                    ctx.save();
                    ctx.translate(sx, sy);
                    ctx.rotate(angle);
                    ctx.moveTo(-6, -3);
                    ctx.lineTo(6, 0);
                    ctx.lineTo(-6, 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                });
            });
        }
    },

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        this.hoveredCity = null;

        for (const id of CITY_IDS) {
            const city = CITIES_DATA[id];
            const pos = this.worldToScreen(city.x, city.y);
            const radius = (4 + city.importance * 1.5) * this.scale + 8;
            if (Utils.distance(mx, my, pos.x, pos.y) < radius) {
                this.hoveredCity = id;
                break;
            }
        }

        // Update tooltip
        const tooltip = document.getElementById('map-tooltip');
        if (this.hoveredCity && typeof Game !== 'undefined') {
            const city = CITIES_DATA[this.hoveredCity];
            const cityState = Game.state && Game.state.cities ? Game.state.cities[this.hoveredCity] : null;
            tooltip.classList.remove('hidden');
            tooltip.style.left = (mx + 15) + 'px';
            tooltip.style.top = (my - 10) + 'px';
            let html = `<h4>${city.displayName}</h4>`;
            html += `<p>${city.description}</p>`;
            if (cityState) {
                html += `<p>Einwohner: ${Utils.formatNumber(cityState.population)}</p>`;
            }
            if (city.hasShipyard) html += `<p>&#9875; Werft vorhanden</p>`;
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
