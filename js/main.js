/* ============================================
   HANSE - Main Entry Point & Screen Management
   ============================================ */

(function() {
    'use strict';

    // Screen management
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    // Initialize the cinematic intro
    const introCanvas = document.getElementById('intro-canvas');
    if (introCanvas) {
        Intro.init(introCanvas);
        // Auto-start intro when page loads
        Intro.startIntro();
    }

    // Skip intro on click/key
    document.getElementById('title-screen').addEventListener('click', (e) => {
        // Don't skip if clicking menu buttons
        if (e.target.classList.contains('title-btn')) return;
        if (Intro.phase === 'blueprint' || Intro.phase === 'story' || Intro.phase === 'ocean') {
            Intro.skipIntro();
        }
    });
    document.addEventListener('keydown', (e) => {
        if ((Intro.phase === 'blueprint' || Intro.phase === 'story' || Intro.phase === 'ocean') && e.key !== 'F5' && e.key !== 'F12') {
            Intro.skipIntro();
        }
    });

    // Title screen buttons
    document.getElementById('btn-new-game').addEventListener('click', () => {
        Sound.init();
        Sound.resume();
        Sound.play('click');
        showScreen('setup-screen');
        // Copy intro canvas scene to setup background
        const setupCanvas = document.getElementById('setup-bg-canvas');
        if (setupCanvas && introCanvas) {
            setupCanvas.width = introCanvas.width;
            setupCanvas.height = introCanvas.height;
            const sCtx = setupCanvas.getContext('2d');
            sCtx.drawImage(introCanvas, 0, 0);
            // Darken it
            sCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            sCtx.fillRect(0, 0, setupCanvas.width, setupCanvas.height);
        }
    });

    document.getElementById('btn-load-game').addEventListener('click', () => {
        Sound.init();
        Sound.resume();
        Sound.play('click');
        if (Game.load()) {
            Intro.phase = 'idle';
            showScreen('game-screen');
            Sound.startAmbient();
        } else {
            alert('Kein gespeichertes Spiel gefunden.');
        }
    });

    document.getElementById('btn-help').addEventListener('click', () => {
        Sound.init();
        Sound.resume();
        Sound.play('click');
        showScreen('help-screen');
    });

    document.getElementById('btn-back-from-help').addEventListener('click', () => {
        showScreen('title-screen');
        Sound.play('click');
        if (Intro.phase === 'idle') Intro.startTitle();
    });

    // Setup screen
    document.getElementById('btn-start-game').addEventListener('click', () => {
        const playerName = document.getElementById('player-name').value.trim() || 'Heinrich Brandis';
        const homeCity = document.getElementById('home-city').value;
        const difficulty = document.getElementById('difficulty').value;

        Intro.phase = 'idle';
        showScreen('game-screen');
        Game.newGame(playerName, homeCity, difficulty);
        Sound.startAmbient('port');
    });

    document.getElementById('btn-back-title').addEventListener('click', () => {
        showScreen('title-screen');
        Sound.play('click');
        if (Intro.phase === 'idle') Intro.startTitle();
    });

    // Modal close on overlay click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) {
            UI.hideModal();
        }
    });

    // Keyboard shortcuts (game)
    document.addEventListener('keydown', (e) => {
        if (!Game.running) return;

        switch (e.key) {
            case ' ':
                e.preventDefault();
                if (Game.speed === 0) {
                    Game.setSpeed(1);
                    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                    document.querySelector('[data-speed="1"]').classList.add('active');
                } else {
                    Game.setSpeed(0);
                    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                    document.querySelector('[data-speed="0"]').classList.add('active');
                }
                break;
            case '1':
                Game.setSpeed(1);
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('[data-speed="1"]').classList.add('active');
                break;
            case '2':
                Game.setSpeed(2);
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('[data-speed="2"]').classList.add('active');
                break;
            case '3':
                Game.setSpeed(3);
                document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('[data-speed="3"]').classList.add('active');
                break;
            case 'Escape':
                if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
                    UI.hideModal();
                } else {
                    UI.showGameMenu();
                }
                break;
            case 's':
                if (e.ctrlKey) {
                    e.preventDefault();
                    Game.save();
                    UI.showNotification('Spiel gespeichert!', 'success');
                }
                break;
        }
    });

    // First user interaction to enable audio
    document.addEventListener('click', () => {
        Sound.init();
        Sound.resume();
    }, { once: true });

})();
