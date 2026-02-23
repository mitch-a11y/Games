/* ============================================
   HANSE - Cities of the Hanseatic League
   ============================================ */

const CITIES_DATA = {
    Luebeck: {
        name: 'Luebeck',
        displayName: 'L\u00fcbeck',
        x: 528, y: 465,
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
        x: 449, y: 497,
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
        x: 373, y: 520,
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
        x: 562, y: 396,
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
        x: 545, y: 433,
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
        x: 589, y: 387,
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
        x: 645, y: 465,
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
        x: 693, y: 438,
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
        x: 824, y: 419,
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
        x: 907, y: 305,
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
        x: 911, y: 146,
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
        x: 724, y: 155,
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
        x: 722, y: 278,
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
        x: 283, y: 77,
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
        x: 235, y: 590,
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
        x: 116, y: 535,
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
        x: 1112, y: 223,
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
// waypoints: [[x,y], ...] intermediate points in world coords (from→to direction)
// Ships interpolate along city→waypoints→city polyline to stay on water
const SEA_ROUTES = [
    // === WESTERN / NORTH SEA ===
    { from: 'London', to: 'Brugge', distance: 4,
      waypoints: [[175, 568]] },
    { from: 'Brugge', to: 'Bremen', distance: 5,
      waypoints: [[270, 555], [320, 530]] },
    { from: 'Brugge', to: 'Hamburg', distance: 6,
      waypoints: [[275, 550], [330, 520], [390, 500]] },
    { from: 'Bremen', to: 'Hamburg', distance: 3 },
    { from: 'Hamburg', to: 'Luebeck', distance: 3,
      waypoints: [[490, 470]] },
    { from: 'London', to: 'Bergen', distance: 8,
      waypoints: [[130, 420], [160, 300], [220, 170]] },
    { from: 'London', to: 'Hamburg', distance: 7,
      waypoints: [[180, 510], [290, 490], [370, 490]] },
    { from: 'Bergen', to: 'Hamburg', distance: 8,
      waypoints: [[300, 170], [340, 270], [350, 360], [370, 430], [410, 470]] },

    // === CENTRAL BALTIC (German Coast) ===
    { from: 'Luebeck', to: 'Wismar', distance: 2 },
    { from: 'Wismar', to: 'Rostock', distance: 2 },
    { from: 'Rostock', to: 'Stralsund', distance: 3 },
    { from: 'Stralsund', to: 'Stettin', distance: 3,
      waypoints: [[605, 410], [625, 440]] },
    { from: 'Luebeck', to: 'Rostock', distance: 3,
      waypoints: [[545, 430]] },
    { from: 'Luebeck', to: 'Stralsund', distance: 4,
      waypoints: [[545, 420], [565, 400]] },

    // === SOUTHERN BALTIC (Pomerania → Prussia) ===
    { from: 'Stettin', to: 'Danzig', distance: 5,
      waypoints: [[655, 440], [670, 425]] },
    { from: 'Stralsund', to: 'Danzig', distance: 6,
      waypoints: [[610, 380], [640, 390], [670, 410]] },
    { from: 'Danzig', to: 'Koenigsberg', distance: 4,
      waypoints: [[740, 425], [780, 420]] },
    { from: 'Koenigsberg', to: 'Riga', distance: 5,
      waypoints: [[860, 380], [885, 340]] },

    // === NORTHERN / EASTERN BALTIC ===
    { from: 'Riga', to: 'Reval', distance: 5,
      waypoints: [[920, 240], [915, 185]] },
    { from: 'Reval', to: 'Novgorod', distance: 5,
      waypoints: [[960, 155], [1020, 175], [1070, 200]] },
    { from: 'Stockholm', to: 'Reval', distance: 5,
      waypoints: [[780, 145], [840, 140]] },
    { from: 'Stockholm', to: 'Visby', distance: 3 },
    { from: 'Visby', to: 'Danzig', distance: 4,
      waypoints: [[710, 340], [700, 400]] },
    { from: 'Visby', to: 'Riga', distance: 5,
      waypoints: [[780, 280], [850, 290]] },
    { from: 'Visby', to: 'Rostock', distance: 5,
      waypoints: [[680, 310], [630, 350], [590, 380]] },

    // === LONG-DISTANCE ROUTES ===
    { from: 'Bergen', to: 'Luebeck', distance: 9,
      waypoints: [[310, 170], [360, 260], [420, 330], [470, 380], [510, 420]] },
    { from: 'Bergen', to: 'Stockholm', distance: 10,
      waypoints: [[320, 150], [380, 200], [450, 210], [530, 200], [620, 180], [680, 165]] },
    { from: 'Stockholm', to: 'Riga', distance: 6,
      waypoints: [[770, 185], [820, 220], [870, 270]] },
    { from: 'Stralsund', to: 'Visby', distance: 4,
      waypoints: [[620, 360], [660, 320]] },
    { from: 'Luebeck', to: 'Danzig', distance: 7,
      waypoints: [[545, 425], [575, 395], [610, 385], [650, 400], [675, 420]] },
    { from: 'Rostock', to: 'Visby', distance: 5,
      waypoints: [[590, 370], [630, 340], [670, 310]] },
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

// === SMOOTH SPLINE ROUTE SYSTEM ===

// Cache for computed spline paths (avoids recomputing every frame)
const _splineCache = {};

// Get raw waypoint path for a route (control points only)
function getRouteControlPoints(fromCityId, toCityId) {
    const from = CITIES_DATA[fromCityId];
    const to = CITIES_DATA[toCityId];
    if (!from || !to) return [{ x: 0, y: 0 }];

    const route = SEA_ROUTES.find(r =>
        (r.from === fromCityId && r.to === toCityId) ||
        (r.from === toCityId && r.to === fromCityId)
    );

    const points = [{ x: from.x, y: from.y }];

    if (route && route.waypoints && route.waypoints.length > 0) {
        const wps = route.from === fromCityId
            ? route.waypoints
            : [...route.waypoints].reverse();
        wps.forEach(wp => points.push({ x: wp[0], y: wp[1] }));
    }

    points.push({ x: to.x, y: to.y });
    return points;
}

// Get smooth spline path for a route segment (cached)
// Returns dense array of {x,y} points along a Catmull-Rom spline
function getRouteSegmentPath(fromCityId, toCityId) {
    const key = fromCityId + '>' + toCityId;
    if (_splineCache[key]) return _splineCache[key];

    const controlPts = getRouteControlPoints(fromCityId, toCityId);

    // If only 2 points (straight line) or 3+, use spline
    let path;
    if (controlPts.length <= 2) {
        path = controlPts;
    } else {
        path = Utils.splinePoints(controlPts, 10);
    }

    _splineCache[key] = path;
    return path;
}

// Interpolate position along a spline path at parameter t (0-1)
// Returns { x, y, angle } in world coordinates
function interpolatePolyline(points, t) {
    if (points.length < 2) return { x: points[0].x, y: points[0].y, angle: 0 };

    let totalLen = 0;
    const segLens = [];
    for (let i = 0; i < points.length - 1; i++) {
        const len = Utils.distance(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
        segLens.push(len);
        totalLen += len;
    }

    if (totalLen === 0) return { x: points[0].x, y: points[0].y, angle: 0 };

    const ct = Math.max(0, Math.min(1, t));
    let targetDist = ct * totalLen;

    for (let i = 0; i < segLens.length; i++) {
        if (targetDist <= segLens[i] || i === segLens.length - 1) {
            const localT = segLens[i] > 0 ? targetDist / segLens[i] : 0;
            const x = Utils.lerp(points[i].x, points[i + 1].x, localT);
            const y = Utils.lerp(points[i].y, points[i + 1].y, localT);
            // Compute angle from surrounding points for smoother heading
            const lookAhead = Math.min(i + 1, points.length - 1);
            const lookBehind = Math.max(i, 0);
            const angle = Utils.angle(points[lookBehind].x, points[lookBehind].y,
                                      points[lookAhead].x, points[lookAhead].y);
            return { x, y, angle };
        }
        targetDist -= segLens[i];
    }

    const last = points.length - 1;
    return {
        x: points[last].x, y: points[last].y,
        angle: Utils.angle(points[last - 1].x, points[last - 1].y, points[last].x, points[last].y)
    };
}
