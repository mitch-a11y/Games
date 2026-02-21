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

    // Title screen buttons
    document.getElementById('btn-new-game').addEventListener('click', () => {
        showScreen('setup-screen');
        TitleCanvas.stop();
        Sound.init();
        Sound.play('click');
    });

    document.getElementById('btn-load-game').addEventListener('click', () => {
        Sound.init();
        Sound.play('click');
        if (Game.load()) {
            showScreen('game-screen');
            TitleCanvas.stop();
            Sound.startAmbient();
            Sound.startMusic();
        } else {
            alert('Kein gespeichertes Spiel gefunden.');
        }
    });

    document.getElementById('btn-help').addEventListener('click', () => {
        showScreen('help-screen');
        TitleCanvas.stop();
        Sound.init();
        Sound.play('click');
    });

    document.getElementById('btn-back-from-help').addEventListener('click', () => {
        showScreen('title-screen');
        TitleCanvas.start();
        Sound.play('click');
    });

    // Setup screen
    document.getElementById('btn-start-game').addEventListener('click', () => {
        const playerName = document.getElementById('player-name').value.trim() || 'Heinrich Brandis';
        const homeCity = document.getElementById('home-city').value;
        const difficulty = document.getElementById('difficulty').value;

        showScreen('game-screen');
        Game.newGame(playerName, homeCity, difficulty);
        Sound.startAmbient();
        Sound.startMusic();
    });

    document.getElementById('btn-back-title').addEventListener('click', () => {
        showScreen('title-screen');
        Sound.play('click');
    });

    // Modal close on overlay click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal-overlay')) {
            UI.hideModal();
        }
    });

    // Keyboard shortcuts
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
