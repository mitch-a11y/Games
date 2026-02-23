/* ============================================
   HANSE - Main Game Engine
   ============================================ */

const Game = {
    state: null,
    speed: 1,
    paused: false,
    tickTimer: null,
    lastTick: 0,
    tickAccumulator: 0,
    running: false,

    // Initialize a new game
    newGame(playerName, homeCity, difficulty) {
        const diffConfig = CONFIG.DIFFICULTY[difficulty];

        this.state = {
            player: {
                name: playerName,
                homeCity: homeCity,
                gold: diffConfig.startGold,
                rank: CONFIG.RANKS[0].name,
                rankIndex: 0,
                ships: [],
                reputation: {},
                totalTraded: 0,
                totalProfit: 0,
                totalSpent: 0,
                voyagesCompleted: 0,
                battlesWon: 0,
                battlesLost: 0,
                battlesFled: 0,
                goodsTraded: {},
                wealthHistory: [],
                daysPlayed: 0,
                tutorialStep: 0,
                tutorialDone: false
            },
            date: {
                day: 1,
                month: CONFIG.START_MONTH,
                year: CONFIG.START_YEAR
            },
            difficulty: difficulty,
            cities: {},
            aiTraders: [],
            wind: {
                direction: Utils.randInt(0, 7),
                strength: Utils.rand(0.5, 2.0)
            },
            eventCooldown: 0,
            monthlyProcessed: false
        };

        // Initialize cities
        CITY_IDS.forEach(cityId => {
            this.state.cities[cityId] = {
                population: CITIES_DATA[cityId].population,
                market: Trading.initCityMarket(cityId),
                playerBuildings: [],
                reputation: 0
            };
        });

        // Give player starting ship
        const startShip = createShip('small_cog', generateShipName(), homeCity);
        this.state.player.ships.push(startShip);

        // Give player a kontor in home city
        this.state.cities[homeCity].playerBuildings.push({
            id: Utils.uid(),
            type: 'kontor',
            level: 1,
            produces: null,
            storage: 100,
            built: { day: 1, month: CONFIG.START_MONTH, year: CONFIG.START_YEAR }
        });
        this.state.cities[homeCity].reputation = 10;

        // Initialize AI traders
        const aiCount = CONFIG.AI_TRADER_COUNT;
        for (let i = 0; i < aiCount; i++) {
            this.state.aiTraders.push(AITrader.createTrader(i, difficulty));
        }

        // Set initial reputation
        this.state.player.reputation[homeCity] = 10;

        this.start();
    },

    // Start game loop
    start() {
        this.running = true;
        this.paused = false;
        this.speed = 1;
        this.lastTick = performance.now();

        // Initialize map
        GameMap.init();
        GameMap.selectCity(this.state.player.homeCity);

        // Initialize UI
        UI.init();
        UI.updateTopBar(this.state);
        UI.updateWind(this.state);
        UI.addLogMessage(`Willkommen, ${this.state.player.name}! Euer Abenteuer beginnt in ${CITIES_DATA[this.state.player.homeCity].displayName}.`, 'info');

        // Start sound
        Sound.init();
        Sound.play('newgame');

        // Start tutorial for new players
        if (!this.state.player.tutorialDone) {
            setTimeout(() => UI.showTutorial(), 2500);
        }

        // Start game loop
        this.gameLoop();
    },

    // Season helper (1=Spring, 2=Summer, 3=Autumn, 4=Winter)
    getSeason() {
        const m = this.state.date.month;
        if (m >= 3 && m <= 5) return 'spring';
        if (m >= 6 && m <= 8) return 'summer';
        if (m >= 9 && m <= 11) return 'autumn';
        return 'winter';
    },

    getSeasonName() {
        const s = this.getSeason();
        return s === 'spring' ? 'Frühling' : s === 'summer' ? 'Sommer' : s === 'autumn' ? 'Herbst' : 'Winter';
    },

    gameLoop() {
        if (!this.running) return;

        const now = performance.now();
        const delta = now - this.lastTick;
        this.lastTick = now;

        if (!this.paused && this.speed > 0) {
            const speedMul = CONFIG.SPEED_MULTIPLIERS[this.speed];
            this.tickAccumulator += delta * speedMul;

            while (this.tickAccumulator >= CONFIG.TICK_MS) {
                this.tickAccumulator -= CONFIG.TICK_MS;
                this.gameTick();
            }
        }

        // Render
        GameMap.render(this.state);

        requestAnimationFrame(() => this.gameLoop());
    },

    // One game tick = one day
    gameTick() {
        if (!this.state) return;

        // Advance date
        this.advanceDate();

        // Update ships
        this.updateShips();

        // Update AI
        this.state.aiTraders.forEach(ai => AITrader.update(ai, this.state));

        // Update markets (every 3 days) with seasonal modifiers
        if (this.state.date.day % 3 === 0) {
            const diffMod = CONFIG.DIFFICULTY[this.state.difficulty].priceBonus;
            const season = this.getSeason();
            CITY_IDS.forEach(cityId => {
                Trading.updateMarket(this.state.cities[cityId], diffMod, season);
            });
            // Invalidate trade profit cache after market update
            UI.invalidateTradeCache();
        }

        // Seasonal announcement (first day of new season)
        if (this.state.date.day === 1 && [3, 6, 9, 12].includes(this.state.date.month)) {
            const seasonName = this.getSeasonName();
            const seasonEffects = {
                'Frühling': '🌱 Getreidepreise fallen, Schiffsverkehr nimmt zu.',
                'Sommer': '☀️ Beste Handelssaison! Alle Routen sicher.',
                'Herbst': '🍂 Erntezeit — Getreide billig, Pelze teurer.',
                'Winter': '❄️ Stürme häufiger, Holz & Salz teurer, Pelze im Überfluss.'
            };
            UI.addLogMessage(`${seasonName} ist angebrochen! ${seasonEffects[seasonName]}`, 'event');
            UI.showNotification(`${seasonName} beginnt!`, 'info');
        }

        // Change wind periodically
        if (this.state.date.day % 5 === 0) {
            this.state.wind.direction = (this.state.wind.direction + Utils.randInt(-1, 1) + 8) % 8;
            this.state.wind.strength = Utils.clamp(
                this.state.wind.strength + Utils.rand(-0.3, 0.3), 0.3, 3.0
            );
            UI.updateWind(this.state);
        }

        // Check events
        this.state.eventCooldown--;
        if (this.state.eventCooldown <= 0 && this.state.date.day % CONFIG.EVENT_CHECK_INTERVAL === 0) {
            // Skip events during active combat
            if (typeof Combat !== 'undefined' && Combat.active) {
                // Don't check events while player is in combat
            } else {
                const events = Events.checkEvents(this.state);
                events.forEach(evt => {
                    UI.addLogMessage(evt.message, evt.template.type === 'combat' ? 'danger' : 'event');
                    // Don't show popup for interactive combat (Combat.initCombat handles its own UI)
                    if (evt.template.interactive) {
                        this.state.eventCooldown = 10;
                    } else if (evt.template.type === 'combat' || evt.template.id === 'plague' || evt.template.id === 'fire') {
                        UI.showEventPopup(evt);
                        this.state.eventCooldown = 10;
                    }
                });
            }
        }

        // Monthly processing
        if (this.state.date.day === 1 && !this.state.monthlyProcessed) {
            this.monthlyUpdate();
            this.state.monthlyProcessed = true;
        }
        if (this.state.date.day === 2) {
            this.state.monthlyProcessed = false;
        }

        // Update player rank
        this.checkRankUp();

        // Update ambient sounds (every 10 days)
        if (this.state.date.day % 10 === 0) {
            Sound.updateAmbient(this.state);
        }

        // Update UI periodically
        this.state.player.daysPlayed++;
        if (this.state.player.daysPlayed % 2 === 0) {
            UI.updateTopBar(this.state);
            UI.refreshCurrentTab();
        }
    },

    advanceDate() {
        this.state.date.day++;
        if (this.state.date.day > CONFIG.DAYS_PER_MONTH) {
            this.state.date.day = 1;
            this.state.date.month++;
            if (this.state.date.month > CONFIG.MONTHS_PER_YEAR) {
                this.state.date.month = 1;
                this.state.date.year++;
            }
        }
    },

    updateShips() {
        this.state.player.ships.forEach(ship => {
            if (ship.status !== 'sailing' || !ship.route) return;

            if (ship.routeIndex >= ship.route.length - 1) {
                this.shipArrived(ship);
                return;
            }

            const fromId = ship.route[ship.routeIndex];
            const toId = ship.route[ship.routeIndex + 1];
            const routeInfo = SEA_ROUTES.find(r =>
                (r.from === fromId && r.to === toId) ||
                (r.from === toId && r.to === fromId)
            );

            const distance = routeInfo ? routeInfo.distance : 5;

            // Calculate speed with wind effect (use convoy speed if in convoy)
            const baseSpeed = ship.convoySpeed || ship.speed;
            let speed = baseSpeed * CONFIG.SHIP_SPEED_BASE;
            // Wind bonus/penalty
            const windEffect = (Math.random() - 0.3) * CONFIG.WIND_EFFECT * this.state.wind.strength;
            speed += windEffect;
            speed = Math.max(speed * 0.3, speed); // minimum 30% speed

            const progressPerTick = speed / (distance * 30);
            ship.progress += progressPerTick;

            if (ship.progress >= 1.0) {
                ship.routeIndex++;
                ship.progress = 0;

                if (ship.routeIndex >= ship.route.length - 1) {
                    this.shipArrived(ship);
                }
            }
        });
    },

    shipArrived(ship) {
        const dest = ship.route[ship.route.length - 1];
        ship.status = 'docked';
        ship.location = dest;
        ship.route = null;
        ship.progress = 0;
        ship.destination = null;

        UI.addLogMessage(`${ship.name} ist in ${CITIES_DATA[dest].displayName} angekommen.`, 'info');
        Sound.play('arrive');

        // Track stats
        if (!this.state.player.voyagesCompleted) this.state.player.voyagesCompleted = 0;
        this.state.player.voyagesCompleted++;

        // Process auto-trade if configured
        if (ship.autoTrade) {
            // Small delay so the market settles
            setTimeout(() => {
                if (ship.status === 'docked' && ship.autoTrade) {
                    Trading.processAutoTrade(this.state, ship);
                }
            }, 100);
        }

        // Auto-select city if no active combat
        if (GameMap.selectedCity !== dest && !(typeof Combat !== 'undefined' && Combat.active)) {
            GameMap.selectCity(dest);
        }
    },

    monthlyUpdate() {
        // Maintenance costs
        const shipMaintenance = this.state.player.ships.reduce(
            (sum, s) => sum + s.maintenance, 0
        );
        const buildingMaintenance = Buildings.getMaintenanceCost(this.state);
        const totalMaintenance = shipMaintenance + buildingMaintenance;

        // Bank loan interest processing
        if (typeof Bank !== 'undefined') {
            Bank.monthlyProcess(this.state);
        }

        // Diplomacy reputation processing
        if (typeof Diplomacy !== 'undefined') {
            Diplomacy.monthlyProcess(this.state);
        }

        if (totalMaintenance > 0) {
            this.state.player.gold -= totalMaintenance;
            UI.addLogMessage(
                `Monatliche Kosten: ${Utils.formatGold(totalMaintenance)} (Schiffe: ${shipMaintenance}, Gebaeude: ${buildingMaintenance})`,
                'info'
            );
        }

        // Population growth in cities
        CITY_IDS.forEach(cityId => {
            const cityState = this.state.cities[cityId];
            const hasHospital = (cityState.playerBuildings || []).some(b => b.type === 'hospital');
            const growthRate = CONFIG.POPULATION_GROWTH * (hasHospital ? 1.5 : 1);

            // Growth depends on food supply
            const foodSupply = cityState.market.grain.stock + cityState.market.fish.stock;
            const foodDemand = cityState.population * 0.01;

            if (foodSupply > foodDemand) {
                cityState.population += Math.floor(cityState.population * growthRate);
            } else {
                cityState.population -= Math.floor(cityState.population * growthRate * 0.5);
            }
            cityState.population = Math.max(500, cityState.population);
        });

        // Building production income
        CITY_IDS.forEach(cityId => {
            const cityState = this.state.cities[cityId];
            if (!cityState.playerBuildings) return;
            cityState.playerBuildings.forEach(b => {
                if (b.produces && GOODS[b.produces]) {
                    cityState.market[b.produces].stock += CONFIG.PRODUCTION_RATE * b.level * CONFIG.DAYS_PER_MONTH;
                }
            });
        });

        // Track wealth history (for stats chart)
        const currentWealth = this.calculateNetWorth();
        if (!this.state.player.wealthHistory) this.state.player.wealthHistory = [];
        this.state.player.wealthHistory.push({
            month: this.state.date.month,
            year: this.state.date.year,
            wealth: currentWealth,
            gold: this.state.player.gold
        });
        // Keep last 60 months
        if (this.state.player.wealthHistory.length > 60) {
            this.state.player.wealthHistory.shift();
        }

        // Check for bankruptcy (game over)
        if (this.state.player.gold < -5000) {
            this.triggerGameOver('bankruptcy');
            return;
        } else if (this.state.player.gold < -1000) {
            UI.showNotification('Achtung: Ihr seid hoch verschuldet!', 'danger');
            UI.addLogMessage('Warnung: Eure Schulden wachsen! Handelt, um sie zu tilgen.', 'danger');
        }

        // Check for victory (Eldermann rank + 500k wealth)
        if (this.state.player.rankIndex >= CONFIG.RANKS.length - 1 && currentWealth >= 500000) {
            this.triggerVictory();
        }
    },

    checkRankUp() {
        const player = this.state.player;
        const wealth = this.calculateNetWorth();

        for (let i = CONFIG.RANKS.length - 1; i >= 0; i--) {
            if (wealth >= CONFIG.RANKS[i].minWealth && i > player.rankIndex) {
                const oldRank = player.rank;
                player.rankIndex = i;
                player.rank = CONFIG.RANKS[i].name;
                UI.showRankUp(oldRank, player.rank);
                UI.addLogMessage(`Befoerderung! Ihr seid jetzt ${player.rank}!`, 'event');
                break;
            }
        }
    },

    calculateNetWorth() {
        if (!this.state) return 0;
        let worth = this.state.player.gold;

        // Ships
        this.state.player.ships.forEach(ship => {
            worth += SHIP_TYPES[ship.typeId].cost * 0.7; // depreciation
            // Cargo value
            for (const goodId in ship.cargo) {
                worth += ship.cargo[goodId] * GOODS[goodId].basePrice;
            }
        });

        // Buildings
        CITY_IDS.forEach(cityId => {
            const cityState = this.state.cities[cityId];
            if (!cityState || !cityState.playerBuildings) return;
            cityState.playerBuildings.forEach(b => {
                const type = BUILDING_TYPES[b.type];
                if (type) worth += type.cost * b.level * 0.5;
            });
        });

        return worth;
    },

    setSpeed(speed) {
        this.speed = speed;
        this.paused = speed === 0;
    },

    // Save game
    save() {
        try {
            localStorage.setItem('hanse_save', JSON.stringify(this.state));
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    },

    // Load game
    load() {
        try {
            const data = localStorage.getItem('hanse_save');
            if (!data) return false;
            this.state = JSON.parse(data);
            // Migrate old saves: add priceHistory if missing
            CITY_IDS.forEach(cityId => {
                if (!this.state.cities[cityId]) return;
                const market = this.state.cities[cityId].market;
                GOOD_IDS.forEach(goodId => {
                    if (market[goodId] && !market[goodId].priceHistory) {
                        const p = market[goodId].price;
                        market[goodId].priceHistory = [];
                        for (let i = 0; i < PRICE_HISTORY_LENGTH; i++) {
                            market[goodId].priceHistory.push(p + Utils.randInt(-3, 3));
                        }
                        market[goodId].avgPrice = p;
                        market[goodId].minPrice = p;
                        market[goodId].maxPrice = p;
                        market[goodId].totalBought = market[goodId].totalBought || 0;
                        market[goodId].totalSold = market[goodId].totalSold || 0;
                    }
                });
            });
            if (!this.state.player.totalTraded) this.state.player.totalTraded = 0;
            this.start();
            return true;
        } catch (e) {
            console.error('Load failed:', e);
            return false;
        }
    },

    // Victory!
    triggerVictory() {
        this.paused = true;
        Sound.play('victory');
        Sound.stopAmbient();
        const stats = this.getGameStats();
        UI.showGameEndScreen('victory', stats);
    },

    // Game Over
    triggerGameOver(reason) {
        this.paused = true;
        Sound.play('defeat');
        Sound.stopAmbient();
        const stats = this.getGameStats();
        stats.reason = reason;
        UI.showGameEndScreen('defeat', stats);
    },

    // Compile comprehensive game statistics
    getGameStats() {
        const p = this.state.player;
        const wealth = this.calculateNetWorth();
        const totalShipValue = p.ships.reduce((sum, s) => sum + Math.floor(SHIP_TYPES[s.typeId].cost * 0.6), 0);
        const totalBuildingValue = CITY_IDS.reduce((sum, cid) => {
            const buildings = this.state.cities[cid].playerBuildings || [];
            return sum + buildings.reduce((bs, b) => {
                const bt = BUILDING_TYPES[b.type];
                return bs + (bt ? bt.cost * b.level : 0);
            }, 0);
        }, 0);
        const totalCargoValue = p.ships.reduce((sum, ship) => {
            return sum + Object.entries(ship.cargo).reduce((cs, [gid, amt]) => {
                return cs + (GOODS[gid] ? GOODS[gid].basePrice * amt : 0);
            }, 0);
        }, 0);

        return {
            playerName: p.name,
            rank: p.rank,
            daysPlayed: p.daysPlayed,
            yearsPlayed: Math.floor(p.daysPlayed / (CONFIG.DAYS_PER_MONTH * 12)),
            wealth: wealth,
            gold: p.gold,
            shipValue: totalShipValue,
            buildingValue: totalBuildingValue,
            cargoValue: totalCargoValue,
            shipCount: p.ships.length,
            totalTraded: p.totalTraded || 0,
            totalProfit: p.totalProfit || 0,
            voyagesCompleted: p.voyagesCompleted || 0,
            battlesWon: p.battlesWon || 0,
            battlesLost: p.battlesLost || 0,
            battlesFled: p.battlesFled || 0,
            buildingCount: CITY_IDS.reduce((sum, cid) => sum + (this.state.cities[cid].playerBuildings?.length || 0), 0),
            citiesWithKontor: CITY_IDS.filter(cid => (this.state.cities[cid].playerBuildings || []).some(b => b.type === 'kontor')).length,
            wealthHistory: p.wealthHistory || [],
            difficulty: this.state.difficulty
        };
    },

    // Return to title
    returnToTitle() {
        this.running = false;
        this.state = null;
        Sound.stopAmbient();
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('title-screen').classList.add('active');
        if (typeof Intro !== 'undefined') Intro.startTitle();
    }
};
