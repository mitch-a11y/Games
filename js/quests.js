/* ============================================
   HANSE - Quest / Missions System
   ============================================ */

const QUEST_TEMPLATES = [
    // Delivery quests
    {
        type: 'delivery',
        titleTemplate: '{good} nach {city} liefern',
        descTemplate: 'Ein Haendler in {city} benoetigt dringend {amount} {good}.',
        generate(gameState) {
            const goodId = GOOD_IDS[Utils.randInt(0, GOOD_IDS.length - 1)];
            const good = GOODS[goodId];
            const targetCity = CITY_IDS[Utils.randInt(0, CITY_IDS.length - 1)];
            if (targetCity === gameState.player.homeCity) return null;
            const amount = Utils.randInt(5, 25);
            const reward = Math.floor(amount * good.basePrice * Utils.rand(1.5, 2.5));
            const repReward = Utils.randInt(3, 8);
            const deadline = Utils.randInt(30, 90); // days
            return {
                goodId, amount, targetCity, reward, repReward, deadline,
                title: `${amount} ${good.name} nach ${CITIES_DATA[targetCity].displayName}`,
                description: `Liefert ${amount} ${good.icon} ${good.name} nach ${CITIES_DATA[targetCity].displayName}. Belohnung: ${Utils.formatGold(reward)} + ${repReward} Ansehen.`,
                checkComplete(gs, quest) {
                    // Check if player has a ship docked at target with enough cargo
                    const ships = gs.player.ships.filter(s => s.location === quest.targetCity);
                    const totalCargo = ships.reduce((sum, s) => sum + (s.cargo[quest.goodId] || 0), 0);
                    return totalCargo >= quest.amount;
                },
                onComplete(gs, quest) {
                    // Remove goods from ship cargo
                    let remaining = quest.amount;
                    gs.player.ships.forEach(s => {
                        if (s.location === quest.targetCity && remaining > 0) {
                            const has = s.cargo[quest.goodId] || 0;
                            const take = Math.min(has, remaining);
                            s.cargo[quest.goodId] -= take;
                            if (s.cargo[quest.goodId] <= 0) delete s.cargo[quest.goodId];
                            remaining -= take;
                        }
                    });
                }
            };
        }
    },
    // Trade profit quest
    {
        type: 'profit',
        generate(gameState) {
            const target = Utils.randInt(2000, 10000);
            const deadline = Utils.randInt(60, 120);
            const reward = Math.floor(target * Utils.rand(0.3, 0.5));
            return {
                profitTarget: target, reward, deadline,
                repReward: Utils.randInt(5, 12),
                profitSoFar: 0,
                title: `${Utils.formatGold(target)} Handelsprofit erzielen`,
                description: `Erwirtschaftet ${Utils.formatGold(target)} Gewinn durch Handel. Belohnung: ${Utils.formatGold(reward)}.`,
                checkComplete(gs, quest) {
                    return quest.profitSoFar >= quest.profitTarget;
                },
                onComplete() {}
            };
        }
    },
    // Build quest
    {
        type: 'build',
        generate(gameState) {
            const buildingTypes = ['brewery', 'workshop', 'weaver', 'saltworks', 'fishery', 'mill'];
            const typeId = buildingTypes[Utils.randInt(0, buildingTypes.length - 1)];
            const bType = BUILDING_TYPES[typeId];
            const targetCity = CITY_IDS[Utils.randInt(0, CITY_IDS.length - 1)];
            const reward = Math.floor(bType.cost * Utils.rand(0.5, 0.8));
            return {
                buildingType: typeId, targetCity, reward,
                repReward: Utils.randInt(5, 15),
                deadline: Utils.randInt(60, 180),
                title: `${bType.name} in ${CITIES_DATA[targetCity].displayName} errichten`,
                description: `Baut eine ${bType.icon} ${bType.name} in ${CITIES_DATA[targetCity].displayName}. Belohnung: ${Utils.formatGold(reward)}.`,
                checkComplete(gs, quest) {
                    const cityState = gs.cities[quest.targetCity];
                    return (cityState.playerBuildings || []).some(b => b.type === quest.buildingType);
                },
                onComplete() {}
            };
        }
    },
    // Reputation quest
    {
        type: 'reputation',
        generate(gameState) {
            const targetCity = CITY_IDS[Utils.randInt(0, CITY_IDS.length - 1)];
            const targetRep = Utils.randInt(25, 50);
            const reward = Utils.randInt(3000, 8000);
            return {
                targetCity, targetRep, reward,
                repReward: 0,
                deadline: Utils.randInt(90, 180),
                title: `Ansehen ${targetRep} in ${CITIES_DATA[targetCity].displayName} erreichen`,
                description: `Steigert euer Ansehen in ${CITIES_DATA[targetCity].displayName} auf ${targetRep}. Belohnung: ${Utils.formatGold(reward)}.`,
                checkComplete(gs, quest) {
                    return (gs.player.reputation[quest.targetCity] || 0) >= quest.targetRep;
                },
                onComplete() {}
            };
        }
    },
    // Exploration quest
    {
        type: 'explore',
        generate(gameState) {
            const citiesToVisit = Utils.randInt(3, 5);
            const allCities = [...CITY_IDS].sort(() => Math.random() - 0.5).slice(0, citiesToVisit);
            const reward = citiesToVisit * Utils.randInt(500, 1000);
            return {
                cities: allCities, visitedCities: [], reward,
                repReward: Utils.randInt(3, 6),
                deadline: Utils.randInt(60, 120),
                title: `${citiesToVisit} Staedte besuchen`,
                description: `Besucht: ${allCities.map(c => CITIES_DATA[c].displayName).join(', ')}. Belohnung: ${Utils.formatGold(reward)}.`,
                checkComplete(gs, quest) {
                    return quest.visitedCities.length >= quest.cities.length;
                },
                onComplete() {}
            };
        }
    }
];

const Quests = {
    // Initialize quest state
    ensureQuestState(player) {
        if (!player.quests) player.quests = { active: [], completed: 0, failed: 0 };
    },

    // Generate a new quest
    generateQuest(gameState) {
        const template = QUEST_TEMPLATES[Utils.randInt(0, QUEST_TEMPLATES.length - 1)];
        const questData = template.generate(gameState);
        if (!questData) return null;

        return {
            id: Utils.uid(),
            type: template.type,
            ...questData,
            startDate: { ...gameState.date },
            daysRemaining: questData.deadline,
            status: 'active'
        };
    },

    // Get available quests to accept (generate fresh ones)
    getAvailableQuests(gameState) {
        this.ensureQuestState(gameState.player);
        // Generate 3 quest offers
        const offers = [];
        let attempts = 0;
        while (offers.length < 3 && attempts < 10) {
            const quest = this.generateQuest(gameState);
            if (quest && !offers.some(q => q.type === quest.type)) {
                offers.push(quest);
            }
            attempts++;
        }
        return offers;
    },

    // Accept a quest
    acceptQuest(gameState, quest) {
        const player = gameState.player;
        this.ensureQuestState(player);

        if (player.quests.active.length >= 3) {
            return { success: false, message: 'Maximal 3 aktive Auftraege gleichzeitig!' };
        }

        player.quests.active.push(quest);
        return { success: true, message: `Auftrag angenommen: ${quest.title}` };
    },

    // Abandon a quest
    abandonQuest(gameState, questId) {
        const player = gameState.player;
        this.ensureQuestState(player);
        player.quests.active = player.quests.active.filter(q => q.id !== questId);
        player.quests.failed++;
        return { success: true, message: 'Auftrag aufgegeben.' };
    },

    // Daily check: update timers, check completion, handle expiry
    dailyUpdate(gameState) {
        const player = gameState.player;
        this.ensureQuestState(player);

        const completedQuests = [];
        const expiredQuests = [];

        player.quests.active.forEach(quest => {
            quest.daysRemaining--;

            // Check explore quest: mark visited cities
            if (quest.type === 'explore' && quest.cities) {
                player.ships.forEach(s => {
                    if (s.location && quest.cities.includes(s.location) && !quest.visitedCities.includes(s.location)) {
                        quest.visitedCities.push(s.location);
                    }
                });
            }

            // Check profit quest: track from trade
            // (profit tracking happens in onTrade hook)

            // Check completion
            if (quest.checkComplete && quest.checkComplete(gameState, quest)) {
                completedQuests.push(quest);
            } else if (quest.daysRemaining <= 0) {
                expiredQuests.push(quest);
            }
        });

        // Complete quests
        completedQuests.forEach(quest => {
            if (quest.onComplete) quest.onComplete(gameState, quest);
            player.gold += quest.reward;
            player.quests.completed++;

            // Rep reward
            if (quest.repReward && quest.targetCity) {
                player.reputation[quest.targetCity] = (player.reputation[quest.targetCity] || 0) + quest.repReward;
            } else if (quest.repReward) {
                // Give to home city
                player.reputation[player.homeCity] = (player.reputation[player.homeCity] || 0) + quest.repReward;
            }

            player.quests.active = player.quests.active.filter(q => q.id !== quest.id);
            UI.addLogMessage(`Auftrag erfuellt: ${quest.title} (+${Utils.formatGold(quest.reward)})`, 'trade');
            UI.showNotification(`Auftrag erfuellt! +${Utils.formatGold(quest.reward)}`, 'success');
            Sound.play('coins');
        });

        // Expire quests
        expiredQuests.forEach(quest => {
            player.quests.active = player.quests.active.filter(q => q.id !== quest.id);
            player.quests.failed++;
            UI.addLogMessage(`Auftrag gescheitert: ${quest.title}`, 'danger');
            UI.showNotification(`Auftrag abgelaufen: ${quest.title}`, 'warning');
        });
    },

    // Track profit for profit quests
    onTrade(gameState, profit) {
        const player = gameState.player;
        this.ensureQuestState(player);
        player.quests.active.forEach(quest => {
            if (quest.type === 'profit' && quest.profitSoFar !== undefined) {
                quest.profitSoFar += Math.max(0, profit);
            }
        });
    }
};
