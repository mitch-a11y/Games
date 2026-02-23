/* HANSE - UI Trade Module */

Object.assign(UI, {
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
            <div class="trade-summary-row"><span>⚓ ${ship.name}</span><span style="color:var(--text-dim)">${SHIP_TYPES[ship.typeId].name}</span></div>
            <div class="trade-summary-row"><span>Fracht:</span><span>${cargoCount} / ${ship.capacity} (${cargoPercent}%)</span></div>
            <div class="ship-cargo-bar" style="margin:4px 0"><div class="ship-cargo-fill" style="width:${cargoPercent}%"></div></div>
            <div class="trade-summary-row"><span>Verfügbar:</span><span style="color:var(--gold-color);font-weight:bold">${Utils.formatGold(Game.state.player.gold)}</span></div>
        </div>`;

        // Trade Advisor — top opportunities
        const topTrades = Trading.getTopTradeOpportunities(Game.state, cityId, 3);
        if (topTrades.length > 0) {
            html += '<div class="trade-advisor">';
            html += '<div class="trade-advisor-title">📊 Handelsberater</div>';
            topTrades.forEach(t => {
                html += `<div class="trade-advisor-tip" onclick="UI.executeTrade('buy','${t.goodId}','${ship.id}','${cityId}',9999);Sound.play('buy')">
                    <span class="advisor-good">${t.good.icon} ${t.good.name}</span>
                    <span class="advisor-route">→ ${t.bestCityName}</span>
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
            const trendIcon = m.trend > 0 ? '<span style="color:var(--danger)">▲</span>' : (m.trend < 0 ? '<span style="color:var(--success)">▼</span>' : '<span style="color:var(--text-dim)">─</span>');
            const priceColor = m.price < good.basePrice * 0.85 ? 'var(--success)' : (m.price > good.basePrice * 1.15 ? 'var(--danger)' : 'var(--text-light)');

            // Profit badge
            let profitBadge = '';
            if (profit > 0 && bestCity) {
                const pctRound = Math.round(profitPercent);
                const badgeColor = pctRound >= 30 ? 'var(--success)' : (pctRound >= 15 ? '#6a9a20' : 'var(--text-dim)');
                profitBadge = `<div class="trade-profit-badge" title="Kaufen hier ${m.price}G, verkaufen in ${bestCity} ${g.bestSellPrice}G (~${bestDistance} Tage)">
                    <span style="color:${badgeColor};font-weight:700">+${pctRound}%</span>
                    <span class="profit-dest">→ ${bestCity}</span>
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
    }
});
