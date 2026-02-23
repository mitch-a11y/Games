/* HANSE - UI Bank Module */

Object.assign(UI, {
    updateBankTab() {
        const panel = document.getElementById('bank-content');
        if (!Game.state) { panel.innerHTML = ''; return; }

        const player = Game.state.player;
        Bank.ensureBankState(player);
        const netWorth = Game.calculateNetWorth();
        const totalDebt = Bank.getTotalDebt(player);
        const monthlyInterest = Bank.getMonthlyInterest(player);

        let html = '';

        // Credit overview
        const ratingColor = player.creditRating >= 60 ? 'var(--success)' : player.creditRating >= 30 ? 'var(--warning)' : 'var(--danger)';
        const ratingLabel = player.creditRating >= 80 ? 'Exzellent' : player.creditRating >= 60 ? 'Gut' : player.creditRating >= 40 ? 'Mittel' : player.creditRating >= 20 ? 'Schlecht' : 'Kritisch';
        html += `<div class="bank-overview">
            <div class="bank-stat"><span class="bank-label">Kreditwuerdigkeit</span><span class="bank-value" style="color:${ratingColor}">${ratingLabel} (${player.creditRating})</span></div>
            <div class="bank-stat"><span class="bank-label">Vermoegen</span><span class="bank-value">${Utils.formatGold(netWorth)}</span></div>
            <div class="bank-stat"><span class="bank-label">Gesamtschuld</span><span class="bank-value" style="color:${totalDebt > 0 ? 'var(--danger)' : 'var(--text-dim)'}">${totalDebt > 0 ? Utils.formatGold(totalDebt) : 'Keine'}</span></div>
            ${monthlyInterest > 0 ? `<div class="bank-stat"><span class="bank-label">Monatl. Zinsen</span><span class="bank-value" style="color:var(--warning)">${Utils.formatGold(monthlyInterest)}</span></div>` : ''}
        </div>`;

        // Active loans
        if (player.loans.length > 0) {
            html += '<h4 class="bank-section-title">Aktive Kredite</h4>';
            player.loans.forEach(loan => {
                const progress = ((loan.totalMonths - loan.monthsLeft) / loan.totalMonths * 100).toFixed(0);
                const urgentClass = loan.monthsLeft <= 3 ? ' loan-urgent' : '';
                html += `<div class="loan-card${urgentClass}">
                    <div class="loan-header">
                        <span class="loan-name">${LOAN_TYPES[loan.type]?.icon || '💰'} ${loan.name}</span>
                        <span class="loan-remaining">${Utils.formatGold(loan.remaining)}</span>
                    </div>
                    <div class="loan-details">
                        <span>Zins: ${(loan.interest * 100).toFixed(1)}%/Mo</span>
                        <span>${loan.monthsLeft} Monate verbleibend</span>
                    </div>
                    <div class="loan-progress-bar"><div class="loan-progress-fill" style="width:${progress}%"></div></div>
                    <div class="loan-actions">
                        <button class="bank-btn bank-btn-repay" onclick="UI.repayLoan('${loan.id}', ${loan.remaining})">Voll tilgen (${Utils.formatGold(loan.remaining)})</button>
                        <button class="bank-btn bank-btn-partial" onclick="UI.showPartialRepay('${loan.id}', ${loan.remaining})">Teilzahlung</button>
                    </div>
                </div>`;
            });
        }

        // Available loan types
        html += '<h4 class="bank-section-title">Neue Kredite</h4>';
        Object.entries(LOAN_TYPES).forEach(([typeId, type]) => {
            const check = Bank.canTakeLoan(player, typeId, netWorth);
            const maxAmount = check.allowed ? check.maxAmount : 0;
            html += `<div class="loan-offer ${check.allowed ? '' : 'loan-unavailable'}">
                <div class="loan-header">
                    <span class="loan-name">${type.icon} ${type.name}</span>
                    <span style="font-size:11px;color:var(--text-dim)">${type.duration} Monate</span>
                </div>
                <div class="loan-desc">${type.description}</div>
                <div class="loan-details">
                    <span>Zins: ${(type.interest * 100).toFixed(1)}%/Mo</span>
                    <span>Max: ${check.allowed ? Utils.formatGold(maxAmount) : '—'}</span>
                </div>
                ${check.allowed
                    ? `<div class="loan-take-controls">
                        <input type="range" class="loan-slider" id="loan-slider-${typeId}" min="500" max="${maxAmount}" step="500" value="${Math.min(5000, maxAmount)}" oninput="document.getElementById('loan-amount-${typeId}').textContent=Number(this.value).toLocaleString('de')+' G'">
                        <span class="loan-amount-display" id="loan-amount-${typeId}">${Math.min(5000, maxAmount).toLocaleString('de')} G</span>
                        <button class="bank-btn bank-btn-take" onclick="UI.takeLoan('${typeId}')">Kredit aufnehmen</button>
                    </div>`
                    : `<div class="loan-blocked">${check.reason}</div>`}
            </div>`;
        });

        panel.innerHTML = html;
    },

    takeLoan(typeId) {
        const slider = document.getElementById(`loan-slider-${typeId}`);
        const amount = slider ? parseInt(slider.value) : 0;
        const result = Bank.takeLoan(Game.state, typeId, amount);
        if (result.success) {
            Sound.play('coins');
            this.addLogMessage(result.message, 'trade');
            this.showNotification(result.message, 'success');
        } else {
            this.showNotification(result.message, 'warning');
        }
        this.updateBankTab();
        this.updateTopBar(Game.state);
    },

    repayLoan(loanId, amount) {
        const result = Bank.repayLoan(Game.state, loanId, amount);
        if (result.success) {
            Sound.play('coins');
            this.addLogMessage(result.message, result.fullyRepaid ? 'trade' : 'info');
            this.showNotification(result.message, result.fullyRepaid ? 'success' : 'info');
        } else {
            this.showNotification(result.message, 'warning');
        }
        this.updateBankTab();
        this.updateTopBar(Game.state);
    },

    showPartialRepay(loanId, maxAmount) {
        const capped = Math.min(maxAmount, Game.state.player.gold);
        const html = `<div style="padding:20px;max-width:350px">
            <h3 style="margin-bottom:12px">Teilzahlung</h3>
            <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">Wie viel wollt Ihr tilgen?</p>
            <input type="range" class="loan-slider" id="partial-repay-slider" min="100" max="${capped}" step="100" value="${Math.floor(capped / 2)}"
                oninput="document.getElementById('partial-repay-display').textContent=Number(this.value).toLocaleString('de')+' G'">
            <span id="partial-repay-display" style="display:block;text-align:center;font-weight:bold;margin:8px 0;color:var(--accent)">${Math.floor(capped / 2).toLocaleString('de')} G</span>
            <div style="display:flex;gap:8px;justify-content:center">
                <button class="bank-btn bank-btn-take" onclick="UI.repayLoan('${loanId}', parseInt(document.getElementById('partial-repay-slider').value)); UI.hideModal();">Zahlen</button>
                <button class="bank-btn" onclick="UI.hideModal()">Abbrechen</button>
            </div>
        </div>`;
        this.showModal(html);
    }
});
