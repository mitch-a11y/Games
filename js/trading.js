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

            // Ensure minimum stock based on demand (cities always have some trade goods)
            let stock = production * 20 + Utils.randInt(5, 30);
            if (demand > 0 && stock < demand * 15) {
                stock = demand * 15 + Utils.randInt(5, 15);
            }

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
    updateMarket(cityState, difficultyMod) {
        const market = cityState.market;

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

        // Limit purchase to 70% of current stock to prevent market manipulation
        const maxBuyableStock = Math.floor(market.stock * 0.7);
        const maxAffordable = Math.floor(player.gold / market.price);
        const maxCapacity = getRemainingCapacity(ship);
        const actual = Math.min(amount, maxAffordable, maxBuyableStock, maxCapacity);

        if (actual <= 0) {
            if (market.stock > 0 && market.stock <= 2) {
                return { success: false, message: 'Zu wenig Vorrat - die Stadt behaelt eine Reserve.' };
            }
            return { success: false, message: 'Kauf nicht moeglich.' };
        }

        // Price increases dynamically with bulk buys (larger purchases cost more per unit)
        let totalCost = 0;
        let remaining = actual;
        let tempStock = market.stock;
        while (remaining > 0) {
            const batch = Math.min(remaining, 5);
            const supplyRatio = tempStock / Math.max(1, market.demand * 20 + 10);
            const priceMul = supplyRatio < 0.5 ? 1 + (0.5 - supplyRatio) * 0.5 : 1;
            totalCost += batch * Math.round(market.price * priceMul);
            tempStock -= batch;
            remaining -= batch;
        }

        if (totalCost > player.gold) {
            // Recalculate with what we can afford
            const affordable = Math.min(actual, Math.floor(player.gold / market.price));
            if (affordable <= 0) return { success: false, message: 'Nicht genug Gold.' };
            totalCost = affordable * market.price;
            market.stock -= affordable;
            market.totalBought += affordable;
            addCargo(ship, goodId, affordable);
            player.gold -= totalCost;
            player.totalTraded += totalCost;
            market.stock = Math.max(0, market.stock);
            // Track where goods were bought for exploit prevention
            if (!ship._purchaseOrigin) ship._purchaseOrigin = {};
            ship._purchaseOrigin[goodId] = cityId;
            return {
                success: true, amount: affordable, cost: totalCost,
                message: `${affordable} ${GOODS[goodId].name} gekauft fuer ${Utils.formatGold(totalCost)}.`
            };
        }

        player.gold -= totalCost;
        market.stock -= actual;
        market.totalBought += actual;
        addCargo(ship, goodId, actual);
        market.stock = Math.max(0, market.stock);
        player.totalTraded += totalCost;

        // Track purchase origin to prevent same-city exploit
        if (!ship._purchaseOrigin) ship._purchaseOrigin = {};
        ship._purchaseOrigin[goodId] = cityId;

        return {
            success: true,
            amount: actual,
            cost: totalCost,
            message: `${actual} ${GOODS[goodId].name} gekauft fuer ${Utils.formatGold(totalCost)}.`
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

        // Penalty if selling in the same city where goods were bought (anti-exploit)
        let pricePenalty = 1.0;
        if (ship._purchaseOrigin && ship._purchaseOrigin[goodId] === cityId) {
            pricePenalty = 0.7; // 30% penalty for same-city flip
        }

        // Price drops with bulk sells (flooding the market)
        let totalRevenue = 0;
        let remaining = actual;
        let tempStock = market.stock;
        while (remaining > 0) {
            const batch = Math.min(remaining, 5);
            const supplyRatio = tempStock / Math.max(1, market.demand * 20 + 10);
            const priceMul = supplyRatio > 1.5 ? Math.max(0.5, 1 - (supplyRatio - 1.5) * 0.2) : 1;
            totalRevenue += batch * Math.round(market.price * priceMul * pricePenalty);
            tempStock += batch;
            remaining -= batch;
        }

        player.gold += totalRevenue;
        market.stock += actual;
        market.totalSold += actual;
        removeCargo(ship, goodId, actual);
        player.totalTraded += totalRevenue;

        // Clear purchase origin if all sold
        if (ship._purchaseOrigin && (ship.cargo[goodId] || 0) === 0) {
            delete ship._purchaseOrigin[goodId];
        }

        let msg = `${actual} ${GOODS[goodId].name} verkauft fuer ${Utils.formatGold(totalRevenue)}.`;
        if (pricePenalty < 1) msg += ' (Preisabzug: gleicher Markt)';

        return {
            success: true,
            amount: actual,
            revenue: totalRevenue,
            message: msg
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
