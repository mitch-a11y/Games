/* ============================================
   HANSE - Complete Sound Engine (Web Audio API)
   All sounds procedurally generated - no external files!
   ============================================ */

const Sound = {
    ctx: null,
    enabled: true,
    masterVolume: 0.35,
    sfxVolume: 0.5,
    musicVolume: 0.3,
    ambientVolume: 0.4,
    musicPlaying: false,
    ambientPlaying: false,

    // Audio nodes
    masterGain: null,
    sfxGain: null,
    musicGain: null,
    ambientGain: null,

    // Ambient state
    _oceanSource: null,
    _oceanFilter: null,
    _windSource: null,
    _windFilter: null,
    _windGain: null,
    _portSource: null,
    _portGain: null,
    _musicInterval: null,
    _musicNodes: [],

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            // Build audio graph: sources -> category gains -> master gain -> destination
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.masterVolume;
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = this.sfxVolume;
            this.sfxGain.connect(this.masterGain);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = this.musicVolume;
            this.musicGain.connect(this.masterGain);

            this.ambientGain = this.ctx.createGain();
            this.ambientGain.gain.value = this.ambientVolume;
            this.ambientGain.connect(this.masterGain);
        } catch (e) {
            this.enabled = false;
        }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    // --- Volume controls ---
    setMasterVolume(v) {
        this.masterVolume = Utils.clamp(v, 0, 1);
        if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
    },

    setSfxVolume(v) {
        this.sfxVolume = Utils.clamp(v, 0, 1);
        if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    },

    setMusicVolume(v) {
        this.musicVolume = Utils.clamp(v, 0, 1);
        if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    },

    setAmbientVolume(v) {
        this.ambientVolume = Utils.clamp(v, 0, 1);
        if (this.ambientGain) this.ambientGain.gain.value = this.ambientVolume;
    },

    // --- Core tone/noise generators ---
    playTone(freq, duration, type, vol, dest) {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(dest || this.sfxGain);
        osc.type = type || 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime((vol || 0.3) * 0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.start(now);
        osc.stop(now + duration);
    },

    _createNoiseBuffer(duration, color) {
        const sampleRate = this.ctx.sampleRate;
        const len = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, len, sampleRate);
        const data = buffer.getChannelData(0);
        if (color === 'brown') {
            let last = 0;
            for (let i = 0; i < len; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (last + 0.02 * white) / 1.02;
                last = data[i];
                data[i] *= 3.5;
            }
        } else if (color === 'pink') {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < len; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
        } else { // white
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    },

    // --- Sound Effects ---
    play(name) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        switch (name) {
            case 'click':
                this._playClick();
                break;
            case 'buy':
                this._playCoinClink(true);
                break;
            case 'sell':
                this._playCoinClink(false);
                break;
            case 'build':
                this._playBuild();
                break;
            case 'sail':
                this._playSailDepart();
                break;
            case 'arrive':
                this._playSuccessFanfare();
                break;
            case 'event':
                this._playNotificationBell();
                break;
            case 'danger':
                this.playTone(220, 0.3, 'sawtooth', 0.2);
                setTimeout(() => this.playTone(185, 0.3, 'sawtooth', 0.2), 200);
                setTimeout(() => this.playTone(165, 0.4, 'sawtooth', 0.2), 400);
                break;
            case 'gold':
                this._playCoinClink(true);
                break;
            case 'combat_start':
                this._playCombatStart();
                break;
            case 'combat_cannon':
                this._playCannonBoom();
                break;
            case 'combat_victory':
                this._playSuccessFanfare();
                break;
            case 'tab_switch':
                this.playTone(600, 0.05, 'sine', 0.1);
                break;
            case 'newgame':
                [523, 587, 659, 784].forEach((f, i) => {
                    setTimeout(() => this.playTone(f, 0.25, 'triangle', 0.18), i * 200);
                });
                break;
        }
    },

    _playClick() {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
    },

    _playCoinClink(ascending) {
        const now = this.ctx.currentTime;
        const freqs = ascending ? [1200, 1600, 2000] : [2000, 1600, 1200];
        freqs.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.type = 'sine';
            osc.frequency.value = f;
            const t = now + i * 0.06;
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.start(t);
            osc.stop(t + 0.12);
            // Add metallic overtone
            const osc2 = this.ctx.createOscillator();
            const g2 = this.ctx.createGain();
            osc2.connect(g2);
            g2.connect(this.sfxGain);
            osc2.type = 'sine';
            osc2.frequency.value = f * 2.756;
            g2.gain.setValueAtTime(0.03, t);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            osc2.start(t);
            osc2.stop(t + 0.08);
        });
    },

    _playBuild() {
        const now = this.ctx.currentTime;
        // Wood hammering sound
        for (let i = 0; i < 3; i++) {
            const t = now + i * 0.12;
            const noise = this.ctx.createBufferSource();
            noise.buffer = this._createNoiseBuffer(0.08, 'brown');
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 800 + i * 200;
            filter.Q.value = 2;
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
            noise.start(t);
            noise.stop(t + 0.08);
        }
        // Rising tone for completion
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now + 0.36);
        osc.frequency.linearRampToValueAtTime(660, now + 0.56);
        g.gain.setValueAtTime(0.06, now + 0.36);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now + 0.36);
        osc.stop(now + 0.6);
    },

    _playSailDepart() {
        const now = this.ctx.currentTime;
        // Sail flap (filtered noise burst)
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._createNoiseBuffer(0.5, 'pink');
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'bandpass';
        filt.frequency.value = 400;
        filt.Q.value = 1;
        const g = this.ctx.createGain();
        noise.connect(filt);
        filt.connect(g);
        g.connect(this.sfxGain);
        g.gain.setValueAtTime(0.06, now);
        g.gain.linearRampToValueAtTime(0.12, now + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        noise.start(now);
        noise.stop(now + 0.5);
        // Creaking wood
        const osc = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        osc.connect(g2);
        g2.connect(this.sfxGain);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now + 0.1);
        osc.frequency.linearRampToValueAtTime(220, now + 0.3);
        osc.frequency.linearRampToValueAtTime(160, now + 0.5);
        g2.gain.setValueAtTime(0.02, now + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now + 0.1);
        osc.stop(now + 0.5);
    },

    _playSuccessFanfare() {
        const now = this.ctx.currentTime;
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => {
            const t = now + i * 0.12;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.type = 'triangle';
            osc.frequency.value = f;
            g.gain.setValueAtTime(0.07, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.start(t);
            osc.stop(t + 0.35);
        });
    },

    _playNotificationBell() {
        const now = this.ctx.currentTime;
        // Bell-like: two detuned oscillators
        [880, 880 * 1.005].forEach(f => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.type = 'sine';
            osc.frequency.value = f;
            g.gain.setValueAtTime(0.08, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
        });
        // Overtone
        const osc3 = this.ctx.createOscillator();
        const g3 = this.ctx.createGain();
        osc3.connect(g3);
        g3.connect(this.sfxGain);
        osc3.type = 'sine';
        osc3.frequency.value = 880 * 2.76;
        g3.gain.setValueAtTime(0.03, now);
        g3.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc3.start(now);
        osc3.stop(now + 0.4);
    },

    _playCombatStart() {
        const now = this.ctx.currentTime;
        // War drum
        for (let i = 0; i < 3; i++) {
            const t = now + i * 0.2;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, t);
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
            g.gain.setValueAtTime(0.2, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.start(t);
            osc.stop(t + 0.2);
        }
        // Alarm horn
        const horn = this.ctx.createOscillator();
        const hg = this.ctx.createGain();
        horn.connect(hg);
        hg.connect(this.sfxGain);
        horn.type = 'sawtooth';
        horn.frequency.setValueAtTime(220, now + 0.6);
        horn.frequency.linearRampToValueAtTime(185, now + 1.0);
        hg.gain.setValueAtTime(0.06, now + 0.6);
        hg.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        horn.start(now + 0.6);
        horn.stop(now + 1.2);
    },

    _playCannonBoom() {
        const now = this.ctx.currentTime;
        // Cannon: noise burst + low frequency thump
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._createNoiseBuffer(0.3, 'brown');
        const nfilt = this.ctx.createBiquadFilter();
        nfilt.type = 'lowpass';
        nfilt.frequency.setValueAtTime(2000, now);
        nfilt.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        const ng = this.ctx.createGain();
        noise.connect(nfilt);
        nfilt.connect(ng);
        ng.connect(this.sfxGain);
        ng.gain.setValueAtTime(0.35, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        noise.start(now);
        noise.stop(now + 0.3);
        // Low thump
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
        g.gain.setValueAtTime(0.25, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        // Wood splintering (high freq noise)
        setTimeout(() => {
            if (!this.enabled || !this.ctx) return;
            const n2 = this.ctx.createBufferSource();
            n2.buffer = this._createNoiseBuffer(0.15, 'white');
            const f2 = this.ctx.createBiquadFilter();
            f2.type = 'highpass';
            f2.frequency.value = 3000;
            const g2 = this.ctx.createGain();
            n2.connect(f2);
            f2.connect(g2);
            g2.connect(this.sfxGain);
            const t2 = this.ctx.currentTime;
            g2.gain.setValueAtTime(0.08, t2);
            g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.12);
            n2.start(t2);
            n2.stop(t2 + 0.12);
        }, 80);
    },

    // --- Ambient Sound Layers ---
    startAmbient() {
        if (!this.enabled || !this.ctx || this.ambientPlaying) return;
        this.resume();
        this.ambientPlaying = true;
        this._startOceanAmbient();
        this._startWindAmbient();
    },

    _startOceanAmbient() {
        // Ocean waves: brown noise through band-pass, with LFO volume modulation
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._createNoiseBuffer(4, 'brown');
        noise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 250;
        filter.Q.value = 0.5;

        // LFO for wave-like volume pulsing
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1; // Slow wave rhythm
        lfoGain.gain.value = 0.015;
        lfo.connect(lfoGain);

        const oceanGain = this.ctx.createGain();
        oceanGain.gain.value = 0.04;
        lfoGain.connect(oceanGain.gain);

        noise.connect(filter);
        filter.connect(oceanGain);
        oceanGain.connect(this.ambientGain);

        noise.start();
        lfo.start();

        this._oceanSource = noise;
        this._oceanFilter = filter;
        this._oceanLfo = lfo;
        this._oceanGainNode = oceanGain;
    },

    _startWindAmbient() {
        // Wind: pink noise through band-pass that shifts with wind strength
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._createNoiseBuffer(3, 'pink');
        noise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 0.8;

        const windGainNode = this.ctx.createGain();
        windGainNode.gain.value = 0.01; // Start quiet

        noise.connect(filter);
        filter.connect(windGainNode);
        windGainNode.connect(this.ambientGain);

        noise.start();

        this._windSource = noise;
        this._windFilter = filter;
        this._windGainNode = windGainNode;
    },

    // Update ambient based on game state (called per frame or periodically)
    updateAmbient(gameState) {
        if (!this.enabled || !this.ctx || !this.ambientPlaying) return;
        if (!gameState || !gameState.wind) return;

        const windStr = gameState.wind.strength;

        // Adjust wind volume and filter based on wind strength
        if (this._windGainNode) {
            const targetVol = Utils.clamp(windStr * 0.02, 0, 0.06);
            this._windGainNode.gain.value += (targetVol - this._windGainNode.gain.value) * 0.05;
        }
        if (this._windFilter) {
            const targetFreq = 300 + windStr * 200;
            this._windFilter.frequency.value += (targetFreq - this._windFilter.frequency.value) * 0.05;
        }

        // Ocean waves get louder in storms
        if (this._oceanGainNode) {
            const targetVol = Utils.clamp(0.03 + windStr * 0.015, 0.03, 0.08);
            this._oceanGainNode.gain.value += (targetVol - this._oceanGainNode.gain.value) * 0.03;
        }
    },

    // --- Port sounds (seagulls, crowd murmur) ---
    playPortAmbient() {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;

        // Seagull cry (frequency sweep)
        const gullDelay = Math.random() * 0.5;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.ambientGain);
        osc.type = 'sine';
        const t0 = now + gullDelay;
        osc.frequency.setValueAtTime(800, t0);
        osc.frequency.linearRampToValueAtTime(1200, t0 + 0.15);
        osc.frequency.linearRampToValueAtTime(600, t0 + 0.4);
        g.gain.setValueAtTime(0.02, t0);
        g.gain.linearRampToValueAtTime(0.04, t0 + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
        osc.start(t0);
        osc.stop(t0 + 0.4);

        // Crowd murmur (short noise burst)
        const crowd = this.ctx.createBufferSource();
        crowd.buffer = this._createNoiseBuffer(0.5, 'pink');
        const cf = this.ctx.createBiquadFilter();
        cf.type = 'bandpass';
        cf.frequency.value = 500;
        cf.Q.value = 1.5;
        const cg = this.ctx.createGain();
        crowd.connect(cf);
        cf.connect(cg);
        cg.connect(this.ambientGain);
        cg.gain.setValueAtTime(0.008, now);
        cg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        crowd.start(now);
        crowd.stop(now + 0.5);
    },

    // --- Ship sailing sounds (creaking, sail flap) ---
    playShipCreak() {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.ambientGain);
        osc.type = 'sawtooth';
        const baseFreq = 150 + Math.random() * 80;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.linearRampToValueAtTime(baseFreq + 30, now + 0.2);
        osc.frequency.linearRampToValueAtTime(baseFreq - 20, now + 0.4);
        g.gain.setValueAtTime(0.01, now);
        g.gain.linearRampToValueAtTime(0.02, now + 0.15);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    },

    // --- Medieval Music Generator ---
    startMusic() {
        if (!this.enabled || !this.ctx || this.musicPlaying) return;
        this.resume();
        this.musicPlaying = true;

        // Pentatonic scale (A minor pentatonic): A3, C4, D4, E4, G4, A4, C5, D5
        const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

        let noteIdx = 0;
        let octaveShift = 0;
        let direction = 1;

        const playNote = () => {
            if (!this.enabled || !this.ctx || !this.musicPlaying) return;
            this.resume();
            const now = this.ctx.currentTime;

            // Pick note from scale with gentle arpeggiation
            const freq = scale[noteIdx] * (octaveShift === 0 ? 1 : 0.5);
            const duration = 0.6 + Math.random() * 0.8;

            // Main note (triangle for medieval lute-like sound)
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.connect(g);
            g.connect(this.musicGain);
            osc.type = 'triangle';
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0.04, now);
            g.gain.setValueAtTime(0.04, now + 0.05);
            g.gain.exponentialRampToValueAtTime(0.001, now + duration);
            osc.start(now);
            osc.stop(now + duration);
            this._musicNodes.push(osc);

            // Harmonic fifth (subtle)
            if (Math.random() > 0.5) {
                const osc2 = this.ctx.createOscillator();
                const g2 = this.ctx.createGain();
                osc2.connect(g2);
                g2.connect(this.musicGain);
                osc2.type = 'sine';
                osc2.frequency.value = freq * 1.5;
                g2.gain.setValueAtTime(0.015, now);
                g2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7);
                osc2.start(now);
                osc2.stop(now + duration * 0.7);
                this._musicNodes.push(osc2);
            }

            // Advance through scale
            noteIdx += direction;
            if (noteIdx >= scale.length - 1) { direction = -1; noteIdx = scale.length - 1; }
            if (noteIdx <= 0) { direction = 1; noteIdx = 0; octaveShift = (octaveShift + 1) % 2; }

            // Occasional rest
            if (Math.random() > 0.75) noteIdx = Math.floor(Math.random() * scale.length);
        };

        // Play notes at slow medieval tempo (variable timing for natural feel)
        const scheduleNext = () => {
            if (!this.musicPlaying) return;
            playNote();
            const delay = 800 + Math.random() * 1200;
            this._musicInterval = setTimeout(scheduleNext, delay);
        };
        scheduleNext();
    },

    stopMusic() {
        this.musicPlaying = false;
        if (this._musicInterval) {
            clearTimeout(this._musicInterval);
            this._musicInterval = null;
        }
        this._musicNodes.forEach(n => { try { n.stop(); } catch (e) {} });
        this._musicNodes = [];
    },

    stopAmbient() {
        this.ambientPlaying = false;
        [this._oceanSource, this._windSource, this._oceanLfo].forEach(s => {
            if (s) try { s.stop(); } catch (e) {}
        });
        this._oceanSource = null;
        this._windSource = null;
        this._oceanLfo = null;
        this._windFilter = null;
        this._windGainNode = null;
        this._oceanFilter = null;
        this._oceanGainNode = null;
    },

    stopAll() {
        this.stopMusic();
        this.stopAmbient();
    },

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stopAll();
        } else {
            this.startAmbient();
            this.startMusic();
        }
        return this.enabled;
    },

    // Mute/unmute (preserves enabled state)
    mute() {
        if (this.masterGain) this.masterGain.gain.value = 0;
    },

    unmute() {
        if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
    }
};
