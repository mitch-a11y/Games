/* ============================================
   HANSE - Quest / Missions System
   5 Starter-Quests fuer neue Spieler
   ============================================ */

const Quests = {

    TEMPLATES: [
        {
            id: 'first_trade',
            name: 'Erster Handel',
            description: 'Kaufe oder verkaufe Waren in einer Stadt. Jeder grosse Kaufmann hat einmal klein angefangen.',
            icon: '\uD83D\uDCE6',
            reward: { gold: 500 },
            rewardText: '500 Gold',
            check(state) {
                return (state.player.totalTraded || 0) > 0;
            }
        },
        {
            id: 'visit_cities',
            name: 'Neue Horizonte',
            description: 'Segelt mit Euren Schiffen zu 3 verschiedenen Staedten, um neue Handelspartner zu finden.',
            icon: '\uD83D\uDDFA\uFE0F',
            reward: { gold: 800 },
            rewardText: '800 Gold',
            target: 3,
            check(state) {
                const visited = state.quests.progress.visit_cities || [];
                return visited.length >= 3;
            },
            progressText(state) {
                const visited = state.quests.progress.visit_cities || [];
                return `${visited.length} / 3 Staedte`;
            }
        },
        {
            id: 'fleet_expansion',
            name: 'Flottenausbau',
            description: 'Besitzt 2 Schiffe gleichzeitig. Eine groessere Flotte bedeutet mehr Profit!',
            icon: '\u2693',
            reward: { gold: 1000 },
            rewardText: '1.000 Gold',
            check(state) {
                return state.player.ships.length >= 2;
            },
            progressText(state) {
                return `${state.player.ships.length} / 2 Schiffe`;
            }
        },
        {
            id: 'second_kontor',
            name: 'Handelsimperium',
            description: 'Errichtet ein Kontor in einer anderen Stadt als Eurer Heimatstadt. Expandiert Euer Netzwerk!',
            icon: '\uD83C\uDFDB\uFE0F',
            reward: { gold: 1500 },
            rewardText: '1.500 Gold',
            check(state) {
                let kontorCount = 0;
                for (const cityId in state.cities) {
                    const buildings = state.cities[cityId].playerBuildings || [];
                    if (buildings.some(b => b.type === 'kontor')) {
                        kontorCount++;
                    }
                }
                return kontorCount >= 2;
            },
            progressText(state) {
                let kontorCount = 0;
                for (const cityId in state.cities) {
                    const buildings = state.cities[cityId].playerBuildings || [];
                    if (buildings.some(b => b.type === 'kontor')) {
                        kontorCount++;
                    }
                }
                return `${kontorCount} / 2 Kontore`;
            }
        },
        {
            id: 'wealthy_merchant',
            name: 'Reicher Kaufmann',
            description: 'Erreicht ein Gesamtvermoegen von 15.000 Gold. Investiert in Schiffe, Gebaeude und Waren!',
            icon: '\uD83D\uDCB0',
            reward: { gold: 2000 },
            rewardText: '2.000 Gold',
            check(state) {
                return Game.calculateNetWorth() >= 15000;
            },
            progressText(state) {
                const worth = Game.calculateNetWorth();
                return `${Utils.formatGold(worth)} / 15.000 Gold`;
            }
        }
    ],

    // Initialize quest state for a new game
    init(gameState) {
        gameState.quests = {
            active: {},    // questId -> { started: dateObj }
            completed: {}, // questId -> { completedAt: dateObj }
            progress: {}   // questId -> quest-specific progress data
        };

        // Activate all starter quests
        this.TEMPLATES.forEach(quest => {
            gameState.quests.active[quest.id] = {
                started: { ...gameState.date }
            };
        });

        // Initialize progress tracking
        gameState.quests.progress.visit_cities = [gameState.player.homeCity];
    },

    // Migrate old save games that don't have quest data
    migrate(gameState) {
        if (!gameState.quests) {
            this.init(gameState);

            // Retroactively check already-completed quests
            this.TEMPLATES.forEach(quest => {
                if (quest.check(gameState)) {
                    gameState.quests.completed[quest.id] = {
                        completedAt: { ...gameState.date }
                    };
                    delete gameState.quests.active[quest.id];
                }
            });
        }
        if (!gameState.quests.progress) {
            gameState.quests.progress = {};
        }
        if (!gameState.quests.progress.visit_cities) {
            // Reconstruct visited cities from current ship locations + home
            const visited = new Set();
            visited.add(gameState.player.homeCity);
            gameState.player.ships.forEach(s => {
                if (s.location) visited.add(s.location);
            });
            gameState.quests.progress.visit_cities = [...visited];
        }
    },

    // Track a city visit (called when a ship arrives)
    trackCityVisit(gameState, cityId) {
        if (!gameState.quests || !gameState.quests.progress) return;
        const visited = gameState.quests.progress.visit_cities || [];
        if (!visited.includes(cityId)) {
            visited.push(cityId);
            gameState.quests.progress.visit_cities = visited;
        }
    },

    // Check all active quests for completion (called periodically from game loop)
    checkQuests(gameState) {
        if (!gameState.quests) return [];

        const newlyCompleted = [];

        this.TEMPLATES.forEach(quest => {
            // Skip already completed or not yet active
            if (gameState.quests.completed[quest.id]) return;
            if (!gameState.quests.active[quest.id]) return;

            if (quest.check(gameState)) {
                // Mark as completed
                gameState.quests.completed[quest.id] = {
                    completedAt: { ...gameState.date }
                };
                delete gameState.quests.active[quest.id];

                // Grant reward
                if (quest.reward.gold) {
                    gameState.player.gold += quest.reward.gold;
                }

                newlyCompleted.push(quest);
            }
        });

        return newlyCompleted;
    },

    getActiveQuests(gameState) {
        if (!gameState.quests) return [];
        return this.TEMPLATES.filter(q => gameState.quests.active[q.id]);
    },

    getCompletedQuests(gameState) {
        if (!gameState.quests) return [];
        return this.TEMPLATES.filter(q => gameState.quests.completed[q.id]);
    }
};
