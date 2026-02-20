/* ============================================
   HANSE - Ship Types & Fleet Management
   ============================================ */

const SHIP_TYPES = {
    small_cog: {
        id: 'small_cog',
        name: 'Kleine Kogge',
        capacity: 50,
        speed: 3,
        hull: 40,
        crew: 8,
        cannons: 0,
        cost: 2000,
        maintenance: 20,
        description: 'Kleines Handelsschiff fuer Kuestenfahrt'
    },
    cog: {
        id: 'cog',
        name: 'Kogge',
        capacity: 100,
        speed: 2.5,
        hull: 60,
        crew: 15,
        cannons: 2,
        cost: 4500,
        maintenance: 40,
        description: 'Standardschiff der Hanse'
    },
    hulk: {
        id: 'hulk',
        name: 'Hulk',
        capacity: 160,
        speed: 2,
        hull: 80,
        crew: 20,
        cannons: 4,
        cost: 8000,
        maintenance: 70,
        description: 'Grosses Frachtschiff'
    },
    caravel: {
        id: 'caravel',
        name: 'Karavelle',
        capacity: 80,
        speed: 4,
        hull: 50,
        crew: 12,
        cannons: 6,
        cost: 7000,
        maintenance: 55,
        description: 'Schnelles, wendiges Schiff'
    },
    carrack: {
        id: 'carrack',
        name: 'Kraek',
        capacity: 250,
        speed: 1.8,
        hull: 120,
        crew: 30,
        cannons: 8,
        cost: 15000,
        maintenance: 120,
        description: 'Maechtige Handelsgaleone'
    },
    warship: {
        id: 'warship',
        name: 'Kriegskogge',
        capacity: 60,
        speed: 3,
        hull: 100,
        crew: 40,
        cannons: 14,
        cost: 12000,
        maintenance: 100,
        description: 'Bewaffnetes Geleitschiff'
    }
};

const SHIP_TYPE_IDS = Object.keys(SHIP_TYPES);

function createShip(typeId, name, location) {
    const type = SHIP_TYPES[typeId];
    return {
        id: Utils.uid(),
        typeId: typeId,
        name: name || type.name,
        capacity: type.capacity,
        speed: type.speed,
        maxHull: type.hull,
        hull: type.hull,
        crew: type.crew,
        cannons: type.cannons,
        maintenance: type.maintenance,
        cargo: {},           // { goodId: amount }
        cargoUsed: 0,
        location: location,  // city id or null if sailing
        destination: null,
        route: null,         // array of city ids
        routeIndex: 0,
        progress: 0,         // 0-1 between route segments
        status: 'docked',    // docked, sailing, repairing
        autoTrade: null,     // auto-trade route config or null
        damaged: false
    };
}

function getCargoWeight(ship) {
    let total = 0;
    for (const goodId in ship.cargo) {
        total += ship.cargo[goodId] * (GOODS[goodId] ? GOODS[goodId].weight : 1);
    }
    return total;
}

function getCargoCount(ship) {
    let total = 0;
    for (const goodId in ship.cargo) {
        total += ship.cargo[goodId];
    }
    return total;
}

function getRemainingCapacity(ship) {
    return ship.capacity - getCargoCount(ship);
}

function addCargo(ship, goodId, amount) {
    const remaining = getRemainingCapacity(ship);
    const actual = Math.min(amount, remaining);
    if (actual <= 0) return 0;
    ship.cargo[goodId] = (ship.cargo[goodId] || 0) + actual;
    ship.cargoUsed = getCargoCount(ship);
    return actual;
}

function removeCargo(ship, goodId, amount) {
    const current = ship.cargo[goodId] || 0;
    const actual = Math.min(amount, current);
    if (actual <= 0) return 0;
    ship.cargo[goodId] = current - actual;
    if (ship.cargo[goodId] <= 0) delete ship.cargo[goodId];
    ship.cargoUsed = getCargoCount(ship);
    return actual;
}

// Ship name generator
const SHIP_NAMES = [
    'Adler', 'Falke', 'Greif', 'Loewe', 'Baer',
    'Schwan', 'Delphin', 'Moewe', 'Stern', 'Nordstern',
    'Ostsee', 'Hansa', 'Fortuna', 'Hoffnung', 'Friede',
    'Einigkeit', 'Treue', 'Glueck', 'Merkur', 'Neptun',
    'St. Maria', 'St. Nikolaus', 'St. Peter', 'Christoph',
    'Windbraut', 'Sturmvogel', 'Wellenreiter', 'Meerdrache'
];

let shipNameIndex = 0;
function generateShipName() {
    const name = SHIP_NAMES[shipNameIndex % SHIP_NAMES.length];
    shipNameIndex++;
    return name;
}
