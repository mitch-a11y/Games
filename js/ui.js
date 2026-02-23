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
                    ? `\u2693 ${dockedShips.length} Schiff${dockedShips.length > 1 ? 'e' : ''}`
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

        // Cache profit data (recalculate only when city changes)
        if (this._bestSellCacheCity !== cityId) {
            this._bestSellCache = Trading.findBestSellCities(Game.state, cityId);
            this._bestSellCacheCity = cityId;
        }
        const bestSells = this._bestSellCache;

        let html = '';

        // Ship selector
        if (dockedShips.length > 1) {
            html += '<div class="trade-ship-selector">';
            dockedShips.forEach((s, i) => {
                const active = i === this.selectedTradeShipIdx;
                html += `<button class="trade-ship-btn ${active ? 'active' : ''}" onclick="UI.selectedTradeShipIdx=${i};UI.updateTradeTab()">${s.name}</button>`;
            });
            html += '</div>';
        }

        // Ship summary
        html += `<div class="trade-summary">
            <div class="trade-summary-row"><span>\u2693 ${ship.name}</span><span style="color:var(--text-dim)">${SHIP_TYPES[ship.typeId].name}</span></div>
            <div class="trade-summary-row"><span>Fracht:</span><span>${cargoCount} / ${ship.capacity} (${cargoPercent}%)</span></div>
            <div class="ship-cargo-bar" style="margin:4px 0"><div class="ship-cargo-fill" style="width:${cargoPercent}%"></div></div>
            <div class="trade-summary-row"><span>Verf\u00fcgbar:</span><span style="color:var(--gold-color);font-weight:bold">${Utils.formatGold(Game.state.player.gold)}</span></div>
        </div>`;

        // Trade Advisor — top opportunities
        const topTrades = Trading.getTopTradeOpportunities(Game.state, cityId, 3);
        if (topTrades.length > 0) {
            html += '<div class="trade-advisor">';
            html += '<div class="trade-advisor-title">\uD83D\uDCCA Handelsberater</div>';
            topTrades.forEach(t => {
                html += `<div class="trade-advisor-tip" onclick="UI.executeTrade('buy','${t.goodId}','${ship.id}','${cityId}',9999);Sound.play('buy')">
                    <span class="advisor-good">${t.good.icon} ${t.good.name}</span>
                    <span class="advisor-route">\u2192 ${t.bestCityName}</span>
                    <span class="advisor-profit">+${Math.round(t.profitPercent)}%</span>
                </div>`;
            });
            html += '</div>';
        }

        // Filter & Sort controls
        html += '<div class="trade-controls">';

        // Category filter
        html += '<div class="trade-filter-row">';
        const categories = [
            { id: 'all', label: 'Alle' },
            { id: 'food', label: 'Nahrung' },
            { id: 'raw', label: 'Rohstoffe' },
            { id: 'manufactured', label: 'Handwerk' },
            { id: 'luxury', label: 'Luxus' }
        ];
        categories.forEach(cat => {
            html += `<button class="trade-filter-btn ${this.tradeFilter === cat.id ? 'active' : ''}"
                onclick="UI.tradeFilter='${cat.id}';UI.updateTradeTab()">${cat.label}</button>`;
        });
        html += '</div>';

        // Sort + profit filter
        html += '<div class="trade-sort-row">';
        html += `<select class="trade-sort-select" onchange="UI.tradeSort=this.value;UI.updateTradeTab()">
            <option value="profit" ${this.tradeSort === 'profit' ? 'selected' : ''}>Sortieren: Profit</option>
            <option value="name" ${this.tradeSort === 'name' ? 'selected' : ''}>Sortieren: Name</option>
            <option value="price" ${this.tradeSort === 'price' ? 'selected' : ''}>Sortieren: Preis</option>
            <option value="stock" ${this.tradeSort === 'stock' ? 'selected' : ''}>Sortieren: Vorrat</option>
        </select>`;
        html += `<label class="trade-profit-toggle">
            <input type="checkbox" ${this.tradeProfitOnly ? 'checked' : ''} onchange="UI.tradeProfitOnly=this.checked;UI.updateTradeTab()">
            <span>Nur profitable</span>
        </label>`;
        html += '</div></div>';

        // Build goods list with sorting/filtering
        let goodsList = GOOD_IDS.map(goodId => {
            const m = cityState.market[goodId];
            const good = GOODS[goodId];
            const best = bestSells[goodId];
            return {
                goodId, good, m,
                inCargo: ship.cargo[goodId] || 0,
                profit: best.profit,
                profitPercent: best.profitPercent,
                bestCity: best.cityName,
                bestCityId: best.cityId,
                bestSellPrice: best.sellPrice,
                bestDistance: best.distance
            };
        });

        // Apply filters
        if (this.tradeFilter !== 'all') {
            goodsList = goodsList.filter(g => g.good.category === this.tradeFilter);
        }
        if (this.tradeProfitOnly) {
            goodsList = goodsList.filter(g => g.profit > 0);
        }

        // Apply sorting
        switch (this.tradeSort) {
            case 'profit':
                goodsList.sort((a, b) => b.profitPercent - a.profitPercent);
                break;
            case 'name':
                goodsList.sort((a, b) => a.good.name.localeCompare(b.good.name));
                break;
            case 'price':
                goodsList.sort((a, b) => a.m.price - b.m.price);
                break;
            case 'stock':
                goodsList.sort((a, b) => b.m.stock - a.m.stock);
                break;
        }

        // Render goods
        if (goodsList.length === 0) {
            html += '<p style="color:var(--text-dim);text-align:center;padding:12px">Keine Waren gefunden.</p>';
        }

        goodsList.forEach(g => {
            const { goodId, good, m, inCargo, profit, profitPercent, bestCity, bestDistance } = g;
            const maxBuy = Math.min(
                Math.floor(Game.state.player.gold / m.price),
                Math.floor(m.stock),
                getRemainingCapacity(ship)
            );
            const trendIcon = m.trend > 0 ? '<span style="color:var(--danger)">\u25B2</span>' : (m.trend < 0 ? '<span style="color:var(--success)">\u25BC</span>' : '<span style="color:var(--text-dim)">\u2500</span>');
            const priceColor = m.price < good.basePrice * 0.85 ? 'var(--success)' : (m.price > good.basePrice * 1.15 ? 'var(--danger)' : 'var(--text-light)');

            // Profit badge
            let profitBadge = '';
            if (profit > 0 && bestCity) {
                const pctRound = Math.round(profitPercent);
                const badgeColor = pctRound >= 30 ? 'var(--success)' : (pctRound >= 15 ? '#6a9a20' : 'var(--text-dim)');
                profitBadge = `<div class="trade-profit-badge" title="Kaufen hier ${m.price}G, verkaufen in ${bestCity} ${g.bestSellPrice}G (~${bestDistance} Tage)">
                    <span style="color:${badgeColor};font-weight:700">+${pctRound}%</span>
                    <span class="profit-dest">\u2192 ${bestCity}</span>
                </div>`;
            } else {
                profitBadge = `<div class="trade-profit-badge"><span style="color:var(--text-dim)">Kein Profit</span></div>`;
            }

            html += `<div class="trade-row ${profit >= 20 ? 'trade-row-hot' : ''}">
                <div class="trade-good-info" style="min-width:0">
                    <div class="trade-good-name">${good.icon} ${good.name} ${trendIcon}</div>
                    <div class="trade-good-detail">
                        <span style="color:${priceColor};font-weight:bold">${m.price} G</span>
                        <span style="color:var(--text-dim)">| Vorrat: ${Math.floor(m.stock)}</span>
                        ${inCargo > 0 ? `<span style="color:var(--accent)">| Fracht: ${inCargo}</span>` : ''}
                    </div>
                    ${profitBadge}
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

    // Invalidate trade profit cache (called when market changes or city changes)
    invalidateTradeCache() {
        this._bestSellCache = null;
        this._bestSellCacheCity = null;
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

        player.ships.forEach(ship => {
            const type = SHIP_TYPES[ship.typeId];
            const cargoCount = getCargoCount(ship);
            const cargoPercent = Math.round(cargoCount / ship.capacity * 100);
            const hullPercent = Math.round(ship.hull / ship.maxHull * 100);

            let statusText = '';
            let statusClass = '';
            if (ship.status === 'docked') {
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
                    <div class="ship-stat"><span class="ship-stat-label">Crew:</span><span class="ship-stat-value">${ship.crew}/${ship.maxCrew || ship.crew}</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Kanonen:</span><span class="ship-stat-value">${ship.cannons}</span></div>
                </div>
                <div class="ship-cargo-bar"><div class="ship-cargo-fill" style="width:${cargoPercent}%"></div></div>
                ${cargoText ? `<div style="font-size:10px;margin-top:4px;color:var(--text-dim)">${cargoText}</div>` : ''}
                ${ship.convoyId ? `<div style="font-size:10px;color:var(--accent);margin-top:2px">⚓ Konvoi</div>` : ''}
                <div class="ship-status ${statusClass}">${statusText}</div>
            </div>`;

            // Navigation options for selected docked ship
            if (this.selectedShipId === ship.id && ship.status === 'docked') {
                html += this.renderNavigationOptions(ship);
                html += this.renderConvoyOptions(ship);
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

        // Crew management
        html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
            <button class="shipyard-buy-btn" style="width:100%;padding:4px" onclick="UI.showCrewManagement('${ship.id}')">👥 Crew verwalten (${ship.crew}/${ship.maxCrew || ship.crew})</button>
        </div>`;

        // Auto-Trade
        html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">`;
        if (ship.autoTrade) {
            const atA = CITIES_DATA[ship.autoTrade.cityA]?.displayName || '?';
            const atB = CITIES_DATA[ship.autoTrade.cityB]?.displayName || '?';
            html += `<div style="font-size:11px;color:var(--accent);margin-bottom:4px">🔄 Auto-Handel aktiv</div>`;
            html += `<div style="font-size:10px;color:var(--text-dim);margin-bottom:6px">${atA} ↔ ${atB} (Min. ${ship.autoTrade.minProfit || 10}% Gewinn)</div>`;
            html += `<button class="trade-btn sell" style="width:100%;padding:4px" onclick="UI.stopAutoTrade('${ship.id}')">⏹ Auto-Handel stoppen</button>`;
        } else {
            html += `<button class="shipyard-buy-btn" style="width:100%;padding:4px" onclick="UI.showAutoTradeSetup('${ship.id}')">🔄 Auto-Handel einrichten</button>`;
        }
        html += `</div>`;

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

    renderConvoyOptions(ship) {
        const player = Game.state.player;
        // Find other docked ships at same location
        const otherShips = player.ships.filter(s =>
            s.id !== ship.id && s.status === 'docked' && s.location === ship.location
        );

        if (otherShips.length === 0 && !ship.convoyId) return '';

        let html = '<div style="padding:8px;background:rgba(230,168,23,0.08);border:1px solid rgba(230,168,23,0.15);border-radius:4px;margin-bottom:8px">';
        html += '<div style="font-size:12px;color:var(--accent);margin-bottom:6px;font-weight:bold">⚓ Konvoi</div>';

        if (ship.convoyId) {
            // Already in convoy — show members & option to leave
            const convoyShips = Convoy.getShips(player.ships, ship.convoyId);
            html += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">';
            html += 'Mitglieder: ' + convoyShips.map(s => s.name).join(', ');
            html += '</div>';
            html += `<button class="trade-btn sell" style="width:100%;padding:4px" onclick="UI.leaveConvoy('${ship.id}')">Konvoi verlassen</button>`;
        } else if (otherShips.length > 0) {
            // Can form convoy
            html += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">';
            html += `${otherShips.length} andere(s) Schiff(e) hier. Konvoi bilden für gemeinsame Reise & Kampfbonus.`;
            html += '</div>';

            // Checkboxes for each ship
            otherShips.forEach(s => {
                html += `<label style="display:block;font-size:11px;padding:3px 0;color:var(--text);cursor:pointer">
                    <input type="checkbox" class="convoy-check" value="${s.id}" checked style="margin-right:6px">
                    ${s.name} (${SHIP_TYPES[s.typeId].name})
                </label>`;
            });

            html += `<button class="shipyard-buy-btn" style="width:100%;margin-top:6px" onclick="UI.formConvoy('${ship.id}')">Konvoi bilden</button>`;
        }

        html += '</div>';
        return html;
    },

    formConvoy(leadShipId) {
        const player = Game.state.player;
        const leadShip = player.ships.find(s => s.id === leadShipId);
        if (!leadShip) return;

        // Get checked ships from checkboxes
        const checks = document.querySelectorAll('.convoy-check:checked');
        const shipIds = [leadShipId];
        checks.forEach(cb => shipIds.push(cb.value));

        const ships = shipIds.map(id => player.ships.find(s => s.id === id)).filter(Boolean);
        if (ships.length < 2) {
            this.showNotification('Mindestens 2 Schiffe für einen Konvoi nötig!', 'warning');
            return;
        }

        Convoy.create(ships);
        Sound.play('click');
        this.addLogMessage(`Konvoi gebildet: ${ships.map(s => s.name).join(', ')}`, 'info');
        this.showNotification(`Konvoi mit ${ships.length} Schiffen gebildet!`, 'success');
        this.updateFleetTab();
    },

    leaveConvoy(shipId) {
        const player = Game.state.player;
        const ship = player.ships.find(s => s.id === shipId);
        if (!ship || !ship.convoyId) return;

        const convoyId = ship.convoyId;
        const remaining = Convoy.getShips(player.ships, convoyId).filter(s => s.id !== shipId);

        // Remove this ship from convoy
        delete ship.convoyId;
        delete ship.convoySpeed;

        // If only 1 ship remains, disband entirely
        if (remaining.length <= 1) {
            Convoy.disband(player.ships, convoyId);
        }

        Sound.play('click');
        this.addLogMessage(`${ship.name} hat den Konvoi verlassen.`, 'info');
        this.updateFleetTab();
    },

    showAutoTradeSetup(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship || ship.status !== 'docked' || !ship.location) return;

        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');

        // Get connected cities for auto-trade route
        const connectedIds = CITY_IDS.filter(cid => cid !== ship.location && findShortestPath(ship.location, cid));

        let html = `<div style="max-width:380px">`;
        html += `<h3 style="margin:0 0 12px;color:var(--accent)">🔄 Auto-Handel einrichten</h3>`;
        html += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:12px">${ship.name} pendelt automatisch zwischen zwei Städten und handelt profitabel.</div>`;

        html += `<div style="margin-bottom:12px">`;
        html += `<label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Heimatstadt</label>`;
        html += `<div style="font-size:13px;color:var(--text);padding:6px;background:rgba(255,255,255,0.05);border-radius:4px">${CITIES_DATA[ship.location].displayName}</div>`;
        html += `</div>`;

        html += `<div style="margin-bottom:12px">`;
        html += `<label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Zielstadt</label>`;
        html += `<select id="at-dest" style="width:100%;padding:6px;background:var(--panel-bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:12px">`;
        connectedIds.forEach(cid => {
            const route = findShortestPath(ship.location, cid);
            const days = route ? route.distance * 3 : '?';
            html += `<option value="${cid}">${CITIES_DATA[cid].displayName} (~${days}d)</option>`;
        });
        html += `</select></div>`;

        html += `<div style="margin-bottom:12px">`;
        html += `<label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Min. Gewinn pro Ware: <span id="at-profit-val">10</span>%</label>`;
        html += `<input type="range" id="at-profit" min="5" max="50" value="10" step="5" style="width:100%" oninput="document.getElementById('at-profit-val').textContent=this.value">`;
        html += `</div>`;

        html += `<div style="margin-bottom:12px">`;
        html += `<label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Max. Einkauf: <span id="at-spend-val">50</span>% des Goldes</label>`;
        html += `<input type="range" id="at-spend" min="10" max="90" value="50" step="10" style="width:100%" oninput="document.getElementById('at-spend-val').textContent=this.value">`;
        html += `</div>`;

        html += `<div style="display:flex;gap:8px;margin-top:16px">`;
        html += `<button class="shipyard-buy-btn" style="flex:1" onclick="UI.startAutoTrade('${ship.id}')">Starten</button>`;
        html += `<button class="modal-btn secondary" style="flex:1" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Abbrechen</button>`;
        html += `</div></div>`;

        content.innerHTML = html;
        overlay.classList.remove('hidden');
    },

    startAutoTrade(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        const destSelect = document.getElementById('at-dest');
        const profitSlider = document.getElementById('at-profit');
        const spendSlider = document.getElementById('at-spend');
        if (!destSelect) return;

        const destCity = destSelect.value;
        const minProfit = parseInt(profitSlider?.value || '10');
        const maxSpendPct = parseInt(spendSlider?.value || '50');

        ship.autoTrade = {
            cityA: ship.location,
            cityB: destCity,
            minProfit: minProfit,
            maxSpend: Game.state.player.gold * (maxSpendPct / 100)
        };

        // Close modal
        document.getElementById('modal-overlay').classList.add('hidden');

        Sound.play('click');
        this.addLogMessage(`${ship.name}: Auto-Handel gestartet ${CITIES_DATA[ship.location].displayName} ↔ ${CITIES_DATA[destCity].displayName}`, 'trade');
        this.showNotification('Auto-Handel aktiviert!', 'success');

        // Immediately start first run
        if (ship.status === 'docked') {
            Trading.processAutoTrade(Game.state, ship);
        }

        this.updateFleetTab();
    },

    stopAutoTrade(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        ship.autoTrade = null;
        Sound.play('click');
        this.addLogMessage(`${ship.name}: Auto-Handel gestoppt.`, 'info');
        this.showNotification('Auto-Handel deaktiviert.', 'info');
        this.updateFleetTab();
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

        // If ship is in a convoy, send all convoy members
        if (ship.convoyId) {
            Convoy.sail(Game.state.player.ships, ship.convoyId, route.path);
            const convoyShips = Convoy.getShips(Game.state.player.ships, ship.convoyId);
            Sound.play('sail');
            this.addLogMessage(`Konvoi (${convoyShips.length} Schiffe) segelt nach ${CITIES_DATA[destId].displayName}.`, 'info');
        } else {
            ship.route = route.path;
            ship.routeIndex = 0;
            ship.progress = 0;
            ship.status = 'sailing';
            ship.destination = destId;
            ship.location = null;
            Sound.play('sail');
            this.addLogMessage(`${ship.name} segelt nach ${CITIES_DATA[destId].displayName}.`, 'info');
        }

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
            html += `<div class="shipyard-item">
                <div class="shipyard-item-header">
                    <span class="shipyard-item-name">${type.name}</span>
                    <span class="shipyard-item-cost">${Utils.formatGold(type.cost)}</span>
                </div>
                <div class="shipyard-item-stats">
                    Fracht: ${type.capacity} | Geschw: ${type.speed} | Rumpf: ${type.hull} | Kanonen: ${type.cannons}
                    <br><span style="color:var(--text-dim)">${type.description}</span>
                </div>
                <button class="shipyard-buy-btn" onclick="UI.buyShip('${typeId}','${cityId}')"
                    ${canAfford ? '' : 'disabled'}>${canAfford ? 'Kaufen' : 'Zu teuer'}</button>
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

    // === BUILD TAB ===
    _buildProductionChainHTML(bType, level, market) {
        if (!bType.consumes && !bType.produces) return '';
        let html = '<div class="production-chain">';
        if (bType.consumes) {
            // Input → Output chain
            const inputs = Object.entries(bType.consumes).map(([goodId, amount]) => {
                const good = GOODS[goodId];
                const needed = amount * level;
                const available = market && market[goodId] ? market[goodId].stock : 0;
                const enough = available >= needed;
                return `<span class="chain-resource ${enough ? 'chain-ok' : 'chain-missing'}">${good.icon} ${needed} ${good.name} <span class="chain-stock">(${available} vorhanden)</span></span>`;
            });
            const output = GOODS[bType.produces];
            html += `<div class="chain-flow">${inputs.join(' + ')} <span class="chain-arrow">\u2192</span> <span class="chain-resource chain-output">${output.icon} ${level} ${output.name}</span></div>`;
        } else if (bType.produces) {
            // Simple production (no inputs)
            const output = GOODS[bType.produces];
            html += `<div class="chain-flow"><span class="chain-resource chain-output">${output.icon} ${level} ${output.name}/Zyklus</span></div>`;
        }
        html += '</div>';
        return html;
    },

    updateBuildTab() {
        const panel = document.getElementById('build-list');
        const cityId = GameMap.selectedCity;

        if (!cityId || !Game.state) {
            panel.innerHTML = '<p style="color:var(--text-dim)">Waehle eine Stadt zum Bauen.</p>';
            return;
        }

        const cityState = Game.state.cities[cityId];
        const market = cityState.market || {};
        const available = Buildings.getAvailable(Game.state, cityId);

        let html = `<p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">${CITIES_DATA[cityId].displayName}</p>`;

        // Show existing buildings
        if (cityState.playerBuildings && cityState.playerBuildings.length > 0) {
            html += '<h4 style="color:var(--text-dim);font-size:11px;text-transform:uppercase;margin-bottom:6px">Eure Gebaeude</h4>';
            cityState.playerBuildings.forEach(b => {
                const type = BUILDING_TYPES[b.type];
                // Production status indicator
                let statusHTML = '';
                if (type.produces) {
                    if (type.consumes) {
                        const producing = b._lastProduced === true;
                        statusHTML = producing
                            ? '<span class="prod-status prod-active">\u25CF Produziert</span>'
                            : '<span class="prod-status prod-idle">\u25CF Rohstoffe fehlen</span>';
                    } else {
                        statusHTML = '<span class="prod-status prod-active">\u25CF Produziert</span>';
                    }
                }
                const chainHTML = this._buildProductionChainHTML(type, b.level, market);
                html += `<div class="build-item" style="border-color:var(--success)">
                    <div class="build-item-header">
                        <span class="build-item-name">${type.icon} ${type.name}</span>
                        <span style="display:flex;align-items:center;gap:6px">
                            ${statusHTML}
                            <span style="color:var(--text-dim);font-size:11px">Stufe ${b.level}</span>
                        </span>
                    </div>
                    ${chainHTML}
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
            const chainHTML = this._buildProductionChainHTML(item.type, 1, market);
            html += `<div class="build-item">
                <div class="build-item-header">
                    <span class="build-item-name">${item.type.icon} ${item.isUpgrade ? 'Ausbau: ' : ''}${item.type.name}</span>
                    <span class="build-item-cost">${Utils.formatGold(item.cost)}</span>
                </div>
                <div class="build-item-desc">${item.type.description}</div>
                ${chainHTML}
                <button class="build-buy-btn" onclick="UI.buildBuilding('${cityId}','${item.typeId}')"
                    ${canAfford ? '' : 'disabled'}>${item.isUpgrade ? 'Ausbauen' : (canAfford ? 'Bauen' : 'Zu teuer')}</button>
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

        const sfxPct = Math.round(Sound.sfxVolume * 100);
        const ambPct = Math.round(Sound.ambientVolume * 100);
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
                        <span style="min-width:65px">Ambient</span>
                        <input type="range" min="0" max="100" value="${ambPct}" style="flex:1;accent-color:var(--gold-color,#c8a84e)" oninput="Sound.setAmbientVolume(this.value/100);document.getElementById('vol-amb-val').textContent=this.value+'%'">
                        <span id="vol-amb-val" style="min-width:35px;text-align:right;font-size:11px">${ambPct}%</span>
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
                    <div style="font-size:20px;font-weight:bold;color:${currentCrew < maxCrew * 0.5 ? 'var(--danger)' : 'var(--text)'}">${currentCrew}</div>
                </div>
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
