/* ============================================
   HANSE - Game Configuration
   ============================================ */

const CONFIG = {
    // Time
    START_YEAR: 1370,
    START_MONTH: 3, // March
    DAYS_PER_MONTH: 30,
    MONTHS_PER_YEAR: 12,
    TICK_MS: 1000,           // 1 real second = 1 game day at speed 1
    SPEED_MULTIPLIERS: [0, 1, 3, 8],

    // Economy
    STARTING_GOLD: 5000,
    TAX_RATE: 0.02,          // 2% per month on buildings
    LOAN_INTEREST: 0.05,     // 5% per month
    MAX_LOAN_MULTIPLIER: 3,  // max loan = net worth * this
    PRICE_VOLATILITY: 0.08,  // random fluctuation per tick
    DEMAND_FACTOR: 0.6,      // how much demand affects price

    // Ships
    SHIP_SPEED_BASE: 2,      // pixels per tick on map
    WIND_EFFECT: 0.5,        // how much wind affects speed
    PIRATE_CHANCE: 0.003,    // per voyage tick
    STORM_CHANCE: 0.005,     // per voyage tick

    // City
    POPULATION_GROWTH: 0.001, // per month base
    CONSUMPTION_RATE: 0.02,   // goods consumed per pop per month
    PRODUCTION_RATE: 0.05,    // goods produced per building per day

    // Player - legacy ranks kept for reference, reputation system now handles ranks
    RANKS: [
        { name: 'Kr\u00e4mer', minWealth: 0 },
        { name: 'H\u00e4ndler', minWealth: 5000 },
        { name: 'Kaufmann', minWealth: 15000 },
        { name: 'Fernkaufmann', minWealth: 50000 },
        { name: 'Ratsherr', minWealth: 150000 },
        { name: 'Patrizier', minWealth: 500000 },
        { name: 'B\u00fcrgermeister', minWealth: 1000000 },
        { name: '\u00c4ltermann der Hanse', minWealth: 2000000 }
    ],

    // Difficulty modifiers
    DIFFICULTY: {
        easy:   { priceBonus: 0.9, startGold: 8000,  aiAggression: 0.5, eventChance: 0.7 },
        normal: { priceBonus: 1.0, startGold: 5000,  aiAggression: 1.0, eventChance: 1.0 },
        hard:   { priceBonus: 1.1, startGold: 3000,  aiAggression: 1.5, eventChance: 1.3 }
    },

    // Map
    MAP_WIDTH: 1200,
    MAP_HEIGHT: 700,

    // Events
    EVENT_CHECK_INTERVAL: 5,  // days between event checks
    EVENT_BASE_CHANCE: 0.15,  // base chance per check

    // AI
    AI_TRADER_COUNT: 4,
    AI_UPDATE_INTERVAL: 3,    // days between AI decisions

    // Buildings max per city
    MAX_BUILDINGS_PER_TYPE: 5
};
