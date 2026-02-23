/* ============================================
   HANSE - Diplomacy & Reputation System
   ============================================ */

const REPUTATION_LEVELS = [
    { name: 'Unbekannt',     min: 0,   icon: '⚪', color: '#6a7a90', priceBonus: 0,    taxReduction: 0 },
    { name: 'Bekannt',       min: 10,  icon: '🟡', color: '#e8a020', priceBonus: 0.02, taxReduction: 0 },
    { name: 'Angesehen',     min: 25,  icon: '🟢', color: '#2eac68', priceBonus: 0.05, taxReduction: 0.1 },
    { name: 'Ehrenwert',     min: 50,  icon: '🔵', color: '#3498db', priceBonus: 0.08, taxReduction: 0.2 },
    { name: 'Ratsfreund',    min: 75,  icon: '🟣', color: '#8e44ad', priceBonus: 0.12, taxReduction: 0.3 },
    { name: 'Ehrenbuerger',  min: 100, icon: '👑', color: '#ffd700', priceBonus: 0.15, taxReduction: 0.5 }
];

const DIPLOMATIC_ACTIONS = {
    donate: {
        id: 'donate',
        name: 'Spende an die Armen',
        icon: '🪙',
        cost: 500,
        repGain: 3,
        cooldown: 0, // can repeat
        description: 'Spendet Gold an die Armen der Stadt'
    },
    festival: {
        id: 'festival',
        name: 'Fest ausrichten',
        icon: '🎉',
        cost: 2000,
        repGain: 8,
        cooldown: 30, // 30 days
        description: 'Richtet ein praechtiges Fest fuer die Buerger aus'
    },
    church_donation: {
        id: 'church_donation',
        name: 'Kirchenspende',
        icon: '⛪',
        cost: 3000,
        repGain: 12,
        cooldown: 60,
        description: 'Grosszuegige Spende an die Kirche'
    },
    trade_agreement: {
        id: 'trade_agreement',
        name: 'Handelsabkommen',
        icon: '📜',
        cost: 5000,
        repGain: 15,
        cooldown: 90,
        minRep: 25, // need Angesehen
        description: 'Formelles Handelsabkommen mit dem Stadtrat'
    },
    guild_membership: {
        id: 'guild_membership',
        name: 'Gildenmitgliedschaft',
        icon: '🏛️',
        cost: 10000,
        repGain: 25,
        cooldown: 0, // one-time
        oneTime: true,
        minRep: 50,
        description: 'Werdet Mitglied der Kaufmannsgilde'
    }
};

const Diplomacy = {
    // Get reputation level info for a value
    getLevel(repValue) {
        let level = REPUTATION_LEVELS[0];
        for (let i = REPUTATION_LEVELS.length - 1; i >= 0; i--) {
            if (repValue >= REPUTATION_LEVELS[i].min) {
                level = REPUTATION_LEVELS[i];
                break;
            }
        }
        return level;
    },

    // Get next reputation level
    getNextLevel(repValue) {
        for (let i = 0; i < REPUTATION_LEVELS.length; i++) {
            if (repValue < REPUTATION_LEVELS[i].min) return REPUTATION_LEVELS[i];
        }
        return null; // max level
    },

    // Get price bonus from reputation in a city
    getPriceBonus(gameState, cityId) {
        const rep = (gameState.player.reputation[cityId] || 0);
        return this.getLevel(rep).priceBonus;
    },

    // Get available diplomatic actions for a city
    getAvailableActions(gameState, cityId) {
        const player = gameState.player;
        const rep = player.reputation[cityId] || 0;
        const cityState = gameState.cities[cityId];

        return Object.values(DIPLOMATIC_ACTIONS).map(action => {
            let available = true;
            let reason = '';

            // Check gold
            if (player.gold < action.cost) {
                available = false;
                reason = 'Nicht genug Gold';
            }

            // Check min reputation
            if (action.minRep && rep < action.minRep) {
                available = false;
                const needed = this.getLevel(action.minRep);
                reason = `Benötigt Status: ${needed.name}`;
            }

            // Check cooldown
            if (action.cooldown > 0) {
                const lastUsed = (player._diplomacyCooldowns || {})[`${cityId}_${action.id}`];
                if (lastUsed) {
                    const daysSince = this._daysSince(gameState.date, lastUsed);
                    if (daysSince < action.cooldown) {
                        available = false;
                        reason = `Noch ${action.cooldown - daysSince} Tage Wartezeit`;
                    }
                }
            }

            // Check one-time
            if (action.oneTime) {
                const done = (player._diplomacyDone || {})[`${cityId}_${action.id}`];
                if (done) {
                    available = false;
                    reason = 'Bereits durchgefuehrt';
                }
            }

            // Check kontor requirement
            const hasKontor = (cityState.playerBuildings || []).some(b => b.type === 'kontor');
            if (!hasKontor) {
                available = false;
                reason = 'Handelskontor benoetigt';
            }

            return { ...action, available, reason };
        });
    },

    // Perform a diplomatic action
    performAction(gameState, cityId, actionId) {
        const action = DIPLOMATIC_ACTIONS[actionId];
        if (!action) return { success: false, message: 'Unbekannte Aktion' };

        const player = gameState.player;
        const available = this.getAvailableActions(gameState, cityId);
        const check = available.find(a => a.id === actionId);

        if (!check || !check.available) {
            return { success: false, message: check ? check.reason : 'Nicht verfuegbar' };
        }

        // Deduct cost
        player.gold -= action.cost;

        // Add reputation
        if (!player.reputation[cityId]) player.reputation[cityId] = 0;
        player.reputation[cityId] += action.repGain;

        // Also add to city reputation
        const cityState = gameState.cities[cityId];
        cityState.reputation = (cityState.reputation || 0) + action.repGain;

        // Set cooldown
        if (action.cooldown > 0) {
            if (!player._diplomacyCooldowns) player._diplomacyCooldowns = {};
            player._diplomacyCooldowns[`${cityId}_${actionId}`] = { ...gameState.date };
        }

        // Mark one-time
        if (action.oneTime) {
            if (!player._diplomacyDone) player._diplomacyDone = {};
            player._diplomacyDone[`${cityId}_${actionId}`] = true;
        }

        const level = this.getLevel(player.reputation[cityId]);
        return {
            success: true,
            message: `${action.name} in ${CITIES_DATA[cityId].displayName}! Reputation +${action.repGain} (${level.icon} ${level.name})`,
            newRep: player.reputation[cityId],
            level
        };
    },

    // Monthly reputation decay/growth
    monthlyProcess(gameState) {
        const player = gameState.player;

        CITY_IDS.forEach(cityId => {
            if (!player.reputation[cityId]) return;
            const cityState = gameState.cities[cityId];
            const hasKontor = (cityState.playerBuildings || []).some(b => b.type === 'kontor');
            const hasChurch = (cityState.playerBuildings || []).some(b => b.type === 'church');

            if (hasKontor) {
                // Active presence: slow growth
                player.reputation[cityId] += 1;
                if (hasChurch) player.reputation[cityId] += 1;
            } else if (player.reputation[cityId] > 5) {
                // No presence: slow decay
                player.reputation[cityId] -= 1;
            }

            // Cap
            player.reputation[cityId] = Math.max(0, Math.min(150, player.reputation[cityId]));
        });
    },

    // Reputation gain from trading
    onTrade(gameState, cityId, tradeVolume) {
        const player = gameState.player;
        if (!player.reputation[cityId]) player.reputation[cityId] = 0;
        // Small rep gain per trade, scaled by volume
        const gain = Math.min(2, Math.floor(tradeVolume / 1000));
        if (gain > 0) {
            player.reputation[cityId] += gain;
            player.reputation[cityId] = Math.min(150, player.reputation[cityId]);
        }
    },

    _daysSince(current, past) {
        const c = current.year * 360 + current.month * 30 + current.day;
        const p = past.year * 360 + past.month * 30 + past.day;
        return c - p;
    }
};
