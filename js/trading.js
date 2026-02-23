/* ============================================
   HANSE - Enhanced Trading System
   Phase 2: Price history, trends, analytics
   ============================================ */

const PRICE_HISTORY_LENGTH = 30; // keep 30 data points

const Trading = {
    // Initialize city markets
    initCityMarket(cityId) {
        const city = CITIES_DATA[cityId];
        const market = {};

        GOOD_IDS.forEach(goodId => {
            const good = GOODS[goodId];
            const production = city.production[goodId] || 0;
            const demand = city.demand[goodId] || 0;

            let stock = production * 20 + Utils.randInt(5, 30);

            let priceMod = 1.0;
            if (production > 0) priceMod -= production * 0.08;
            if (demand > 0) priceMod += demand * 0.06;
            priceMod += Utils.rand(-0.1, 0.1);

            const price = Math.round(good.basePrice * Utils.clamp(priceMod, 0.4, 2.5));

            // Initialize with price history
            const history = [];
            for (let i = 0; i < PRICE_HISTORY_LENGTH; i++) {
                history.push(price + Utils.randInt(-3, 3));
            }

            market[goodId] = {
                stock: stock,
                price: price,
                basePrice: price,
                lastPrice: price,
                demand: demand,
                production: production,
                trend: 0,
                priceHistory: history,
                avgPrice: price,
                minPrice: price,
                maxPrice: price,
                totalBought: 0,
                totalSold: 0
            };
        });

        return market;
    },

    // Update market prices based on supply/demand
    // Seasonal price modifiers
    SEASON_MODS: {
        spring: { grain: 0.9, fish: 1.0, wood: 0.95, iron: 1.0, cloth: 1.0, fur: 1.1, beer: 1.0, salt: 1.0, spices: 1.0, wine: 1.0 },
        summer: { grain: 0.85, fish: 0.9, wood: 0.9, iron: 1.0, cloth: 0.95, fur: 1.2, beer: 0.9, salt: 0.95, spices: 0.95, wine: 0.9 },
        autumn: { grain: 0.75, fish: 0.95, wood: 1.0, iron: 1.05, cloth: 1.05, fur: 0.85, beer: 0.95, salt: 1.05, spices: 1.1, wine: 1.05 },
        winter: { grain: 1.3, fish: 1.2, wood: 1.25, iron: 1.1, cloth: 1.1, fur: 0.8, beer: 1.1, salt: 1.2, spices: 1.15, wine: 1.2 }
    },

    updateMarket(cityState, difficultyMod, season) {
        const market = cityState.market;
        const seasonMods = season ? (this.SEASON_MODS[season] || {}) : {};

        GOOD_IDS.forEach(goodId => {
            const m = market[goodId];
            const good = GOODS[goodId];

            // Production adds stock
            if (m.production > 0) {
                m.stock += m.production * CONFIG.PRODUCTION_RATE;
            }

            // Player building production
            if (cityState.playerBuildings) {
                cityState.playerBuildings.forEach(b => {
                    if (b.produces === goodId) {
                        m.stock += CONFIG.PRODUCTION_RATE * b.level;
                    }
                });
            }

            // Consumption reduces stock
            const consumption = (m.demand * CONFIG.CONSUMPTION_RATE * cityState.population / 1000);
            m.stock = Math.max(0, m.stock - consumption);

            // Price calculation
            const supplyRatio = m.stock / Math.max(1, m.demand * 20 + 10);
            let priceFactor = 1.0;

            if (supplyRatio < 0.3) {
                priceFactor = 1.5 + (0.3 - supplyRatio) * 3;
            } else if (supplyRatio > 2.0) {
                priceFactor = 0.5 - (supplyRatio - 2.0) * 0.1;
            } else {
                priceFactor = 1.3 - supplyRatio * 0.4;
            }

            priceFactor += Utils.rand(-CONFIG.PRICE_VOLATILITY, CONFIG.PRICE_VOLATILITY);
            priceFactor *= (difficultyMod || 1.0);

            // Apply seasonal modifier
            const sMod = seasonMods[goodId] || 1.0;
            priceFactor *= sMod;

            const newPrice = Math.round(good.basePrice * Utils.clamp(priceFactor, 0.3, 3.5));

            // Track trend
            m.lastPrice = m.price;
            m.price = newPrice;
            if (newPrice > m.lastPrice + 1) m.trend = 1;
            else if (newPrice < m.lastPrice - 1) m.trend = -1;
            else m.trend = 0;

            // Update price history
            m.priceHistory.push(newPrice);
            if (m.priceHistory.length > PRICE_HISTORY_LENGTH) {
                m.priceHistory.shift();
            }

            // Compute statistics
            m.avgPrice = Math.round(m.priceHistory.reduce((a, b) => a + b, 0) / m.priceHistory.length);
            m.minPrice = Math.min(...m.priceHistory);
            m.maxPrice = Math.max(...m.priceHistory);
        });
    },

    // Execute a buy transaction
    buy(gameState, cityId, goodId, amount, ship) {
        const cityState = gameState.cities[cityId];
        const market = cityState.market[goodId];
        const player = gameState.player;

        const maxAffordable = Math.floor(player.gold / market.price);
        const maxStock = Math.floor(market.stock);
        const maxCapacity = getRemainingCapacity(ship);
        const actual = Math.min(amount, maxAffordable, maxStock, maxCapacity);

        if (actual <= 0) return { success: false, message: 'Kauf nicht moeglich.' };

        const cost = actual * market.price;
        player.gold -= cost;
        market.stock -= actual;
        market.totalBought += actual;
        addCargo(ship, goodId, actual);

        market.stock = Math.max(0, market.stock);
        player.totalTraded += cost;

        return {
            success: true,
            amount: actual,
            cost: cost,
            message: `${actual} ${GOODS[goodId].name} gekauft fuer ${Utils.formatGold(cost)}.`
        };
    },

    // Execute a sell transaction
    sell(gameState, cityId, goodId, amount, ship) {
        const cityState = gameState.cities[cityId];
        const market = cityState.market[goodId];
        const player = gameState.player;

        const inCargo = ship.cargo[goodId] || 0;
        const actual = Math.min(amount, inCargo);

        if (actual <= 0) return { success: false, message: 'Verkauf nicht moeglich.' };

        const revenue = actual * market.price;
        player.gold += revenue;
        market.stock += actual;
        market.totalSold += actual;
        removeCargo(ship, goodId, actual);
        player.totalTraded += revenue;

        return {
            success: true,
            amount: actual,
            revenue: revenue,
            message: `${actual} ${GOODS[goodId].name} verkauft fuer ${Utils.formatGold(revenue)}.`
        };
    },

    // Calculate profit potential between two cities
    getProfitPotential(fromCity, toCity, goodId) {
        const fromMarket = fromCity.market[goodId];
        const toMarket = toCity.market[goodId];
        if (!fromMarket || !toMarket) return 0;
        return toMarket.price - fromMarket.price;
    },

    // Find best trades for a given route
    findBestTrades(gameState, fromCityId, toCityId) {
        const fromCity = gameState.cities[fromCityId];
        const toCity = gameState.cities[toCityId];
        if (!fromCity || !toCity) return [];

        const trades = GOOD_IDS.map(goodId => ({
            goodId,
            buyPrice: fromCity.market[goodId].price,
            sellPrice: toCity.market[goodId].price,
            profit: toCity.market[goodId].price - fromCity.market[goodId].price,
            profitPercent: ((toCity.market[goodId].price - fromCity.market[goodId].price) / fromCity.market[goodId].price * 100),
            stock: fromCity.market[goodId].stock
        }));

        return trades.sort((a, b) => b.profitPercent - a.profitPercent);
    },

    // Find the best sell city for each good from a given city
    // Returns { goodId: { cityId, cityName, sellPrice, profit, profitPercent, distance } }
    findBestSellCities(gameState, fromCityId) {
        const fromCity = gameState.cities[fromCityId];
        if (!fromCity) return {};

        const results = {};

        GOOD_IDS.forEach(goodId => {
            const buyPrice = fromCity.market[goodId].price;
            let bestCity = null;
            let bestProfit = 0;
            let bestProfitPct = 0;
            let bestSellPrice = 0;
            let bestDistance = 0;

            CITY_IDS.forEach(toCityId => {
                if (toCityId === fromCityId) return;
                const toCity = gameState.cities[toCityId];
                if (!toCity) return;

                const sellPrice = toCity.market[goodId].price;
                const profit = sellPrice - buyPrice;
                const profitPct = (profit / buyPrice) * 100;

                if (profit > bestProfit) {
                    const route = findShortestPath(fromCityId, toCityId);
                    bestCity = toCityId;
                    bestProfit = profit;
                    bestProfitPct = profitPct;
                    bestSellPrice = sellPrice;
                    bestDistance = route ? route.distance : 99;
                }
            });

            results[goodId] = {
                cityId: bestCity,
                cityName: bestCity ? CITIES_DATA[bestCity].displayName : null,
                sellPrice: bestSellPrice,
                profit: bestProfit,
                profitPercent: bestProfitPct,
                distance: bestDistance
            };
        });

        return results;
    },

    // Get top N trade opportunities from a city (for trade advisor)
    getTopTradeOpportunities(gameState, fromCityId, topN = 5) {
        const bestSells = this.findBestSellCities(gameState, fromCityId);
        const fromCity = gameState.cities[fromCityId];
        if (!fromCity) return [];

        const opportunities = GOOD_IDS.map(goodId => {
            const best = bestSells[goodId];
            const m = fromCity.market[goodId];
            return {
                goodId,
                good: GOODS[goodId],
                buyPrice: m.price,
                stock: m.stock,
                bestCity: best.cityId,
                bestCityName: best.cityName,
                sellPrice: best.sellPrice,
                profit: best.profit,
                profitPercent: best.profitPercent,
                distance: best.distance,
                // Profit per distance unit (efficiency)
                profitPerDay: best.distance > 0 ? best.profit / best.distance : 0
            };
        }).filter(o => o.profit > 0 && o.stock >= 2);

        return opportunities.sort((a, b) => b.profitPercent - a.profitPercent).slice(0, topN);
    },

    // === AUTO-TRADE ===

    // Execute auto-trade logic when ship arrives at a destination
    processAutoTrade(gameState, ship) {
        if (!ship.autoTrade || ship.status !== 'docked' || !ship.location) return;

        const at = ship.autoTrade;
        const cityId = ship.location;
        const otherCity = cityId === at.cityA ? at.cityB : at.cityA;

        // Step 1: Sell all cargo (except goods we want to buy for return trip)
        const cargoEntries = Object.entries(ship.cargo).filter(([, v]) => v > 0);
        let totalRevenue = 0;
        cargoEntries.forEach(([goodId, amount]) => {
            const result = this.sell(gameState, cityId, goodId, amount, ship);
            if (result.success) totalRevenue += result.revenue;
        });

        // Step 2: Buy profitable goods for destination
        const trades = this.findBestTrades(gameState, cityId, otherCity);
        const profitableTrades = trades.filter(t =>
            t.profitPercent >= (at.minProfit || 10) && t.stock >= 3
        );

        let totalSpent = 0;
        const maxSpend = at.maxSpend || (gameState.player.gold * 0.5);

        profitableTrades.forEach(trade => {
            if (totalSpent >= maxSpend) return;
            const remaining = getRemainingCapacity(ship);
            if (remaining <= 0) return;

            const maxBuyable = Math.min(
                remaining,
                Math.floor(trade.stock * 0.6), // Don't drain market
                Math.floor((maxSpend - totalSpent) / trade.buyPrice)
            );

            if (maxBuyable >= 1) {
                const result = this.buy(gameState, cityId, trade.goodId, maxBuyable, ship);
                if (result.success) totalSpent += result.cost;
            }
        });

        // Step 3: Sail to other city
        const route = findShortestPath(cityId, otherCity);
        if (route) {
            ship.route = route.path;
            ship.routeIndex = 0;
            ship.progress = 0;
            ship.status = 'sailing';
            ship.destination = otherCity;
            ship.location = null;

            if (totalRevenue > 0 || totalSpent > 0) {
                UI.addLogMessage(
                    `${ship.name} (Auto): Verkauf ${Utils.formatGold(totalRevenue)}, Einkauf ${Utils.formatGold(totalSpent)} → ${CITIES_DATA[otherCity].displayName}`,
                    'trade'
                );
            }
        }
    },

    // Draw price history mini-chart (canvas-based for inline use)
    renderPriceChart(history, width, height, currentPrice, basePrice) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.display = 'block';
        canvas.style.borderRadius = '3px';
        const ctx = canvas.getContext('2d');

        if (!history || history.length < 2) return canvas;

        const min = Math.min(...history) * 0.9;
        const max = Math.max(...history) * 1.1;
        const range = max - min || 1;
        const stepX = width / (history.length - 1);

        // Background
        ctx.fillStyle = 'rgba(10, 20, 40, 0.6)';
        ctx.fillRect(0, 0, width, height);

        // Base price line
        const baseY = height - ((basePrice - min) / range) * height;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.lineTo(width, baseY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Gradient fill under line
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        if (currentPrice >= basePrice) {
            gradient.addColorStop(0, 'rgba(39, 174, 96, 0.3)');
            gradient.addColorStop(1, 'rgba(39, 174, 96, 0.0)');
        } else {
            gradient.addColorStop(0, 'rgba(192, 57, 43, 0.3)');
            gradient.addColorStop(1, 'rgba(192, 57, 43, 0.0)');
        }

        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let i = 0; i < history.length; i++) {
            const x = i * stepX;
            const y = height - ((history[i] - min) / range) * height;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Price line
        ctx.beginPath();
        for (let i = 0; i < history.length; i++) {
            const x = i * stepX;
            const y = height - ((history[i] - min) / range) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = currentPrice >= basePrice ? '#27ae60' : '#c0392b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Current price dot
        const lastX = (history.length - 1) * stepX;
        const lastY = height - ((history[history.length - 1] - min) / range) * height;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        return canvas;
    }
};
