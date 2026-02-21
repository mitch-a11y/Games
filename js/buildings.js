/* ============================================
   HANSE - Buildings & Construction
   ============================================ */

const BUILDING_TYPES = {
    kontor: {
        id: 'kontor',
        name: 'Handelskontor',
        icon: '🏛️',
        cost: 3000,
        maintenance: 30,
        maxLevel: 3,
        description: 'Ermoeglicht Handel und Lagerung in dieser Stadt',
        effect: 'Lagerkapazitaet +100 pro Stufe',
        produces: null,
        storage: 100,
        prerequisite: null
    },
    warehouse: {
        id: 'warehouse',
        name: 'Lagerhaus',
        icon: '🏚️',
        cost: 2000,
        maintenance: 15,
        maxLevel: 5,
        description: 'Erweitert die Lagerkapazitaet',
        effect: 'Lagerkapazitaet +200 pro Stufe',
        produces: null,
        storage: 200,
        prerequisite: 'kontor'
    },
    brewery: {
        id: 'brewery',
        name: 'Brauerei',
        icon: '🍺',
        cost: 4000,
        maintenance: 35,
        maxLevel: 3,
        description: 'Produziert Bier',
        effect: 'Produziert Bier',
        produces: 'beer',
        storage: 0,
        prerequisite: 'kontor'
    },
    workshop: {
        id: 'workshop',
        name: 'Werkstatt',
        icon: '🔨',
        cost: 5000,
        maintenance: 40,
        maxLevel: 3,
        description: 'Produziert Eisenwaren',
        effect: 'Produziert Eisenwaren',
        produces: 'iron',
        storage: 0,
        prerequisite: 'kontor'
    },
    weaver: {
        id: 'weaver',
        name: 'Weberei',
        icon: '🧵',
        cost: 5500,
        maintenance: 40,
        maxLevel: 3,
        description: 'Produziert Tuch',
        effect: 'Produziert Tuch',
        produces: 'cloth',
        storage: 0,
        prerequisite: 'kontor'
    },
    saltworks: {
        id: 'saltworks',
        name: 'Saline',
        icon: '🧂',
        cost: 4500,
        maintenance: 35,
        maxLevel: 3,
        description: 'Produziert Salz',
        effect: 'Produziert Salz',
        produces: 'salt',
        storage: 0,
        prerequisite: 'kontor'
    },
    mill: {
        id: 'mill',
        name: 'Muehle',
        icon: '🌾',
        cost: 3000,
        maintenance: 25,
        maxLevel: 3,
        description: 'Verarbeitet Getreide',
        effect: 'Produziert Getreide',
        produces: 'grain',
        storage: 0,
        prerequisite: 'kontor'
    },
    fishery: {
        id: 'fishery',
        name: 'Fischerei',
        icon: '🐟',
        cost: 2500,
        maintenance: 20,
        maxLevel: 3,
        description: 'Faengt und verarbeitet Fisch',
        effect: 'Produziert Fisch',
        produces: 'fish',
        storage: 0,
        prerequisite: 'kontor'
    },
    church: {
        id: 'church',
        name: 'Kirche',
        icon: '⛪',
        cost: 10000,
        maintenance: 50,
        maxLevel: 1,
        description: 'Erhoeht Ansehen in der Stadt',
        effect: 'Reputation +20',
        produces: null,
        storage: 0,
        prerequisite: 'kontor'
    },
    hospital: {
        id: 'hospital',
        name: 'Hospital',
        icon: '🏥',
        cost: 8000,
        maintenance: 60,
        maxLevel: 1,
        description: 'Verbessert die Bevoelkerungsentwicklung',
        effect: 'Bevoelkerungswachstum +50%',
        produces: null,
        storage: 0,
        prerequisite: 'kontor'
    }
};

const BUILDING_TYPE_IDS = Object.keys(BUILDING_TYPES);

const Buildings = {
    // Get buildings available to build in a city
    getAvailable(gameState, cityId) {
        const cityState = gameState.cities[cityId];
        if (!cityState) return [];

        const existing = cityState.playerBuildings || [];
        const available = [];

        BUILDING_TYPE_IDS.forEach(typeId => {
            const type = BUILDING_TYPES[typeId];

            // Check prerequisite
            if (type.prerequisite) {
                const hasPrereq = existing.some(b => b.type === type.prerequisite);
                if (!hasPrereq) return;
            }

            const existingOfType = existing.filter(b => b.type === typeId);
            const currentCount = existingOfType.length;
            const currentLevel = existingOfType.reduce((sum, b) => sum + b.level, 0);

            // Skip buildings under construction
            const underConstruction = existingOfType.some(b => b.constructionDays > 0);
            if (underConstruction) return;

            if (typeId === 'kontor') {
                // Only one kontor, upgradeable
                if (currentCount > 0 && currentLevel >= type.maxLevel) return;
            } else if (type.maxLevel === 1) {
                // Single-build buildings (church, hospital) - skip if already built
                if (currentCount > 0) return;
            } else {
                // For upgradeable buildings: allow upgrade if below max level
                if (currentCount > 0) {
                    const bld = existingOfType[0];
                    if (bld.level >= type.maxLevel) return;
                    // Show as upgrade option
                    available.push({
                        typeId,
                        type,
                        isUpgrade: true,
                        currentLevel: bld.level,
                        cost: Math.floor(type.cost * (bld.level + 1) * 0.6)
                    });
                    return;
                }
                // Allow new builds up to limit
                if (currentCount >= CONFIG.MAX_BUILDINGS_PER_TYPE) return;
            }

            available.push({
                typeId,
                type,
                isUpgrade: typeId === 'kontor' && currentCount > 0,
                currentLevel: currentLevel,
                cost: typeId === 'kontor' && currentCount > 0
                    ? type.cost * (currentLevel + 1)
                    : type.cost
            });
        });

        return available;
    },

    // Build or upgrade
    build(gameState, cityId, typeId) {
        const cityState = gameState.cities[cityId];
        const player = gameState.player;
        const type = BUILDING_TYPES[typeId];

        if (!cityState.playerBuildings) cityState.playerBuildings = [];

        const existing = cityState.playerBuildings.filter(b => b.type === typeId);

        // Upgrade existing building (kontor or production buildings)
        if (existing.length > 0 && (typeId === 'kontor' || type.maxLevel > 1)) {
            const building = existing[0];
            const cost = typeId === 'kontor'
                ? type.cost * (building.level + 1)
                : Math.floor(type.cost * (building.level + 1) * 0.6);
            if (player.gold < cost) return { success: false, message: 'Nicht genug Gold!' };
            player.gold -= cost;
            // Construction time: 10 + 5 per level days
            building.constructionDays = 10 + building.level * 5;
            building.pendingUpgrade = true;
            return {
                success: true,
                message: `Ausbau von ${type.name} in ${CITIES_DATA[cityId].displayName} begonnen! (${building.constructionDays} Tage)`
            };
        }

        // New building
        const cost = type.cost;
        if (player.gold < cost) return { success: false, message: 'Nicht genug Gold!' };

        // Construction time based on building type
        const constructionDays = typeId === 'kontor' ? 15
            : typeId === 'church' ? 30
            : typeId === 'hospital' ? 25
            : 12;

        player.gold -= cost;
        cityState.playerBuildings.push({
            id: Utils.uid(),
            type: typeId,
            level: 1,
            produces: type.produces,
            storage: type.storage,
            built: { day: gameState.date.day, month: gameState.date.month, year: gameState.date.year },
            constructionDays: constructionDays
        });

        // Reputation boost
        if (!cityState.reputation) cityState.reputation = 0;
        cityState.reputation += typeId === 'church' ? 20 : 5;

        return {
            success: true,
            message: `Bau von ${type.name} in ${CITIES_DATA[cityId].displayName} begonnen! (${constructionDays} Tage)`
        };
    },

    // Get total storage capacity in a city
    getStorageCapacity(cityState) {
        if (!cityState.playerBuildings) return 0;
        return cityState.playerBuildings.reduce((sum, b) => {
            const type = BUILDING_TYPES[b.type];
            return sum + (type ? type.storage * b.level : 0);
        }, 0);
    },

    // Get monthly maintenance costs
    getMaintenanceCost(gameState) {
        let total = 0;
        CITY_IDS.forEach(cityId => {
            const cityState = gameState.cities[cityId];
            if (!cityState || !cityState.playerBuildings) return;
            cityState.playerBuildings.forEach(b => {
                const type = BUILDING_TYPES[b.type];
                if (type) total += type.maintenance * b.level;
            });
        });
        return total;
    }
};
