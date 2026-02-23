/* ============================================
   HANSE - Sound System (Web Audio API + WAV Files)
   ============================================ */

const Sound = {
    ctx: null,
    enabled: true,
    volume: 0.5,
    sfxVolume: 0.6,
    ambientVolume: 0.3,
    musicVolume: 0.45,   // Separate music volume (menu + ingame tracks)
    musicPlaying: false,
    buffers: {},      // Loaded audio buffers
    musicBuffers: {}, // Music track buffers (loaded separately)
    loading: false,
    loaded: false,
    ambientSource: null,
    ambientGain: null,
    portAmbientSource: null,
    portAmbientGain: null,
    currentAmbient: null,  // 'ocean', 'port', or 'title'
    titleAmbientNodes: null,  // synth ambient fallback for title screen

    // Music system
    menuMusicSource: null,
    menuMusicGain: null,
    ingameMusicSource: null,
    ingameMusicGain: null,
    currentIngameTrack: -1,
    ingameTrackOrder: [],
    musicFadeTime: 2.0,    // seconds for crossfade

    // All sound files to preload
    SOUNDS: {
        click:       'assets/sounds/click.wav',
        buy:         'assets/sounds/buy.wav',
        sell:        'assets/sounds/sell.wav',
        gold:        'assets/sounds/coin_clink.wav',
        coins:       'assets/sounds/coins_pouch.wav',
        build:       'assets/sounds/build.wav',
        sail:        'assets/sounds/sail.wav',
        arrive:      'assets/sounds/arrive.wav',
        cannon:      'assets/sounds/cannon.wav',
        hit:         'assets/sounds/hit.wav',
        danger:      'assets/sounds/danger.wav',
        event:       'assets/sounds/event.wav',
        victory:     'assets/sounds/victory.wav',
        defeat:      'assets/sounds/defeat.wav',
        newgame:     'assets/sounds/newgame.wav',
        flee:        'assets/sounds/flee.wav',
        wave_crash:  'assets/sounds/wave_crash.wav',
        ocean:       'assets/sounds/ocean_ambient.wav',
        port:        'assets/sounds/port_ambient.wav'
    },

    // Music tracks (loaded separately from SFX)
    MUSIC: {
        menu:     'assets/music/menu_ambient.mp3',
        ingame_1: 'assets/music/ingame_1.mp3',
        ingame_2: 'assets/music/ingame_2.mp3',
        ingame_3: 'assets/music/ingame_3.mp3'
    },

    async init() {
        // Load saved settings from localStorage
        this.loadSettings();

        try {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        } catch (e) {
            console.warn('Web Audio not supported');
            this.enabled = false;
            return;
        }

        // Start preloading sounds + music
        this.preloadAll();
        this.preloadMusic();
    },

    // Persist sound settings to localStorage
    saveSettings() {
        try {
            localStorage.setItem('hanse_sound', JSON.stringify({
                enabled: this.enabled,
                volume: this.volume,
                sfxVolume: this.sfxVolume,
                ambientVolume: this.ambientVolume,
                musicVolume: this.musicVolume
            }));
        } catch (e) { /* localStorage not available */ }
    },

    loadSettings() {
        try {
            const saved = localStorage.getItem('hanse_sound');
            if (saved) {
                const s = JSON.parse(saved);
                if (typeof s.enabled === 'boolean') this.enabled = s.enabled;
                if (typeof s.volume === 'number') this.volume = s.volume;
                if (typeof s.sfxVolume === 'number') this.sfxVolume = s.sfxVolume;
                if (typeof s.ambientVolume === 'number') this.ambientVolume = s.ambientVolume;
                if (typeof s.musicVolume === 'number') this.musicVolume = s.musicVolume;
            }
        } catch (e) { /* localStorage not available */ }
    },

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    async preloadAll() {
        if (this.loading || this.loaded) return;
        this.loading = true;

        const entries = Object.entries(this.SOUNDS);
        let loaded = 0;

        const promises = entries.map(async ([name, url]) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                this.buffers[name] = await this.ctx.decodeAudioData(arrayBuffer);
                loaded++;
            } catch (e) {
                console.warn(`Sound load failed: ${name} (${url})`, e.message);
            }
        });

        await Promise.all(promises);
        this.loaded = true;
        this.loading = false;
        console.log(`Sound: ${loaded}/${entries.length} sounds loaded`);
    },

    // ==========================================
    // MUSIC PRELOADER (separate from SFX)
    // ==========================================
    async preloadMusic() {
        if (!this.ctx) return;
        const entries = Object.entries(this.MUSIC);
        let loaded = 0;

        const promises = entries.map(async ([name, url]) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                this.musicBuffers[name] = await this.ctx.decodeAudioData(arrayBuffer);
                loaded++;
            } catch (e) {
                console.warn(`Music load failed: ${name} (${url})`, e.message);
            }
        });

        await Promise.all(promises);
        console.log(`Music: ${loaded}/${entries.length} tracks loaded`);
    },

    // ==========================================
    // MENU MUSIC (title screen)
    // ==========================================
    startMenuMusic() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        // Already playing?
        if (this.menuMusicSource) return;

        const buffer = this.musicBuffers.menu;
        if (!buffer) {
            // Fallback to synth ambient if music not loaded yet
            this.startTitleAmbient();
            return;
        }

        // Stop synth ambient if it was playing as fallback
        this.stopTitleAmbient();

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        // Fade in over 2.5 seconds
        gain.gain.linearRampToValueAtTime(
            this.musicVolume * this.volume,
            this.ctx.currentTime + 2.5
        );

        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);

        this.menuMusicSource = source;
        this.menuMusicGain = gain;
    },

    stopMenuMusic() {
        if (!this.menuMusicSource) return;
        const source = this.menuMusicSource;
        const gain = this.menuMusicGain;

        try {
            gain.gain.cancelScheduledValues(this.ctx.currentTime);
            gain.gain.setValueAtTime(gain.gain.value, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + this.musicFadeTime);
            setTimeout(() => {
                try { source.stop(); } catch (e) {}
                try { gain.disconnect(); } catch (e) {}
            }, this.musicFadeTime * 1000 + 200);
        } catch (e) {
            try { source.stop(); } catch (e2) {}
        }

        this.menuMusicSource = null;
        this.menuMusicGain = null;
    },

    // ==========================================
    // INGAME MUSIC (shuffled 3 tracks, crossfade)
    // ==========================================
    startIngameMusic() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        // Already playing?
        if (this.ingameMusicSource) return;

        // Build shuffled track order
        this.ingameTrackOrder = [1, 2, 3].sort(() => Math.random() - 0.5);
        this.currentIngameTrack = -1;

        this._playNextIngameTrack();
    },

    _playNextIngameTrack() {
        if (!this.enabled || !this.ctx) return;

        this.currentIngameTrack++;
        if (this.currentIngameTrack >= this.ingameTrackOrder.length) {
            // Reshuffle and restart
            this.ingameTrackOrder = [1, 2, 3].sort(() => Math.random() - 0.5);
            this.currentIngameTrack = 0;
        }

        const trackNum = this.ingameTrackOrder[this.currentIngameTrack];
        const buffer = this.musicBuffers[`ingame_${trackNum}`];
        if (!buffer) {
            console.warn(`Ingame track ${trackNum} not loaded`);
            return;
        }

        // Clean up previous source
        if (this.ingameMusicSource) {
            try { this.ingameMusicSource.stop(); } catch (e) {}
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = false; // Don't loop individual tracks

        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        gain.gain.linearRampToValueAtTime(
            this.musicVolume * this.volume,
            this.ctx.currentTime + this.musicFadeTime
        );

        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);

        this.ingameMusicSource = source;
        this.ingameMusicGain = gain;

        // When track ends, crossfade to next
        source.onended = () => {
            if (this.ingameMusicSource === source) {
                this.ingameMusicSource = null;
                this.ingameMusicGain = null;
                // Small gap then next track
                setTimeout(() => this._playNextIngameTrack(), 800);
            }
        };

        // Schedule fade-out near the end
        const fadeOutStart = Math.max(0, buffer.duration - this.musicFadeTime - 0.5);
        setTimeout(() => {
            if (this.ingameMusicGain === gain) {
                try {
                    gain.gain.cancelScheduledValues(this.ctx.currentTime);
                    gain.gain.setValueAtTime(gain.gain.value, this.ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + this.musicFadeTime);
                } catch (e) {}
            }
        }, fadeOutStart * 1000);
    },

    stopIngameMusic() {
        if (!this.ingameMusicSource) return;
        const source = this.ingameMusicSource;
        const gain = this.ingameMusicGain;

        // Prevent onended from starting next track
        source.onended = null;

        try {
            gain.gain.cancelScheduledValues(this.ctx.currentTime);
            gain.gain.setValueAtTime(gain.gain.value, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + this.musicFadeTime);
            setTimeout(() => {
                try { source.stop(); } catch (e) {}
                try { gain.disconnect(); } catch (e) {}
            }, this.musicFadeTime * 1000 + 200);
        } catch (e) {
            try { source.stop(); } catch (e2) {}
        }

        this.ingameMusicSource = null;
        this.ingameMusicGain = null;
    },

    // Stop all music (menu + ingame)
    stopAllMusic() {
        this.stopMenuMusic();
        this.stopIngameMusic();
        this.stopTitleAmbient();
    },

    setMusicVolume(val) {
        this.musicVolume = Math.max(0, Math.min(1, val));
        if (this.menuMusicGain) {
            this.menuMusicGain.gain.value = this.musicVolume * this.volume;
        }
        if (this.ingameMusicGain) {
            this.ingameMusicGain.gain.value = this.musicVolume * this.volume;
        }
        this.saveSettings();
    },

    // Play a sound effect by name
    play(name, volumeScale = 1.0) {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        const buffer = this.buffers[name];
        if (!buffer) {
            // Fallback to synth for sounds not yet loaded
            this._synthFallback(name);
            return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.value = this.sfxVolume * volumeScale * this.volume;

        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);

        return source;
    },

    // Synth fallback for when WAVs haven't loaded yet
    _synthFallback(name) {
        if (!this.ctx) return;
        const playTone = (freq, dur, type, vol) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = type || 'sine';
            osc.frequency.value = freq;
            gain.gain.value = (vol || 0.15) * this.volume;
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + dur);
        };

        switch (name) {
            case 'click': playTone(800, 0.08, 'square', 0.1); break;
            case 'buy':
                playTone(523, 0.1, 'sine', 0.15);
                setTimeout(() => playTone(659, 0.1, 'sine', 0.15), 80);
                break;
            case 'sell':
                playTone(659, 0.1, 'sine', 0.15);
                setTimeout(() => playTone(523, 0.1, 'sine', 0.15), 80);
                break;
            case 'gold':
                playTone(880, 0.05, 'sine', 0.1);
                setTimeout(() => playTone(1100, 0.05, 'sine', 0.08), 50);
                break;
            case 'build':
                playTone(440, 0.15, 'triangle', 0.15);
                setTimeout(() => playTone(554, 0.15, 'triangle', 0.15), 100);
                setTimeout(() => playTone(659, 0.2, 'triangle', 0.15), 200);
                break;
            case 'sail':
                playTone(330, 0.3, 'sine', 0.12);
                setTimeout(() => playTone(392, 0.3, 'sine', 0.12), 150);
                break;
            case 'arrive':
                playTone(523, 0.15, 'sine', 0.15);
                setTimeout(() => playTone(659, 0.15, 'sine', 0.15), 100);
                setTimeout(() => playTone(784, 0.25, 'sine', 0.15), 200);
                break;
            case 'event':
                playTone(440, 0.2, 'sawtooth', 0.1);
                setTimeout(() => playTone(370, 0.2, 'sawtooth', 0.1), 150);
                break;
            case 'danger':
                playTone(220, 0.3, 'sawtooth', 0.15);
                setTimeout(() => playTone(185, 0.3, 'sawtooth', 0.15), 200);
                break;
            case 'newgame':
                // Replaced: no more "dat dat dat" — title uses ambient instead
                break;
        }
    },

    // ==========================================
    // TITLE SCREEN AMBIENT (generative synth pad)
    // ==========================================
    startTitleAmbient() {
        if (!this.enabled || !this.ctx) return;
        this.resume();
        if (this.titleAmbientNodes) return; // already playing

        const ctx = this.ctx;
        const masterGain = ctx.createGain();
        masterGain.gain.value = 0;
        masterGain.gain.linearRampToValueAtTime(
            this.ambientVolume * this.volume * 0.6,
            ctx.currentTime + 3 // 3 second fade in
        );
        masterGain.connect(ctx.destination);

        const nodes = { master: masterGain, sources: [] };

        // Deep drone pad (D2 + A2 — medieval open fifth)
        const droneFreqs = [73.42, 110.0]; // D2, A2
        droneFreqs.forEach(freq => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain = ctx.createGain();
            gain.gain.value = 0.12;

            // Gentle LFO for movement
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.08 + Math.random() * 0.05;
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start();

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start();
            nodes.sources.push(osc, lfo);
        });

        // Ethereal high harmonics (very quiet, shimmery)
        [293.66, 440.0, 587.33].forEach((freq, i) => { // D4, A4, D5
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            const gain = ctx.createGain();
            gain.gain.value = 0.02 - i * 0.005; // decreasing volume

            // Slow amplitude modulation
            const ampLfo = ctx.createOscillator();
            ampLfo.type = 'sine';
            ampLfo.frequency.value = 0.03 + i * 0.02;
            const ampLfoGain = ctx.createGain();
            ampLfoGain.gain.value = 0.015;
            ampLfo.connect(ampLfoGain);
            ampLfoGain.connect(gain.gain);
            ampLfo.start();

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start();
            nodes.sources.push(osc, ampLfo);
        });

        // Filtered brown noise — like wind/waves
        const bufferSize = ctx.sampleRate * 4;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5;
        }
        const noiseSource = ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 150;

        const noiseGain = ctx.createGain();
        noiseGain.gain.value = 0.06;

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        noiseSource.start();
        nodes.sources.push(noiseSource);

        this.titleAmbientNodes = nodes;
    },

    stopTitleAmbient() {
        if (!this.titleAmbientNodes) return;
        const { master, sources } = this.titleAmbientNodes;

        // Fade out over 1.5 seconds
        try {
            master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
            setTimeout(() => {
                sources.forEach(s => { try { s.stop(); } catch (e) {} });
                try { master.disconnect(); } catch (e) {}
            }, 1700);
        } catch (e) {
            sources.forEach(s => { try { s.stop(); } catch (e2) {} });
        }
        this.titleAmbientNodes = null;
    },

    // Ambient sound management
    startAmbient(type = 'ocean') {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        // Don't restart if already playing the same type
        if (this.currentAmbient === type && this.musicPlaying) return;

        // Stop current ambient
        this.stopAmbient();

        const buffer = this.buffers[type];
        if (!buffer) {
            // Fallback to generated noise
            this._startSynthAmbient();
            return;
        }

        this.musicPlaying = true;
        this.currentAmbient = type;

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gain = this.ctx.createGain();
        gain.gain.value = 0; // Start silent
        gain.gain.linearRampToValueAtTime(
            this.ambientVolume * this.volume,
            this.ctx.currentTime + 2  // 2 second fade in
        );

        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);

        this.ambientSource = source;
        this.ambientGain = gain;
    },

    // Switch ambient based on game state
    updateAmbient(gameState) {
        if (!this.enabled || !gameState) return;

        // Check if we're in port view or sailing view
        const selectedCity = typeof GameMap !== 'undefined' ? GameMap.selectedCity : null;
        const hasDockedShips = gameState.player.ships.some(s => s.status === 'docked');
        const hasSailingShips = gameState.player.ships.some(s => s.status === 'sailing');

        if (selectedCity && hasDockedShips) {
            this.startAmbient('port');
        } else if (hasSailingShips) {
            this.startAmbient('ocean');
        } else {
            this.startAmbient('port');
        }
    },

    _startSynthAmbient() {
        // Fallback brown noise ambient
        if (this.musicPlaying) return;
        this.musicPlaying = true;
        this.currentAmbient = 'synth';

        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

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

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.03 * this.volume;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 200;

        this.ambientSource.connect(filter);
        filter.connect(this.ambientGain);
        this.ambientGain.connect(this.ctx.destination);
        this.ambientSource.start();
    },

    stopAmbient() {
        if (this.ambientSource) {
            if (this.ambientGain) {
                // Fade out over 1 second
                try {
                    this.ambientGain.gain.linearRampToValueAtTime(
                        0, this.ctx.currentTime + 1
                    );
                    setTimeout(() => {
                        try { this.ambientSource?.stop(); } catch (e) {}
                        this.ambientSource = null;
                    }, 1100);
                } catch (e) {
                    try { this.ambientSource.stop(); } catch (e2) {}
                    this.ambientSource = null;
                }
            } else {
                try { this.ambientSource.stop(); } catch (e) {}
                this.ambientSource = null;
            }
        }
        this.musicPlaying = false;
        this.currentAmbient = null;
    },

    // Volume controls
    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        if (this.ambientGain) {
            this.ambientGain.gain.value = this.ambientVolume * this.volume;
        }
        this.saveSettings();
    },

    setSfxVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
        this.saveSettings();
    },

    setAmbientVolume(val) {
        this.ambientVolume = Math.max(0, Math.min(1, val));
        if (this.ambientGain) {
            this.ambientGain.gain.value = this.ambientVolume * this.volume;
        }
        this.saveSettings();
    },

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stopAmbient();
            this.stopAllMusic();
        } else {
            if (this.ctx) this.startAmbient();
        }
        this.saveSettings();
        return this.enabled;
    }
};
