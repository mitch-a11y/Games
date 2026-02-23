/* ============================================
   HANSE - Combat System
   Interactive ship-to-ship combat with
   tactical choices and round-based resolution
   ============================================ */

const Combat = {
    active: false,
    state: null,
    /** ID of the ship currently in combat (prevents tick-level race conditions) */
    combatShipId: null,

    // Start a combat encounter
    initCombat(playerShip, enemyType, nearCity) {
        // Prevent double-combat: if already fighting, ignore
        if (this.active) return;
        // Check for convoy — combine forces
        let convoyShips = [];
        if (playerShip.convoyId && Game.state && Game.state.player) {
            convoyShips = Convoy.getShips(Game.state.player.ships, playerShip.convoyId)
                .filter(s => s.id !== playerShip.id && s.status === 'sailing');
        }

        // Effective combat stats include convoy ships
        const totalCannons = playerShip.cannons + convoyShips.reduce((s, c) => s + c.cannons, 0);
        const totalCrew = playerShip.crew + convoyShips.reduce((s, c) => s + c.crew, 0);

        const enemy = this._generateEnemy(enemyType, { ...playerShip, cannons: totalCannons });

        this.state = {
            playerShip,
            enemy,
            nearCity,
            round: 0,
            log: [],
            phase: 'choice',   // choice, fighting, resolved
            result: null,       // victory, defeat, fled, ransomed
            loot: null,
            convoyShips,
            effectiveCannons: totalCannons,
            effectiveCrew: totalCrew
        };

        this.active = true;
        this.combatShipId = playerShip.id;
        this._addLog(`${enemy.name} greift ${playerShip.name} nahe ${CITIES_DATA[nearCity]?.displayName || 'der Küste'} an!`, 'danger');
        this._showCombatUI();
    },

    _generateEnemy(type, playerShip) {
        const templates = {
            pirate_small: {
                name: 'Piratenkutter',
                hull: 25, maxHull: 25,
                cannons: 2, crew: 12, speed: 4,
                lootGold: [50, 200], icon: '🏴‍☠️'
            },
            pirate: {
                name: 'Piratenkogge',
                hull: 45, maxHull: 45,
                cannons: 6, crew: 25, speed: 3,
                lootGold: [100, 500], icon: '🏴‍☠️'
            },
            pirate_large: {
                name: 'Piratengaleone',
                hull: 80, maxHull: 80,
                cannons: 12, crew: 50, speed: 2,
                lootGold: [300, 1000], icon: '🏴‍☠️'
            }
        };

        // Scale enemy to player ship strength
        let template;
        if (playerShip.cannons >= 8) {
            template = templates.pirate_large;
        } else if (playerShip.cannons >= 4) {
            template = templates.pirate;
        } else {
            template = Math.random() < 0.6 ? templates.pirate_small : templates.pirate;
        }

        return { ...template };
    },

    // Player chooses action
    chooseAction(action) {
        if (!this.active || this.state.phase === 'resolved') return;

        switch (action) {
            case 'fight':
                this.state.phase = 'fighting';
                this._fight();
                break;
            case 'flee':
                this._flee();
                break;
            case 'ransom':
                this._ransom();
                break;
        }
    },

    _fight() {
        const { playerShip, enemy, effectiveCannons, effectiveCrew } = this.state;
        this.state.round++;

        Sound.play('cannon');

        // Player fires (using convoy-combined stats)
        const playerDmg = this._calcDamage(effectiveCannons || playerShip.cannons, effectiveCrew || playerShip.crew);
        enemy.hull -= playerDmg;
        this._addLog(`${playerShip.name} feuert! ${playerDmg} Schaden am Feind.`, 'info');

        // Check enemy sunk
        if (enemy.hull <= 0) {
            enemy.hull = 0;
            this._victory();
            return;
        }

        // Enemy fires back
        setTimeout(() => Sound.play('hit'), 400);
        const enemyDmg = this._calcDamage(enemy.cannons, enemy.crew);
        playerShip.hull -= enemyDmg;
        this._addLog(`${enemy.name} feuert zurück! ${enemyDmg} Schaden an ${playerShip.name}.`, 'danger');

        // Crew casualties (small chance)
        if (Math.random() < 0.2) {
            const crewLoss = Utils.randInt(1, 3);
            enemy.crew = Math.max(1, enemy.crew - crewLoss);
        }

        // Check player sunk
        if (playerShip.hull <= 0) {
            playerShip.hull = 1; // Don't actually sink, but heavy damage
            this._defeat();
            return;
        }

        if (playerShip.hull < playerShip.maxHull * 0.3) {
            playerShip.damaged = true;
        }

        // Still fighting — show updated UI
        this.state.phase = 'choice';
        this._showCombatUI();
    },

    _flee() {
        Sound.play('flee');
        const { playerShip, enemy } = this.state;
        const fleeChance = 0.3 + (playerShip.speed - enemy.speed + 2) * 0.1;

        if (Math.random() < Utils.clamp(fleeChance, 0.15, 0.85)) {
            this._addLog(`${playerShip.name} entkommt dem ${enemy.name}!`, 'info');
            // Take a parting shot
            const partingDmg = Math.floor(this._calcDamage(enemy.cannons, enemy.crew) * 0.5);
            if (partingDmg > 0) {
                playerShip.hull -= partingDmg;
                this._addLog(`Abschiedsschuss! ${partingDmg} Schaden beim Fliehen.`, 'danger');
            }
            this.state.result = 'fled';
            this.state.phase = 'resolved';
            if (Game.state?.player) Game.state.player.battlesFled = (Game.state.player.battlesFled || 0) + 1;
        } else {
            this._addLog('Flucht gescheitert! Der Feind ist zu schnell!', 'danger');
            // Enemy gets a free shot
            const freeDmg = this._calcDamage(enemy.cannons, enemy.crew);
            playerShip.hull -= freeDmg;
            this._addLog(`${enemy.name} nutzt die Gelegenheit! ${freeDmg} Schaden.`, 'danger');

            if (playerShip.hull <= 0) {
                playerShip.hull = 1;
                this._defeat();
                return;
            }
            this.state.phase = 'choice';
        }

        if (playerShip.hull < playerShip.maxHull * 0.3) {
            playerShip.damaged = true;
        }
        this._showCombatUI();
    },

    _ransom() {
        const { playerShip, enemy } = this.state;
        const ransomCost = Utils.randInt(100, 500) + enemy.cannons * 20;

        if (Game.state.player.gold >= ransomCost) {
            Game.state.player.gold -= ransomCost;
            Sound.play('coins');
            this._addLog(`Ihr zahlt ${Utils.formatGold(ransomCost)} Lösegeld. ${enemy.name} zieht ab.`, 'warning');
            this.state.result = 'ransomed';
        } else {
            this._addLog(`Nicht genug Gold für Lösegeld! (${Utils.formatGold(ransomCost)} benötigt)`, 'danger');
            this._addLog('Die Piraten greifen wütend an!', 'danger');
            // Forced combat round
            this.state.phase = 'fighting';
            this._fight();
            return;
        }

        this.state.phase = 'resolved';
        this._showCombatUI();
    },

    _victory() {
        const { playerShip, enemy } = this.state;
        const lootGold = Utils.randInt(enemy.lootGold[0], enemy.lootGold[1]);
        Game.state.player.gold += lootGold;

        this.state.loot = { gold: lootGold, goods: [] };

        // Chance to recover goods
        if (Math.random() < 0.4) {
            const possibleGoods = ['iron', 'cloth', 'spices', 'wine'];
            const lootGood = Utils.pick(possibleGoods);
            const lootAmt = Utils.randInt(3, 15);
            const added = addCargo(playerShip, lootGood, lootAmt);
            if (added > 0) {
                this.state.loot.goods.push({ id: lootGood, amount: added });
            }
        }

        Sound.play('victory');
        if (Game.state?.player) Game.state.player.battlesWon = (Game.state.player.battlesWon || 0) + 1;
        this._addLog(`SIEG! ${enemy.name} versenkt!`, 'success');
        this._addLog(`Beute: ${Utils.formatGold(lootGold)}`, 'success');
        if (this.state.loot.goods.length > 0) {
            this.state.loot.goods.forEach(g => {
                this._addLog(`Erbeutet: ${g.amount} ${GOODS[g.id].name}`, 'success');
            });
        }

        // Reputation boost
        const nearCity = this.state.nearCity;
        if (nearCity && Game.state.cities[nearCity]) {
            Game.state.cities[nearCity].reputation = (Game.state.cities[nearCity].reputation || 0) + 3;
            Game.state.player.reputation[nearCity] = (Game.state.player.reputation[nearCity] || 0) + 3;
        }

        this.state.result = 'victory';
        this.state.phase = 'resolved';
        this._showCombatUI();
    },

    _defeat() {
        const { playerShip, enemy } = this.state;

        // Lose cargo
        const lostGoods = [];
        const goodIds = Object.keys(playerShip.cargo);
        goodIds.forEach(gid => {
            const lostAmt = Math.floor(playerShip.cargo[gid] * Utils.rand(0.3, 0.7));
            if (lostAmt > 0) {
                removeCargo(playerShip, gid, lostAmt);
                lostGoods.push(`${lostAmt} ${GOODS[gid].name}`);
            }
        });

        // Lose gold
        const lostGold = Math.floor(Game.state.player.gold * Utils.rand(0.05, 0.15));
        Game.state.player.gold -= lostGold;

        Sound.play('defeat');
        if (Game.state?.player) Game.state.player.battlesLost = (Game.state.player.battlesLost || 0) + 1;
        this._addLog('NIEDERLAGE! Die Piraten plündern euer Schiff!', 'danger');
        if (lostGold > 0) this._addLog(`${Utils.formatGold(lostGold)} Gold gestohlen!`, 'danger');
        if (lostGoods.length > 0) this._addLog(`Verloren: ${lostGoods.join(', ')}`, 'danger');

        playerShip.hull = Math.max(1, playerShip.hull);
        playerShip.damaged = true;

        this.state.result = 'defeat';
        this.state.phase = 'resolved';
        this._showCombatUI();
    },

    _calcDamage(cannons, crew) {
        // Base damage from cannons with randomness
        const baseDmg = cannons * Utils.rand(1.5, 3.5);
        // Crew effectiveness bonus
        const crewBonus = Math.min(crew * 0.1, 3);
        // Lucky hit chance
        const lucky = Math.random() < 0.1 ? 1.5 : 1;
        return Math.max(1, Math.round((baseDmg + crewBonus) * lucky));
    },

    _addLog(text, type) {
        this.state.log.push({ text, type: type || 'info' });
    },

    // === UI ===
    _showCombatUI() {
        const { playerShip, enemy, round, log, phase, result } = this.state;
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');

        const pHullPct = Math.max(0, playerShip.hull / playerShip.maxHull);
        const eHullPct = Math.max(0, enemy.hull / enemy.maxHull);
        const pHullColor = pHullPct > 0.5 ? '#2eac68' : (pHullPct > 0.25 ? '#e8a020' : '#d94040');
        const eHullColor = eHullPct > 0.5 ? '#2eac68' : (eHullPct > 0.25 ? '#e8a020' : '#d94040');

        let html = `<div class="combat-ui">`;
        html += `<h3>${enemy.icon} Seekampf! — Runde ${round}</h3>`;

        // Ship comparison
        html += `<div class="combat-ships">`;

        // Player ship
        html += `<div class="combat-ship player-ship">`;
        html += `<div class="combat-ship-name" style="color:#ffd700">⚓ ${playerShip.name}</div>`;
        html += `<div class="combat-ship-type">${SHIP_TYPES[playerShip.typeId].name}</div>`;
        html += `<div class="combat-bar"><div class="combat-bar-fill" style="width:${pHullPct*100}%;background:${pHullColor}"></div></div>`;
        html += `<div class="combat-stats">`;
        html += `<span>Rumpf: ${playerShip.hull}/${playerShip.maxHull}</span>`;
        const eCannons = this.state.effectiveCannons || playerShip.cannons;
        const eCrew = this.state.effectiveCrew || playerShip.crew;
        const hasConvoy = this.state.convoyShips && this.state.convoyShips.length > 0;
        html += `<span>Kanonen: ${eCannons}${hasConvoy ? ' ⚓' : ''}</span>`;
        html += `<span>Crew: ${eCrew}</span>`;
        if (hasConvoy) html += `<span style="color:var(--accent)">Konvoi: +${this.state.convoyShips.length}</span>`;
        html += `</div></div>`;

        // VS
        html += `<div class="combat-vs">⚔️</div>`;

        // Enemy ship
        html += `<div class="combat-ship enemy-ship">`;
        html += `<div class="combat-ship-name" style="color:#d94040">${enemy.icon} ${enemy.name}</div>`;
        html += `<div class="combat-ship-type">Piratenschiff</div>`;
        html += `<div class="combat-bar"><div class="combat-bar-fill" style="width:${eHullPct*100}%;background:${eHullColor}"></div></div>`;
        html += `<div class="combat-stats">`;
        html += `<span>Rumpf: ${Math.max(0, enemy.hull)}/${enemy.maxHull}</span>`;
        html += `<span>Kanonen: ${enemy.cannons}</span>`;
        html += `<span>Crew: ${enemy.crew}</span>`;
        html += `</div></div>`;

        html += `</div>`; // combat-ships

        // Combat log
        html += `<div class="combat-log">`;
        const recentLogs = log.slice(-6);
        recentLogs.forEach(entry => {
            const color = entry.type === 'danger' ? '#d94040' :
                          entry.type === 'success' ? '#2eac68' :
                          entry.type === 'warning' ? '#e8a020' : '#8899aa';
            html += `<div class="combat-log-entry" style="color:${color}">${entry.text}</div>`;
        });
        html += `</div>`;

        // Actions
        html += `<div class="combat-actions">`;
        if (phase === 'choice') {
            html += `<button class="modal-btn primary" onclick="Combat.chooseAction('fight')">⚔️ Kämpfen</button>`;
            html += `<button class="modal-btn secondary" onclick="Combat.chooseAction('flee')">🏃 Fliehen</button>`;
            html += `<button class="modal-btn secondary" onclick="Combat.chooseAction('ransom')">💰 Lösegeld</button>`;
        } else if (phase === 'resolved') {
            const resultText = result === 'victory' ? '🏆 Sieg!' :
                               result === 'defeat' ? '💀 Niederlage' :
                               result === 'fled' ? '🏃 Entkommen' : '💰 Lösegeld gezahlt';
            html += `<div class="combat-result">${resultText}</div>`;
            html += `<button class="modal-btn primary" onclick="Combat.closeCombat()">Weiter</button>`;
        }
        html += `</div>`;

        html += `</div>`; // combat-ui

        content.innerHTML = html;
        overlay.classList.remove('hidden');

        // Pause game during combat
        if (Game.speed > 0) {
            this._savedSpeed = Game.speed;
            Game.setSpeed(0);
        }
    },

    closeCombat() {
        this.active = false;
        this.combatShipId = null;
        this.state = null;
        document.getElementById('modal-overlay').classList.add('hidden');

        // Resume game speed (default to 1 if saved speed was lost)
        const resumeSpeed = this._savedSpeed || 1;
        this._savedSpeed = null;
        Game.setSpeed(resumeSpeed);

        UI.updateTopBar(Game.state);
        UI.refreshCurrentTab();
    }
};
