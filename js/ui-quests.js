/* HANSE - UI Quests Module */

Object.assign(UI, {
    showQuestBoard() {
        if (typeof Quests === 'undefined' || !Game.state) return;
        Quests.ensureQuestState(Game.state.player);

        const active = Game.state.player.quests.active;
        const completed = Game.state.player.quests.completed;
        const failed = Game.state.player.quests.failed;
        const offers = Quests.getAvailableQuests(Game.state);

        let html = `<div class="quest-board">
            <div class="quest-board-header">
                <h3>Auftragsboard</h3>
                <button class="modal-close-btn" onclick="UI.hideModal()">&times;</button>
            </div>
            <div class="quest-stats">
                <span>Erfuellt: ${completed}</span>
                <span>Gescheitert: ${failed}</span>
                <span>Aktiv: ${active.length}/3</span>
            </div>`;

        // Active quests
        if (active.length > 0) {
            html += '<h4 class="quest-section-title">Aktive Auftraege</h4>';
            active.forEach(quest => {
                const urgentClass = quest.daysRemaining <= 10 ? ' quest-urgent' : '';
                let progressHTML = '';
                if (quest.type === 'profit' && quest.profitTarget) {
                    const pct = Math.min(100, (quest.profitSoFar / quest.profitTarget * 100)).toFixed(0);
                    progressHTML = `<div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div><span class="quest-progress-text">${Utils.formatGold(quest.profitSoFar)} / ${Utils.formatGold(quest.profitTarget)}</span>`;
                } else if (quest.type === 'explore' && quest.cities) {
                    const pct = Math.min(100, (quest.visitedCities.length / quest.cities.length * 100)).toFixed(0);
                    progressHTML = `<div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%"></div></div><span class="quest-progress-text">${quest.visitedCities.length}/${quest.cities.length} Staedte</span>`;
                }
                html += `<div class="quest-card${urgentClass}">
                    <div class="quest-card-header">
                        <span class="quest-title">${quest.title}</span>
                        <span class="quest-timer">${quest.daysRemaining}d</span>
                    </div>
                    <div class="quest-desc">${quest.description}</div>
                    ${progressHTML}
                    <button class="quest-btn quest-btn-abandon" onclick="UI.abandonQuest('${quest.id}')">Aufgeben</button>
                </div>`;
            });
        }

        // New quest offers
        if (active.length < 3) {
            html += '<h4 class="quest-section-title">Verfuegbare Auftraege</h4>';
            offers.forEach(quest => {
                html += `<div class="quest-card quest-offer">
                    <div class="quest-card-header">
                        <span class="quest-title">${quest.title}</span>
                        <span class="quest-reward">${Utils.formatGold(quest.reward)}</span>
                    </div>
                    <div class="quest-desc">${quest.description}</div>
                    <div class="quest-meta">Frist: ${quest.deadline} Tage</div>
                    <button class="quest-btn quest-btn-accept" onclick="UI.acceptQuest(JSON.parse(this.dataset.quest))" data-quest='${JSON.stringify(quest)}'>Annehmen</button>
                </div>`;
            });
        }

        html += '</div>';
        this.showModal(html);
    },

    acceptQuest(quest) {
        if (typeof Quests === 'undefined') return;
        const result = Quests.acceptQuest(Game.state, quest);
        if (result.success) {
            Sound.play('build');
            this.addLogMessage(result.message, 'info');
            this.showNotification(result.message, 'success');
        } else {
            this.showNotification(result.message, 'warning');
        }
        this.showQuestBoard(); // Refresh
    },

    abandonQuest(questId) {
        if (typeof Quests === 'undefined') return;
        const result = Quests.abandonQuest(Game.state, questId);
        this.showNotification(result.message, 'info');
        this.showQuestBoard(); // Refresh
    }
});
