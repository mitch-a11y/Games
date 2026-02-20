/* ============================================
   HANSE - Cities of the Hanseatic League
   ============================================ */

const CITIES_DATA = {
    Luebeck: {
        name: 'Luebeck',
        displayName: 'L\u00fcbeck',
        x: 490, y: 360,
        population: 25000,
        importance: 5, // 1-5, affects trade volume
        hasShipyard: true,
        production: { salt: 3, beer: 2, cloth: 1 },
        demand: { grain: 3, fish: 2, wood: 1, fur: 2, spices: 3, wine: 2 },
        description: 'Koenigin der Hanse, Hauptstadt des Handelsbundes'
    },
    Hamburg: {
        name: 'Hamburg',
        displayName: 'Hamburg',
        x: 430, y: 370,
        population: 18000,
        importance: 4,
        hasShipyard: true,
        production: { beer: 3, cloth: 2, grain: 1 },
        demand: { fish: 3, wood: 2, iron: 2, fur: 1, spices: 2, wine: 2 },
        description: 'Grosser Hafen an der Elbe, Tor zur Nordsee'
    },
    Bremen: {
        name: 'Bremen',
        displayName: 'Bremen',
        x: 390, y: 385,
        population: 12000,
        importance: 3,
        hasShipyard: true,
        production: { beer: 3, grain: 1, cloth: 1 },
        demand: { fish: 2, wood: 2, iron: 1, fur: 1, wine: 2, spices: 1 },
        description: 'Handelsstadt an der Weser'
    },
    Rostock: {
        name: 'Rostock',
        displayName: 'Rostock',
        x: 540, y: 340,
        population: 12000,
        importance: 3,
        hasShipyard: true,
        production: { grain: 2, fish: 2, beer: 1 },
        demand: { cloth: 2, iron: 2, salt: 2, spices: 1, wine: 1 },
        description: 'Wichtiger Ostseehafen in Mecklenburg'
    },
    Wismar: {
        name: 'Wismar',
        displayName: 'Wismar',
        x: 510, y: 348,
        population: 8000,
        importance: 2,
        hasShipyard: false,
        production: { fish: 2, grain: 2 },
        demand: { cloth: 1, iron: 1, salt: 2, beer: 2, wine: 1 },
        description: 'Kleine Hafenstadt in Mecklenburg'
    },
    Stralsund: {
        name: 'Stralsund',
        displayName: 'Stralsund',
        x: 580, y: 320,
        population: 10000,
        importance: 3,
        hasShipyard: true,
        production: { fish: 3, grain: 1, salt: 1 },
        demand: { cloth: 2, iron: 2, beer: 2, spices: 1, wine: 1 },
        description: 'Hafen am Strelasund, Tor nach Ruegen'
    },
    Stettin: {
        name: 'Stettin',
        displayName: 'Stettin',
        x: 615, y: 370,
        population: 9000,
        importance: 2,
        hasShipyard: true,
        production: { wood: 3, grain: 2, fish: 1 },
        demand: { cloth: 2, iron: 1, salt: 1, beer: 2, wine: 1, spices: 1 },
        description: 'Hafenstadt an der Oder'
    },
    Danzig: {
        name: 'Danzig',
        displayName: 'Danzig',
        x: 720, y: 340,
        population: 20000,
        importance: 4,
        hasShipyard: true,
        production: { grain: 3, wood: 3, fur: 1 },
        demand: { cloth: 3, iron: 2, salt: 2, beer: 2, spices: 2, wine: 2 },
        description: 'Grosser Handelshafen an der Weichsel'
    },
    Koenigsberg: {
        name: 'Koenigsberg',
        displayName: 'K\u00f6nigsberg',
        x: 810, y: 310,
        population: 10000,
        importance: 3,
        hasShipyard: true,
        production: { grain: 2, wood: 2, fur: 2 },
        demand: { cloth: 2, iron: 2, salt: 2, beer: 1, wine: 2, spices: 1 },
        description: 'Sitz des Deutschen Ordens'
    },
    Riga: {
        name: 'Riga',
        displayName: 'Riga',
        x: 890, y: 240,
        population: 12000,
        importance: 3,
        hasShipyard: true,
        production: { fur: 3, wood: 3, grain: 1 },
        demand: { cloth: 3, iron: 2, salt: 3, beer: 2, wine: 2, spices: 2 },
        description: 'Tor zum Osten, Pelzhandel'
    },
    Reval: {
        name: 'Reval',
        displayName: 'Reval',
        x: 920, y: 170,
        population: 8000,
        importance: 3,
        hasShipyard: true,
        production: { fur: 3, wood: 2, fish: 1 },
        demand: { cloth: 2, iron: 2, salt: 2, grain: 2, wine: 2, spices: 2, beer: 1 },
        description: 'Estnischer Handelshafen'
    },
    Stockholm: {
        name: 'Stockholm',
        displayName: 'Stockholm',
        x: 740, y: 150,
        population: 7000,
        importance: 3,
        hasShipyard: true,
        production: { iron: 3, wood: 2, fish: 2 },
        demand: { cloth: 2, grain: 2, salt: 1, beer: 2, wine: 2, spices: 1 },
        description: 'Schwedisches Zentrum, Eisenexport'
    },
    Visby: {
        name: 'Visby',
        displayName: 'Visby',
        x: 700, y: 220,
        population: 6000,
        importance: 3,
        hasShipyard: false,
        production: { fish: 2, grain: 1 },
        demand: { cloth: 2, iron: 1, beer: 2, wine: 2, spices: 2, salt: 1 },
        description: 'Gotland - alte Handelsmetropole'
    },
    Bergen: {
        name: 'Bergen',
        displayName: 'Bergen',
        x: 280, y: 140,
        population: 9000,
        importance: 3,
        hasShipyard: true,
        production: { fish: 4, wood: 2 },
        demand: { grain: 3, cloth: 2, iron: 1, beer: 2, salt: 2, wine: 1, spices: 1 },
        description: 'Norwegisches Kontor, Stockfischhandel'
    },
    Brugge: {
        name: 'Brugge',
        displayName: 'Br\u00fcgge',
        x: 270, y: 430,
        population: 35000,
        importance: 5,
        hasShipyard: true,
        production: { cloth: 4, wine: 2, spices: 2 },
        demand: { grain: 2, fish: 2, wood: 2, fur: 3, iron: 1 },
        description: 'Flandrische Handelsmetropole, Tuchhandel'
    },
    London: {
        name: 'London',
        displayName: 'London',
        x: 210, y: 445,
        population: 40000,
        importance: 4,
        hasShipyard: true,
        production: { cloth: 3, wine: 1, iron: 1, spices: 1 },
        demand: { grain: 2, fish: 2, wood: 3, fur: 3, beer: 1 },
        description: 'Stalhof - Hanseatisches Kontor in England'
    },
    Novgorod: {
        name: 'Novgorod',
        displayName: 'Nowgorod',
        x: 1010, y: 130,
        population: 15000,
        importance: 4,
        hasShipyard: false,
        production: { fur: 4, wood: 2, grain: 1 },
        demand: { cloth: 3, iron: 2, salt: 3, beer: 2, wine: 3, spices: 2 },
        description: 'Peterhof - Russisches Kontor, Pelzhandel'
    }
};

const CITY_IDS = Object.keys(CITIES_DATA);

// Sea routes: connections between cities with distances
const SEA_ROUTES = [
    // Western Baltic
    { from: 'London', to: 'Brugge', distance: 4 },
    { from: 'Brugge', to: 'Bremen', distance: 5 },
    { from: 'Brugge', to: 'Hamburg', distance: 6 },
    { from: 'Bremen', to: 'Hamburg', distance: 3 },
    { from: 'Hamburg', to: 'Luebeck', distance: 3 },
    { from: 'London', to: 'Bergen', distance: 8 },
    { from: 'London', to: 'Hamburg', distance: 7 },
    { from: 'Bergen', to: 'Hamburg', distance: 8 },
    // Central Baltic
    { from: 'Luebeck', to: 'Wismar', distance: 2 },
    { from: 'Wismar', to: 'Rostock', distance: 2 },
    { from: 'Rostock', to: 'Stralsund', distance: 3 },
    { from: 'Stralsund', to: 'Stettin', distance: 3 },
    { from: 'Luebeck', to: 'Rostock', distance: 3 },
    { from: 'Luebeck', to: 'Stralsund', distance: 4 },
    // Southern Baltic
    { from: 'Stettin', to: 'Danzig', distance: 5 },
    { from: 'Stralsund', to: 'Danzig', distance: 6 },
    { from: 'Danzig', to: 'Koenigsberg', distance: 4 },
    { from: 'Koenigsberg', to: 'Riga', distance: 5 },
    // Northern Baltic
    { from: 'Riga', to: 'Reval', distance: 5 },
    { from: 'Reval', to: 'Novgorod', distance: 5 },
    { from: 'Stockholm', to: 'Reval', distance: 5 },
    { from: 'Stockholm', to: 'Visby', distance: 3 },
    { from: 'Visby', to: 'Danzig', distance: 4 },
    { from: 'Visby', to: 'Riga', distance: 5 },
    { from: 'Visby', to: 'Rostock', distance: 5 },
    { from: 'Bergen', to: 'Luebeck', distance: 9 },
    { from: 'Bergen', to: 'Stockholm', distance: 10 },
    { from: 'Stockholm', to: 'Riga', distance: 6 },
    { from: 'Stralsund', to: 'Visby', distance: 4 },
    { from: 'Luebeck', to: 'Danzig', distance: 7 },
    { from: 'Rostock', to: 'Visby', distance: 5 },
];

// Build adjacency for pathfinding
function buildRouteGraph() {
    const graph = {};
    CITY_IDS.forEach(id => { graph[id] = []; });
    SEA_ROUTES.forEach(r => {
        graph[r.from].push({ city: r.to, distance: r.distance });
        graph[r.to].push({ city: r.from, distance: r.distance });
    });
    return graph;
}

const ROUTE_GRAPH = buildRouteGraph();

// Dijkstra's shortest path
function findShortestPath(from, to) {
    if (from === to) return { path: [from], distance: 0 };

    const dist = {};
    const prev = {};
    const visited = new Set();
    const queue = [];

    CITY_IDS.forEach(id => { dist[id] = Infinity; });
    dist[from] = 0;
    queue.push({ city: from, dist: 0 });

    while (queue.length > 0) {
        queue.sort((a, b) => a.dist - b.dist);
        const { city: current } = queue.shift();

        if (current === to) break;
        if (visited.has(current)) continue;
        visited.add(current);

        for (const neighbor of ROUTE_GRAPH[current]) {
            const newDist = dist[current] + neighbor.distance;
            if (newDist < dist[neighbor.city]) {
                dist[neighbor.city] = newDist;
                prev[neighbor.city] = current;
                queue.push({ city: neighbor.city, dist: newDist });
            }
        }
    }

    if (dist[to] === Infinity) return null;

    const path = [];
    let cur = to;
    while (cur) {
        path.unshift(cur);
        cur = prev[cur];
    }
    return { path, distance: dist[to] };
}

// Get connected cities
function getConnectedCities(cityId) {
    return ROUTE_GRAPH[cityId].map(r => r.city);
}
