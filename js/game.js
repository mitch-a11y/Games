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
                daysPlayed: 0
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

        // Initialize quests
        Quests.init(this.state);

        // Initialize reputation system
        Reputation.init(this.state);

        this._isNewGame = true;
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

        // Start game loop
        this.gameLoop();

        // Offer tutorial for new games (not loads)
        if (this._isNewGame) {
            this._isNewGame = false;
            setTimeout(() => Tutorial.offer(), 600);
        }
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

        // Update markets (every 3 days)
        if (this.state.date.day % 3 === 0) {
            const diffMod = CONFIG.DIFFICULTY[this.state.difficulty].priceBonus;
            CITY_IDS.forEach(cityId => {
                Trading.updateMarket(this.state.cities[cityId], diffMod);
            });
        }

        // Change wind periodically
        if (this.state.date.day % 5 === 0) {
            this.state.wind.direction = (this.state.wind.direction + Utils.randInt(-1, 1) + 8) % 8;
            this.state.wind.strength = Utils.clamp(
                this.state.wind.strength + Utils.rand(-0.3, 0.3), 0.3, 3.0
            );
            UI.updateWind(this.state);
        }

        // Check events (skip if combat is active)
        this.state.eventCooldown--;
        if (!Combat.active && this.state.eventCooldown <= 0 && this.state.date.day % CONFIG.EVENT_CHECK_INTERVAL === 0) {
            const events = Events.checkEvents(this.state);
            events.forEach(evt => {
                // Combat events are handled by the Combat system (modal already shown)
                if (evt.template.type === 'combat' && Combat.active) {
                    UI.addLogMessage(evt.message, 'danger');
                    this.state.eventCooldown = 15;
                    return;
                }
                UI.addLogMessage(evt.message, evt.template.type === 'combat' ? 'danger' : 'event');
                if (evt.template.id === 'plague' || evt.template.id === 'fire') {
                    UI.showEventPopup(evt);
                    this.state.eventCooldown = 10;
                }
            });
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

        // Check quests periodically
        if (this.state.player.daysPlayed % 5 === 0) {
            const completed = Quests.checkQuests(this.state);
            completed.forEach(quest => {
                Reputation.onQuestComplete(this.state, quest);
                UI.addLogMessage(`Auftrag abgeschlossen: ${quest.name} - ${quest.rewardText} erhalten!`, 'event');
                UI.showQuestComplete(quest);
            });
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

            // Calculate speed with wind effect
            let speed = ship.speed * CONFIG.SHIP_SPEED_BASE;
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

        // Track city visit for quests
        Quests.trackCityVisit(this.state, dest);

        // Track city visit for reputation (first visit bonus)
        Reputation.onCityVisit(this.state, dest);

        UI.addLogMessage(`${ship.name} ist in ${CITIES_DATA[dest].displayName} angekommen.`, 'info');
        Sound.play('arrive');

        // Arrival particle effect
        GameMap.spawnArrivalParticles(dest);

        // Auto-select city
        if (GameMap.selectedCity !== dest) {
            GameMap.selectCity(dest);
        }
    },

    monthlyUpdate() {
        // Maintenance costs (with reputation discount)
        const maintenanceDiscount = Reputation.getMaintenanceDiscount(this.state);
        const rawShipMaint = this.state.player.ships.reduce(
            (sum, s) => sum + s.maintenance, 0
        );
        const rawBuildingMaint = Buildings.getMaintenanceCost(this.state);
        const shipMaintenance = Math.round(rawShipMaint * (1 - maintenanceDiscount));
        const buildingMaintenance = Math.round(rawBuildingMaint * (1 - maintenanceDiscount));
        const totalMaintenance = shipMaintenance + buildingMaintenance;

        if (totalMaintenance > 0) {
            this.state.player.gold -= totalMaintenance;
            const discountText = maintenanceDiscount > 0 ? ` (${Math.round(maintenanceDiscount * 100)}% Rang-Rabatt)` : '';
            UI.addLogMessage(
                `Monatliche Kosten: ${Utils.formatGold(totalMaintenance)} (Schiffe: ${shipMaintenance}, Gebaeude: ${buildingMaintenance})${discountText}`,
                'info'
            );
        }

        // Reputation monthly check (bankruptcy, gold milestones)
        Reputation.onMonthlyCheck(this.state);

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

        // Check for bankruptcy
        if (this.state.player.gold < -1000) {
            UI.showNotification('Achtung: Ihr seid hoch verschuldet!', 'danger');
            UI.addLogMessage('Warnung: Eure Schulden wachsen! Handelt, um sie zu tilgen.', 'danger');
        }
    },

    checkRankUp() {
        const result = Reputation.checkRankUp(this.state);
        if (result.promoted) {
            UI.showRepRankUp(result.oldRank, result.newRank);
            UI.addLogMessage(`Befoerderung! Ihr seid jetzt ${result.newRank.displayName}!`, 'event');
            Sound.play('newgame');
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
            Quests.migrate(this.state);
            Reputation.migrate(this.state);
            this.start();
            return true;
        } catch (e) {
            console.error('Load failed:', e);
            return false;
        }
    },

    // Return to title
    returnToTitle() {
        this.running = false;
        this.state = null;
        Sound.stopAmbient();
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('title-screen').classList.add('active');
        TitleCanvas.start();
    }
};
