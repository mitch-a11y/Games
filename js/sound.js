/* ============================================
   HANSE - Sound System (Web Audio API)
   ============================================ */

const Sound = {
    ctx: null,
    enabled: true,
    volume: 0.3,
    musicPlaying: false,

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // Simple tone generator
    playTone(freq, duration, type, vol) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.value = (vol || this.volume) * 0.3;
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
    },

    // Sound effects
    play(name) {
        if (!this.enabled) return;

        switch (name) {
            case 'click':
                this.playTone(800, 0.08, 'square', 0.15);
                break;
            case 'buy':
                this.playTone(523, 0.1, 'sine', 0.2);
                setTimeout(() => this.playTone(659, 0.1, 'sine', 0.2), 80);
                break;
            case 'sell':
                this.playTone(659, 0.1, 'sine', 0.2);
                setTimeout(() => this.playTone(523, 0.1, 'sine', 0.2), 80);
                break;
            case 'build':
                this.playTone(440, 0.15, 'triangle', 0.2);
                setTimeout(() => this.playTone(554, 0.15, 'triangle', 0.2), 100);
                setTimeout(() => this.playTone(659, 0.2, 'triangle', 0.2), 200);
                break;
            case 'sail':
                this.playTone(330, 0.3, 'sine', 0.15);
                setTimeout(() => this.playTone(392, 0.3, 'sine', 0.15), 150);
                break;
            case 'arrive':
                this.playTone(523, 0.15, 'sine', 0.2);
                setTimeout(() => this.playTone(659, 0.15, 'sine', 0.2), 100);
                setTimeout(() => this.playTone(784, 0.25, 'sine', 0.2), 200);
                break;
            case 'event':
                this.playTone(440, 0.2, 'sawtooth', 0.15);
                setTimeout(() => this.playTone(370, 0.2, 'sawtooth', 0.15), 150);
                break;
            case 'danger':
                this.playTone(220, 0.3, 'sawtooth', 0.2);
                setTimeout(() => this.playTone(185, 0.3, 'sawtooth', 0.2), 200);
                setTimeout(() => this.playTone(165, 0.4, 'sawtooth', 0.2), 400);
                break;
            case 'gold':
                this.playTone(880, 0.05, 'sine', 0.15);
                setTimeout(() => this.playTone(1100, 0.05, 'sine', 0.1), 50);
                break;
            case 'combat_start':
                this.playTone(220, 0.2, 'sawtooth', 0.25);
                setTimeout(() => this.playTone(185, 0.2, 'sawtooth', 0.25), 150);
                setTimeout(() => this.playTone(165, 0.3, 'sawtooth', 0.2), 300);
                setTimeout(() => this.playTone(220, 0.15, 'square', 0.15), 500);
                break;
            case 'combat_cannon':
                this.playTone(110, 0.15, 'sawtooth', 0.3);
                setTimeout(() => this.playTone(80, 0.2, 'square', 0.2), 80);
                setTimeout(() => this.playTone(55, 0.25, 'sawtooth', 0.15), 160);
                break;
            case 'combat_victory':
                [523, 659, 784, 1047].forEach((f, i) => {
                    setTimeout(() => this.playTone(f, 0.3, 'triangle', 0.2), i * 150);
                });
                break;
            case 'newgame':
                [523, 587, 659, 784].forEach((f, i) => {
                    setTimeout(() => this.playTone(f, 0.25, 'triangle', 0.2), i * 200);
                });
                break;
        }
    },

    // Ambient sea sounds (looping noise)
    startAmbient() {
        if (!this.enabled || !this.ctx || this.musicPlaying) return;
        this.resume();
        this.musicPlaying = true;

        // Create gentle noise for sea ambiance
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Brown noise (filtered)
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5;
        }

        this.ambientSource = this.ctx.createBufferSource();
        this.ambientSource.buffer = buffer;
        this.ambientSource.loop = true;

        const ambientGain = this.ctx.createGain();
        ambientGain.gain.value = 0.03;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        this.ambientSource.connect(filter);
        filter.connect(ambientGain);
        ambientGain.connect(this.ctx.destination);
        this.ambientSource.start();
        this.ambientGain = ambientGain;
    },

    stopAmbient() {
        if (this.ambientSource) {
            try { this.ambientSource.stop(); } catch (e) {}
            this.ambientSource = null;
        }
        this.musicPlaying = false;
    },

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) this.stopAmbient();
        else this.startAmbient();
        return this.enabled;
    }
};
