/* ============================================
   HANSE - Tutorial / Onboarding System
   Guides new players through core game mechanics
   ============================================ */

const Tutorial = {
    active: false,
    currentStep: 0,
    steps: [],
    overlay: null,
    dialog: null,
    spotlight: null,
    skipBtn: null,
    onStepAction: null,  // callback for action-triggered advances

    // Storage key for tracking completion
    STORAGE_KEY: 'hanse_tutorial_done',

    // Check if tutorial has been completed before
    isCompleted() {
        try {
            return localStorage.getItem(this.STORAGE_KEY) === '1';
        } catch (e) {
            return false;
        }
    },

    // Mark tutorial as completed
    markCompleted() {
        try {
            localStorage.setItem(this.STORAGE_KEY, '1');
        } catch (e) { /* ignore */ }
    },

    // Reset tutorial (for replay from menu)
    reset() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (e) { /* ignore */ }
    },

    // Define all tutorial steps
    buildSteps() {
        const homeCityName = Game.state
            ? CITIES_DATA[Game.state.player.homeCity].displayName
            : 'eurer Heimatstadt';

        this.steps = [
            // Step 0: Welcome
            {
                title: 'Willkommen bei Hanse!',
                text: `Ihr seid ein aufstrebender Kaufmann in der Hansestadt ${homeCityName}. Dieses kurze Lernprogramm zeigt Euch die wichtigsten Grundlagen des Spiels.`,
                icon: '\u2693',
                target: null,
                position: 'center',
                advance: 'click'
            },
            // Step 1: Top Bar
            {
                title: 'Die Kopfleiste',
                text: 'Hier seht Ihr Euren Namen, Rang, das aktuelle Datum, die Spielgeschwindigkeit und Euer Gold. Mit den Geschwindigkeitstasten steuert Ihr den Zeitfluss.',
                icon: '\u2139\uFE0F',
                target: '#top-bar',
                position: 'below',
                advance: 'click'
            },
            // Step 2: Gold display
            {
                title: 'Euer Vermoegen',
                text: 'Dies ist Euer Gold \u2013 die Waehrung der Hanse. Handelt klug, um es zu vermehren! Schiffe und Gebaeude kosten Unterhalt.',
                icon: '\uD83D\uDCB0',
                target: '#gold-display',
                position: 'below',
                advance: 'click'
            },
            // Step 3: Map
            {
                title: 'Die Handelskarte',
                text: 'Die Karte zeigt die Hansestaedte und Eure Schiffe. Klickt auf eine Stadt, um sie auszuwaehlen und Informationen zu erhalten.',
                icon: '\uD83D\uDDFA\uFE0F',
                target: '#map-panel',
                position: 'right',
                advance: 'click'
            },
            // Step 4: Side panel intro
            {
                title: 'Die Seitenleiste',
                text: 'Hier verwaltet Ihr Euer Handelsimperium. Fuenf Reiter bieten verschiedene Funktionen: Stadt-Info, Handel, Flotte, Bauen und Auftraege.',
                icon: '\uD83D\uDCCB',
                target: '#side-panel-tabs',
                position: 'left',
                advance: 'click'
            },
            // Step 5: City tab
            {
                title: 'Stadt-Informationen',
                text: 'Der Stadt-Reiter zeigt Euch die Bevoelkerung, Marktpreise und Euer Ansehen. Gruene Preise bedeuten guenstige Einkaufsmoeglichkeiten, rote hohe Verkaufspreise.',
                icon: '\uD83C\uDFD8\uFE0F',
                target: '#tab-city',
                position: 'left',
                tabSwitch: 'city',
                advance: 'click'
            },
            // Step 6: Trade tab
            {
                title: 'Handeln',
                text: 'Wechselt zum Handel-Reiter, um Waren zu kaufen und zu verkaufen. Kauft guenstig ein und verkauft dort, wo die Ware gebraucht wird \u2013 das ist der Schluessel zum Erfolg!',
                icon: '\u2696\uFE0F',
                target: '[data-tab="trade"]',
                position: 'below',
                tabSwitch: 'trade',
                advance: 'click'
            },
            // Step 7: Trade details
            {
                title: 'Waren handeln',
                text: 'Nutzt die +1, +5 und +25 Knoepfe zum Kaufen, oder -1, -5 und Alle zum Verkaufen. "Max" kauft so viel wie moeglich. "Beste Waren laden" sucht automatisch die guenstigsten Waren.',
                icon: '\uD83D\uDCE6',
                target: '#trade-goods-list',
                position: 'left',
                advance: 'click'
            },
            // Step 8: Fleet tab
            {
                title: 'Eure Flotte',
                text: 'Im Flotte-Reiter verwaltet Ihr Eure Schiffe. Klickt auf ein Schiff, um Ziele auszuwaehlen und es loszuschicken. In Staedten mit Werft koennt Ihr neue Schiffe kaufen.',
                icon: '\u26F5',
                target: '[data-tab="fleet"]',
                position: 'below',
                tabSwitch: 'fleet',
                advance: 'click'
            },
            // Step 9: Build tab
            {
                title: 'Gebaeude errichten',
                text: 'Baut Handelskontore, Lageraeuser und Produktionsstaetten. Ein Kontor ist die Voraussetzung fuer alle weiteren Gebaeude in einer Stadt.',
                icon: '\uD83C\uDFD7\uFE0F',
                target: '[data-tab="build"]',
                position: 'below',
                tabSwitch: 'build',
                advance: 'click'
            },
            // Step 10: Quests tab
            {
                title: 'Auftraege',
                text: 'Auftraege geben Euch Ziele und belohnen Euch mit Gold. Schaut regelmaessig nach, um Euren Fortschritt zu verfolgen.',
                icon: '\uD83D\uDCDC',
                target: '[data-tab="quests"]',
                position: 'below',
                tabSwitch: 'quests',
                advance: 'click'
            },
            // Step 11: Speed controls
            {
                title: 'Spielgeschwindigkeit',
                text: 'Steuert die Zeit mit diesen Knoepfen oder den Tasten 1-3. Leertaste pausiert das Spiel. Erhoehte Geschwindigkeit laesst die Tage schneller vergehen.',
                icon: '\u23E9',
                target: '.speed-controls',
                position: 'below',
                advance: 'click'
            },
            // Step 12: Wind
            {
                title: 'Wind',
                text: 'Der Wind beeinflusst die Reisegeschwindigkeit Eurer Schiffe. Guenstiger Wind verkuerzt die Reise, Gegenwind verlaengert sie.',
                icon: '\uD83C\uDF2C\uFE0F',
                target: '#wind-indicator',
                position: 'right',
                advance: 'click'
            },
            // Step 13: Message log
            {
                title: 'Nachrichten',
                text: 'Das Nachrichtenprotokoll zeigt wichtige Ereignisse: Ankuenfte, Handelsaktivitaeten, Gefahren und Erfolge.',
                icon: '\uD83D\uDCDC',
                target: '#bottom-bar',
                position: 'above',
                advance: 'click'
            },
            // Step 14: First goal
            {
                title: 'Euer erstes Ziel',
                text: 'Ladet Waren auf Euer Schiff, segelt zu einer anderen Stadt und verkauft sie dort mit Gewinn. So beginnt jedes grosse Handelsimperium! Viel Erfolg, Kaufmann!',
                icon: '\uD83C\uDF1F',
                target: null,
                position: 'center',
                advance: 'click'
            }
        ];
    },

    // Initialize and start the tutorial
    start() {
        if (this.active) return;

        this.buildSteps();
        this.currentStep = 0;
        this.active = true;

        // Pause the game during tutorial
        Game.setSpeed(0);
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-speed="0"]').classList.add('active');

        // Create overlay elements
        this.createOverlay();
        this.showStep(0);
    },

    // Create the tutorial overlay DOM elements
    createOverlay() {
        // Remove existing if any
        this.destroy();

        // Main overlay container
        this.overlay = document.createElement('div');
        this.overlay.id = 'tutorial-overlay';
        this.overlay.className = 'tutorial-overlay';

        // Spotlight cutout (SVG-based for smooth clipping)
        this.spotlight = document.createElement('div');
        this.spotlight.id = 'tutorial-spotlight';
        this.spotlight.className = 'tutorial-spotlight';
        this.overlay.appendChild(this.spotlight);

        // Dialog box
        this.dialog = document.createElement('div');
        this.dialog.id = 'tutorial-dialog';
        this.dialog.className = 'tutorial-dialog';

        // Skip button
        this.skipBtn = document.createElement('button');
        this.skipBtn.id = 'tutorial-skip';
        this.skipBtn.className = 'tutorial-skip';
        this.skipBtn.textContent = 'Tutorial beenden';
        this.skipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.end();
        });

        document.getElementById('game-screen').appendChild(this.overlay);
        document.getElementById('game-screen').appendChild(this.dialog);
        document.getElementById('game-screen').appendChild(this.skipBtn);
    },

    // Show a specific step
    showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.steps.length) {
            this.end();
            return;
        }

        this.currentStep = stepIndex;
        const step = this.steps[stepIndex];

        // Switch tab if needed
        if (step.tabSwitch) {
            UI.switchTab(step.tabSwitch);
        }

        // Small delay to let DOM update after tab switch
        requestAnimationFrame(() => {
            this.positionSpotlight(step);
            this.renderDialog(step);
        });
    },

    // Position the spotlight around target element
    positionSpotlight(step) {
        if (!step.target) {
            // No target - full overlay, centered dialog
            this.overlay.style.display = 'block';
            this.spotlight.style.display = 'none';
            this.overlay.style.clipPath = 'none';
            return;
        }

        const target = document.querySelector(step.target);
        if (!target) {
            // Target not found, show without spotlight
            this.overlay.style.display = 'block';
            this.spotlight.style.display = 'none';
            this.overlay.style.clipPath = 'none';
            return;
        }

        const rect = target.getBoundingClientRect();
        const gameScreen = document.getElementById('game-screen').getBoundingClientRect();
        const padding = 6;

        // Position relative to game screen
        const x = rect.left - gameScreen.left - padding;
        const y = rect.top - gameScreen.top - padding;
        const w = rect.width + padding * 2;
        const h = rect.height + padding * 2;

        this.overlay.style.display = 'block';
        this.spotlight.style.display = 'block';

        // Use clipPath polygon to cut out spotlight area
        // Create an inset rectangle hole in the overlay
        const sw = gameScreen.width;
        const sh = gameScreen.height;

        this.overlay.style.clipPath = `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
            ${x}px ${y}px, ${x}px ${y + h}px, ${x + w}px ${y + h}px, ${x + w}px ${y}px, ${x}px ${y}px
        )`;

        // Position the spotlight border indicator
        this.spotlight.style.display = 'block';
        this.spotlight.style.left = x + 'px';
        this.spotlight.style.top = y + 'px';
        this.spotlight.style.width = w + 'px';
        this.spotlight.style.height = h + 'px';
    },

    // Render the dialog box for current step
    renderDialog(step) {
        const totalSteps = this.steps.length;
        const isLast = this.currentStep === totalSteps - 1;
        const isFirst = this.currentStep === 0;

        let html = '';
        html += `<div class="tutorial-dialog-icon">${step.icon || '\u2139\uFE0F'}</div>`;
        html += `<div class="tutorial-dialog-title">${step.title}</div>`;
        html += `<div class="tutorial-dialog-text">${step.text}</div>`;
        html += `<div class="tutorial-dialog-footer">`;
        html += `<span class="tutorial-dialog-counter">${this.currentStep + 1} / ${totalSteps}</span>`;
        html += `<div class="tutorial-dialog-buttons">`;
        if (!isFirst) {
            html += `<button class="tutorial-btn secondary" id="tutorial-prev">Zurueck</button>`;
        }
        html += `<button class="tutorial-btn primary" id="tutorial-next">${isLast ? 'Loslegen!' : 'Weiter'}</button>`;
        html += `</div></div>`;

        // Progress dots
        html += `<div class="tutorial-progress">`;
        for (let i = 0; i < totalSteps; i++) {
            const cls = i === this.currentStep ? 'active' : (i < this.currentStep ? 'done' : '');
            html += `<span class="tutorial-dot ${cls}"></span>`;
        }
        html += `</div>`;

        this.dialog.innerHTML = html;
        this.dialog.style.display = 'block';

        // Position dialog relative to target
        this.positionDialog(step);

        // Button listeners
        const nextBtn = document.getElementById('tutorial-next');
        const prevBtn = document.getElementById('tutorial-prev');

        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                Sound.play('click');
                if (isLast) {
                    this.end();
                } else {
                    this.showStep(this.currentStep + 1);
                }
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                Sound.play('click');
                this.showStep(this.currentStep - 1);
            });
        }

        // Entrance animation
        this.dialog.classList.remove('tutorial-dialog-enter');
        void this.dialog.offsetWidth; // force reflow
        this.dialog.classList.add('tutorial-dialog-enter');
    },

    // Position dialog box near the target element
    positionDialog(step) {
        const dialog = this.dialog;
        const gameScreen = document.getElementById('game-screen').getBoundingClientRect();
        const dialogWidth = 340;
        const dialogMaxHeight = 260;
        const margin = 16;

        if (!step.target || step.position === 'center') {
            // Center in game screen
            dialog.style.left = (gameScreen.width / 2 - dialogWidth / 2) + 'px';
            dialog.style.top = (gameScreen.height / 2 - dialogMaxHeight / 2) + 'px';
            dialog.style.right = 'auto';
            dialog.style.bottom = 'auto';
            return;
        }

        const target = document.querySelector(step.target);
        if (!target) {
            dialog.style.left = (gameScreen.width / 2 - dialogWidth / 2) + 'px';
            dialog.style.top = (gameScreen.height / 2 - dialogMaxHeight / 2) + 'px';
            return;
        }

        const rect = target.getBoundingClientRect();
        const relX = rect.left - gameScreen.left;
        const relY = rect.top - gameScreen.top;

        // Reset
        dialog.style.left = 'auto';
        dialog.style.right = 'auto';
        dialog.style.top = 'auto';
        dialog.style.bottom = 'auto';

        switch (step.position) {
            case 'below':
                dialog.style.left = Math.max(margin, Math.min(relX, gameScreen.width - dialogWidth - margin)) + 'px';
                dialog.style.top = (relY + rect.height + margin) + 'px';
                break;
            case 'above':
                dialog.style.left = Math.max(margin, Math.min(relX, gameScreen.width - dialogWidth - margin)) + 'px';
                dialog.style.top = Math.max(margin, relY - dialogMaxHeight - margin) + 'px';
                break;
            case 'left':
                dialog.style.left = Math.max(margin, relX - dialogWidth - margin) + 'px';
                dialog.style.top = Math.max(margin, relY) + 'px';
                break;
            case 'right':
                dialog.style.left = (relX + rect.width + margin) + 'px';
                dialog.style.top = Math.max(margin, relY) + 'px';
                break;
            default:
                dialog.style.left = (gameScreen.width / 2 - dialogWidth / 2) + 'px';
                dialog.style.top = (gameScreen.height / 2 - dialogMaxHeight / 2) + 'px';
        }

        // Clamp to screen bounds
        const dRect = dialog.getBoundingClientRect();
        const gRect = gameScreen;
        if (dRect.right > gRect.right - margin) {
            dialog.style.left = (gRect.width - dialogWidth - margin) + 'px';
        }
        if (dRect.bottom > gRect.bottom - margin) {
            dialog.style.top = Math.max(margin, gRect.height - dRect.height - margin) + 'px';
        }
        if (dRect.left < gRect.left + margin) {
            dialog.style.left = margin + 'px';
        }
        if (dRect.top < gRect.top + margin) {
            dialog.style.top = margin + 'px';
        }
    },

    // End the tutorial
    end() {
        this.active = false;
        this.markCompleted();
        this.destroy();

        // Resume game
        Game.setSpeed(1);
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-speed="1"]').classList.add('active');

        // Switch back to city tab
        UI.switchTab('city');

        UI.showNotification('Tutorial abgeschlossen. Viel Erfolg!', 'success');
        UI.addLogMessage('Das Lernprogramm wurde abgeschlossen. Handelt weise!', 'info');
    },

    // Remove all tutorial DOM elements
    destroy() {
        const ids = ['tutorial-overlay', 'tutorial-dialog', 'tutorial-skip'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        this.overlay = null;
        this.dialog = null;
        this.spotlight = null;
        this.skipBtn = null;
    },

    // Called to offer tutorial to new players
    offer() {
        if (this.isCompleted()) return;

        const html = `<div class="event-popup">
            <div class="event-icon">\u2693</div>
            <h3>Lernprogramm</h3>
            <div class="event-text">Willkommen! Moechtet Ihr eine kurze Einfuehrung in die Grundlagen des Spiels?</div>
            <div class="modal-buttons">
                <button class="modal-btn primary" onclick="UI.hideModal();Tutorial.start()">Ja, gerne!</button>
                <button class="modal-btn secondary" onclick="UI.hideModal();Tutorial.markCompleted()">Nein, danke</button>
            </div>
        </div>`;
        UI.showModal(html);
    }
};
