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
    }
};
