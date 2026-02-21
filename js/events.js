/* ============================================
   HANSE - Random Events System
   ============================================ */

const EVENT_TEMPLATES = [
    {
        id: 'pirate_attack',
        name: 'Piratenangriff!',
        icon: '🏴‍☠️',
        text: 'Piraten greifen {ship} nahe {city} an!',
        type: 'combat',
        chance: 0.12,
        requiresSailing: true,
        effect(gameState, params) {
            const ship = params.ship;
            const damage = Utils.randInt(10, 30);
            const lostGold = Utils.randInt(50, 300);

            ship.hull = Math.max(1, ship.hull - damage);
            if (ship.hull < ship.maxHull * 0.3) ship.damaged = true;

            // Chance to lose cargo
            const lostGoods = [];
            if (Math.random() < 0.4) {
                const goodIds = Object.keys(ship.cargo);
                if (goodIds.length > 0) {
                    const lostGood = Utils.pick(goodIds);
                    const lostAmt = Math.floor(ship.cargo[lostGood] * Utils.rand(0.1, 0.4));
                    if (lostAmt > 0) {
                        removeCargo(ship, lostGood, lostAmt);
                        lostGoods.push(`${lostAmt} ${GOODS[lostGood].name}`);
                    }
                }
            }

            let msg = `${ship.name} wurde von Piraten angegriffen! ${damage} Rumpfschaden.`;
            if (lostGoods.length > 0) msg += ` Verloren: ${lostGoods.join(', ')}.`;
            return msg;
        }
    },
    {
        id: 'storm',
        name: 'Sturm!',
        icon: '⛈️',
        text: 'Ein schwerer Sturm trifft {ship} auf See!',
        type: 'weather',
        chance: 0.15,
        requiresSailing: true,
        effect(gameState, params) {
            const ship = params.ship;
            const damage = Utils.randInt(5, 20);
            ship.hull = Math.max(1, ship.hull - damage);
            if (ship.hull < ship.maxHull * 0.3) ship.damaged = true;

            // Slow down
            ship.progress = Math.max(0, ship.progress - 0.2);

            return `${ship.name} geriet in einen Sturm! ${damage} Rumpfschaden, Reise verzoegert.`;
        }
    },
    {
        id: 'favorable_wind',
        name: 'Guenstiger Wind',
        icon: '💨',
        text: 'Guenstiger Wind beschleunigt {ship}!',
        type: 'weather',
        chance: 0.18,
        requiresSailing: true,
        effect(gameState, params) {
            const ship = params.ship;
            ship.progress = Math.min(0.95, ship.progress + 0.25);
            return `${ship.name} segelt mit guenstigem Wind! Reise beschleunigt.`;
        }
    },
    {
        id: 'plague',
        name: 'Seuche!',
        icon: '☠️',
        text: 'Die Pest wuetet in {city}!',
        type: 'city',
        chance: 0.04,
        requiresSailing: false,
        effect(gameState, params) {
            const cityId = params.cityId;
            const cityState = gameState.cities[cityId];
            const loss = Math.floor(cityState.population * Utils.rand(0.05, 0.15));
            cityState.population = Math.max(500, cityState.population - loss);

            // Increase demand for food
            cityState.market.grain.demand += 1;
            cityState.market.fish.demand += 1;

            return `Seuche in ${CITIES_DATA[cityId].displayName}! ${Utils.formatNumber(loss)} Einwohner gestorben.`;
        }
    },
    {
        id: 'trade_boom',
        name: 'Handelsboom',
        icon: '📈',
        text: 'Wirtschaftlicher Aufschwung in {city}!',
        type: 'city',
        chance: 0.08,
        requiresSailing: false,
        effect(gameState, params) {
            const cityId = params.cityId;
            const cityState = gameState.cities[cityId];
            // Boost all prices up
            GOOD_IDS.forEach(gid => {
                cityState.market[gid].price = Math.round(cityState.market[gid].price * Utils.rand(1.1, 1.3));
            });
            cityState.population += Math.floor(cityState.population * 0.02);

            return `Handelsboom in ${CITIES_DATA[cityId].displayName}! Preise steigen.`;
        }
    },
    {
        id: 'trade_depression',
        name: 'Wirtschaftskrise',
        icon: '📉',
        text: 'Wirtschaftskrise in {city}!',
        type: 'city',
        chance: 0.06,
        requiresSailing: false,
        effect(gameState, params) {
            const cityId = params.cityId;
            const cityState = gameState.cities[cityId];
            GOOD_IDS.forEach(gid => {
                cityState.market[gid].price = Math.round(cityState.market[gid].price * Utils.rand(0.7, 0.9));
            });
            return `Wirtschaftskrise in ${CITIES_DATA[cityId].displayName}! Preise fallen.`;
        }
    },
    {
        id: 'new_route',
        name: 'Neue Handelsroute',
        icon: '🗺️',
        text: 'Neue Handelsroute nach {city} entdeckt!',
        type: 'city',
        chance: 0.05,
        requiresSailing: false,
        effect(gameState, params) {
            const cityId = params.cityId;
            const cityState = gameState.cities[cityId];
            // Add luxury goods
            const luxGood = Utils.pick(['spices', 'wine', 'fur']);
            cityState.market[luxGood].stock += Utils.randInt(10, 30);

            return `Neue Handelsroute! ${GOODS[luxGood].name} jetzt verfuegbar in ${CITIES_DATA[cityId].displayName}!`;
        }
    },
    {
        id: 'fire',
        name: 'Stadtbrand!',
        icon: '🔥',
        text: 'Feuer in {city}!',
        type: 'city',
        chance: 0.04,
        requiresSailing: false,
        effect(gameState, params) {
            const cityId = params.cityId;
            const cityState = gameState.cities[cityId];

            // Destroy some goods
            GOOD_IDS.forEach(gid => {
                const loss = Math.floor(cityState.market[gid].stock * Utils.rand(0, 0.3));
                cityState.market[gid].stock = Math.max(0, cityState.market[gid].stock - loss);
            });

            // Increase wood demand
            cityState.market.wood.demand += 2;

            // Maybe destroy a player building
            if (cityState.playerBuildings && cityState.playerBuildings.length > 0 && Math.random() < 0.2) {
                const idx = Utils.randInt(0, cityState.playerBuildings.length - 1);
                const destroyed = cityState.playerBuildings.splice(idx, 1)[0];
                Reputation.onBuildingDestroyed(gameState);
                return `Stadtbrand in ${CITIES_DATA[cityId].displayName}! Ihr ${BUILDING_TYPES[destroyed.type].name} wurde zerstoert!`;
            }

            return `Stadtbrand in ${CITIES_DATA[cityId].displayName}! Vorraete beschaedigt, Holznachfrage steigt.`;
        }
    },
    {
        id: 'harvest',
        name: 'Gute Ernte',
        icon: '🌻',
        text: 'Reiche Ernte in {city}!',
        type: 'city',
        chance: 0.10,
        requiresSailing: false,
        effect(gameState, params) {
            const cityId = params.cityId;
            const cityState = gameState.cities[cityId];
            cityState.market.grain.stock += Utils.randInt(20, 50);
            cityState.market.grain.price = Math.round(cityState.market.grain.price * 0.8);
            return `Reiche Ernte in ${CITIES_DATA[cityId].displayName}! Getreide im Ueberfluss.`;
        }
    },
    {
        id: 'bad_harvest',
        name: 'Misssernte',
        icon: '🥀',
        text: 'Missernte in {city}!',
        type: 'city',
        chance: 0.08,
        requiresSailing: false,
        effect(gameState, params) {
            const cityId = params.cityId;
            const cityState = gameState.cities[cityId];
            cityState.market.grain.stock = Math.max(0, cityState.market.grain.stock - Utils.randInt(10, 30));
            cityState.market.grain.price = Math.round(cityState.market.grain.price * 1.4);
            return `Missernte in ${CITIES_DATA[cityId].displayName}! Getreidepreise steigen stark!`;
        }
    },
    {
        id: 'royal_order',
        name: 'Koeniglicher Auftrag',
        icon: '👑',
        text: 'Der Koenig bestellt Waren!',
        type: 'player',
        chance: 0.06,
        requiresSailing: false,
        effect(gameState, params) {
            const bonus = Utils.randInt(200, 800);
            gameState.player.gold += bonus;
            return `Koeniglicher Auftrag! Ihr erhaltet ${Utils.formatGold(bonus)} als Belohnung.`;
        }
    },
    {
        id: 'guild_tax',
        name: 'Gildenabgabe',
        icon: '💰',
        text: 'Die Gilde verlangt Abgaben!',
        type: 'player',
        chance: 0.08,
        requiresSailing: false,
        effect(gameState, params) {
            const tax = Math.floor(gameState.player.gold * Utils.rand(0.02, 0.05));
            gameState.player.gold = Math.max(0, gameState.player.gold - tax);
            return `Gildenabgabe faellig! ${Utils.formatGold(tax)} bezahlt.`;
        }
    }
];

const Events = {
    lastCheck: 0,

    checkEvents(gameState) {
        const eventChanceMod = CONFIG.DIFFICULTY[gameState.difficulty].eventChance;
        const events = [];

        // Check ship events
        gameState.player.ships.forEach(ship => {
            if (ship.status === 'sailing') {
                EVENT_TEMPLATES.filter(e => e.requiresSailing).forEach(evt => {
                    if (Math.random() < evt.chance * eventChanceMod * 0.3) {
                        const nearCity = ship.route ? ship.route[ship.routeIndex] : 'See';
                        const msg = evt.effect(gameState, { ship, cityId: nearCity });
                        events.push({
                            template: evt,
                            message: msg,
                            params: { ship: ship.name, city: CITIES_DATA[nearCity]?.displayName || 'See' }
                        });
                    }
                });
            }
        });

        // Check city events
        const randomCity = Utils.pick(CITY_IDS);
        EVENT_TEMPLATES.filter(e => e.type === 'city').forEach(evt => {
            if (Math.random() < evt.chance * eventChanceMod * 0.15) {
                const msg = evt.effect(gameState, { cityId: randomCity });
                events.push({
                    template: evt,
                    message: msg,
                    params: { city: CITIES_DATA[randomCity].displayName }
                });
            }
        });

        // Check player events
        EVENT_TEMPLATES.filter(e => e.type === 'player').forEach(evt => {
            if (Math.random() < evt.chance * eventChanceMod * 0.1) {
                const msg = evt.effect(gameState, {});
                events.push({
                    template: evt,
                    message: msg,
                    params: {}
                });
            }
        });

        return events;
    }
};
