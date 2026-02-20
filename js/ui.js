/* ============================================
   HANSE - UI Manager
   ============================================ */

const UI = {
    currentTab: 'city',
    selectedShipId: null,
    notifications: [],

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
        }
    },

    // Update top bar info
    updateTopBar(gameState) {
        document.getElementById('player-display').textContent = gameState.player.name;
        document.getElementById('rank-display').textContent = gameState.player.rank;
        document.getElementById('date-display').textContent = Utils.formatDate(
            gameState.date.day, gameState.date.month, gameState.date.year
        );
        document.getElementById('gold-display').textContent = Utils.formatGold(gameState.player.gold);
    },

    // City tab
    onCitySelected(cityId) {
        GameMap.selectedCity = cityId;
        this.switchTab('city');
        this.updateCityTab();
    },

    updateCityTab() {
        const cityId = GameMap.selectedCity;
        if (!cityId || !Game.state) {
            document.getElementById('city-name').textContent = 'Keine Stadt ausgewaehlt';
            document.getElementById('city-details').innerHTML = '<p style="color: var(--text-dim)">Klicke auf eine Stadt in der Karte.</p>';
            return;
        }

        const city = CITIES_DATA[cityId];
        const cityState = Game.state.cities[cityId];

        document.getElementById('city-name').textContent = city.displayName;

        let html = '';

        // Basic info
        html += this.detailRow('Einwohner', Utils.formatNumber(cityState.population));
        html += this.detailRow('Bedeutung', '★'.repeat(city.importance) + '☆'.repeat(5 - city.importance));
        html += this.detailRow('Werft', city.hasShipyard ? 'Ja' : 'Nein');

        // Player buildings
        if (cityState.playerBuildings && cityState.playerBuildings.length > 0) {
            html += this.detailRow('Eure Gebaeude', cityState.playerBuildings.length);
        }

        // Reputation
        const rep = cityState.reputation || 0;
        html += this.detailRow('Ansehen', rep > 0 ? `+${rep}` : rep);

        // Ships docked here
        const dockedShips = Game.state.player.ships.filter(s => s.location === cityId);
        if (dockedShips.length > 0) {
            html += this.detailRow('Eure Schiffe', dockedShips.map(s => s.name).join(', '));
        }

        // Market overview
        html += '<div class="city-goods-section"><h4>Marktpreise</h4>';
        GOOD_IDS.forEach(goodId => {
            const m = cityState.market[goodId];
            const good = GOODS[goodId];
            const trendClass = m.trend > 0 ? 'trend-up' : (m.trend < 0 ? 'trend-down' : 'trend-stable');
            const trendIcon = m.trend > 0 ? '▲' : (m.trend < 0 ? '▼' : '─');

            html += `<div class="city-good-row">
                <span class="city-good-name">${good.icon} ${good.name}</span>
                <span class="city-good-stock">${Math.floor(m.stock)}</span>
                <span class="city-good-price">${m.price} G</span>
                <span class="city-good-trend ${trendClass}">${trendIcon}</span>
            </div>`;
        });
        html += '</div>';

        document.getElementById('city-details').innerHTML = html;
    },

    detailRow(label, value) {
        return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`;
    },

    // Trade tab
    updateTradeTab() {
        const cityId = GameMap.selectedCity;
        const panel = document.getElementById('trade-goods-list');

        if (!cityId || !Game.state) {
            panel.innerHTML = '<p style="color: var(--text-dim)">Waehle eine Stadt zum Handeln.</p>';
            return;
        }

        // Find player ships docked at this city
        const dockedShips = Game.state.player.ships.filter(s => s.location === cityId && s.status === 'docked');

        if (dockedShips.length === 0) {
            panel.innerHTML = '<p style="color: var(--text-dim)">Kein Schiff in dieser Stadt zum Handeln.</p>';
            return;
        }

        const ship = dockedShips[0]; // Use first docked ship
        const cityState = Game.state.cities[cityId];

        let html = `<div class="trade-summary">
            <div class="trade-summary-row"><span>Schiff:</span><span>${ship.name}</span></div>
            <div class="trade-summary-row"><span>Fracht:</span><span>${getCargoCount(ship)} / ${ship.capacity}</span></div>
            <div class="trade-summary-row"><span>Gold:</span><span style="color:var(--gold-color)">${Utils.formatGold(Game.state.player.gold)}</span></div>
        </div>`;

        GOOD_IDS.forEach(goodId => {
            const m = cityState.market[goodId];
            const good = GOODS[goodId];
            const inCargo = ship.cargo[goodId] || 0;

            html += `<div class="trade-row">
                <div class="trade-good-info">
                    <div class="trade-good-name">${good.icon} ${good.name}</div>
                    <div class="trade-good-detail">Preis: ${m.price} G | Vorrat: ${Math.floor(m.stock)} | Im Schiff: ${inCargo}</div>
                </div>
                <div class="trade-actions">
                    <button class="trade-btn buy" onclick="UI.executeTrade('buy','${goodId}','${ship.id}','${cityId}',5)" ${Game.state.player.gold < m.price || m.stock < 1 || getRemainingCapacity(ship) <= 0 ? 'disabled' : ''}>+5</button>
                    <button class="trade-btn-max" onclick="UI.executeTrade('buy','${goodId}','${ship.id}','${cityId}',999)" ${Game.state.player.gold < m.price || m.stock < 1 || getRemainingCapacity(ship) <= 0 ? 'disabled' : ''}>Max</button>
                    <button class="trade-btn sell" onclick="UI.executeTrade('sell','${goodId}','${ship.id}','${cityId}',5)" ${inCargo <= 0 ? 'disabled' : ''}>-5</button>
                    <button class="trade-btn-max" onclick="UI.executeTrade('sell','${goodId}','${ship.id}','${cityId}',999)" ${inCargo <= 0 ? 'disabled' : ''}>Alle</button>
                </div>
            </div>`;
        });

        panel.innerHTML = html;
    },

    executeTrade(action, goodId, shipId, cityId, amount) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        let result;
        if (action === 'buy') {
            result = Trading.buy(Game.state, cityId, goodId, amount, ship);
            if (result.success) Sound.play('buy');
        } else {
            result = Trading.sell(Game.state, cityId, goodId, amount, ship);
            if (result.success) Sound.play('sell');
        }

        if (result.success) {
            this.addLogMessage(result.message, 'trade');
        } else {
            this.showNotification(result.message, 'warning');
        }

        this.updateTradeTab();
        this.updateTopBar(Game.state);
    },

    // Fleet tab
    updateFleetTab() {
        const panel = document.getElementById('fleet-list');
        const player = Game.state ? Game.state.player : null;
        if (!player) return;

        let html = '';

        if (player.ships.length === 0) {
            html = '<p style="color: var(--text-dim)">Keine Schiffe. Kaufe eines in einer Stadt mit Werft!</p>';
        }

        player.ships.forEach(ship => {
            const type = SHIP_TYPES[ship.typeId];
            const cargoPercent = (getCargoCount(ship) / ship.capacity * 100).toFixed(0);
            const hullPercent = (ship.hull / ship.maxHull * 100).toFixed(0);

            let statusText = '';
            let statusClass = '';
            if (ship.status === 'docked') {
                statusText = `Angedockt: ${CITIES_DATA[ship.location]?.displayName || ship.location}`;
                statusClass = 'docked';
            } else if (ship.status === 'sailing') {
                const dest = ship.route ? ship.route[ship.route.length - 1] : ship.destination;
                statusText = `Unterwegs: ${CITIES_DATA[dest]?.displayName || dest}`;
                statusClass = 'sailing';
            }

            html += `<div class="ship-card ${this.selectedShipId === ship.id ? 'selected' : ''}" onclick="UI.selectShip('${ship.id}')">
                <div class="ship-card-header">
                    <span class="ship-card-name">${ship.name}</span>
                    <span class="ship-card-type">${type.name}</span>
                </div>
                <div class="ship-card-stats">
                    <div class="ship-stat"><span class="ship-stat-label">Rumpf:</span><span class="ship-stat-value">${hullPercent}%</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Fracht:</span><span class="ship-stat-value">${getCargoCount(ship)}/${ship.capacity}</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Geschw.:</span><span class="ship-stat-value">${ship.speed.toFixed(1)}</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Kanonen:</span><span class="ship-stat-value">${ship.cannons}</span></div>
                </div>
                <div class="ship-cargo-bar"><div class="ship-cargo-fill" style="width:${cargoPercent}%"></div></div>
                <div class="ship-status ${statusClass}">${statusText}</div>
            </div>`;

            // If selected and docked, show navigation options
            if (this.selectedShipId === ship.id && ship.status === 'docked') {
                html += this.renderNavigationOptions(ship);
            }
        });

        panel.innerHTML = html;

        // Shipyard
        this.updateShipyard();
    },

    renderNavigationOptions(ship) {
        const connected = getConnectedCities(ship.location);
        let html = '<div style="padding:8px;background:rgba(15,52,96,0.4);border-radius:4px;margin-bottom:8px">';
        html += '<div style="font-size:12px;color:var(--accent);margin-bottom:6px">Ziel waehlen:</div>';

        connected.forEach(destId => {
            const city = CITIES_DATA[destId];
            const route = findShortestPath(ship.location, destId);
            const travelDays = route ? route.distance * 3 : '?';

            html += `<button class="trade-btn buy" style="margin:2px;padding:4px 8px;font-size:11px"
                onclick="UI.sailShip('${ship.id}','${destId}')">${city.displayName} (~${travelDays} Tage)</button>`;
        });

        // Repair option if damaged
        if (ship.hull < ship.maxHull) {
            const repairCost = Math.ceil((ship.maxHull - ship.hull) * 10);
            html += `<div style="margin-top:6px"><button class="trade-btn-max" onclick="UI.repairShip('${ship.id}')"
                ${Game.state.player.gold < repairCost ? 'disabled' : ''}>Reparieren (${repairCost} Gold)</button></div>`;
        }

        html += '</div>';
        return html;
    },

    selectShip(shipId) {
        this.selectedShipId = this.selectedShipId === shipId ? null : shipId;
        Sound.play('click');
        this.updateFleetTab();
    },

    sailShip(shipId, destId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship || ship.status !== 'docked') return;

        const route = findShortestPath(ship.location, destId);
        if (!route) {
            this.showNotification('Keine Route gefunden!', 'warning');
            return;
        }

        ship.route = route.path;
        ship.routeIndex = 0;
        ship.progress = 0;
        ship.status = 'sailing';
        ship.destination = destId;
        ship.location = null;

        Sound.play('sail');
        this.addLogMessage(`${ship.name} segelt nach ${CITIES_DATA[destId].displayName}.`, 'info');
        this.selectedShipId = null;
        this.updateFleetTab();
    },

    repairShip(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        const repairCost = Math.ceil((ship.maxHull - ship.hull) * 10);
        if (Game.state.player.gold < repairCost) {
            this.showNotification('Nicht genug Gold!', 'warning');
            return;
        }

        Game.state.player.gold -= repairCost;
        ship.hull = ship.maxHull;
        ship.damaged = false;

        Sound.play('build');
        this.addLogMessage(`${ship.name} wurde fuer ${Utils.formatGold(repairCost)} repariert.`, 'info');
        this.updateFleetTab();
        this.updateTopBar(Game.state);
    },

    updateShipyard() {
        const section = document.getElementById('shipyard-section');
        const list = document.getElementById('shipyard-list');
        const cityId = GameMap.selectedCity;

        if (!cityId || !CITIES_DATA[cityId].hasShipyard) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');

        // Check if player has a ship docked here (requirement for shipyard access)
        const hasPresence = Game.state.player.ships.some(s => s.location === cityId) ||
            (Game.state.cities[cityId].playerBuildings || []).some(b => b.type === 'kontor');

        if (!hasPresence) {
            list.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Ihr braucht ein Kontor oder Schiff hier.</p>';
            return;
        }

        let html = '';
        SHIP_TYPE_IDS.forEach(typeId => {
            const type = SHIP_TYPES[typeId];
            html += `<div class="shipyard-item">
                <div class="shipyard-item-header">
                    <span class="shipyard-item-name">${type.name}</span>
                    <span class="shipyard-item-cost">${Utils.formatGold(type.cost)}</span>
                </div>
                <div class="shipyard-item-stats">
                    Fracht: ${type.capacity} | Geschw: ${type.speed} | Rumpf: ${type.hull} | Kanonen: ${type.cannons}
                </div>
                <button class="shipyard-buy-btn" onclick="UI.buyShip('${typeId}','${cityId}')"
                    ${Game.state.player.gold < type.cost ? 'disabled' : ''}>Kaufen</button>
            </div>`;
        });

        list.innerHTML = html;
    },

    buyShip(typeId, cityId) {
        const type = SHIP_TYPES[typeId];
        if (Game.state.player.gold < type.cost) {
            this.showNotification('Nicht genug Gold!', 'warning');
            return;
        }

        Game.state.player.gold -= type.cost;
        const name = generateShipName();
        const ship = createShip(typeId, name, cityId);
        Game.state.player.ships.push(ship);

        Sound.play('build');
        this.addLogMessage(`Neues Schiff "${name}" (${type.name}) in ${CITIES_DATA[cityId].displayName} gekauft!`, 'trade');
        this.showNotification(`${type.name} "${name}" erworben!`, 'success');
        this.updateFleetTab();
        this.updateTopBar(Game.state);
    },

    // Build tab
    updateBuildTab() {
        const panel = document.getElementById('build-list');
        const cityId = GameMap.selectedCity;

        if (!cityId || !Game.state) {
            panel.innerHTML = '<p style="color: var(--text-dim)">Waehle eine Stadt zum Bauen.</p>';
            return;
        }

        const cityState = Game.state.cities[cityId];
        const available = Buildings.getAvailable(Game.state, cityId);

        let html = `<p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">${CITIES_DATA[cityId].displayName}</p>`;

        // Show existing buildings
        if (cityState.playerBuildings && cityState.playerBuildings.length > 0) {
            html += '<h4 style="color:var(--text-dim);font-size:11px;text-transform:uppercase;margin-bottom:6px">Eure Gebaeude</h4>';
            cityState.playerBuildings.forEach(b => {
                const type = BUILDING_TYPES[b.type];
                html += `<div class="build-item" style="border-color:var(--success)">
                    <div class="build-item-header">
                        <span class="build-item-name">${type.icon} ${type.name}</span>
                        <span style="color:var(--text-dim);font-size:11px">Stufe ${b.level}</span>
                    </div>
                    <div class="build-item-desc">${type.effect}</div>
                </div>`;
            });
            html += '<div style="height:12px"></div>';
        }

        // Show available buildings
        html += '<h4 style="color:var(--text-dim);font-size:11px;text-transform:uppercase;margin-bottom:6px">Verfuegbar</h4>';

        if (available.length === 0) {
            html += '<p style="color:var(--text-dim);font-size:12px">Keine weiteren Gebaeude verfuegbar.</p>';
        }

        available.forEach(item => {
            html += `<div class="build-item">
                <div class="build-item-header">
                    <span class="build-item-name">${item.type.icon} ${item.isUpgrade ? 'Ausbau: ' : ''}${item.type.name}</span>
                    <span class="build-item-cost">${Utils.formatGold(item.cost)}</span>
                </div>
                <div class="build-item-desc">${item.type.description}</div>
                <button class="build-buy-btn" onclick="UI.buildBuilding('${cityId}','${item.typeId}')"
                    ${Game.state.player.gold < item.cost ? 'disabled' : ''}>${item.isUpgrade ? 'Ausbauen' : 'Bauen'}</button>
            </div>`;
        });

        panel.innerHTML = html;
    },

    buildBuilding(cityId, typeId) {
        const result = Buildings.build(Game.state, cityId, typeId);
        if (result.success) {
            Sound.play('build');
            this.addLogMessage(result.message, 'trade');
            this.showNotification(result.message, 'success');
        } else {
            this.showNotification(result.message, 'warning');
        }
        this.updateBuildTab();
        this.updateTopBar(Game.state);
    },

    // Wind indicator
    updateWind(gameState) {
        const directions = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
        const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
        const idx = gameState.wind.direction;
        document.getElementById('wind-direction').textContent = arrows[idx];
        document.getElementById('wind-label').textContent = `${directions[idx]} ${gameState.wind.strength.toFixed(1)}`;
    },

    // Message log
    addLogMessage(text, type) {
        const log = document.getElementById('message-log');
        const time = Game.state ? Utils.formatDateShort(Game.state.date.day, Game.state.date.month, Game.state.date.year) : '';

        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `<span class="log-time">${time}</span><span class="log-text ${type || ''}">${text}</span>`;

        log.insertBefore(entry, log.firstChild);

        // Keep log manageable
        while (log.children.length > 100) {
            log.removeChild(log.lastChild);
        }
    },

    // Notifications
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

    // Modal
    showModal(html) {
        document.getElementById('modal-content').innerHTML = html;
        document.getElementById('modal-overlay').classList.remove('hidden');
    },

    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    // Event popup
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

    // Game menu
    showGameMenu() {
        const html = `<h3>Spielmenue</h3>
            <div class="modal-buttons" style="flex-direction:column;gap:8px">
                <button class="modal-btn primary" onclick="Game.save();UI.showNotification('Gespeichert!','success');UI.hideModal()">Spiel speichern</button>
                <button class="modal-btn secondary" onclick="Sound.toggle();UI.hideModal();UI.showNotification(Sound.enabled?'Ton an':'Ton aus','info')">Ton ${Sound.enabled ? 'aus' : 'ein'}</button>
                <button class="modal-btn danger" onclick="UI.hideModal();Game.returnToTitle()">Zum Hauptmenue</button>
                <button class="modal-btn secondary" onclick="UI.hideModal()">Zurueck</button>
            </div>`;
        this.showModal(html);
    },

    // Rank up notification
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
    }
};
