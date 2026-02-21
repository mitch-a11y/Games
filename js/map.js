/* ============================================
   HANSE - Enhanced Map Renderer
   Phase 2: Water effects, better ships, wakes
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

        // Deep ocean gradient background
        const grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, '#071a30');
        grad.addColorStop(0.3, '#0c2844');
        grad.addColorStop(0.6, '#0e3058');
        grad.addColorStop(1, '#0a2240');
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

        // Cities on top
        this.drawCities(ctx, gameState);

        // Hovered city highlight
        if (this.hoveredCity) {
            this.drawCityHighlight(ctx, this.hoveredCity);
        }

        // Seagulls (on top of everything, in the sky)
        this.drawSeagulls(ctx);

        // Compass rose
        this.drawCompass(ctx, gameState);
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

        // Land with gradient
        const landGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        landGrad.addColorStop(0, '#2a5e2a');
        landGrad.addColorStop(0.5, '#336633');
        landGrad.addColorStop(1, '#2a5a28');

        ctx.fillStyle = landGrad;
        ctx.strokeStyle = '#4a8a4a';
        ctx.lineWidth = 1.5;

        // All land masses
        this.drawAllLandMasses(ctx);

        // Coastline shadow (draw land masses again with shadow)
        ctx.shadowColor = 'rgba(0, 20, 40, 0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(0,0,0,0)'; // invisible fill
        ctx.strokeStyle = 'rgba(60, 100, 60, 0.5)';
        ctx.lineWidth = 1;
        this.drawAllLandMasses(ctx, true); // stroke only
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Shallow water (lighter coastal areas)
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = landGrad;
        this.drawAllLandMasses(ctx, false, 4); // expanded
        ctx.globalCompositeOperation = 'source-over';

        // Add terrain texture dots
        ctx.fillStyle = 'rgba(50, 110, 50, 0.3)';
        for (let i = 0; i < 200; i++) {
            const tx = Math.random() * this.width;
            const ty = Math.random() * this.height;
            // Only draw if point is on land (simplified check)
            ctx.beginPath();
            ctx.arc(tx, ty, 1, 0, Math.PI * 2);
            ctx.fill();
        }
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
            // Danish Islands (Funen/Zealand)
            [[440,312],[460,318],[475,332],[470,350],[455,358],[438,348],[432,328],[440,312]],
            // Britain
            [[168,322],[198,308],[232,328],[248,365],[252,405],[242,438],[225,462],[200,478],[168,482],[148,462],[132,432],[128,398],[138,365],[152,340]],
            // Northern Germany / Poland coast
            [[250,432],[310,418],[365,405],[425,365],[490,355],[548,348],[618,350],[690,358],[750,375],[750,700],[250,700]],
            // Baltic States (Lithuania, Latvia, Estonia)
            [[750,375],[772,358],[798,330],[825,290],[845,248],[860,205],[875,178],[920,158],[920,700],[750,700]],
            // Northwestern Russia
            [[920,158],[942,145],[968,132],[1005,122],[1050,120],[1100,128],[1150,145],[1200,155],[1200,700],[920,700]],
            // Gotland
            [[632,238],[650,242],[655,260],[652,280],[640,290],[628,282],[625,262],[630,245]]
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
                const pulseR = radius + 8 + Math.sin(t * 0.06) * 3;
                const grd = ctx.createRadialGradient(pos.x, pos.y, radius, pos.x, pos.y, pulseR);
                grd.addColorStop(0, 'rgba(230, 168, 23, 0.4)');
                grd.addColorStop(1, 'rgba(230, 168, 23, 0)');
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, pulseR, 0, Math.PI * 2);
                ctx.fillStyle = grd;
                ctx.fill();
            }

            // Home city golden ring
            if (isHome) {
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, radius + 5, 0, Math.PI * 2);
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

            // Main city circle with gradient
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

            // City name with shadow
            const fontSize = Math.max(10, Math.round(11 * this.scale));
            ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 3;
            ctx.fillStyle = isSelected ? '#ffd700' : (isHovered ? '#fff' : '#c8c0a8');
            ctx.fillText(city.displayName, pos.x, pos.y - radius - 5);
            ctx.shadowBlur = 0;

            // Small ship count badge
            if (dockedCount > 0) {
                const bx = pos.x + radius + 2;
                const by = pos.y - radius - 2;
                ctx.fillStyle = '#2980b9';
                ctx.beginPath();
                ctx.arc(bx, by, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.font = '8px sans-serif';
                ctx.fillText(dockedCount, bx, by + 3);
            }
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
        // Update and draw wake particles
        for (let i = this.wakes.length - 1; i >= 0; i--) {
            const w = this.wakes[i];
            w.life -= w.decay;
            w.size += 0.08;

            if (w.life <= 0) {
                this.wakes.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = w.life * 0.3;
            ctx.strokeStyle = 'rgba(180, 220, 255, 0.6)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(w.x, w.y, w.size, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Cap wake count for performance
        if (this.wakes.length > 200) {
            this.wakes.splice(0, this.wakes.length - 200);
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
