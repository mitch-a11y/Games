/* ============================================
   HANSE - Goods & Commodities
   ============================================ */

const GOODS = {
    grain: {
        id: 'grain',
        name: 'Getreide',
        icon: '🌾',
        basePrice: 30,
        weight: 2,
        category: 'food',
        perishable: false,
        description: 'Grundnahrungsmittel fuer die Bevoelkerung'
    },
    fish: {
        id: 'fish',
        name: 'Fisch',
        icon: '🐟',
        basePrice: 25,
        weight: 1.5,
        category: 'food',
        perishable: true,
        description: 'Frischer und gesalzener Fisch'
    },
    wood: {
        id: 'wood',
        name: 'Holz',
        icon: '🪵',
        basePrice: 20,
        weight: 4,
        category: 'raw',
        perishable: false,
        description: 'Bau- und Brennholz'
    },
    iron: {
        id: 'iron',
        name: 'Eisenwaren',
        icon: '⚒️',
        basePrice: 80,
        weight: 5,
        category: 'manufactured',
        perishable: false,
        description: 'Werkzeuge, Naegel und Beschlaege'
    },
    cloth: {
        id: 'cloth',
        name: 'Tuch',
        icon: '🧶',
        basePrice: 100,
        weight: 1,
        category: 'manufactured',
        perishable: false,
        description: 'Feines flandrisches Tuch'
    },
    fur: {
        id: 'fur',
        name: 'Pelze',
        icon: '🦊',
        basePrice: 150,
        weight: 1,
        category: 'luxury',
        perishable: false,
        description: 'Edle Pelze aus dem Osten'
    },
    beer: {
        id: 'beer',
        name: 'Bier',
        icon: '🍺',
        basePrice: 35,
        weight: 3,
        category: 'food',
        perishable: true,
        description: 'Hanseatisches Exportbier'
    },
    salt: {
        id: 'salt',
        name: 'Salz',
        icon: '🧂',
        basePrice: 45,
        weight: 3,
        category: 'raw',
        perishable: false,
        description: 'Lueneburger Salz zur Konservierung'
    },
    spices: {
        id: 'spices',
        name: 'Gewuerze',
        icon: '🌶️',
        basePrice: 250,
        weight: 0.5,
        category: 'luxury',
        perishable: false,
        description: 'Seltene orientalische Gewuerze'
    },
    wine: {
        id: 'wine',
        name: 'Wein',
        icon: '🍷',
        basePrice: 120,
        weight: 3,
        category: 'luxury',
        perishable: false,
        description: 'Rheinwein und franzoesischer Wein'
    }
};

const GOOD_IDS = Object.keys(GOODS);

// Get goods by category
function getGoodsByCategory(category) {
    return GOOD_IDS.filter(id => GOODS[id].category === category);
}
