/* ============================================
   HANSE - Reputation & Rank Progression System
   ============================================ */

const REPUTATION_RANKS = [
    {
        name: 'Kraemer',
        displayName: 'Kr\u00e4mer',
        minRep: 0,
        icon: '\uD83D\uDCE6',
        maxShips: 3,
        priceDiscount: 0,
        maintenanceDiscount: 0,
        unlockedShips: ['small_cog'],
        description: 'Ein bescheidener Anfang im Handelswesen'
    },
    {
        name: 'Haendler',
        displayName: 'H\u00e4ndler',
        minRep: 500,
        icon: '\u2696\uFE0F',
        maxShips: 4,
        priceDiscount: 0.02,
        maintenanceDiscount: 0.03,
        unlockedShips: ['small_cog', 'cog'],
        description: 'Ein anerkannter H\u00e4ndler der Hanse'
    },
    {
        name: 'Kaufmann',
        displayName: 'Kaufmann',
        minRep: 2000,
        icon: '\uD83D\uDCB0',
        maxShips: 5,
        priceDiscount: 0.04,
        maintenanceDiscount: 0.05,
        unlockedShips: ['small_cog', 'cog', 'hulk'],
        description: 'Ein wohlhabender Kaufmann mit gutem Ruf'
    },
    {
        name: 'Fernkaufmann',
        displayName: 'Fernkaufmann',
        minRep: 5000,
        icon: '\uD83D\uDDFA\uFE0F',
        maxShips: 6,
        priceDiscount: 0.06,
        maintenanceDiscount: 0.08,
        unlockedShips: ['small_cog', 'cog', 'hulk', 'caravel'],
        description: 'Euer Ruf reicht weit ueber die Grenzen'
    },
    {
        name: 'Ratsherr',
        displayName: 'Ratsherr',
        minRep: 10000,
        icon: '\uD83C\uDFDB\uFE0F',
        maxShips: 7,
        priceDiscount: 0.08,
        maintenanceDiscount: 0.10,
        unlockedShips: ['small_cog', 'cog', 'hulk', 'caravel', 'carrack'],
        description: 'Mitglied des Rates - Eure Stimme hat Gewicht'
    },
    {
        name: 'Patrizier',
        displayName: 'Patrizier',
        minRep: 25000,
        icon: '\uD83D\uDC51',
        maxShips: 8,
        priceDiscount: 0.10,
        maintenanceDiscount: 0.13,
        unlockedShips: ['small_cog', 'cog', 'hulk', 'caravel', 'carrack', 'warship'],
        description: 'Zur Elite der Stadt gehoerend'
    },
    {
        name: 'Buergermeister',
        displayName: 'B\u00fcrgermeister',
        minRep: 50000,
        icon: '\uD83C\uDFF0',
        maxShips: 9,
        priceDiscount: 0.12,
        maintenanceDiscount: 0.16,
        unlockedShips: ['small_cog', 'cog', 'hulk', 'caravel', 'carrack', 'warship'],
        description: 'Oberhaupt einer Hansestadt'
    },
    {
        name: 'Aeltermann',
        displayName: '\u00c4ltermann der Hanse',
        minRep: 100000,
        icon: '\u2B50',
        maxShips: 10,
        priceDiscount: 0.15,
        maintenanceDiscount: 0.20,
        unlockedShips: ['small_cog', 'cog', 'hulk', 'caravel', 'carrack', 'warship'],
        description: 'Der maechtigste Kaufmann der gesamten Hanse!'
    }
];

const Reputation = {
    // --- State accessors ---

    getState(gameState) {
        return gameState.player.rep;
    },

    getScore(gameState) {
        return gameState.player.rep ? gameState.player.rep.score : 0;
    },

    getRankIndex(gameState) {
        return gameState.player.rep ? gameState.player.rep.rankIndex : 0;
    },

    getRank(gameState) {
        return REPUTATION_RANKS[this.getRankIndex(gameState)];
    },

    getNextRank(gameState) {
        const idx = this.getRankIndex(gameState);
        return idx < REPUTATION_RANKS.length - 1 ? REPUTATION_RANKS[idx + 1] : null;
    },

    getProgressToNext(gameState) {
        const score = this.getScore(gameState);
        const rank = this.getRank(gameState);
        const next = this.getNextRank(gameState);
        if (!next) return 1.0;
        const range = next.minRep - rank.minRep;
        const progress = score - rank.minRep;
        return Math.min(1.0, progress / range);
    },

    // --- Initialization ---

    init(gameState) {
        gameState.player.rep = {
            score: 0,
            rankIndex: 0,
            history: [],
            visitedCities: [gameState.player.homeCity],
            goldMilestonesReached: 0
        };
        // Update player rank display name
        gameState.player.rank = REPUTATION_RANKS[0].displayName;
        gameState.player.rankIndex = 0;
    },

    // Migrate old saves
    migrate(gameState) {
        if (!gameState.player.rep) {
            this.init(gameState);
            // Give some starting rep based on existing progress
            const wealth = Game.calculateNetWorth();
            const milestones = Math.floor(wealth / 10000);
            if (milestones > 0) {
                gameState.player.rep.goldMilestonesReached = milestones;
                gameState.player.rep.score += milestones * 100;
            }
            // Credit visited cities
            if (gameState.quests && gameState.quests.progress && gameState.quests.progress.visit_cities) {
                gameState.player.rep.visitedCities = [...gameState.quests.progress.visit_cities];
                gameState.player.rep.score += (gameState.player.rep.visitedCities.length - 1) * 25;
            }
            // Credit existing buildings
            let buildingCount = 0;
            CITY_IDS.forEach(cityId => {
                const cityState = gameState.cities[cityId];
                if (cityState && cityState.playerBuildings) {
                    cityState.playerBuildings.forEach(b => {
                        buildingCount++;
                        if (b.type === 'church') {
                            gameState.player.rep.score += 75;
                        } else {
                            gameState.player.rep.score += 15;
                        }
                    });
                }
            });
            // Credit existing ships
            gameState.player.rep.score += gameState.player.ships.length * 10;
            // Credit existing trades
            if (gameState.player.totalTraded > 0) {
                gameState.player.rep.score += Math.min(500, Math.floor(gameState.player.totalTraded / 500));
            }
            // Recalculate rank
            this._recalcRank(gameState);
            this.addHistory(gameState, 'Reputation migriert', gameState.player.rep.score);
        }
        // Ensure all fields exist
        if (!gameState.player.rep.history) gameState.player.rep.history = [];
        if (!gameState.player.rep.visitedCities) gameState.player.rep.visitedCities = [];
        if (gameState.player.rep.goldMilestonesReached === undefined) gameState.player.rep.goldMilestonesReached = 0;
    },

    // --- Core reputation modification ---

    addRep(gameState, amount, reason) {
        if (!gameState.player.rep) return;
        gameState.player.rep.score = Math.max(0, gameState.player.rep.score + amount);
        this.addHistory(gameState, reason, amount);
        // Rank-up is checked via Game.checkRankUp() in the game tick
    },

    addHistory(gameState, reason, amount) {
        if (!gameState.player.rep) return;
        gameState.player.rep.history.unshift({
            text: reason,
            amount: amount,
            date: { ...gameState.date }
        });
        // Keep last 50 entries
        if (gameState.player.rep.history.length > 50) {
            gameState.player.rep.history.length = 50;
        }
    },

    // --- Rank checking ---

    checkRankUp(gameState) {
        const rep = gameState.player.rep;
        const oldIndex = rep.rankIndex;

        this._recalcRank(gameState);

        if (rep.rankIndex > oldIndex) {
            const oldRank = REPUTATION_RANKS[oldIndex];
            const newRank = REPUTATION_RANKS[rep.rankIndex];
            gameState.player.rank = newRank.displayName;
            gameState.player.rankIndex = rep.rankIndex;
            return { promoted: true, oldRank, newRank };
        }
        return { promoted: false };
    },

    _recalcRank(gameState) {
        const rep = gameState.player.rep;
        for (let i = REPUTATION_RANKS.length - 1; i >= 0; i--) {
            if (rep.score >= REPUTATION_RANKS[i].minRep) {
                rep.rankIndex = i;
                gameState.player.rank = REPUTATION_RANKS[i].displayName;
                gameState.player.rankIndex = i;
                break;
            }
        }
    },

    // --- Reputation earning triggers ---

    onCityVisit(gameState, cityId) {
        if (!gameState.player.rep) return;
        const visited = gameState.player.rep.visitedCities;
        if (!visited.includes(cityId)) {
            visited.push(cityId);
            const cityName = CITIES_DATA[cityId] ? CITIES_DATA[cityId].displayName : cityId;
            this.addRep(gameState, 25, `${cityName} erstmals besucht`);
            return true;
        }
        return false;
    },

    onTrade(gameState, revenue) {
        if (!gameState.player.rep) return;
        // +2 base per transaction
        this.addRep(gameState, 2, 'Handelsabschluss');
        // +5-20 bonus based on transaction size
        if (revenue > 0) {
            const bonus = Utils.clamp(Math.floor(revenue / 100), 5, 20);
            if (bonus >= 5) {
                this.addRep(gameState, bonus, `Erfolgreicher Handel (${Utils.formatGold(revenue)})`);
            }
        }
    },

    onBuild(gameState, typeId, cityId) {
        if (!gameState.player.rep) return;
        const cityName = CITIES_DATA[cityId] ? CITIES_DATA[cityId].displayName : cityId;
        if (typeId === 'church') {
            this.addRep(gameState, 75, `Kirche in ${cityName} errichtet`);
        } else {
            const typeName = BUILDING_TYPES[typeId] ? BUILDING_TYPES[typeId].name : typeId;
            this.addRep(gameState, 15, `${typeName} in ${cityName} gebaut`);
        }
    },

    onQuestComplete(gameState, quest) {
        if (!gameState.player.rep) return;
        const repReward = Math.max(50, Math.min(200, Math.floor((quest.reward.gold || 500) / 10)));
        this.addRep(gameState, repReward, `Auftrag: ${quest.name}`);
    },

    onShipAcquired(gameState) {
        if (!gameState.player.rep) return;
        this.addRep(gameState, 10, 'Neues Schiff erworben');
    },

    onShipLost(gameState, shipName) {
        if (!gameState.player.rep) return;
        this.addRep(gameState, -30, `${shipName} verloren`);
    },

    // Called monthly from game loop
    onMonthlyCheck(gameState) {
        if (!gameState.player.rep) return;

        // Bankruptcy penalty: gold < 500
        if (gameState.player.gold < 500) {
            this.addRep(gameState, -20, 'Nahe am Bankrott');
        }

        // Gold milestones: +100 per 10000 gold net worth
        const netWorth = Game.calculateNetWorth();
        const milestones = Math.floor(netWorth / 10000);
        const reached = gameState.player.rep.goldMilestonesReached;
        if (milestones > reached) {
            const newMilestones = milestones - reached;
            gameState.player.rep.goldMilestonesReached = milestones;
            this.addRep(gameState, newMilestones * 100, `Vermoegensmeilenstein: ${Utils.formatGold(milestones * 10000)}`);
        }
    },

    onBuildingDestroyed(gameState) {
        if (!gameState.player.rep) return;
        this.addRep(gameState, -10, 'Gebaeude zerstoert');
    },

    // --- Rank benefits ---

    getPriceDiscount(gameState) {
        const rank = this.getRank(gameState);
        return rank ? rank.priceDiscount : 0;
    },

    getMaintenanceDiscount(gameState) {
        const rank = this.getRank(gameState);
        return rank ? rank.maintenanceDiscount : 0;
    },

    getMaxShips(gameState) {
        const rank = this.getRank(gameState);
        return rank ? rank.maxShips : 3;
    },

    getUnlockedShips(gameState) {
        const rank = this.getRank(gameState);
        return rank ? rank.unlockedShips : ['small_cog'];
    },

    isShipUnlocked(gameState, typeId) {
        return this.getUnlockedShips(gameState).includes(typeId);
    }
};
