/* ============================================
   HANSE - Enhanced UI Manager
   Phase 2: Price charts, better trade UI, sliders

   Modular UI components loaded separately:
   - ui-quests.js: Quest board methods
   - ui-trade.js: Trade tab methods
   - ui-fleet.js: Fleet tab methods
   - ui-build.js: Build tab methods
   - ui-bank.js: Bank tab methods
   ============================================ */

const UI = {
    currentTab: 'city',
    selectedShipId: null,
    selectedTradeShipIdx: 0,
    notifications: [],
    tradeQuantities: {}, // store qty per good for trade tab
    tradeSort: 'profit',    // 'name', 'price', 'profit', 'stock'
    tradeFilter: 'all',     // 'all', 'food', 'raw', 'manufactured', 'luxury'
    tradeProfitOnly: false,  // only show profitable goods
    tradeDestCity: null,     // selected comparison destination
    _bestSellCache: null,    // cached profit data
    _bestSellCacheCity: null, // which city the cache is for

    init() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTab(btn.dataset.tab);
                Sound.play('click');
            });
        });

        // Speed controls
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                Game.setSpeed(parseInt(btn.dataset.speed));
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Sound.play('click');
            });
        });

        // Top bar buttons
        document.getElementById('btn-save').addEventListener('click', () => {
            Game.save();
            this.showNotification('Spiel gespeichert!', 'success');
            Sound.play('gold');
        });

        document.getElementById('btn-menu').addEventListener('click', () => {
            this.showGameMenu();
        });
    },

    // Mobile panel toggle
    toggleMobilePanel(open) {
        const panel = document.getElementById('side-panel');
        if (open) {
            panel.classList.add('mobile-open');
        } else {
            panel.classList.remove('mobile-open');
        }
    },

    isMobile() {
        return window.innerWidth <= 768;
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');

        this.refreshCurrentTab();
    },

    refreshCurrentTab() {
        switch (this.currentTab) {
            case 'city': this.updateCityTab(); break;
            case 'trade': this.updateTradeTab(); break;
            case 'fleet': this.updateFleetTab(); break;
            case 'build': this.updateBuildTab(); break;
            case 'bank': this.updateBankTab(); break;
        }
    },

    // Update top bar + side panel banner
    updateTopBar(gameState) {
        document.getElementById('player-display').textContent = gameState.player.name;
        document.getElementById('rank-display').textContent = gameState.player.rank;
        document.getElementById('date-display').textContent = Utils.formatDate(
            gameState.date.day, gameState.date.month, gameState.date.year
        );
        document.getElementById('gold-display').textContent = Utils.formatGold(gameState.player.gold);

        // Update side panel city banner
        const cityId = GameMap.selectedCity;
        const bannerName = document.getElementById('side-panel-city-name');
        const bannerGold = document.getElementById('side-panel-city-gold');
        if (bannerName) {
            if (cityId && CITIES_DATA[cityId]) {
                bannerName.textContent = CITIES_DATA[cityId].displayName;
                const dockedShips = gameState.player.ships.filter(s => s.location === cityId);
                bannerGold.textContent = dockedShips.length > 0
                    ? `⚓ ${dockedShips.length} Schiff${dockedShips.length > 1 ? 'e' : ''}`
                    : '';
            } else {
                bannerName.textContent = 'Keine Stadt';
                bannerGold.textContent = '';
            }
        }
    },

    // === CITY TAB ===
    onCitySelected(cityId) {
        GameMap.selectedCity = cityId;
        this.switchTab('city');
        this.updateCityTab();
        if (Game.state) this.updateTopBar(Game.state); // refresh banner
        if (this.isMobile()) this.toggleMobilePanel(true);
    },

    doDiplomacy(cityId, actionId) {
        if (typeof Diplomacy === 'undefined') return;
        const result = Diplomacy.performAction(Game.state, cityId, actionId);
        if (result.success) {
            Sound.play('coins');
            this.addLogMessage(result.message, 'trade');
            this.showNotification(result.message, 'success');
        } else {
            this.showNotification(result.message, 'warning');
        }
        this.updateCityTab();
        this.updateTopBar(Game.state);
    },

    updateCityTab() {
        const cityId = GameMap.selectedCity;
        if (!cityId || !Game.state) {
            document.getElementById('city-name').textContent = 'Keine Stadt ausgewaehlt';
            document.getElementById('city-details').innerHTML = '<p style="color:var(--text-dim)">Klicke auf eine Stadt in der Karte.</p>';
            return;
        }

        const city = CITIES_DATA[cityId];
        const cityState = Game.state.cities[cityId];

        document.getElementById('city-name').textContent = city.displayName;

        let html = '';

        // Basic info
        html += this.detailRow('Einwohner', Utils.formatNumber(cityState.population));
        html += this.detailRow('Bedeutung', '<span style="color:#ffd700">' + '★'.repeat(city.importance) + '☆'.repeat(5 - city.importance));
        html += this.detailRow('Werft', city.hasShipyard ? '<span style="color:var(--success)">Ja</span>' : 'Nein');

        // Player buildings
        if (cityState.playerBuildings && cityState.playerBuildings.length > 0) {
            html += this.detailRow('Eure Gebaeude', cityState.playerBuildings.map(b => BUILDING_TYPES[b.type].icon).join(' '));
        }

        // Reputation & Diplomacy
        const playerRep = Game.state.player.reputation[cityId] || 0;
        if (typeof Diplomacy !== 'undefined') {
            const level = Diplomacy.getLevel(playerRep);
            const nextLevel = Diplomacy.getNextLevel(playerRep);
            const progressHTML = nextLevel
                ? `<div class="rep-progress-bar"><div class="rep-progress-fill" style="width:${Math.min(100, ((playerRep - level.min) / (nextLevel.min - level.min)) * 100)}%"></div></div><span class="rep-next">Naechst: ${nextLevel.name} (${nextLevel.min})</span>`
                : '<span class="rep-next" style="color:var(--gold-color)">Maximaler Rang!</span>';
            html += `<div class="rep-display">
                <div class="rep-header">
                    <span class="rep-label">Ansehen</span>
                    <span class="rep-value" style="color:${level.color}">${level.icon} ${level.name} (${playerRep})</span>
                </div>
                ${progressHTML}
                ${level.priceBonus > 0 ? `<span class="rep-bonus">Preisbonus: ${(level.priceBonus * 100).toFixed(0)}%</span>` : ''}
            </div>`;
        } else {
            const rep = cityState.reputation || 0;
            html += this.detailRow('Ansehen', rep > 0 ? `<span style="color:var(--success)">+${rep}</span>` : `${rep}`);
        }

        // Ships docked here
        const dockedShips = Game.state.player.ships.filter(s => s.location === cityId);
        if (dockedShips.length > 0) {
            html += this.detailRow('Eure Schiffe', dockedShips.map(s => s.name).join(', '));
        }

        // AI traders in this city
        if (Game.state.aiTraders) {
            const aiHere = Game.state.aiTraders.filter(ai =>
                ai.ships.some(s => s.location === cityId && s.status === 'docked')
            );
            if (aiHere.length > 0) {
                const aiNames = aiHere.map(ai => {
                    const cargo = ai.ships.reduce((sum, s) => sum + getCargoCount(s), 0);
                    return `${ai.name.split(' ')[0]} (${cargo} Fracht)`;
                }).join(', ');
                html += this.detailRow('Fremde Haendler', `<span style="font-size:11px">${aiNames}</span>`);
            }
        }

        // Net worth
        const netWorth = Game.calculateNetWorth();
        html += this.detailRow('Vermoegen', `<span style="color:var(--gold-color)">${Utils.formatGold(netWorth)}</span>`);

        // Diplomacy actions
        if (typeof Diplomacy !== 'undefined') {
            const actions = Diplomacy.getAvailableActions(Game.state, cityId);
            const hasKontor = (cityState.playerBuildings || []).some(b => b.type === 'kontor');
            if (hasKontor) {
                html += '<div class="diplo-section"><h4>Diplomatie</h4>';
                actions.forEach(action => {
                    html += `<div class="diplo-action ${action.available ? '' : 'diplo-unavailable'}">
                        <div class="diplo-action-header">
                            <span>${action.icon} ${action.name}</span>
                            <span class="diplo-cost">${Utils.formatGold(action.cost)}</span>
                        </div>
                        <div class="diplo-desc">${action.description} <em>(+${action.repGain} Ansehen)</em></div>
                        ${action.available
                            ? `<button class="diplo-btn" onclick="UI.doDiplomacy('${cityId}','${action.id}')">Ausfuehren</button>`
                            : `<span class="diplo-blocked">${action.reason}</span>`}
                    </div>`;
                });
                html += '</div>';
            }
        }

        // Market overview with mini charts
        html += '<div class="city-goods-section"><h4>Marktpreise</h4>';
        GOOD_IDS.forEach(goodId => {
            const m = cityState.market[goodId];
            const good = GOODS[goodId];
            const trendClass = m.trend > 0 ? 'trend-up' : (m.trend < 0 ? 'trend-down' : 'trend-stable');
            const trendIcon = m.trend > 0 ? '▲' : (m.trend < 0 ? '▼' : '─');

            // Price vs base comparison
            const vsBase = m.price - good.basePrice;
            const vsColor = vsBase > 5 ? 'var(--danger)' : (vsBase < -5 ? 'var(--success)' : 'var(--text-dim)');

            // Highlight especially cheap or expensive goods
            const dealClass = vsBase < -8 ? 'good-deal' : (vsBase > 8 ? 'bad-deal' : '');

            html += `<div class="city-good-row ${dealClass}" onclick="UI.showPriceDetail('${cityId}','${goodId}')" style="cursor:pointer" title="Klicken fuer Preishistorie">
                <span class="city-good-name">${good.icon} ${good.name}</span>
                <span class="city-good-stock" title="Vorrat">${Math.floor(m.stock)}</span>
                <span class="city-good-price" style="color:${vsColor}">${m.price} G</span>
                <span class="city-good-trend ${trendClass}" title="${vsBase > 0 ? '+' : ''}${vsBase} vs. Basis">${trendIcon}</span>
            </div>`;
        });
        html += '</div>';

        document.getElementById('city-details').innerHTML = html;
    },

    detailRow(label, value) {
        return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`;
    },

    // Show price detail popup with chart
    showPriceDetail(cityId, goodId) {
        const cityState = Game.state.cities[cityId];
        const m = cityState.market[goodId];
        const good = GOODS[goodId];

        const chartCanvas = Trading.renderPriceChart(
            m.priceHistory || [], 320, 120, m.price, good.basePrice
        );

        let html = `<div class="event-popup">
            <h3>${good.icon} ${good.name} in ${CITIES_DATA[cityId].displayName}</h3>
            <div style="display:flex;justify-content:space-around;margin:12px 0;font-size:13px">
                <div style="text-align:center">
                    <div style="color:var(--text-dim)">Aktuell</div>
                    <div style="font-size:18px;font-weight:bold;color:var(--gold-color)">${m.price} G</div>
                </div>
                <div style="text-align:center">
                    <div style="color:var(--text-dim)">Durchschnitt</div>
                    <div style="font-size:18px;font-weight:bold">${m.avgPrice || m.price} G</div>
                </div>
                <div style="text-align:center">
                    <div style="color:var(--text-dim)">Spanne</div>
                    <div style="font-size:14px">${m.minPrice || m.price} - ${m.maxPrice || m.price} G</div>
                </div>
            </div>
            <div id="price-chart-container" style="display:flex;justify-content:center;margin:8px 0"></div>
            <div style="display:flex;justify-content:space-around;margin:8px 0;font-size:12px;color:var(--text-dim)">
                <div>Vorrat: ${Math.floor(m.stock)}</div>
                <div>Nachfrage: ${'█'.repeat(m.demand) || '─'}</div>
                <div>Produktion: ${'█'.repeat(m.production) || '─'}</div>
            </div>
            <div style="font-size:11px;color:var(--text-dim);text-align:center;margin:4px 0">${good.description}</div>
            <div class="modal-buttons">
                <button class="modal-btn primary" onclick="UI.hideModal()">Schliessen</button>
            </div>
        </div>`;

        this.showModal(html);

        // Inject the canvas chart
        const container = document.getElementById('price-chart-container');
        if (container) {
            container.appendChild(chartCanvas);
        }
    },

    // Trade tab methods in ui-trade.js
    updateTradeTab() { /* in ui-trade.js */ },
    invalidateTradeCache() { /* in ui-trade.js */ },
    executeTrade() { /* in ui-trade.js */ },
    sellAllCargo() { /* in ui-trade.js */ },
    autoBuyBest() { /* in ui-trade.js */ },

    // Fleet tab methods in ui-fleet.js
    updateFleetTab() { /* in ui-fleet.js */ },
    renderNavigationOptions() { /* in ui-fleet.js */ },
    renderConvoyOptions() { /* in ui-fleet.js */ },
    formConvoy() { /* in ui-fleet.js */ },
    leaveConvoy() { /* in ui-fleet.js */ },
    showAutoTradeSetup() { /* in ui-fleet.js */ },
    startAutoTrade() { /* in ui-fleet.js */ },
    stopAutoTrade() { /* in ui-fleet.js */ },
    selectShip() { /* in ui-fleet.js */ },
    sailShip() { /* in ui-fleet.js */ },
    repairShip() { /* in ui-fleet.js */ },
    sellShip() { /* in ui-fleet.js */ },
    confirmSellShip() { /* in ui-fleet.js */ },
    updateShipyard() { /* in ui-fleet.js */ },
    buyShip() { /* in ui-fleet.js */ },

    // Build tab methods in ui-build.js
    _buildProductionChainHTML() { /* in ui-build.js */ },
    updateBuildTab() { /* in ui-build.js */ },
    buildBuilding() { /* in ui-build.js */ },

    // Bank tab methods in ui-bank.js
    updateBankTab() { /* in ui-bank.js */ },
    takeLoan() { /* in ui-bank.js */ },
    repayLoan() { /* in ui-bank.js */ },
    showPartialRepay() { /* in ui-bank.js */ },

    // Quest methods in ui-quests.js
    showQuestBoard() { /* in ui-quests.js */ },
    acceptQuest() { /* in ui-quests.js */ },
    abandonQuest() { /* in ui-quests.js */ },

    // === WIND ===
    updateWind(gameState) {
        const directions = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
        const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
        const idx = gameState.wind.direction;
        document.getElementById('wind-direction').textContent = arrows[idx];
        document.getElementById('wind-label').textContent = `${directions[idx]} ${gameState.wind.strength.toFixed(1)}`;
    },

    // === MESSAGE LOG ===
    addLogMessage(text, type) {
        const log = document.getElementById('message-log');
        const time = Game.state ? Utils.formatDateShort(Game.state.date.day, Game.state.date.month, Game.state.date.year) : '';

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span class="log-time">${time}</span><span class="log-text ${type || ''}">${text}</span>`;

        log.insertBefore(entry, log.firstChild);

        while (log.children.length > 100) {
            log.removeChild(log.lastChild);
        }
    },

    // === NOTIFICATIONS ===
    showNotification(text, type) {
        const area = document.getElementById('notification-area');
        const notif = document.createElement('div');
        notif.className = `notification ${type || 'info'}`;
        notif.textContent = text;
        area.appendChild(notif);

        setTimeout(() => {
            notif.style.animation = 'notifFade 0.3s ease-out forwards';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    },

    // === MODAL ===
    showModal(html) {
        document.getElementById('modal-content').innerHTML = html;
        document.getElementById('modal-overlay').classList.remove('hidden');
    },

    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    showEventPopup(event) {
        const html = `<div class="event-popup">
            <div class="event-icon">${event.template.icon}</div>
            <h3>${event.template.name}</h3>
            <div class="event-text">${event.message}</div>
            <div class="modal-buttons">
                <button class="modal-btn primary" onclick="UI.hideModal()">Verstanden</button>
            </div>
        </div>`;
        this.showModal(html);
        Sound.play(event.template.type === 'combat' ? 'danger' : 'event');
    },

    showGameMenu() {
        const netWorth = Game.calculateNetWorth();
        const daysPlayed = Game.state.player.daysPlayed;
        const shipsOwned = Game.state.player.ships.length;
        const totalTraded = Game.state.player.totalTraded || 0;

        const sfxPct = Math.round(Sound.sfxVolume * 100);
        const musicPct = Math.round(Sound.musicVolume * 100);
        const masterPct = Math.round(Sound.volume * 100);

        const html = `<h3>Spielmenue</h3>
            <div style="font-size:12px;margin-bottom:12px;padding:10px;background:rgba(15,52,96,0.3);border-radius:4px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Vermoegen:</span><span style="color:var(--gold-color)">${Utils.formatGold(netWorth)}</span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Handelsvolumen:</span><span>${Utils.formatGold(totalTraded)}</span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Tage gespielt:</span><span>${daysPlayed}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Schiffe:</span><span>${shipsOwned}</span></div>
            </div>

            <div style="margin-bottom:12px;padding:10px;background:rgba(15,52,96,0.3);border-radius:4px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <span style="font-size:13px;font-weight:bold">Sound</span>
                    <button id="menu-sound-toggle" class="modal-btn ${Sound.enabled ? 'primary' : 'danger'}" style="padding:4px 12px;font-size:11px;min-width:50px" onclick="Sound.toggle();UI.showGameMenu()">${Sound.enabled ? 'AN' : 'AUS'}</button>
                </div>
                <div style="opacity:${Sound.enabled ? 1 : 0.4};pointer-events:${Sound.enabled ? 'auto' : 'none'}">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px">
                        <span style="min-width:65px">Gesamt</span>
                        <input type="range" min="0" max="100" value="${masterPct}" style="flex:1;accent-color:var(--gold-color,#c8a84e)" oninput="Sound.setVolume(this.value/100);document.getElementById('vol-master-val').textContent=this.value+'%'">
                        <span id="vol-master-val" style="min-width:35px;text-align:right;font-size:11px">${masterPct}%</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px">
                        <span style="min-width:65px">Effekte</span>
                        <input type="range" min="0" max="100" value="${sfxPct}" style="flex:1;accent-color:var(--gold-color,#c8a84e)" oninput="Sound.setSfxVolume(this.value/100);document.getElementById('vol-sfx-val').textContent=this.value+'%'">
                        <span id="vol-sfx-val" style="min-width:35px;text-align:right;font-size:11px">${sfxPct}%</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;font-size:12px">
                        <span style="min-width:65px">Musik</span>
                        <input type="range" min="0" max="100" value="${musicPct}" style="flex:1;accent-color:var(--gold-color,#c8a84e)" oninput="Sound.setMusicVolume(this.value/100);document.getElementById('vol-music-val').textContent=this.value+'%'">
                        <span id="vol-music-val" style="min-width:35px;text-align:right;font-size:11px">${musicPct}%</span>
                    </div>
                </div>
            </div>

            <div class="modal-buttons" style="flex-direction:column;gap:8px">
                <button class="modal-btn primary" onclick="Game.save();UI.showNotification('Gespeichert!','success');UI.hideModal()">Spiel speichern</button>
                <button class="modal-btn secondary" onclick="UI.hideModal();UI.showStatsScreen()">Statistiken</button>
                <button class="modal-btn danger" onclick="UI.hideModal();Game.returnToTitle()">Zum Hauptmenue</button>
                <button class="modal-btn secondary" onclick="UI.hideModal()">Zurueck</button>
            </div>`;
        this.showModal(html);
    },

    showRankUp(oldRank, newRank) {
        const html = `<div class="event-popup">
            <div class="event-icon">🏅</div>
            <h3>Befoerderung!</h3>
            <div class="event-text">Ihr wurdet vom ${oldRank} zum <strong style="color:var(--accent)">${newRank}</strong> befoerdert!</div>
            <div class="modal-buttons">
                <button class="modal-btn primary" onclick="UI.hideModal()">Vortrefflich!</button>
            </div>
        </div>`;
        this.showModal(html);
        Sound.play('newgame');
    },

    // ============================================
    // GAME END SCREEN (Victory / Defeat)
    // ============================================
    showGameEndScreen(type, stats) {
        const isVictory = type === 'victory';
        const icon = isVictory ? '👑' : '💀';
        const title = isVictory ? 'SIEG! Ihr seid Eldermann!' : 'BANKROTT!';
        const subtitle = isVictory
            ? `${stats.playerName}, Ihr habt die Hanse erobert!`
            : `${stats.playerName}, Eure Schulden haben Euch ruiniert.`;
        const color = isVictory ? 'var(--gold-color)' : '#e74c3c';

        let html = `<div style="text-align:center;max-width:480px">
            <div style="font-size:48px;margin-bottom:8px;animation:combatPulse 2s infinite">${icon}</div>
            <h2 style="color:${color};margin:0 0 4px;font-size:24px">${title}</h2>
            <div style="color:var(--text-dim);margin-bottom:16px;font-size:13px">${subtitle}</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;margin-bottom:16px;font-size:12px">
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px">
                    <div style="color:var(--text-dim)">Vermögen</div>
                    <div style="color:var(--gold-color);font-size:16px;font-weight:bold">${Utils.formatGold(stats.wealth)}</div>
                </div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px">
                    <div style="color:var(--text-dim)">Gespielt</div>
                    <div style="color:var(--text);font-size:16px;font-weight:bold">${stats.yearsPlayed} Jahre</div>
                </div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px">
                    <div style="color:var(--text-dim)">Handelsvolumen</div>
                    <div style="color:var(--text);font-weight:bold">${Utils.formatGold(stats.totalTraded)}</div>
                </div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px">
                    <div style="color:var(--text-dim)">Reisen</div>
                    <div style="color:var(--text);font-weight:bold">${stats.voyagesCompleted}</div>
                </div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px">
                    <div style="color:var(--text-dim)">Schlachten</div>
                    <div style="color:var(--text);font-weight:bold">⚔${stats.battlesWon} ✓ / ${stats.battlesLost} ✗ / ${stats.battlesFled} 🏃</div>
                </div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px">
                    <div style="color:var(--text-dim)">Gebäude</div>
                    <div style="color:var(--text);font-weight:bold">${stats.buildingCount} in ${stats.citiesWithKontor} Städten</div>
                </div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px">
                    <div style="color:var(--text-dim)">Flotte</div>
                    <div style="color:var(--text);font-weight:bold">${stats.shipCount} Schiffe</div>
                </div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px">
                    <div style="color:var(--text-dim)">Schwierigkeit</div>
                    <div style="color:var(--text);font-weight:bold">${stats.difficulty === 'easy' ? 'Leicht' : stats.difficulty === 'hard' ? 'Schwer' : 'Normal'}</div>
                </div>
            </div>`;

        // Mini wealth chart
        if (stats.wealthHistory && stats.wealthHistory.length > 2) {
            html += `<canvas id="end-wealth-chart" width="440" height="100" style="width:100%;height:100px;border-radius:4px;background:rgba(15,52,96,0.3);margin-bottom:16px"></canvas>`;
        }

        html += `<div class="modal-buttons" style="flex-direction:column;gap:8px">
                ${isVictory ? '<button class="modal-btn primary" onclick="UI.hideModal();Game.paused=false">Weiterspielen</button>' : ''}
                <button class="modal-btn ${isVictory ? 'secondary' : 'primary'}" onclick="UI.hideModal();Game.returnToTitle()">Hauptmenü</button>
            </div>
        </div>`;

        this.showModal(html);

        // Draw wealth chart after DOM update
        if (stats.wealthHistory && stats.wealthHistory.length > 2) {
            requestAnimationFrame(() => this._drawMiniChart('end-wealth-chart', stats.wealthHistory));
        }
    },

    // ============================================
    // STATISTICS DASHBOARD (in Game Menu)
    // ============================================
    showStatsScreen() {
        const stats = Game.getGameStats();
        const p = Game.state.player;

        let html = `<div style="max-width:520px">
            <h3 style="margin:0 0 12px;color:var(--accent)">📊 Statistiken</h3>

            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px;font-size:11px">
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px;text-align:center">
                    <div style="color:var(--gold-color);font-size:18px;font-weight:bold">${Utils.formatGold(stats.wealth)}</div>
                    <div style="color:var(--text-dim)">Vermögen</div>
                </div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px;text-align:center">
                    <div style="color:var(--text);font-size:18px;font-weight:bold">${stats.yearsPlayed}J ${Game.state.date.month}M</div>
                    <div style="color:var(--text-dim)">Spielzeit</div>
                </div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px;text-align:center">
                    <div style="color:var(--accent);font-size:18px;font-weight:bold">${stats.rank}</div>
                    <div style="color:var(--text-dim)">Rang</div>
                </div>
            </div>

            <canvas id="stats-wealth-chart" width="480" height="120" style="width:100%;height:120px;border-radius:4px;background:rgba(15,52,96,0.2);margin-bottom:12px"></canvas>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:12px">
                <div style="padding:6px 8px;background:rgba(15,52,96,0.2);border-radius:4px;display:flex;justify-content:space-between">
                    <span style="color:var(--text-dim)">Handelsvolumen</span><span style="color:var(--text)">${Utils.formatGold(stats.totalTraded)}</span>
                </div>
                <div style="padding:6px 8px;background:rgba(15,52,96,0.2);border-radius:4px;display:flex;justify-content:space-between">
                    <span style="color:var(--text-dim)">Reisen</span><span style="color:var(--text)">${stats.voyagesCompleted}</span>
                </div>
                <div style="padding:6px 8px;background:rgba(15,52,96,0.2);border-radius:4px;display:flex;justify-content:space-between">
                    <span style="color:var(--text-dim)">Schlachten ⚔</span><span style="color:var(--text)">${stats.battlesWon}W / ${stats.battlesLost}L / ${stats.battlesFled}F</span>
                </div>
                <div style="padding:6px 8px;background:rgba(15,52,96,0.2);border-radius:4px;display:flex;justify-content:space-between">
                    <span style="color:var(--text-dim)">Schiffe</span><span style="color:var(--text)">${stats.shipCount}</span>
                </div>
                <div style="padding:6px 8px;background:rgba(15,52,96,0.2);border-radius:4px;display:flex;justify-content:space-between">
                    <span style="color:var(--text-dim)">Gebäude</span><span style="color:var(--text)">${stats.buildingCount}</span>
                </div>
                <div style="padding:6px 8px;background:rgba(15,52,96,0.2);border-radius:4px;display:flex;justify-content:space-between">
                    <span style="color:var(--text-dim)">Städte</span><span style="color:var(--text)">${stats.citiesWithKontor} / ${CITY_IDS.length}</span>
                </div>
            </div>

            <h4 style="margin:0 0 6px;font-size:12px;color:var(--text-dim)">Vermögensaufteilung</h4>
            <div style="display:flex;gap:2px;height:20px;border-radius:4px;overflow:hidden;margin-bottom:16px">
                <div style="flex:${stats.gold};background:var(--gold-color);min-width:2px" title="Gold: ${Utils.formatGold(stats.gold)}"></div>
                <div style="flex:${stats.shipValue};background:#3498db;min-width:2px" title="Schiffe: ${Utils.formatGold(stats.shipValue)}"></div>
                <div style="flex:${stats.buildingValue};background:#2ecc71;min-width:2px" title="Gebäude: ${Utils.formatGold(stats.buildingValue)}"></div>
                <div style="flex:${stats.cargoValue};background:#e67e22;min-width:2px" title="Fracht: ${Utils.formatGold(stats.cargoValue)}"></div>
            </div>
            <div style="display:flex;gap:12px;font-size:10px;margin-bottom:16px;flex-wrap:wrap">
                <span><span style="color:var(--gold-color)">■</span> Gold ${Utils.formatGold(stats.gold)}</span>
                <span><span style="color:#3498db">■</span> Schiffe ${Utils.formatGold(stats.shipValue)}</span>
                <span><span style="color:#2ecc71">■</span> Gebäude ${Utils.formatGold(stats.buildingValue)}</span>
                <span><span style="color:#e67e22">■</span> Fracht ${Utils.formatGold(stats.cargoValue)}</span>
            </div>

            <button class="modal-btn secondary" style="width:100%" onclick="UI.hideModal()">Schließen</button>
        </div>`;

        this.showModal(html);
        requestAnimationFrame(() => this._drawMiniChart('stats-wealth-chart', stats.wealthHistory));
    },

    // Mini sparkline chart renderer
    _drawMiniChart(canvasId, wealthHistory) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !wealthHistory || wealthHistory.length < 2) return;

        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const pad = 10;

        ctx.clearRect(0, 0, w, h);

        const values = wealthHistory.map(wh => wh.wealth);
        const min = Math.min(...values) * 0.9;
        const max = Math.max(...values) * 1.1 || 1;

        // Grid lines
        ctx.strokeStyle = 'rgba(100,130,180,0.15)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 4; i++) {
            const y = pad + (h - pad * 2) * (i / 3);
            ctx.beginPath();
            ctx.moveTo(pad, y);
            ctx.lineTo(w - pad, y);
            ctx.stroke();
        }

        // Wealth line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(230, 168, 23, 0.9)';
        ctx.lineWidth = 2;
        values.forEach((v, i) => {
            const x = pad + (w - pad * 2) * (i / (values.length - 1));
            const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Fill under line
        const lastX = pad + (w - pad * 2);
        const lastY = h - pad - ((values[values.length - 1] - min) / (max - min)) * (h - pad * 2);
        ctx.lineTo(lastX, h - pad);
        ctx.lineTo(pad, h - pad);
        ctx.closePath();
        ctx.fillStyle = 'rgba(230, 168, 23, 0.08)';
        ctx.fill();

        // Labels
        ctx.fillStyle = 'rgba(200, 220, 240, 0.5)';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(Utils.formatGold(Math.floor(max)), pad + 2, pad + 8);
        ctx.fillText(Utils.formatGold(Math.floor(min)), pad + 2, h - pad - 2);
    },

    // ============================================
    // PRICE HISTORY CHART (in Trade Tab)
    // ============================================
    showPriceChart(goodId, cityId) {
        const cityState = Game.state.cities[cityId];
        if (!cityState) return;
        const market = cityState.market[goodId];
        if (!market || !market.priceHistory) return;
        const good = GOODS[goodId];

        let html = `<div style="max-width:420px">
            <h3 style="margin:0 0 8px;color:var(--accent)">${good.icon} ${good.name} — Preisverlauf</h3>
            <div style="font-size:11px;color:var(--text-dim);margin-bottom:8px">${CITIES_DATA[cityId].displayName}</div>
            <canvas id="price-chart-canvas" width="400" height="160" style="width:100%;height:160px;border-radius:4px;background:rgba(15,52,96,0.3);margin-bottom:8px"></canvas>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:12px">
                <span>Aktuell: <b style="color:var(--gold-color)">${market.price}g</b></span>
                <span>Ø ${market.avgPrice}g</span>
                <span style="color:#2ecc71">Min: ${market.minPrice}g</span>
                <span style="color:#e74c3c">Max: ${market.maxPrice}g</span>
            </div>
            <button class="modal-btn secondary" style="width:100%" onclick="UI.hideModal()">Schließen</button>
        </div>`;

        this.showModal(html);
        requestAnimationFrame(() => {
            const canvas = document.getElementById('price-chart-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const w = canvas.width, h = canvas.height, pad = 15;
            ctx.clearRect(0, 0, w, h);

            const prices = market.priceHistory;
            const base = good.basePrice;
            const min = Math.min(...prices, base) * 0.85;
            const max = Math.max(...prices, base) * 1.15 || 1;

            // Base price line
            const baseY = h - pad - ((base - min) / (max - min)) * (h - pad * 2);
            ctx.strokeStyle = 'rgba(100,130,180,0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(pad, baseY);
            ctx.lineTo(w - pad, baseY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(100,130,180,0.5)';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`Basis ${base}g`, w - pad - 2, baseY - 3);

            // Price line
            ctx.beginPath();
            ctx.strokeStyle = '#e6a817';
            ctx.lineWidth = 2;
            prices.forEach((p, i) => {
                const x = pad + (w - pad * 2) * (i / (prices.length - 1));
                const y = h - pad - ((p - min) / (max - min)) * (h - pad * 2);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Current price dot
            const lastIdx = prices.length - 1;
            const cx = pad + (w - pad * 2);
            const cy = h - pad - ((prices[lastIdx] - min) / (max - min)) * (h - pad * 2);
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#e6a817';
            ctx.fill();

            // Axis labels
            ctx.fillStyle = 'rgba(200,220,240,0.5)';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${Math.floor(max)}g`, pad, pad + 6);
            ctx.fillText(`${Math.floor(min)}g`, pad, h - pad + 10);
        });
    },

    // ============================================
    // TUTORIAL SYSTEM
    // ============================================
    tutorialSteps: [
        { target: '.tab-btn[data-tab="trade"]', text: 'Willkommen, Händler! Klickt auf den Handels-Tab um zu beginnen.', highlight: 'trade-tab' },
        { target: '.trade-btn.buy', text: 'Kauft günstige Waren ein. Achtet auf grüne Pfeile — die zeigen steigende Preise!', highlight: 'trade-panel' },
        { target: '.tab-btn[data-tab="fleet"]', text: 'Im Flotten-Tab könnt ihr eure Schiffe verwalten und Ziele wählen.', highlight: 'fleet-tab' },
        { target: '#map-canvas', text: 'Klickt auf eine andere Stadt auf der Karte. Dorthin segelt euer Schiff!', highlight: 'map' },
        { target: '.tab-btn[data-tab="build"]', text: 'Baut Kontore und Produktionsstätten um passives Einkommen zu generieren.', highlight: 'build-tab' },
        { target: null, text: 'Tipp: Kauft billig, segelt zur nächsten Stadt, verkauft teuer. So wächst euer Imperium! Viel Erfolg!', highlight: null }
    ],

    showTutorial() {
        if (!Game.state) return;
        const step = Game.state.player.tutorialStep || 0;
        if (step >= this.tutorialSteps.length) {
            Game.state.player.tutorialDone = true;
            return;
        }

        const tutorial = this.tutorialSteps[step];
        this._showTutorialBubble(tutorial.text, step);
    },

    _showTutorialBubble(text, step) {
        // Remove existing
        const existing = document.getElementById('tutorial-bubble');
        if (existing) existing.remove();

        const isLast = step >= this.tutorialSteps.length - 1;

        const bubble = document.createElement('div');
        bubble.id = 'tutorial-bubble';
        bubble.innerHTML = `
            <div style="position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;
                background:rgba(10,20,40,0.95);border:2px solid var(--accent);border-radius:12px;
                padding:16px 20px;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,0.6);
                animation:modalIn 0.3s ease">
                <div style="font-size:13px;color:var(--text);line-height:1.5;margin-bottom:12px">${text}</div>
                <div style="display:flex;gap:8px;justify-content:space-between;align-items:center">
                    <span style="font-size:10px;color:var(--text-dim)">${step + 1} / ${this.tutorialSteps.length}</span>
                    <div style="display:flex;gap:8px">
                        <button onclick="UI.skipTutorial()" style="padding:4px 12px;font-size:11px;background:transparent;
                            color:var(--text-dim);border:1px solid var(--border);border-radius:4px;cursor:pointer">
                            Überspringen</button>
                        <button onclick="UI.nextTutorial()" style="padding:4px 16px;font-size:11px;background:var(--accent);
                            color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold">
                            ${isLast ? 'Los geht\'s!' : 'Weiter →'}</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(bubble);
    },

    nextTutorial() {
        if (!Game.state) return;
        Game.state.player.tutorialStep = (Game.state.player.tutorialStep || 0) + 1;
        Sound.play('click');

        const existing = document.getElementById('tutorial-bubble');
        if (existing) existing.remove();

        if (Game.state.player.tutorialStep >= this.tutorialSteps.length) {
            Game.state.player.tutorialDone = true;
            this.showNotification('Tutorial abgeschlossen! Viel Erfolg, Händler!', 'success');
        } else {
            this.showTutorial();
        }
    },

    skipTutorial() {
        if (!Game.state) return;
        Game.state.player.tutorialDone = true;
        Game.state.player.tutorialStep = this.tutorialSteps.length;
        const existing = document.getElementById('tutorial-bubble');
        if (existing) existing.remove();
        Sound.play('click');
    },

    // ============================================
    // CREW MANAGEMENT
    // ============================================
    showCrewManagement(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        const maxCrew = ship.maxCrew || SHIP_TYPES[ship.typeId].crew;
        const crewCost = 25; // per sailor
        const currentCrew = ship.crew;
        const canHire = Math.min(maxCrew - currentCrew, Math.floor(Game.state.player.gold / crewCost));

        let html = `<div style="max-width:380px">
            <h3 style="margin:0 0 12px;color:var(--accent)">👥 Crew — ${ship.name}</h3>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:12px">
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px;text-align:center">
                    <div style="color:var(--text-dim)">Aktuelle Crew</div>
                    <div style="font-size:20px;font-weight:bold;color:${currentCrew < maxCrew * 0.5 ? 'var(--danger)' : 'var(--text)'}">${currentCrew}</div></div>
                <div style="padding:8px;background:rgba(15,52,96,0.3);border-radius:4px;text-align:center">
                    <div style="color:var(--text-dim)">Maximum</div>
                    <div style="font-size:20px;font-weight:bold">${maxCrew}</div>
                </div>
            </div>
            <div style="margin-bottom:8px;font-size:11px;color:var(--text-dim)">
                Mehr Crew = stärkerer Kampfbonus & schnelleres Segeln.<br>
                Kosten: ${crewCost} G pro Matrose.
            </div>`;

        // Crew bar
        const crewPct = Math.round(currentCrew / maxCrew * 100);
        const crewColor = crewPct > 60 ? '#2eac68' : (crewPct > 30 ? '#e8a020' : '#d94040');
        html += `<div style="height:12px;background:rgba(0,0,0,0.3);border-radius:6px;overflow:hidden;margin-bottom:12px">
            <div style="height:100%;width:${crewPct}%;background:${crewColor};border-radius:6px;transition:width 0.3s"></div>
        </div>`;

        // Hire buttons
        html += `<div style="display:flex;gap:6px;margin-bottom:8px">
            <button class="trade-btn buy" style="flex:1;padding:6px" onclick="UI.hireCrew('${ship.id}',1)" ${canHire < 1 ? 'disabled' : ''}>+1 (${crewCost}G)</button>
            <button class="trade-btn buy" style="flex:1;padding:6px" onclick="UI.hireCrew('${ship.id}',5)" ${canHire < 1 ? 'disabled' : ''}>+5 (${crewCost*5}G)</button>
            <button class="trade-btn buy" style="flex:1;padding:6px" onclick="UI.hireCrew('${ship.id}',${maxCrew - currentCrew})" ${canHire < 1 ? 'disabled' : ''}>Voll (${(maxCrew-currentCrew)*crewCost}G)</button>
        </div>`;

        // Fire buttons
        html += `<div style="display:flex;gap:6px;margin-bottom:16px">
            <button class="trade-btn sell" style="flex:1;padding:6px" onclick="UI.fireCrew('${ship.id}',1)" ${currentCrew <= 3 ? 'disabled' : ''}>-1</button>
            <button class="trade-btn sell" style="flex:1;padding:6px" onclick="UI.fireCrew('${ship.id}',5)" ${currentCrew <= 3 ? 'disabled' : ''}>-5</button>
        </div>`;

        html += `<button class="modal-btn secondary" style="width:100%" onclick="UI.hideModal()">Schließen</button>
        </div>`;

        this.showModal(html);
    },

    hireCrew(shipId, amount) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        const maxCrew = ship.maxCrew || SHIP_TYPES[ship.typeId].crew;
        const crewCost = 25;
        const actual = Math.min(amount, maxCrew - ship.crew, Math.floor(Game.state.player.gold / crewCost));

        if (actual <= 0) {
            this.showNotification('Kann keine Crew anheuern!', 'warning');
            return;
        }

        ship.crew += actual;
        Game.state.player.gold -= actual * crewCost;
        Sound.play('coins');
        this.addLogMessage(`${actual} Matrosen für ${ship.name} angeheuert. (${actual * crewCost} G)`, 'info');
        this.showCrewManagement(shipId); // Refresh
        this.updateTopBar(Game.state);
    },

    fireCrew(shipId, amount) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        const minCrew = 3;
        const actual = Math.min(amount, ship.crew - minCrew);

        if (actual <= 0) {
            this.showNotification('Mindestens 3 Matrosen benötigt!', 'warning');
            return;
        }

        ship.crew -= actual;
        Sound.play('click');
        this.addLogMessage(`${actual} Matrosen von ${ship.name} entlassen.`, 'info');
        this.showCrewManagement(shipId); // Refresh
    }
};
