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
            // Scandinavian peninsula
            [[280,0],[300,40],[320,80],[340,100],[300,130],[310,160],[340,120],[380,100],[420,80],[460,60],[500,40],[540,20],[600,10],[660,20],[700,50],[730,80],[750,100],[770,80],[790,40],[820,20],[860,0],[280,0]],
            // Southern Sweden
            [[520,190],[540,210],[560,230],[580,250],[600,270],[580,290],[550,280],[520,260],[500,240],[490,220],[500,200],[520,190]],
            // Gotland
            [[690,195],[710,200],[715,220],[710,240],[695,250],[680,240],[675,220],[680,200],[690,195]],
            // Jutland
            [[420,260],[430,280],[440,300],[450,320],[470,340],[490,360],[480,380],[460,400],[440,410],[420,420],[400,410],[390,390],[395,370],[400,350],[405,330],[400,310],[395,290],[400,270],[420,260]],
            // Danish islands
            [[470,330],[490,335],[500,345],[495,360],[480,365],[465,355],[460,340],[470,330]],
            // Northern Germany coast
            [[340,420],[360,410],[380,400],[410,395],[440,405],[470,398],[500,385],[530,370],[560,360],[590,355],[620,360],[650,370],[680,365],[710,355],[740,350],[770,340],[800,330],[830,320],[860,310],[890,300],[920,280],[950,260],[980,240],[1010,220],[1040,200],[1060,180],[1080,160],[1100,140],[1100,700],[340,700],[340,420]],
            // Britain
            [[140,340],[160,330],[180,340],[200,360],[220,380],[240,400],[250,420],[260,440],[250,460],[230,480],[200,500],[170,510],[150,500],[140,480],[130,460],[120,440],[110,420],[120,400],[130,380],[125,360],[140,340]],
            // Low Countries
            [[240,420],[260,415],[280,420],[300,430],[320,440],[340,450],[340,700],[240,700],[240,420]],
            // Norway coast
            [[150,0],[160,20],[170,50],[180,80],[200,100],[220,110],[240,120],[260,130],[270,145],[260,160],[250,180],[240,200],[235,220],[240,240],[250,260],[260,280],[270,290],[280,280],[280,0],[150,0]]
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
        const size = isPlayer ? 1.2 : 0.85;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        // Hull shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(1, 2, 10 * size, 3 * size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Hull
        ctx.fillStyle = hullColor;
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-9 * size, 0);
        ctx.quadraticCurveTo(-7 * size, -4 * size, 0, -4 * size);
        ctx.quadraticCurveTo(7 * size, -4 * size, 10 * size, 0);
        ctx.quadraticCurveTo(7 * size, 4 * size, 0, 4 * size);
        ctx.quadraticCurveTo(-7 * size, 4 * size, -9 * size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Bow (pointed front)
        ctx.fillStyle = hullColor;
        ctx.beginPath();
        ctx.moveTo(8 * size, -2.5 * size);
        ctx.lineTo(13 * size, 0);
        ctx.lineTo(8 * size, 2.5 * size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Mast
        ctx.strokeStyle = '#543';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -10 * size);
        ctx.stroke();

        // Sail (flutters slightly)
        const flutter = Math.sin(t * 0.1) * 1.2;
        ctx.fillStyle = sailColor;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(-1, -9 * size);
        ctx.quadraticCurveTo(5 * size + flutter, -6 * size, 6 * size + flutter, -3 * size);
        ctx.lineTo(-1, -2 * size);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Flag at top of mast
        if (isPlayer) {
            ctx.fillStyle = '#c0392b';
            ctx.beginPath();
            ctx.moveTo(0, -10 * size);
            ctx.lineTo(4, -11 * size + Math.sin(t * 0.15) * 0.5);
            ctx.lineTo(0, -9 * size);
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
