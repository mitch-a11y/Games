/* ============================================
   HANSE - Trading System
   ============================================ */

const Trading = {
    // Initialize city markets
    initCityMarket(cityId) {
        const city = CITIES_DATA[cityId];
        const market = {};

        GOOD_IDS.forEach(goodId => {
            const good = GOODS[goodId];
            const production = city.production[goodId] || 0;
            const demand = city.demand[goodId] || 0;

            // Stock based on production
            let stock = production * 20 + Utils.randInt(5, 30);

            // Price based on supply/demand balance
            let priceMod = 1.0;
            if (production > 0) priceMod -= production * 0.08;
            if (demand > 0) priceMod += demand * 0.06;
            priceMod += Utils.rand(-0.1, 0.1);

            const price = Math.round(good.basePrice * Utils.clamp(priceMod, 0.4, 2.5));

            market[goodId] = {
                stock: stock,
                price: price,
                basePrice: price,
                lastPrice: price,
                demand: demand,
                production: production,
                trend: 0 // -1 falling, 0 stable, 1 rising
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

            // Add production from player buildings
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
                priceFactor = 1.5 + (0.3 - supplyRatio) * 3; // scarce = expensive
            } else if (supplyRatio > 2.0) {
                priceFactor = 0.5 - (supplyRatio - 2.0) * 0.1; // oversupply = cheap
            } else {
                priceFactor = 1.3 - supplyRatio * 0.4;
            }

            // Random fluctuation
            priceFactor += Utils.rand(-CONFIG.PRICE_VOLATILITY, CONFIG.PRICE_VOLATILITY);

            // Difficulty modifier
            priceFactor *= (difficultyMod || 1.0);

            const newPrice = Math.round(good.basePrice * Utils.clamp(priceFactor, 0.3, 3.5));

            // Track trend
            m.lastPrice = m.price;
            m.price = newPrice;
            if (newPrice > m.lastPrice + 1) m.trend = 1;
            else if (newPrice < m.lastPrice - 1) m.trend = -1;
            else m.trend = 0;
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
        addCargo(ship, goodId, actual);

        // Price rises after purchase
        market.stock = Math.max(0, market.stock);

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
        removeCargo(ship, goodId, actual);

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
    }
};
