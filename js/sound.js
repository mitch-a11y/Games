/* ============================================
   HANSE - Sound System (Web Audio API + WAV Files)
   ============================================ */

const Sound = {
    ctx: null,
    enabled: true,
    volume: 0.5,
    sfxVolume: 0.6,
    musicVolume: 0.45,
    buffers: {},      // Loaded audio buffers
    musicBuffers: {}, // Music track buffers (loaded separately)
    loading: false,
    loaded: false,

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
        flee:        'assets/sounds/flee.wav'
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
    _menuMusicRetryTimer: null,

    startMenuMusic() {
        if (!this.enabled || !this.ctx) return;
        this.resume();

        // Already playing the real music?
        if (this.menuMusicSource) return;

        // Clear any previous retry timer
        if (this._menuMusicRetryTimer) {
            clearInterval(this._menuMusicRetryTimer);
            this._menuMusicRetryTimer = null;
        }

        const buffer = this.musicBuffers.menu;
        if (!buffer) {
            // MP3 not loaded yet — poll every 500ms until ready
            this._menuMusicRetryTimer = setInterval(() => {
                if (this.musicBuffers.menu) {
                    clearInterval(this._menuMusicRetryTimer);
                    this._menuMusicRetryTimer = null;
                    this.menuMusicSource = null;
                    this.startMenuMusic();
                }
            }, 500);
            return;
        }

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
        // Clear retry timer if still waiting for music to load
        if (this._menuMusicRetryTimer) {
            clearInterval(this._menuMusicRetryTimer);
            this._menuMusicRetryTimer = null;
        }
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

    // Volume controls
    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        // Update active music gain nodes
        if (this.menuMusicGain) {
            this.menuMusicGain.gain.value = this.musicVolume * this.volume;
        }
        if (this.ingameMusicGain) {
            this.ingameMusicGain.gain.value = this.musicVolume * this.volume;
        }
        this.saveSettings();
    },

    setSfxVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
        this.saveSettings();
    },

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stopAllMusic();
        }
        this.saveSettings();
        return this.enabled;
    }
};
