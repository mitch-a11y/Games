/* ============================================
   HANSE - Pirate Encounter & Naval Combat System
   ============================================ */

// Pirate fleet templates with increasing difficulty
const PIRATE_TYPES = [
    {
        id: 'scouts',
        name: 'Piratenspaeher',
        icon: '\u2694\uFE0F',
        description: 'Eine kleine Piratenschaluppe auf Beutezug',
        hull: 25,
        maxHull: 25,
        cannons: 1,
        crew: 10,
        speed: 4,
        aggression: 0.4,
        minGold: 30,
        maxGold: 120,
        fleeThreshold: 0.6
    },
    {
        id: 'raiders',
        name: 'Kaperbande',
        icon: '\uD83C\uDFF4\u200D\u2620\uFE0F',
        description: 'Erfahrene Piraten in einer bewaffneten Kogge',
        hull: 45,
        maxHull: 45,
        cannons: 3,
        crew: 20,
        speed: 3,
        aggression: 0.6,
        minGold: 80,
        maxGold: 300,
        fleeThreshold: 0.4
    },
    {
        id: 'warband',
        name: 'Piratenflotte',
        icon: '\uD83D\uDDE1\uFE0F',
        description: 'Mehrere schwer bewaffnete Piratenschiffe',
        hull: 70,
        maxHull: 70,
        cannons: 6,
        crew: 35,
        speed: 2.5,
        aggression: 0.8,
        minGold: 200,
        maxGold: 600,
        fleeThreshold: 0.25
    },
    {
        id: 'dread',
        name: 'Schwarze Flotte',
        icon: '\u2620\uFE0F',
        description: 'Die gefuerchtete Schwarze Flotte - Schrecken der Ostsee!',
        hull: 100,
        maxHull: 100,
        cannons: 10,
        crew: 50,
        speed: 3,
        aggression: 0.95,
        minGold: 400,
        maxGold: 1000,
        fleeThreshold: 0.15
    }
];

// Pirate captain names for flavor
const PIRATE_NAMES = [
    'Klaus Stoertebeker', 'Gödeke Michels', 'Hennig Wichmann',
    'Magister Wigbold', 'Nikolaus Mansen', 'Marquard Pansen',
    'Heino Wansen', 'Johann Stortebeker', 'Keno tom Bansen',
    'Erich der Rote', 'Sven Schwarzbart', 'Dietrich Freibeuter'
];

const Combat = {
    active: false,
    state: null,

    // Generate a pirate encounter for a ship
    generateEncounter(ship, gameState) {
        // Select pirate type based on player rank and ship value
        const rankIndex = Reputation.getRankIndex(gameState);
        const shipValue = SHIP_TYPES[ship.typeId].cost;

        // Higher ranks and more valuable ships attract stronger pirates
        let tierWeights;
        if (rankIndex <= 1) {
            tierWeights = [0.7, 0.25, 0.05, 0];
        } else if (rankIndex <= 3) {
            tierWeights = [0.3, 0.4, 0.25, 0.05];
        } else {
            tierWeights = [0.1, 0.25, 0.4, 0.25];
        }

        // Ship value modifier - big ships attract bigger pirates
        if (shipValue >= 12000) {
            tierWeights[3] += 0.15;
            tierWeights[0] -= 0.1;
        }

        // Difficulty modifier
        const diffMod = CONFIG.DIFFICULTY[gameState.difficulty].eventChance;
        if (diffMod > 1) {
            tierWeights[2] += 0.1;
            tierWeights[3] += 0.05;
        }

        // Normalize weights
        const totalWeight = tierWeights.reduce((a, b) => a + b, 0);
        const roll = Math.random() * totalWeight;
        let cumulative = 0;
        let selectedTier = 0;
        for (let i = 0; i < tierWeights.length; i++) {
            cumulative += tierWeights[i];
            if (roll <= cumulative) {
                selectedTier = i;
                break;
            }
        }

        const pirateTemplate = PIRATE_TYPES[selectedTier];
        const pirateName = Utils.pick(PIRATE_NAMES);

        // Scale pirate stats slightly with randomness
        const scaleFactor = Utils.rand(0.85, 1.15);

        return {
            pirate: {
                ...pirateTemplate,
                hull: Math.round(pirateTemplate.hull * scaleFactor),
                maxHull: Math.round(pirateTemplate.maxHull * scaleFactor),
                cannons: Math.max(1, Math.round(pirateTemplate.cannons * scaleFactor)),
                crew: Math.max(5, Math.round(pirateTemplate.crew * scaleFactor)),
                captainName: pirateName,
                bounty: Utils.randInt(pirateTemplate.minGold, pirateTemplate.maxGold)
            },
            ship: ship,
            round: 0,
            log: [],
            playerFired: false,
            resolved: false,
            outcome: null // 'victory', 'defeat', 'fled', 'surrendered'
        };
    },

    // Start a combat encounter - pauses game and shows combat UI
    startCombat(ship, gameState) {
        const encounter = this.generateEncounter(ship, gameState);
        this.active = true;
        this.state = encounter;

        // Pause the game during combat
        Game.paused = true;

        // Show the combat modal
        this.renderCombatUI(gameState);

        // Play combat start sound
        Sound.play('combat_start');
    },

    // Calculate damage from an attack
    calculateDamage(attackerCannons, attackerCrew, defenderHull) {
        // Base damage from cannons
        let damage = 0;
        for (let i = 0; i < attackerCannons; i++) {
            if (Math.random() < 0.65) { // 65% hit chance per cannon
                damage += Utils.randInt(3, 8);
            }
        }

        // Crew boarding bonus (small)
        if (attackerCrew > 15 && Math.random() < 0.3) {
            damage += Utils.randInt(2, 5);
        }

        return Math.max(1, damage);
    },

    // Player fires cannons
    doFireCannons(gameState) {
        if (!this.active || !this.state || this.state.resolved) return;

        const combat = this.state;
        const ship = combat.ship;
        const pirate = combat.pirate;

        combat.round++;

        // Player attacks
        const playerDamage = this.calculateDamage(ship.cannons, ship.crew, pirate.hull);
        pirate.hull = Math.max(0, pirate.hull - playerDamage);

        combat.log.push({
            type: 'player_attack',
            text: `${ship.name} feuert! ${playerDamage} Schaden an den Piraten.`
        });

        // Check if pirates are defeated
        if (pirate.hull <= 0) {
            this.resolveVictory(gameState);
            this.renderCombatUI(gameState);
            return;
        }

        // Pirates may flee if badly damaged
        if (pirate.hull / pirate.maxHull < pirate.fleeThreshold && Math.random() < 0.5) {
            combat.log.push({
                type: 'pirate_flee',
                text: 'Die Piraten ziehen sich zurueck! Sie haben genug!'
            });
            this.resolveVictory(gameState);
            this.renderCombatUI(gameState);
            return;
        }

        // Pirates counterattack
        const pirateDamage = this.calculateDamage(pirate.cannons, pirate.crew, ship.hull);
        ship.hull = Math.max(1, ship.hull - pirateDamage);

        combat.log.push({
            type: 'pirate_attack',
            text: `Piraten feuern zurueck! ${pirateDamage} Schaden an ${ship.name}.`
        });

        if (ship.hull < ship.maxHull * 0.3) {
            ship.damaged = true;
        }

        // Check if player ship is critically damaged
        if (ship.hull <= 1) {
            this.resolveDefeat(gameState);
            this.renderCombatUI(gameState);
            return;
        }

        Sound.play('combat_cannon');
        this.renderCombatUI(gameState);
    },

    // Player attempts to flee
    doFlee(gameState) {
        if (!this.active || !this.state || this.state.resolved) return;

        const combat = this.state;
        const ship = combat.ship;
        const pirate = combat.pirate;

        combat.round++;

        // Flee chance based on ship speed vs pirate speed, hull condition
        const speedRatio = ship.speed / pirate.speed;
        const hullFactor = ship.hull / ship.maxHull;
        let fleeChance = 0.3 + (speedRatio - 1) * 0.3 + hullFactor * 0.1;

        // Wind bonus
        fleeChance += Utils.rand(-0.05, 0.1);

        // Caravel gets a flee bonus (fast ship)
        if (ship.typeId === 'caravel') fleeChance += 0.15;

        fleeChance = Utils.clamp(fleeChance, 0.1, 0.85);

        if (Math.random() < fleeChance) {
            combat.log.push({
                type: 'flee_success',
                text: `${ship.name} entkommt den Piraten!`
            });
            combat.resolved = true;
            combat.outcome = 'fled';
            Sound.play('sail');
        } else {
            combat.log.push({
                type: 'flee_fail',
                text: 'Fluchtversuch fehlgeschlagen! Die Piraten holen auf!'
            });

            // Pirates get a free attack on a failed flee
            const pirateDamage = this.calculateDamage(
                Math.ceil(pirate.cannons * 0.7), pirate.crew, ship.hull
            );
            ship.hull = Math.max(1, ship.hull - pirateDamage);

            combat.log.push({
                type: 'pirate_attack',
                text: `Piraten nutzen die Gelegenheit! ${pirateDamage} Schaden an ${ship.name}.`
            });

            if (ship.hull < ship.maxHull * 0.3) {
                ship.damaged = true;
            }

            if (ship.hull <= 1) {
                this.resolveDefeat(gameState);
            }

            Sound.play('combat_cannon');
        }

        this.renderCombatUI(gameState);
    },

    // Player surrenders and pays tribute
    doSurrender(gameState) {
        if (!this.active || !this.state || this.state.resolved) return;

        const combat = this.state;
        const ship = combat.ship;
        const pirate = combat.pirate;

        combat.resolved = true;
        combat.outcome = 'surrendered';

        // Pirates take gold
        const goldDemand = Math.min(
            Utils.randInt(pirate.bounty * 0.3, pirate.bounty * 0.8),
            Math.floor(gameState.player.gold * 0.3)
        );
        const goldTaken = Math.min(goldDemand, gameState.player.gold);
        gameState.player.gold -= goldTaken;

        combat.log.push({
            type: 'surrender',
            text: `Ihr uebergebt ${Utils.formatGold(goldTaken)} an die Piraten.`
        });

        // Pirates take some cargo (30-50%)
        const cargoLost = [];
        const goodIds = Object.keys(ship.cargo);
        goodIds.forEach(goodId => {
            if (Math.random() < pirate.aggression) {
                const lostAmt = Math.floor(ship.cargo[goodId] * Utils.rand(0.2, 0.5));
                if (lostAmt > 0) {
                    removeCargo(ship, goodId, lostAmt);
                    cargoLost.push(`${lostAmt} ${GOODS[goodId].name}`);
                }
            }
        });

        if (cargoLost.length > 0) {
            combat.log.push({
                type: 'cargo_lost',
                text: `Fracht geplundert: ${cargoLost.join(', ')}`
            });
        }

        // Reputation loss for surrendering
        Reputation.addRep(gameState, -15, 'Piraten Tribut gezahlt');

        Sound.play('danger');
        this.renderCombatUI(gameState);
    },

    // Resolve a victory
    resolveVictory(gameState) {
        const combat = this.state;
        const pirate = combat.pirate;

        combat.resolved = true;
        combat.outcome = 'victory';

        // Gold reward
        const goldReward = pirate.bounty;
        gameState.player.gold += goldReward;

        combat.log.push({
            type: 'victory',
            text: `Sieg! Ihr erbeutet ${Utils.formatGold(goldReward)} von den Piraten!`
        });

        // Chance to capture pirate goods
        const lootChance = 0.4 + (pirate.maxHull > 50 ? 0.2 : 0);
        if (Math.random() < lootChance) {
            const lootGood = Utils.pick(GOOD_IDS);
            const lootAmt = Utils.randInt(3, Math.floor(pirate.crew / 2));
            const added = addCargo(combat.ship, lootGood, lootAmt);
            if (added > 0) {
                combat.log.push({
                    type: 'loot',
                    text: `Beute gefunden: ${added} ${GOODS[lootGood].name}!`
                });
            }
        }

        // Reputation gain for defeating pirates
        const repGain = 10 + PIRATE_TYPES.findIndex(p => p.id === pirate.id) * 15;
        Reputation.addRep(gameState, repGain, `${pirate.name} besiegt`);

        Sound.play('combat_victory');
    },

    // Resolve a defeat
    resolveDefeat(gameState) {
        const combat = this.state;
        const ship = combat.ship;
        const pirate = combat.pirate;

        combat.resolved = true;
        combat.outcome = 'defeat';

        // Take significant gold
        const goldLoss = Math.min(
            Utils.randInt(pirate.bounty * 0.5, pirate.bounty),
            gameState.player.gold
        );
        gameState.player.gold -= goldLoss;

        combat.log.push({
            type: 'defeat',
            text: `Niederlage! Die Piraten nehmen ${Utils.formatGold(goldLoss)}.`
        });

        // Lose most cargo
        const cargoLost = [];
        Object.keys(ship.cargo).forEach(goodId => {
            const lostAmt = Math.floor(ship.cargo[goodId] * Utils.rand(0.5, 0.8));
            if (lostAmt > 0) {
                removeCargo(ship, goodId, lostAmt);
                cargoLost.push(`${lostAmt} ${GOODS[goodId].name}`);
            }
        });

        if (cargoLost.length > 0) {
            combat.log.push({
                type: 'cargo_lost',
                text: `Fracht geplundert: ${cargoLost.join(', ')}`
            });
        }

        // Ensure ship is damaged
        ship.hull = Math.max(1, Math.floor(ship.maxHull * 0.1));
        ship.damaged = true;

        // Reputation loss
        Reputation.addRep(gameState, -25, 'Kampf gegen Piraten verloren');

        Sound.play('danger');
    },

    // End combat and return to game
    endCombat(gameState) {
        if (!this.active) return;

        const combat = this.state;

        // Log the outcome to the game message log
        let summaryMsg;
        switch (combat.outcome) {
            case 'victory':
                summaryMsg = `${combat.ship.name} hat ${combat.pirate.captainName}s ${combat.pirate.name} besiegt!`;
                break;
            case 'fled':
                summaryMsg = `${combat.ship.name} ist den Piraten entkommen.`;
                break;
            case 'surrendered':
                summaryMsg = `${combat.ship.name} hat den Piraten Tribut gezahlt.`;
                break;
            case 'defeat':
                summaryMsg = `${combat.ship.name} wurde von ${combat.pirate.captainName}s ${combat.pirate.name} ueberwaltigt!`;
                break;
        }

        UI.addLogMessage(summaryMsg, combat.outcome === 'victory' ? 'trade' : 'danger');

        this.active = false;
        this.state = null;

        // Unpause the game
        Game.paused = false;

        // Hide the modal
        UI.hideModal();

        // Refresh UI
        UI.updateTopBar(gameState);
        UI.refreshCurrentTab();
    },

    // Render the combat UI in the modal
    renderCombatUI(gameState) {
        const combat = this.state;
        const ship = combat.ship;
        const pirate = combat.pirate;

        const shipHullPct = Math.round(ship.hull / ship.maxHull * 100);
        const pirateHullPct = Math.round(pirate.hull / pirate.maxHull * 100);
        const shipHullColor = shipHullPct > 50 ? 'var(--success)' : (shipHullPct > 25 ? 'var(--warning)' : 'var(--danger)');
        const pirateHullColor = pirateHullPct > 50 ? 'var(--success)' : (pirateHullPct > 25 ? 'var(--warning)' : 'var(--danger)');

        let html = '<div class="combat-modal">';

        // Header
        html += `<div class="combat-header">
            <div class="combat-icon">${pirate.icon}</div>
            <h3 class="combat-title">${pirate.name}!</h3>
            <div class="combat-desc">${pirate.description}</div>
            <div class="combat-captain">Kapitaen: <strong>${pirate.captainName}</strong></div>
        </div>`;

        // Ship comparison
        html += '<div class="combat-ships">';

        // Player ship
        html += `<div class="combat-ship-card player">
            <div class="combat-ship-label">Euer Schiff</div>
            <div class="combat-ship-name">${ship.name}</div>
            <div class="combat-ship-type">${SHIP_TYPES[ship.typeId].name}</div>
            <div class="combat-hull-bar">
                <div class="combat-hull-fill" style="width:${shipHullPct}%;background:${shipHullColor}"></div>
            </div>
            <div class="combat-hull-text" style="color:${shipHullColor}">${ship.hull} / ${ship.maxHull}</div>
            <div class="combat-ship-stats">
                <span title="Kanonen">\uD83D\uDCA3 ${ship.cannons}</span>
                <span title="Besatzung">\uD83D\uDC64 ${ship.crew}</span>
                <span title="Geschwindigkeit">\uD83D\uDCA8 ${ship.speed}</span>
            </div>
        </div>`;

        // VS divider
        html += '<div class="combat-vs">VS</div>';

        // Pirate ship
        html += `<div class="combat-ship-card pirate">
            <div class="combat-ship-label">Piraten</div>
            <div class="combat-ship-name">${pirate.captainName}</div>
            <div class="combat-ship-type">${pirate.name}</div>
            <div class="combat-hull-bar">
                <div class="combat-hull-fill" style="width:${pirateHullPct}%;background:${pirateHullColor}"></div>
            </div>
            <div class="combat-hull-text" style="color:${pirateHullColor}">${pirate.hull} / ${pirate.maxHull}</div>
            <div class="combat-ship-stats">
                <span title="Kanonen">\uD83D\uDCA3 ${pirate.cannons}</span>
                <span title="Besatzung">\uD83D\uDC64 ${pirate.crew}</span>
                <span title="Geschwindigkeit">\uD83D\uDCA8 ${pirate.speed}</span>
            </div>
        </div>`;

        html += '</div>'; // end combat-ships

        // Combat log
        html += '<div class="combat-log">';
        if (combat.log.length === 0) {
            html += `<div class="combat-log-entry encounter">Piraten voraus! ${pirate.captainName} greift ${ship.name} an!</div>`;
        }
        // Show last 6 log entries
        const visibleLog = combat.log.slice(-6);
        visibleLog.forEach(entry => {
            let entryClass = '';
            if (entry.type === 'player_attack') entryClass = 'player-action';
            else if (entry.type === 'pirate_attack') entryClass = 'pirate-action';
            else if (entry.type === 'victory' || entry.type === 'loot') entryClass = 'victory';
            else if (entry.type === 'defeat' || entry.type === 'cargo_lost') entryClass = 'defeat';
            else if (entry.type === 'flee_success' || entry.type === 'pirate_flee') entryClass = 'victory';
            else if (entry.type === 'flee_fail') entryClass = 'pirate-action';
            else if (entry.type === 'surrender') entryClass = 'defeat';
            html += `<div class="combat-log-entry ${entryClass}">${entry.text}</div>`;
        });
        html += '</div>';

        // Round indicator
        if (!combat.resolved) {
            html += `<div class="combat-round">Runde ${combat.round + 1}</div>`;
        }

        // Action buttons or result
        if (combat.resolved) {
            let resultClass, resultTitle, resultText;
            switch (combat.outcome) {
                case 'victory':
                    resultClass = 'victory';
                    resultTitle = 'Sieg!';
                    resultText = 'Die Piraten sind besiegt! Die See ist wieder sicher.';
                    break;
                case 'fled':
                    resultClass = 'fled';
                    resultTitle = 'Entkommen!';
                    resultText = 'Ihr seid den Piraten entkommen. Glueck gehabt!';
                    break;
                case 'surrendered':
                    resultClass = 'surrendered';
                    resultTitle = 'Uebergabe';
                    resultText = 'Ihr habt den Piraten Tribut gezahlt um Euer Schiff zu retten.';
                    break;
                case 'defeat':
                    resultClass = 'defeat';
                    resultTitle = 'Niederlage!';
                    resultText = 'Die Piraten haben Euch ueberwaltigt und Eure Waren geplundert.';
                    break;
            }

            html += `<div class="combat-result ${resultClass}">
                <div class="combat-result-title">${resultTitle}</div>
                <div class="combat-result-text">${resultText}</div>
            </div>`;

            html += `<div class="modal-buttons">
                <button class="modal-btn primary" onclick="Combat.endCombat(Game.state)">Weiter</button>
            </div>`;
        } else {
            // Action buttons
            html += '<div class="combat-actions">';

            html += `<button class="combat-action-btn fire" onclick="Combat.doFireCannons(Game.state)" title="Feuert Eure Kanonen auf die Piraten">
                <span class="combat-action-icon">\uD83D\uDCA5</span>
                <span class="combat-action-label">Feuer!</span>
                <span class="combat-action-desc">${ship.cannons} Kanonen</span>
            </button>`;

            const fleeEstimate = Math.round(Utils.clamp(
                0.3 + (ship.speed / pirate.speed - 1) * 0.3 + (ship.hull / ship.maxHull) * 0.1,
                0.1, 0.85
            ) * 100);

            html += `<button class="combat-action-btn flee" onclick="Combat.doFlee(Game.state)" title="Versucht den Piraten zu entkommen">
                <span class="combat-action-icon">\uD83D\uDCA8</span>
                <span class="combat-action-label">Fliehen</span>
                <span class="combat-action-desc">~${fleeEstimate}% Chance</span>
            </button>`;

            html += `<button class="combat-action-btn surrender" onclick="Combat.doSurrender(Game.state)" title="Ergebt Euch und zahlt Tribut">
                <span class="combat-action-icon">\uD83C\uDFF3\uFE0F</span>
                <span class="combat-action-label">Ergeben</span>
                <span class="combat-action-desc">Tribut zahlen</span>
            </button>`;

            html += '</div>';
        }

        html += '</div>'; // end combat-modal

        UI.showModal(html);
    }
};
