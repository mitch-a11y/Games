/* ============================================
   HANSE - Map Renderer with Background Image
   Phase 3: Illustrated map background with
   sprite-based ships
   ============================================ */

const GameMap = {
    canvas: null,
    ctx: null,
    width: 0,
    height: 0,
    hoveredCity: null,
    selectedCity: null,
    animFrame: 0,
    // Background map image
    mapImage: null,
    mapImageLoaded: false,
    // Ship sprites by type
    shipSprites: {},
    // Ship wake particles
    wakes: [],
    // Sea sparkle particles
    sparkles: [],
    // Seagulls
    seagulls: [],
    // Clouds
    clouds: [],

    init() {
        this.canvas = document.getElementById('game-map');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => { this.resize(); });
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.onClick(e));

        // Load map background image
        this.mapImage = new Image();
        this.mapImage.src = 'assets/map.jpg';
        this.mapImage.onload = () => {
            this.mapImageLoaded = true;
        };
        this.mapImage.onerror = () => {
            console.warn('Failed to load map background image: assets/map.jpg');
        };

        // Load ship sprites — supports multi-angle (8 directions) or single sprite
        // Multi-angle files: assets/ship_{type}_{dir}.png where dir = 0,1,...7
        // Directions: 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE (clockwise from East)
        // Falls back to single sprite: assets/ship_{type}.png
        this.shipSprites = {};
        this.ANGLE_COUNT = 8;
        const spriteTypes = ['small_cog', 'cog', 'hulk', 'caravel', 'carrack'];
        spriteTypes.forEach(type => {
            const entry = { angles: [], singleImg: null, loaded: false, multiAngle: false };

            // Try multi-angle first
            let loadedAngles = 0;
            let failedAngles = 0;
            for (let dir = 0; dir < this.ANGLE_COUNT; dir++) {
                const img = new Image();
                img.src = `assets/ship_${type}_${dir}.png`;
                entry.angles.push({ img, loaded: false });
                img.onload = () => {
                    entry.angles[dir].loaded = true;
                    loadedAngles++;
                    if (loadedAngles === this.ANGLE_COUNT) {
                        entry.multiAngle = true;
                        entry.loaded = true;
                    }
                };
                img.onerror = () => {
                    failedAngles++;
                    // If any angle fails, fall back to single sprite
                    if (failedAngles === 1) {
                        const single = new Image();
                        single.src = `assets/ship_${type}.png`;
                        entry.singleImg = single;
                        single.onload = () => { entry.loaded = true; };
                    }
                };
            }

            this.shipSprites[type] = entry;
        });
        // warship reuses cog sprite
        this.shipSprites['warship'] = this.shipSprites['cog'];

        // Seed sparkles (subtle for illustrated map)
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

        // Draw background map image (or fallback gradient)
        this.drawMapBackground(ctx);

        // Sea sparkles (subtle over the map)
        this.drawSparkles(ctx);

        // Clouds (atmospheric, subtle)
        this.drawClouds(ctx);

        // Draw sea routes
        this.drawRoutes(ctx, gameState);

        // Ship wakes (behind ships)
        this.drawWakes(ctx);

        // Draw ships with sprite graphics
        if (gameState) {
            this.drawShips(ctx, gameState);
        }

        // Cities on top
        this.drawCities(ctx, gameState);

        // Player buildings around cities
        if (gameState) {
            this.drawCityBuildings(ctx, gameState);
        }

        // Hovered city highlight
        if (this.hoveredCity) {
            this.drawCityHighlight(ctx, this.hoveredCity);
        }

        // Seagulls (on top of everything, in the sky)
        this.drawSeagulls(ctx);

        // Weather & season overlay
        this.drawWeatherOverlay(ctx, gameState);

        // Compass rose
        this.drawCompass(ctx, gameState);
    },

    // Weather and seasonal tinting overlay
    drawWeatherOverlay(ctx, gameState) {
        if (!gameState) return;

        const season = typeof Game !== 'undefined' && Game.getSeason ? Game.getSeason() : 'summer';
        const wind = gameState.wind;
        const t = this.animFrame;

        // Seasonal color tint (very subtle)
        const seasonTints = {
            spring: 'rgba(100, 200, 100, 0.03)',
            summer: 'rgba(255, 220, 100, 0.02)',
            autumn: 'rgba(200, 120, 50, 0.04)',
            winter: 'rgba(150, 180, 220, 0.06)'
        };
        ctx.fillStyle = seasonTints[season] || 'transparent';
        ctx.fillRect(0, 0, this.width, this.height);

        // Storm effect when wind is strong
        if (wind && wind.strength > 2.0) {
            // Rain streaks
            ctx.save();
            ctx.strokeStyle = 'rgba(180, 200, 220, 0.15)';
            ctx.lineWidth = 1;
            const windAngle = wind.direction * Math.PI / 4;
            const dx = Math.cos(windAngle) * 15;
            const dy = Math.sin(windAngle) * 15 + 10;

            for (let i = 0; i < 40; i++) {
                const rx = ((t * 3 + i * 97) % this.width);
                const ry = ((t * 5 + i * 53) % this.height);
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(rx + dx, ry + dy);
                ctx.stroke();
            }
            ctx.restore();

            // Darker overlay for storms
            ctx.fillStyle = 'rgba(0, 10, 30, 0.08)';
            ctx.fillRect(0, 0, this.width, this.height);
        }

        // Winter: subtle fog at bottom
        if (season === 'winter') {
            const fogGrad = ctx.createLinearGradient(0, this.height * 0.7, 0, this.height);
            fogGrad.addColorStop(0, 'rgba(180, 200, 220, 0)');
            fogGrad.addColorStop(1, 'rgba(180, 200, 220, 0.08)');
            ctx.fillStyle = fogGrad;
            ctx.fillRect(0, 0, this.width, this.height);
        }
    },

    drawMapBackground(ctx) {
        // Clear with dark background first (for letterbox areas)
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.width, this.height);

        if (this.mapImageLoaded && this.mapImage) {
            // Draw background image aligned with world coordinates
            const topLeft = this.worldToScreen(0, 0);
            const mapW = CONFIG.MAP_WIDTH * this.scale;
            const mapH = CONFIG.MAP_HEIGHT * this.scale;
            ctx.drawImage(this.mapImage, topLeft.x, topLeft.y, mapW, mapH);
        } else {
            // Fallback gradient if image not loaded
            const grad = ctx.createLinearGradient(0, 0, 0, this.height);
            grad.addColorStop(0, '#071a30');
            grad.addColorStop(0.3, '#0c2844');
            grad.addColorStop(0.6, '#0e3058');
            grad.addColorStop(1, '#0a2240');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, this.width, this.height);
        }
    },


    drawSparkles(ctx) {
        const t = this.animFrame;
        this.sparkles.forEach(s => {
            const brightness = (Math.sin(t * s.speed + s.phase) + 1) * 0.5;
            if (brightness > 0.7) {
                const sx = s.x * this.width;
                const sy = s.y * this.height;
                // Much more subtle sparkles for illustrated map
                ctx.globalAlpha = (brightness - 0.7) * 0.5;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;
    },


    drawRoutes(ctx, gameState) {
        const t = this.animFrame;

        SEA_ROUTES.forEach(route => {
            const from = CITIES_DATA[route.from];
            const to = CITIES_DATA[route.to];
            if (!from || !to) return;

            // Get smooth spline path
            const worldPoints = getRouteSegmentPath(route.from, route.to);
            const screenPoints = worldPoints.map(p => this.worldToScreen(p.x, p.y));

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

            // Active route glow effect
            if (isActive) {
                ctx.save();
                ctx.strokeStyle = 'rgba(230, 168, 23, 0.15)';
                ctx.lineWidth = 6;
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
                for (let i = 1; i < screenPoints.length; i++) {
                    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
                }
                ctx.stroke();
                ctx.restore();

                ctx.strokeStyle = 'rgba(230, 168, 23, 0.55)';
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 8]);
                ctx.lineDashOffset = -t * 0.5;
            } else {
                ctx.strokeStyle = 'rgba(100, 150, 200, 0.3)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 7]);
                ctx.lineDashOffset = 0;
            }

            // Draw smooth spline path
            ctx.beginPath();
            ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
            for (let i = 1; i < screenPoints.length; i++) {
                ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
            }
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

    drawCityBuildings(ctx, gameState) {
        const t = this.animFrame;

        CITY_IDS.forEach(cityId => {
            const cityState = gameState.cities[cityId];
            if (!cityState || !cityState.playerBuildings || cityState.playerBuildings.length === 0) return;

            const city = CITIES_DATA[cityId];
            const pos = this.worldToScreen(city.x, city.y);
            const baseRadius = (4 + city.importance * 1.5) * this.scale;
            const buildings = cityState.playerBuildings;

            // Position building icons in a ring around the city
            const ringRadius = baseRadius + 14;
            const startAngle = Math.PI * 0.6; // Start from lower-right
            const angleStep = (Math.PI * 1.6) / Math.max(buildings.length, 1);

            buildings.forEach((b, idx) => {
                const type = BUILDING_TYPES[b.type];
                if (!type) return;

                const a = startAngle + idx * angleStep;
                const bx = pos.x + Math.cos(a) * ringRadius;
                const by = pos.y + Math.sin(a) * ringRadius;

                // Production pulse for active production buildings
                const isProd = type.produces !== null;
                const pulse = isProd ? Math.sin(t * 0.04 + idx) * 0.12 : 0;

                // Background pill
                const pillW = 9;
                ctx.globalAlpha = 0.85 + pulse;
                ctx.fillStyle = isProd ? 'rgba(46, 172, 104, 0.5)' : 'rgba(20, 40, 70, 0.7)';
                ctx.strokeStyle = isProd ? 'rgba(46, 172, 104, 0.6)' : 'rgba(100, 130, 180, 0.3)';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.arc(bx, by, pillW, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Emoji icon
                ctx.globalAlpha = 0.95;
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(type.icon, bx, by);

                // Level badge (if level > 1)
                if (b.level > 1) {
                    ctx.fillStyle = '#ffd700';
                    ctx.font = 'bold 7px sans-serif';
                    ctx.fillText(b.level, bx + 6, by - 6);
                }
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

    // Ship scale multiplier based on type (bigger ships = bigger sprites)
    getShipScale(typeId, isPlayer) {
        const scales = {
            small_cog: 1.2,
            cog: 1.5,
            hulk: 1.8,
            caravel: 1.4,
            carrack: 2.2,
            warship: 1.7
        };
        const base = scales[typeId] || 1.4;
        return isPlayer ? base : base * 0.75;
    },

    drawShips(ctx, gameState) {
        if (!gameState || !gameState.player) return;
        const t = this.animFrame;

        // Player ships
        gameState.player.ships.forEach(ship => {
            if (ship.status !== 'sailing' || !ship.route || ship.route.length < 2) return;
            const pos = this.getShipScreenPos(ship, t);
            if (!pos) return;

            const shipScale = this.getShipScale(ship.typeId, true);

            // Wake particles — bigger ships = bigger wakes
            if (t % 2 === 0) {
                const wakeOff = 6 + shipScale * 3;
                this.wakes.push({
                    x: pos.x - Math.cos(pos.angle) * wakeOff,
                    y: pos.y - Math.sin(pos.angle) * wakeOff,
                    life: 1.0,
                    size: 1.5 + shipScale * 0.8,
                    decay: 0.012,
                    isV: true,
                    angle: pos.angle,
                    spread: shipScale * 1.5
                });
            }

            this.drawDetailedShip(ctx, pos.x, pos.y, pos.angle, ship, '#e6a817', '#fff', true);

            // Ship name label
            const labelOffset = 10 + shipScale * 5;
            ctx.shadowColor = 'rgba(0,0,0,0.9)';
            ctx.shadowBlur = 3;
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd700';
            ctx.fillText(ship.name, pos.x, pos.y - labelOffset);
            ctx.shadowBlur = 0;

            // Hull bar if damaged
            if (ship.hull < ship.maxHull) {
                const barW = 20 + shipScale * 4;
                const barH = 3;
                const hullPct = ship.hull / ship.maxHull;
                const barY = pos.y + 8 + shipScale * 3;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(pos.x - barW/2, barY, barW, barH);
                ctx.fillStyle = hullPct > 0.5 ? '#27ae60' : (hullPct > 0.25 ? '#f39c12' : '#c0392b');
                ctx.fillRect(pos.x - barW/2, barY, barW * hullPct, barH);
            }
        });

        // AI ships (sailing)
        if (gameState.aiTraders) {
            const aiColors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#f39c12', '#7f8c8d'];
            gameState.aiTraders.forEach((ai, aiIdx) => {
                const aiColor = aiColors[aiIdx % aiColors.length];
                ai.ships.forEach(ship => {
                    if (ship.status !== 'sailing' || !ship.route || ship.route.length < 2) return;
                    const pos = this.getShipScreenPos(ship, t + aiIdx * 10);
                    if (!pos) return;

                    const shipScale = this.getShipScale(ship.typeId, false);

                    if (t % 4 === 0) {
                        this.wakes.push({
                            x: pos.x - Math.cos(pos.angle) * (4 + shipScale * 2),
                            y: pos.y - Math.sin(pos.angle) * (4 + shipScale * 2),
                            life: 0.5, size: 1 + shipScale * 0.5, decay: 0.02
                        });
                    }

                    this.drawDetailedShip(ctx, pos.x, pos.y, pos.angle, ship, aiColor, '#ddd', false);

                    // AI ship name label
                    const labelOffset = 8 + shipScale * 4;
                    ctx.shadowColor = 'rgba(0,0,0,0.9)';
                    ctx.shadowBlur = 3;
                    ctx.font = '8px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = aiColor;
                    ctx.fillText(ai.name.split(' ')[0], pos.x, pos.y - labelOffset);
                    ctx.shadowBlur = 0;
                });
            });
        }

        // AI ships docked — small pennant markers at cities
        if (gameState.aiTraders) {
            const aiColors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#f39c12', '#7f8c8d'];
            gameState.aiTraders.forEach((ai, aiIdx) => {
                const aiColor = aiColors[aiIdx % aiColors.length];
                ai.ships.forEach(ship => {
                    if (ship.status !== 'docked' || !ship.location) return;
                    const city = CITIES_DATA[ship.location];
                    if (!city) return;
                    const sp = this.worldToScreen(city.x, city.y);

                    // Draw small colored diamond below city
                    const offsetY = 12 + aiIdx * 6;
                    const dx = sp.x + (aiIdx % 2 === 0 ? -10 : 10);
                    const dy = sp.y + offsetY;

                    ctx.save();
                    ctx.translate(dx, dy);
                    // Diamond shape
                    ctx.beginPath();
                    ctx.moveTo(0, -4);
                    ctx.lineTo(4, 0);
                    ctx.lineTo(0, 4);
                    ctx.lineTo(-4, 0);
                    ctx.closePath();
                    ctx.fillStyle = aiColor;
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    ctx.restore();
                });
            });
        }
    },

    getShipScreenPos(ship, t) {
        const fromCityId = ship.route[ship.routeIndex];
        const toIdx = Math.min(ship.routeIndex + 1, ship.route.length - 1);
        const toCityId = ship.route[toIdx];
        if (!CITIES_DATA[fromCityId] || !CITIES_DATA[toCityId]) return null;

        // Get full polyline path with waypoints
        const worldPath = getRouteSegmentPath(fromCityId, toCityId);
        const pos = interpolatePolyline(worldPath, ship.progress);

        // Convert to screen coordinates
        const screenPos = this.worldToScreen(pos.x, pos.y);

        // Add gentle bobbing on waves
        const x = screenPos.x;
        const y = screenPos.y + Math.sin(t * 0.08) * 2.5 + Math.cos(t * 0.12) * 1;

        return { x, y, angle: pos.angle };
    },

    // Convert angle (radians) to sprite direction index (0-7)
    angleToDirection(angle) {
        // Normalize to 0..2PI
        let a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        // Each direction covers 45 degrees (PI/4 radians)
        return Math.round(a / (Math.PI / 4)) % this.ANGLE_COUNT;
    },

    drawDetailedShip(ctx, x, y, angle, ship, hullColor, sailColor, isPlayer) {
        const sprite = this.shipSprites[ship.typeId];

        if (sprite && sprite.loaded) {
            const scale = this.getShipScale(ship.typeId, isPlayer);
            let img;
            let useRotation = true;

            if (sprite.multiAngle) {
                // Use pre-rendered angle sprite — no canvas rotation needed!
                const dir = this.angleToDirection(angle);
                const angleEntry = sprite.angles[dir];
                if (angleEntry && angleEntry.loaded) {
                    img = angleEntry.img;
                    useRotation = false;
                }
            }

            // Fallback to single sprite with rotation
            if (!img) {
                img = sprite.singleImg || (sprite.angles[0] && sprite.angles[0].img);
                if (!img) return;
                useRotation = true;
            }

            const sw = img.width * scale;
            const sh = img.height * scale;

            ctx.save();
            ctx.translate(x, y);
            if (useRotation) ctx.rotate(angle);

            // Shadow
            ctx.globalAlpha = 0.25;
            ctx.filter = 'blur(3px) brightness(0)';
            ctx.drawImage(img, -sw / 2 + 3, -sh / 2 + 5, sw, sh);
            ctx.filter = 'none';
            ctx.globalAlpha = 1;

            // Ship sprite
            ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);

            // Tint AI ships
            if (!isPlayer) {
                ctx.globalAlpha = 0.55;
                ctx.filter = 'saturate(0.3) brightness(0.8)';
                ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
                ctx.filter = 'none';
                ctx.globalAlpha = 1;
            }

            ctx.restore();
        } else {
            // Fallback: draw simple ship if sprite not loaded
            const s = this.getShipScale(ship.typeId, isPlayer) * 0.7;

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            // Simple hull shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(0, 3 * s, 14 * s, 3.5 * s, 0, 0, Math.PI * 2);
            ctx.fill();

            // Simple ship hull
            ctx.fillStyle = isPlayer ? '#e6a817' : '#778899';
            ctx.beginPath();
            ctx.moveTo(-12 * s, 0);
            ctx.lineTo(-11 * s, 3 * s);
            ctx.lineTo(-6 * s, 4.5 * s);
            ctx.lineTo(6 * s, 4.5 * s);
            ctx.lineTo(11 * s, 3 * s);
            ctx.lineTo(14 * s, -1 * s);
            ctx.lineTo(12 * s, -3 * s);
            ctx.lineTo(8 * s, -4 * s);
            ctx.lineTo(-6 * s, -4 * s);
            ctx.lineTo(-10 * s, -5 * s);
            ctx.lineTo(-13 * s, -3 * s);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 0.8;
            ctx.stroke();

            // Simple mast
            ctx.strokeStyle = '#5c3a1e';
            ctx.lineWidth = 2 * s;
            ctx.beginPath();
            ctx.moveTo(1 * s, -4 * s);
            ctx.lineTo(1 * s, -18 * s);
            ctx.stroke();

            ctx.restore();
        }
    },

    drawWakes(ctx) {
        for (let i = this.wakes.length - 1; i >= 0; i--) {
            const w = this.wakes[i];
            w.life -= w.decay;
            w.size += 0.12;

            if (w.life <= 0) {
                this.wakes.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = w.life * 0.25;

            if (w.isV && w.angle !== undefined) {
                // V-shaped wake trail
                const spread = (w.spread || 2) * (1 - w.life + 0.5);
                const perpAngle = w.angle + Math.PI / 2;
                const dx = Math.cos(perpAngle) * spread;
                const dy = Math.sin(perpAngle) * spread;

                ctx.strokeStyle = 'rgba(200, 230, 255, 0.5)';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(w.x, w.y);
                ctx.lineTo(w.x + dx, w.y + dy);
                ctx.moveTo(w.x, w.y);
                ctx.lineTo(w.x - dx, w.y - dy);
                ctx.stroke();

                // Foam dot at center
                ctx.fillStyle = 'rgba(220, 240, 255, 0.4)';
                ctx.beginPath();
                ctx.arc(w.x, w.y, w.size * 0.4, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Simple circular wake (AI ships)
                ctx.strokeStyle = 'rgba(180, 220, 255, 0.5)';
                ctx.lineWidth = 0.5;
                ctx.beginPath();
                ctx.arc(w.x, w.y, w.size, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;

        if (this.wakes.length > 300) {
            this.wakes.splice(0, this.wakes.length - 300);
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
            // AI traders in this city
            if (Game.state.aiTraders) {
                const aiHere = Game.state.aiTraders.filter(ai =>
                    ai.ships.some(s => s.location === this.hoveredCity && s.status === 'docked')
                );
                if (aiHere.length > 0) {
                    html += '<p style="color:#c0a060">' + aiHere.map(a => a.name.split(' ')[0]).join(', ') + '</p>';
                }
            }
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
