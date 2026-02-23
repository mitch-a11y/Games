/* ============================================
   HANSE - Sound System (Web Audio API + WAV Files)
   ============================================ */

const Sound = {
    ctx: null,
    enabled: true,
    volume: 0.5,
    sfxVolume: 0.6,
    ambientVolume: 0.3,
    musicPlaying: false,
    buffers: {},      // Loaded audio buffers
    loading: false,
    loaded: false,
    ambientSource: null,
    ambientGain: null,
    portAmbientSource: null,
    portAmbientGain: null,
    currentAmbient: null,  // 'ocean' or 'port'

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

    async init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio not supported');
            this.enabled = false;
            return;
        }

        // Start preloading sounds
        this.preloadAll();
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
                [523, 587, 659, 784].forEach((f, i) => {
                    setTimeout(() => playTone(f, 0.25, 'triangle', 0.15), i * 200);
                });
                break;
        }
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
    },

    setSfxVolume(val) {
        this.sfxVolume = Math.max(0, Math.min(1, val));
    },

    setAmbientVolume(val) {
        this.ambientVolume = Math.max(0, Math.min(1, val));
        if (this.ambientGain) {
            this.ambientGain.gain.value = this.ambientVolume * this.volume;
        }
    },

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stopAmbient();
        } else {
            if (this.ctx) this.startAmbient();
        }
        return this.enabled;
    }
};
