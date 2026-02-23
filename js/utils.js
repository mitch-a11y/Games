/* ============================================
   HANSE - Utility Functions
   ============================================ */

const Utils = {
    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    rand(min, max) {
        return Math.random() * (max - min) + min;
    },

    randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    },

    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },

    distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    },

    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    formatGold(amount) {
        return Math.floor(amount).toLocaleString('de-DE') + ' Gold';
    },

    formatNumber(n) {
        return Math.floor(n).toLocaleString('de-DE');
    },

    formatDate(day, month, year) {
        const months = [
            'Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        return `${day}. ${months[month - 1]} ${year}`;
    },

    formatDateShort(day, month, year) {
        return `${day}.${month}.${year}`;
    },

    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Simple seeded random for reproducible events
    seededRandom(seed) {
        let s = seed;
        return function() {
            s = (s * 16807 + 0) % 2147483647;
            return s / 2147483647;
        };
    },

    // Ease functions for animations
    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    },

    easeOut(t) {
        return 1 - (1 - t) ** 2;
    },

    // Generate unique ID
    uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    // Catmull-Rom spline interpolation between 4 points at parameter t (0-1)
    catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        return {
            x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
            y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        };
    },

    // Generate smooth spline points from a set of control points
    // Returns array of {x,y} along the spline
    splinePoints(controlPoints, segmentsPerCurve = 12) {
        if (controlPoints.length < 2) return [...controlPoints];
        if (controlPoints.length === 2) return [...controlPoints];

        const pts = controlPoints;
        const result = [];

        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(i - 1, 0)];
            const p1 = pts[i];
            const p2 = pts[Math.min(i + 1, pts.length - 1)];
            const p3 = pts[Math.min(i + 2, pts.length - 1)];

            const steps = (i === pts.length - 2) ? segmentsPerCurve : segmentsPerCurve;
            for (let s = 0; s < steps; s++) {
                const t = s / steps;
                result.push(this.catmullRom(p0, p1, p2, p3, t));
            }
        }
        // Push final point
        result.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
        return result;
    }
};
