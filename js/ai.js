/* ============================================
   HANSE - AI Traders
   ============================================ */

const AI_NAMES = [
    { name: 'Tidemann Warendorp', home: 'Luebeck' },
    { name: 'Johann Wittenborg', home: 'Hamburg' },
    { name: 'Hildebrand Veckinchusen', home: 'Brugge' },
    { name: 'Bertram Morneweg', home: 'Danzig' },
    { name: 'Bruno von Warendorp', home: 'Riga' },
    { name: 'Heinrich Castorp', home: 'Rostock' },
    { name: 'Simon Swerting', home: 'Stralsund' },
    { name: 'Gottschalk Remlingrade', home: 'Bremen' }
];

const AITrader = {
    createTrader(index, difficulty) {
        const template = AI_NAMES[index % AI_NAMES.length];
        const aggression = CONFIG.DIFFICULTY[difficulty].aiAggression;

        return {
            id: 'ai_' + index,
            name: template.name,
            homeCity: template.home,
            gold: Utils.randInt(3000, 8000),
            ships: [
                createShip('cog', template.name + 's Kogge', template.home)
            ],
            reputation: Utils.randInt(10, 30),
            aggression: aggression,
            tradeTimer: 0,
            targetCity: null
        };
    },

    // AI decision making
    update(trader, gameState) {
        trader.tradeTimer++;
        if (trader.tradeTimer < CONFIG.AI_UPDATE_INTERVAL) return;
        trader.tradeTimer = 0;

        trader.ships.forEach(ship => {
            if (ship.status === 'sailing') {
                this.updateShipMovement(ship, gameState);
                return;
            }

            if (ship.status !== 'docked' || !ship.location) return;

            // Decide: sell cargo, then buy new goods and sail
            const currentCity = ship.location;
            const cityState = gameState.cities[currentCity];

            // Sell all cargo
            for (const goodId in ship.cargo) {
                if (ship.cargo[goodId] > 0 && cityState) {
                    const amount = ship.cargo[goodId];
                    const market = cityState.market[goodId];
                    if (market) {
                        const revenue = amount * market.price;
                        trader.gold += revenue;
                        market.stock += amount;
                    }
                    ship.cargo[goodId] = 0;
                }
            }
            ship.cargo = {};
            ship.cargoUsed = 0;

            // Find best destination
            const connectedCities = getConnectedCities(currentCity);
            if (connectedCities.length === 0) return;

            let bestDest = null;
            let bestProfit = 0;

            connectedCities.forEach(destId => {
                const destState = gameState.cities[destId];
                if (!destState) return;

                GOOD_IDS.forEach(goodId => {
                    const profit = Trading.getProfitPotential(cityState, destState, goodId);
                    const stock = cityState.market[goodId].stock;
                    if (profit > 0 && stock > 5) {
                        const score = profit * Math.min(stock, ship.capacity) * (0.5 + Math.random() * 0.5);
                        if (score > bestProfit) {
                            bestProfit = score;
                            bestDest = destId;
                        }
                    }
                });
            });

            if (!bestDest) {
                // Random destination
                bestDest = Utils.pick(connectedCities);
            }

            // Buy goods for the trip
            if (cityState) {
                const trades = Trading.findBestTrades(gameState, currentCity, bestDest);
                for (const trade of trades) {
                    if (trade.profit <= 0) continue;
                    const maxBuy = Math.min(
                        getRemainingCapacity(ship),
                        Math.floor(cityState.market[trade.goodId].stock * 0.3),
                        Math.floor(trader.gold / trade.buyPrice)
                    );
                    if (maxBuy > 0) {
                        const cost = maxBuy * trade.buyPrice;
                        trader.gold -= cost;
                        cityState.market[trade.goodId].stock -= maxBuy;
                        addCargo(ship, trade.goodId, maxBuy);
                    }
                    if (getRemainingCapacity(ship) <= 0) break;
                }
            }

            // Set sail
            const route = findShortestPath(currentCity, bestDest);
            if (route && route.path.length > 1) {
                ship.route = route.path;
                ship.routeIndex = 0;
                ship.progress = 0;
                ship.status = 'sailing';
                ship.location = null;
                ship.destination = bestDest;
            }
        });
    },

    updateShipMovement(ship, gameState) {
        if (!ship.route || ship.routeIndex >= ship.route.length - 1) {
            // Arrived
            ship.status = 'docked';
            ship.location = ship.route ? ship.route[ship.route.length - 1] : ship.destination;
            ship.route = null;
            ship.progress = 0;
            return;
        }

        const fromId = ship.route[ship.routeIndex];
        const toId = ship.route[ship.routeIndex + 1];
        const routeInfo = SEA_ROUTES.find(r =>
            (r.from === fromId && r.to === toId) ||
            (r.from === toId && r.to === fromId)
        );

        const distance = routeInfo ? routeInfo.distance : 5;
        const speedPerTick = (ship.speed * CONFIG.SHIP_SPEED_BASE) / (distance * 5);

        ship.progress += speedPerTick;

        if (ship.progress >= 1.0) {
            ship.routeIndex++;
            ship.progress = 0;

            if (ship.routeIndex >= ship.route.length - 1) {
                ship.status = 'docked';
                ship.location = ship.route[ship.route.length - 1];
                ship.route = null;
            }
        }
    }
};
