/* ============================================
   HANSE - Enhanced UI Manager
   Phase 2: Price charts, better trade UI, sliders
   ============================================ */

const UI = {
    currentTab: 'city',
    selectedShipId: null,
    selectedTradeShipIdx: 0,
    notifications: [],
    tradeQuantities: {}, // store qty per good for trade tab
    tutorialStep: -1,    // -1 = inactive, 0+ = active step
    tutorialDismissed: false,

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

    // Update top bar
    updateTopBar(gameState) {
        document.getElementById('player-display').textContent = gameState.player.name;
        document.getElementById('rank-display').textContent = gameState.player.rank;
        document.getElementById('date-display').textContent = Utils.formatDate(
            gameState.date.day, gameState.date.month, gameState.date.year
        );
        document.getElementById('gold-display').textContent = Utils.formatGold(gameState.player.gold);
    },

    // === CITY TAB ===
    onCitySelected(cityId) {
        GameMap.selectedCity = cityId;
        // If there's a tutorial active, advance it
        if (this.tutorialStep !== undefined && this.tutorialStep >= 0) {
            this.advanceTutorial(cityId);
        }
        this.switchTab('city');
        this.updateCityTab();
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
        html += this.detailRow('Bedeutung', '<span style="color:#ffd700">' + '\u2605'.repeat(city.importance) + '</span>' + '\u2606'.repeat(5 - city.importance));
        html += this.detailRow('Werft', city.hasShipyard ? '<span style="color:var(--success)">Ja</span>' : 'Nein');

        // Player buildings
        if (cityState.playerBuildings && cityState.playerBuildings.length > 0) {
            html += this.detailRow('Eure Gebaeude', cityState.playerBuildings.map(b => BUILDING_TYPES[b.type].icon).join(' '));
        }

        // Reputation
        const rep = cityState.reputation || 0;
        html += this.detailRow('Ansehen', rep > 0 ? `<span style="color:var(--success)">+${rep}</span>` : `${rep}`);

        // Ships docked here
        const dockedShips = Game.state.player.ships.filter(s => s.location === cityId);
        if (dockedShips.length > 0) {
            html += this.detailRow('Eure Schiffe', dockedShips.map(s => s.name).join(', '));
        }

        // Net worth
        const netWorth = Game.calculateNetWorth();
        html += this.detailRow('Vermoegen', `<span style="color:var(--gold-color)">${Utils.formatGold(netWorth)}</span>`);

        // === "SAIL HERE" quick navigation ===
        const shipsElsewhere = Game.state.player.ships.filter(
            s => s.location !== cityId && s.status === 'docked'
        );
        if (shipsElsewhere.length > 0) {
            html += '<div style="margin:8px 0;padding:8px;background:rgba(15,52,96,0.5);border:1px solid var(--accent);border-radius:6px">';
            html += '<div style="font-size:12px;color:var(--accent);margin-bottom:6px;font-weight:bold">Schiff hierher senden:</div>';
            shipsElsewhere.forEach(ship => {
                const from = CITIES_DATA[ship.location];
                const route = findShortestPath(ship.location, cityId);
                if (route) {
                    const travelDays = route.distance * 3;
                    html += `<button class="trade-btn buy" style="margin:2px;padding:5px 10px;font-size:11px;width:100%;text-align:left"
                        onclick="UI.sailShip('${ship.id}','${cityId}');UI.switchTab('city')">
                        ${ship.name} (${from.displayName}, ~${travelDays} Tage)</button>`;
                }
            });
            html += '</div>';
        }

        // Market overview with mini charts
        html += '<div class="city-goods-section"><h4>Marktpreise</h4>';
        GOOD_IDS.forEach(goodId => {
            const m = cityState.market[goodId];
            const good = GOODS[goodId];
            const trendClass = m.trend > 0 ? 'trend-up' : (m.trend < 0 ? 'trend-down' : 'trend-stable');
            const trendIcon = m.trend > 0 ? '\u25B2' : (m.trend < 0 ? '\u25BC' : '\u2500');

            // Price vs base comparison
            const vsBase = m.price - good.basePrice;
            const vsColor = vsBase > 5 ? 'var(--danger)' : (vsBase < -5 ? 'var(--success)' : 'var(--text-dim)');

            html += `<div class="city-good-row" onclick="UI.showPriceDetail('${cityId}','${goodId}')" style="cursor:pointer" title="Klicken fuer Preishistorie">
                <span class="city-good-name">${good.icon} ${good.name}</span>
                <span class="city-good-stock" title="Vorrat">${Math.floor(m.stock)}</span>
                <span class="city-good-price">${m.price} G</span>
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
                <div>Nachfrage: ${'\u2588'.repeat(m.demand) || '\u2500'}</div>
                <div>Produktion: ${'\u2588'.repeat(m.production) || '\u2500'}</div>
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

    // === TRADE TAB ===
    updateTradeTab() {
        const cityId = GameMap.selectedCity;
        const panel = document.getElementById('trade-goods-list');

        if (!cityId || !Game.state) {
            panel.innerHTML = '<p style="color:var(--text-dim)">Waehle eine Stadt zum Handeln.</p>';
            return;
        }

        const dockedShips = Game.state.player.ships.filter(s => s.location === cityId && s.status === 'docked');

        if (dockedShips.length === 0) {
            panel.innerHTML = '<p style="color:var(--text-dim)">Kein Schiff in dieser Stadt. Sendet ein Schiff hierher oder kauft eines in der Werft.</p>';
            return;
        }

        // Ship selector if multiple ships
        if (this.selectedTradeShipIdx >= dockedShips.length) this.selectedTradeShipIdx = 0;
        const ship = dockedShips[this.selectedTradeShipIdx];
        const cityState = Game.state.cities[cityId];
        const cargoCount = getCargoCount(ship);
        const cargoPercent = Math.round(cargoCount / ship.capacity * 100);

        let html = '';

        // Ship selector
        if (dockedShips.length > 1) {
            html += '<div style="display:flex;gap:4px;margin-bottom:8px">';
            dockedShips.forEach((s, i) => {
                const active = i === this.selectedTradeShipIdx;
                html += `<button onclick="UI.selectedTradeShipIdx=${i};UI.updateTradeTab()"
                    style="flex:1;padding:4px 6px;font-size:11px;border-radius:3px;cursor:pointer;
                    background:${active ? 'var(--accent-dark)' : 'var(--bg-medium)'};
                    color:${active ? '#fff' : 'var(--text-dim)'};
                    border:1px solid ${active ? 'var(--accent)' : 'var(--border)'}">${s.name}</button>`;
            });
            html += '</div>';
        }

        // Ship summary with cargo bar
        html += `<div class="trade-summary">
            <div class="trade-summary-row"><span>Schiff:</span><span>${ship.name} (${SHIP_TYPES[ship.typeId].name})</span></div>
            <div class="trade-summary-row"><span>Fracht:</span><span>${cargoCount} / ${ship.capacity}</span></div>
            <div class="ship-cargo-bar" style="margin:4px 0"><div class="ship-cargo-fill" style="width:${cargoPercent}%"></div></div>
            <div class="trade-summary-row"><span>Gold:</span><span style="color:var(--gold-color)">${Utils.formatGold(Game.state.player.gold)}</span></div>
        </div>`;

        // Goods list
        GOOD_IDS.forEach(goodId => {
            const m = cityState.market[goodId];
            const good = GOODS[goodId];
            const inCargo = ship.cargo[goodId] || 0;
            const maxBuy = Math.min(
                Math.floor(Game.state.player.gold / m.price),
                Math.floor(m.stock),
                getRemainingCapacity(ship)
            );
            const trendIcon = m.trend > 0 ? '<span style="color:var(--danger)">\u25B2</span>' : (m.trend < 0 ? '<span style="color:var(--success)">\u25BC</span>' : '<span style="color:var(--text-dim)">\u2500</span>');

            // Price color: green if below base (good buy), red if above (good sell)
            const priceColor = m.price < good.basePrice * 0.85 ? 'var(--success)' : (m.price > good.basePrice * 1.15 ? 'var(--danger)' : 'var(--text-light)');

            html += `<div class="trade-row">
                <div class="trade-good-info" style="min-width:0">
                    <div class="trade-good-name">${good.icon} ${good.name} ${trendIcon}</div>
                    <div class="trade-good-detail">
                        <span style="color:${priceColor};font-weight:bold">${m.price} G</span>
                        <span style="color:var(--text-dim)">| Vorrat: ${Math.floor(m.stock)}</span>
                        ${inCargo > 0 ? `<span style="color:var(--accent)">| Fracht: ${inCargo}</span>` : ''}
                    </div>
                </div>
                <div class="trade-actions">
                    <button class="trade-btn buy" onclick="UI.executeTrade('buy','${goodId}','${ship.id}','${cityId}',1)"
                        ${maxBuy <= 0 ? 'disabled' : ''} title="1 kaufen">+1</button>
                    <button class="trade-btn buy" onclick="UI.executeTrade('buy','${goodId}','${ship.id}','${cityId}',5)"
                        ${maxBuy <= 0 ? 'disabled' : ''} title="5 kaufen">+5</button>
                    <button class="trade-btn buy" onclick="UI.executeTrade('buy','${goodId}','${ship.id}','${cityId}',25)"
                        ${maxBuy <= 0 ? 'disabled' : ''} title="25 kaufen">+25</button>
                    <button class="trade-btn-max" onclick="UI.executeTrade('buy','${goodId}','${ship.id}','${cityId}',9999)"
                        ${maxBuy <= 0 ? 'disabled' : ''} title="Maximum kaufen">Max</button>
                    <span style="width:6px"></span>
                    <button class="trade-btn sell" onclick="UI.executeTrade('sell','${goodId}','${ship.id}','${cityId}',1)"
                        ${inCargo <= 0 ? 'disabled' : ''} title="1 verkaufen">-1</button>
                    <button class="trade-btn sell" onclick="UI.executeTrade('sell','${goodId}','${ship.id}','${cityId}',5)"
                        ${inCargo <= 0 ? 'disabled' : ''} title="5 verkaufen">-5</button>
                    <button class="trade-btn-max" onclick="UI.executeTrade('sell','${goodId}','${ship.id}','${cityId}',9999)"
                        ${inCargo <= 0 ? 'disabled' : ''} title="Alle verkaufen">Alle</button>
                </div>
            </div>`;
        });

        // Quick actions
        html += `<div style="display:flex;gap:6px;margin-top:10px">
            <button class="trade-btn-max" style="flex:1;padding:6px" onclick="UI.sellAllCargo('${ship.id}','${cityId}')"
                ${cargoCount <= 0 ? 'disabled' : ''}>Alles verkaufen</button>
            <button class="trade-btn-max" style="flex:1;padding:6px" onclick="UI.autoBuyBest('${ship.id}','${cityId}')">Beste Waren laden</button>
        </div>`;

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
            // Visual feedback flash
            if (action === 'sell' && result.revenue > 0) {
                this.showTradeFlash(`+${Utils.formatGold(result.revenue)}`, 'success');
            } else if (action === 'buy' && result.cost > 0) {
                this.showTradeFlash(`-${Utils.formatGold(result.cost)}`, 'danger');
            }
        } else {
            this.showNotification(result.message, 'warning');
        }

        this.updateTradeTab();
        this.updateTopBar(Game.state);
    },

    showTradeFlash(text, type) {
        const goldEl = document.getElementById('gold-display');
        if (goldEl) {
            // Flash the gold display
            goldEl.style.transition = 'transform 0.15s, color 0.15s';
            goldEl.style.transform = 'scale(1.3)';
            goldEl.style.color = type === 'success' ? '#27ae60' : '#e74c3c';
            setTimeout(() => {
                goldEl.style.transform = 'scale(1)';
                goldEl.style.color = '';
            }, 400);
        }
        // Floating text notification
        this.showNotification(text, type === 'success' ? 'success' : 'warning');
    },

    sellAllCargo(shipId, cityId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        let totalRevenue = 0;
        let soldCount = 0;
        const goodsSold = [];

        GOOD_IDS.forEach(goodId => {
            const inCargo = ship.cargo[goodId] || 0;
            if (inCargo > 0) {
                const result = Trading.sell(Game.state, cityId, goodId, inCargo, ship);
                if (result.success) {
                    totalRevenue += result.revenue;
                    soldCount += result.amount;
                    goodsSold.push(`${result.amount} ${GOODS[goodId].name}`);
                }
            }
        });

        if (soldCount > 0) {
            Sound.play('sell');
            this.addLogMessage(`Alles verkauft: ${goodsSold.join(', ')} fuer ${Utils.formatGold(totalRevenue)}.`, 'trade');
            this.showNotification(`${Utils.formatGold(totalRevenue)} eingenommen!`, 'success');
        }

        this.updateTradeTab();
        this.updateTopBar(Game.state);
    },

    autoBuyBest(shipId, cityId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        // Find goods that are cheapest here (below average price)
        const cityState = Game.state.cities[cityId];
        const deals = GOOD_IDS.map(goodId => {
            const m = cityState.market[goodId];
            const good = GOODS[goodId];
            return {
                goodId,
                price: m.price,
                discount: (good.basePrice - m.price) / good.basePrice,
                stock: m.stock
            };
        }).filter(d => d.discount > 0 && d.stock > 2)
          .sort((a, b) => b.discount - a.discount);

        let totalCost = 0;
        let boughtCount = 0;

        for (const deal of deals) {
            const remaining = getRemainingCapacity(ship);
            if (remaining <= 0) break;

            const maxBuy = Math.min(
                remaining,
                Math.floor(Game.state.player.gold / deal.price),
                Math.floor(deal.stock * 0.5)
            );

            if (maxBuy > 0) {
                const result = Trading.buy(Game.state, cityId, deal.goodId, maxBuy, ship);
                if (result.success) {
                    totalCost += result.cost;
                    boughtCount += result.amount;
                }
            }
        }

        if (boughtCount > 0) {
            Sound.play('buy');
            this.addLogMessage(`${boughtCount} Waren automatisch geladen fuer ${Utils.formatGold(totalCost)}.`, 'trade');
            this.showNotification(`${boughtCount} Waren geladen!`, 'success');
        } else {
            this.showNotification('Keine guenstigen Waren verfuegbar.', 'warning');
        }

        this.updateTradeTab();
        this.updateTopBar(Game.state);
    },

    // === FLEET TAB ===
    updateFleetTab() {
        const panel = document.getElementById('fleet-list');
        const player = Game.state ? Game.state.player : null;
        if (!player) return;

        let html = '';

        if (player.ships.length === 0) {
            html = '<p style="color:var(--text-dim)">Keine Schiffe. Kaufe eines in einer Stadt mit Werft!</p>';
        }

        // Hint for ship interaction
        if (player.ships.length > 0 && !this.selectedShipId) {
            html += '<p style="color:var(--accent);font-size:11px;margin-bottom:8px;font-style:italic">Klicke auf ein Schiff fuer Navigationsziele und Reparatur.</p>';
        }

        player.ships.forEach(ship => {
            const type = SHIP_TYPES[ship.typeId];
            const cargoCount = getCargoCount(ship);
            const cargoPercent = Math.round(cargoCount / ship.capacity * 100);
            const hullPercent = Math.round(ship.hull / ship.maxHull * 100);

            let statusText = '';
            let statusClass = '';
            if (ship.status === 'building') {
                statusText = `Im Bau: ${ship.constructionDays} Tage (${CITIES_DATA[ship.location] ? CITIES_DATA[ship.location].displayName : ''})`;
                statusClass = 'sailing';
            } else if (ship.status === 'docked') {
                statusText = `Angedockt: ${CITIES_DATA[ship.location] ? CITIES_DATA[ship.location].displayName : ship.location}`;
                statusClass = 'docked';
            } else if (ship.status === 'sailing') {
                const dest = ship.route ? ship.route[ship.route.length - 1] : ship.destination;
                const destName = CITIES_DATA[dest] ? CITIES_DATA[dest].displayName : dest;
                const progressPct = ship.route ? Math.round((ship.routeIndex + ship.progress) / (ship.route.length - 1) * 100) : 0;
                statusText = `Unterwegs: ${destName} (${progressPct}%)`;
                statusClass = 'sailing';
            }

            // Cargo summary
            let cargoText = '';
            const cargoEntries = Object.entries(ship.cargo).filter(([, v]) => v > 0);
            if (cargoEntries.length > 0) {
                cargoText = cargoEntries.map(([gid, amt]) => `${GOODS[gid].icon}${amt}`).join(' ');
            }

            html += `<div class="ship-card ${this.selectedShipId === ship.id ? 'selected' : ''}" onclick="UI.selectShip('${ship.id}')">
                <div class="ship-card-header">
                    <span class="ship-card-name">${ship.name}</span>
                    <span class="ship-card-type">${type.name}</span>
                </div>
                <div class="ship-card-stats">
                    <div class="ship-stat"><span class="ship-stat-label">Rumpf:</span><span class="ship-stat-value" style="color:${hullPercent > 50 ? 'var(--text)' : (hullPercent > 25 ? 'var(--warning)' : 'var(--danger)')}">${hullPercent}%</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Fracht:</span><span class="ship-stat-value">${cargoCount}/${ship.capacity}</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Geschw.:</span><span class="ship-stat-value">${ship.speed.toFixed(1)}</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Kanonen:</span><span class="ship-stat-value">${ship.cannons}</span></div>
                </div>
                <div class="ship-cargo-bar"><div class="ship-cargo-fill" style="width:${cargoPercent}%"></div></div>
                ${cargoText ? `<div style="font-size:10px;margin-top:4px;color:var(--text-dim)">${cargoText}</div>` : ''}
                <div class="ship-status ${statusClass}">${statusText}</div>
            </div>`;

            // Navigation options for selected docked ship
            if (this.selectedShipId === ship.id && ship.status === 'docked') {
                html += this.renderNavigationOptions(ship);
            }
        });

        panel.innerHTML = html;
        this.updateShipyard();
    },

    renderNavigationOptions(ship) {
        const connected = getConnectedCities(ship.location);
        let html = '<div style="padding:8px;background:rgba(15,52,96,0.4);border-radius:4px;margin-bottom:8px">';
        html += '<div style="font-size:12px;color:var(--accent);margin-bottom:6px;font-weight:bold">Ziel waehlen:</div>';

        // Sort by distance
        const destinations = connected.map(destId => {
            const route = findShortestPath(ship.location, destId);
            return { destId, distance: route ? route.distance : 99, travelDays: route ? route.distance * 3 : '?' };
        }).sort((a, b) => a.distance - b.distance);

        destinations.forEach(dest => {
            const city = CITIES_DATA[dest.destId];
            html += `<button class="trade-btn buy" style="margin:2px;padding:4px 8px;font-size:11px;width:calc(50% - 4px)"
                onclick="UI.sailShip('${ship.id}','${dest.destId}')">${city.displayName} <span style="color:var(--text-dim)">(~${dest.travelDays}d)</span></button>`;
        });

        // Repair option
        if (ship.hull < ship.maxHull) {
            const repairCost = Math.ceil((ship.maxHull - ship.hull) * 10);
            html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
                <button class="build-buy-btn" style="width:100%" onclick="UI.repairShip('${ship.id}')"
                ${Game.state.player.gold < repairCost ? 'disabled' : ''}>Reparieren - ${Utils.formatGold(repairCost)}</button>
            </div>`;
        }

        // Sell ship option
        const sellPrice = Math.floor(SHIP_TYPES[ship.typeId].cost * 0.4);
        if (Game.state.player.ships.length > 1) {
            html += `<div style="margin-top:4px">
                <button class="trade-btn sell" style="width:100%;padding:4px" onclick="UI.sellShip('${ship.id}')"
                    title="Schiff verkaufen">Verkaufen (${Utils.formatGold(sellPrice)})</button>
            </div>`;
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

    sellShip(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship || Game.state.player.ships.length <= 1) return;

        const sellPrice = Math.floor(SHIP_TYPES[ship.typeId].cost * 0.4);

        this.showModal(`<div class="event-popup">
            <h3>Schiff verkaufen?</h3>
            <div class="event-text">"${ship.name}" (${SHIP_TYPES[ship.typeId].name}) fuer ${Utils.formatGold(sellPrice)} verkaufen?<br>
            ${getCargoCount(ship) > 0 ? '<span style="color:var(--warning)">Achtung: Fracht geht verloren!</span>' : ''}</div>
            <div class="modal-buttons">
                <button class="modal-btn danger" onclick="UI.confirmSellShip('${shipId}')">Verkaufen</button>
                <button class="modal-btn secondary" onclick="UI.hideModal()">Abbrechen</button>
            </div>
        </div>`);
    },

    confirmSellShip(shipId) {
        const idx = Game.state.player.ships.findIndex(s => s.id === shipId);
        if (idx === -1) return;

        const ship = Game.state.player.ships[idx];
        const sellPrice = Math.floor(SHIP_TYPES[ship.typeId].cost * 0.4);
        Game.state.player.gold += sellPrice;
        Game.state.player.ships.splice(idx, 1);

        Sound.play('sell');
        this.addLogMessage(`${ship.name} fuer ${Utils.formatGold(sellPrice)} verkauft.`, 'trade');
        this.hideModal();
        this.selectedShipId = null;
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

        const hasPresence = Game.state.player.ships.some(s => s.location === cityId) ||
            (Game.state.cities[cityId].playerBuildings || []).some(b => b.type === 'kontor');

        if (!hasPresence) {
            list.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Ihr braucht ein Kontor oder Schiff hier.</p>';
            return;
        }

        let html = '';
        SHIP_TYPE_IDS.forEach(typeId => {
            const type = SHIP_TYPES[typeId];
            const canAfford = Game.state.player.gold >= type.cost;
            const costColor = canAfford ? 'var(--gold-color)' : 'var(--danger)';
            html += `<div class="shipyard-item">
                <div class="shipyard-item-header">
                    <span class="shipyard-item-name">${type.name}</span>
                    <span class="shipyard-item-cost" style="color:${costColor}">${Utils.formatGold(type.cost)}</span>
                </div>
                <div class="shipyard-item-stats">
                    Fracht: ${type.capacity} | Geschw: ${type.speed} | Rumpf: ${type.hull} | Kanonen: ${type.cannons}
                    <br><span style="color:var(--text-dim)">${type.description}</span>
                </div>
                <button class="shipyard-buy-btn" onclick="UI.buyShip('${typeId}','${cityId}')"
                    ${canAfford ? '' : 'disabled'} style="${canAfford ? '' : 'opacity:0.5'}">Kaufen</button>
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

        // Construction time based on ship size
        const buildDays = typeId === 'small_cog' ? 7
            : typeId === 'cog' ? 12
            : typeId === 'hulk' ? 20
            : typeId === 'caravel' ? 18
            : typeId === 'carrack' ? 30
            : typeId === 'warship' ? 25
            : 15;
        ship.constructionDays = buildDays;
        ship.status = 'building';

        Game.state.player.ships.push(ship);

        Sound.play('build');
        this.addLogMessage(`Bau von "${name}" (${type.name}) in ${CITIES_DATA[cityId].displayName} begonnen! (${buildDays} Tage)`, 'trade');
        this.showNotification(`${type.name} "${name}" wird gebaut!`, 'success');
        this.updateFleetTab();
        this.updateTopBar(Game.state);
    },

    // === BUILD TAB ===
    updateBuildTab() {
        const panel = document.getElementById('build-list');
        const cityId = GameMap.selectedCity;

        if (!cityId || !Game.state) {
            panel.innerHTML = '<p style="color:var(--text-dim)">Waehle eine Stadt zum Bauen.</p>';
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
                const underConstruction = b.constructionDays > 0;
                const borderColor = underConstruction ? 'var(--warning)' : 'var(--success)';
                const statusText = underConstruction
                    ? (b.pendingUpgrade ? `Ausbau: ${b.constructionDays} Tage` : `Bau: ${b.constructionDays} Tage`)
                    : `Stufe ${b.level}`;
                const statusColor = underConstruction ? 'var(--warning)' : 'var(--text-dim)';
                html += `<div class="build-item" style="border-color:${borderColor}">
                    <div class="build-item-header">
                        <span class="build-item-name">${type.icon} ${type.name}</span>
                        <span style="color:${statusColor};font-size:11px">${statusText}</span>
                    </div>
                    <div class="build-item-desc">${type.effect}</div>
                    ${underConstruction ? `<div style="margin:4px 0"><div style="background:var(--bg-dark);border-radius:3px;height:6px;overflow:hidden"><div style="background:var(--warning);height:100%;width:${Math.max(5, 100 - b.constructionDays * 3)}%;transition:width 0.3s"></div></div></div>` : ''}
                    <div style="font-size:10px;color:var(--text-dim)">Unterhalt: ${type.maintenance * b.level} G/Monat</div>
                </div>`;
            });
            html += '<div style="height:12px"></div>';
        }

        // Available buildings
        html += '<h4 style="color:var(--text-dim);font-size:11px;text-transform:uppercase;margin-bottom:6px">Verfuegbar</h4>';

        if (available.length === 0 && (!cityState.playerBuildings || cityState.playerBuildings.length === 0)) {
            html += '<p style="color:var(--text-dim);font-size:12px">Errichtet zuerst ein Handelskontor!</p>';
        } else if (available.length === 0) {
            html += '<p style="color:var(--text-dim);font-size:12px">Alle Gebaeude errichtet.</p>';
        }

        available.forEach(item => {
            const canAfford = Game.state.player.gold >= item.cost;
            const costColor = canAfford ? 'var(--gold-color)' : 'var(--danger)';
            html += `<div class="build-item">
                <div class="build-item-header">
                    <span class="build-item-name">${item.type.icon} ${item.isUpgrade ? 'Ausbau: ' : ''}${item.type.name}</span>
                    <span class="build-item-cost" style="color:${costColor}">${Utils.formatGold(item.cost)}</span>
                </div>
                <div class="build-item-desc">${item.type.description}<br><em style="color:var(--text-dim)">${item.type.effect}</em></div>
                <button class="build-buy-btn" onclick="UI.buildBuilding('${cityId}','${item.typeId}')"
                    ${canAfford ? '' : 'disabled'} style="${canAfford ? '' : 'opacity:0.5'}">${item.isUpgrade ? 'Ausbauen' : 'Bauen'}</button>
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

    // === WIND ===
    updateWind(gameState) {
        const directions = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
        const arrows = ['\u2193', '\u2199', '\u2190', '\u2196', '\u2191', '\u2197', '\u2192', '\u2198'];
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

        const html = `<h3>Spielmenue</h3>
            <div style="font-size:12px;margin-bottom:16px;padding:10px;background:rgba(15,52,96,0.3);border-radius:4px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Vermoegen:</span><span style="color:var(--gold-color)">${Utils.formatGold(netWorth)}</span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Handelsvolumen:</span><span>${Utils.formatGold(totalTraded)}</span></div>
                <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Tage gespielt:</span><span>${daysPlayed}</span></div>
                <div style="display:flex;justify-content:space-between"><span>Schiffe:</span><span>${shipsOwned}</span></div>
            </div>
            <div class="modal-buttons" style="flex-direction:column;gap:8px">
                <button class="modal-btn primary" onclick="Game.save();UI.showNotification('Gespeichert!','success');UI.hideModal()">Spiel speichern</button>
                <button class="modal-btn secondary" onclick="Sound.toggle();UI.hideModal();UI.showNotification(Sound.enabled?'Ton an':'Ton aus','info')">Ton ${Sound.enabled ? 'aus' : 'ein'}</button>
                <button class="modal-btn danger" onclick="UI.hideModal();Game.returnToTitle()">Zum Hauptmenue</button>
                <button class="modal-btn secondary" onclick="UI.hideModal()">Zurueck</button>
            </div>`;
        this.showModal(html);
    },

    showRankUp(oldRank, newRank) {
        const html = `<div class="event-popup">
            <div class="event-icon">\uD83C\uDFC5</div>
            <h3>Befoerderung!</h3>
            <div class="event-text">Ihr wurdet vom ${oldRank} zum <strong style="color:var(--accent)">${newRank}</strong> befoerdert!</div>
            <div class="modal-buttons">
                <button class="modal-btn primary" onclick="UI.hideModal()">Vortrefflich!</button>
            </div>
        </div>`;
        this.showModal(html);
        Sound.play('newgame');
    },

    // === TUTORIAL SYSTEM ===
    startTutorial() {
        this.tutorialStep = 0;
        this.tutorialDismissed = false;
        this.showTutorialStep();
    },

    tutorialSteps: [
        {
            title: 'Willkommen bei der Hanse!',
            text: 'Ihr seid ein Kaufmann in eurer Heimatstadt. Lasst uns euren ersten Handel machen!<br><br><strong>Schritt 1:</strong> Schaut euch die Marktpreise im Stadt-Tab an. Guenstige Waren sind <span style="color:var(--success)">gruen</span> markiert.',
            action: 'Schaue die Preise an'
        },
        {
            title: 'Waren einkaufen',
            text: '<strong>Schritt 2:</strong> Wechselt zum <strong>Handel-Tab</strong> und kauft guenstige Waren ein. Tipp: Waren, die hier produziert werden, sind billig! Kauft davon mit den +1, +5 oder Max-Buttons.',
            action: 'Wechsle zum Handel-Tab',
            tab: 'trade'
        },
        {
            title: 'Ziel waehlen und segeln',
            text: '<strong>Schritt 3:</strong> Jetzt muesst ihr segeln! Es gibt zwei Wege:<br>1. <strong>Klickt auf eine andere Stadt</strong> in der Karte - dort erscheint ein "Schiff hierher senden"-Button.<br>2. Oder geht zum <strong>Flotte-Tab</strong>, klickt euer Schiff an, und waehlt ein Ziel.<br><br>Tipp: Verkauft eure Waren in Staedten, die sie nicht produzieren!',
            action: 'Segelt zu einer anderen Stadt'
        },
        {
            title: 'Waren verkaufen',
            text: '<strong>Schritt 4:</strong> Wenn euer Schiff ankommt, wechselt zum <strong>Handel-Tab</strong> und verkauft eure Waren. Waren die hier gebraucht werden kosten mehr - das ist euer Gewinn!',
            action: 'Verkauft eure Waren'
        },
        {
            title: 'Geschafft!',
            text: 'Sehr gut! Ihr kennt jetzt die Grundlagen des Hansehandels.<br><br><strong>Weitere Tipps:</strong><ul style="text-align:left;margin:8px 0"><li>Baut Gebaeude im <strong>Bauen-Tab</strong> fuer Produktion</li><li>Kauft groessere Schiffe in Staedten mit Werft</li><li>Beachtet den Wind - er beeinflusst die Reisezeit</li><li>Steigt im Rang auf, indem ihr Vermoegen anhaeuft</li></ul>',
            action: 'Viel Erfolg!'
        }
    ],

    showTutorialStep() {
        if (this.tutorialStep < 0 || this.tutorialStep >= this.tutorialSteps.length) return;
        const step = this.tutorialSteps[this.tutorialStep];
        const isLast = this.tutorialStep === this.tutorialSteps.length - 1;
        const html = `<div class="event-popup">
            <div style="font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">
                Tutorial (${this.tutorialStep + 1}/${this.tutorialSteps.length})
            </div>
            <h3>${step.title}</h3>
            <div class="event-text" style="text-align:left;line-height:1.5">${step.text}</div>
            <div class="modal-buttons">
                <button class="modal-btn primary" onclick="UI.nextTutorialStep()">${isLast ? 'Tutorial beenden' : 'Weiter'}</button>
                ${!isLast ? '<button class="modal-btn secondary" onclick="UI.dismissTutorial()">Tutorial beenden</button>' : ''}
            </div>
        </div>`;
        this.showModal(html);
    },

    nextTutorialStep() {
        this.tutorialStep++;
        if (this.tutorialStep >= this.tutorialSteps.length) {
            this.tutorialStep = -1;
            this.tutorialDismissed = true;
            this.hideModal();
            return;
        }
        this.showTutorialStep();
    },

    dismissTutorial() {
        this.tutorialStep = -1;
        this.tutorialDismissed = true;
        this.hideModal();
    },

    advanceTutorial(cityId) {
        // Auto-advance tutorial when player clicks a different city
        if (this.tutorialStep === 2 && cityId !== Game.state.player.homeCity) {
            // Player clicked another city - good!
        }
    }
};
