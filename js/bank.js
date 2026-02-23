/* ============================================
   HANSE - Bank & Credit System
   ============================================ */

const LOAN_TYPES = {
    short: {
        id: 'short',
        name: 'Kurzkredit',
        icon: '💰',
        duration: 6,       // months
        interest: 0.03,    // 3% per month
        description: 'Schnelles Gold, moderate Zinsen',
        maxMultiplier: 1.0 // max = net worth * this
    },
    standard: {
        id: 'standard',
        name: 'Handelskredit',
        icon: '🏦',
        duration: 12,
        interest: 0.04,    // 4% per month
        description: 'Solide Finanzierung fuer Expansion',
        maxMultiplier: 2.0
    },
    large: {
        id: 'large',
        name: 'Grosskredit',
        icon: '👑',
        duration: 24,
        interest: 0.05,    // 5% per month
        description: 'Fuer grosse Investitionen',
        maxMultiplier: 3.0,
        minReputation: 20  // needs some reputation
    }
};

const Bank = {
    // Initialize bank state on player if missing
    ensureBankState(player) {
        if (!player.loans) player.loans = [];
        if (player.creditRating === undefined) player.creditRating = 50; // 0-100
    },

    // Calculate total active debt
    getTotalDebt(player) {
        this.ensureBankState(player);
        return player.loans.reduce((sum, loan) => sum + loan.remaining, 0);
    },

    // Calculate monthly interest payment
    getMonthlyInterest(player) {
        this.ensureBankState(player);
        return player.loans.reduce((sum, loan) => {
            return sum + Math.ceil(loan.remaining * loan.interest);
        }, 0);
    },

    // Get max loan amount for a type
    getMaxLoan(player, loanType, netWorth) {
        const type = LOAN_TYPES[loanType];
        if (!type) return 0;
        const base = Math.max(1000, netWorth) * type.maxMultiplier;
        const creditMod = player.creditRating / 50; // 0-2x multiplier
        const existingDebt = this.getTotalDebt(player);
        return Math.max(0, Math.floor(base * creditMod - existingDebt));
    },

    // Check if player can take a loan
    canTakeLoan(player, loanType, netWorth) {
        const type = LOAN_TYPES[loanType];
        if (!type) return { allowed: false, reason: 'Unbekannter Kredittyp' };

        // Check min reputation for large loans
        if (type.minReputation) {
            const avgRep = this._getAverageReputation(player);
            if (avgRep < type.minReputation) {
                return { allowed: false, reason: `Mindestens ${type.minReputation} Durchschnitts-Reputation benötigt (aktuell: ${Math.floor(avgRep)})` };
            }
        }

        // Check credit rating
        if (player.creditRating < 20) {
            return { allowed: false, reason: 'Eure Kreditwuerdigkeit ist zu niedrig!' };
        }

        // Check max concurrent loans
        if (player.loans.length >= 3) {
            return { allowed: false, reason: 'Maximal 3 gleichzeitige Kredite erlaubt.' };
        }

        const maxAmount = this.getMaxLoan(player, loanType, netWorth);
        if (maxAmount < 500) {
            return { allowed: false, reason: 'Kreditrahmen erschöpft.' };
        }

        return { allowed: true, maxAmount };
    },

    // Take out a loan
    takeLoan(gameState, loanType, amount) {
        const player = gameState.player;
        this.ensureBankState(player);
        const netWorth = Game.calculateNetWorth();
        const check = this.canTakeLoan(player, loanType, netWorth);

        if (!check.allowed) {
            return { success: false, message: check.reason };
        }

        const type = LOAN_TYPES[loanType];
        const clampedAmount = Math.min(amount, check.maxAmount);
        if (clampedAmount < 500) {
            return { success: false, message: 'Mindestbetrag: 500 Gold' };
        }

        const loan = {
            id: Utils.uid(),
            type: loanType,
            name: type.name,
            principal: clampedAmount,
            remaining: clampedAmount,
            interest: type.interest,
            monthsLeft: type.duration,
            totalMonths: type.duration,
            takenDate: { ...gameState.date },
            monthlyPayment: Math.ceil(clampedAmount / type.duration) + Math.ceil(clampedAmount * type.interest)
        };

        player.loans.push(loan);
        player.gold += clampedAmount;

        return {
            success: true,
            message: `${type.name} über ${Utils.formatGold(clampedAmount)} aufgenommen! Laufzeit: ${type.duration} Monate.`,
            loan
        };
    },

    // Repay a loan (partial or full)
    repayLoan(gameState, loanId, amount) {
        const player = gameState.player;
        this.ensureBankState(player);

        const loan = player.loans.find(l => l.id === loanId);
        if (!loan) return { success: false, message: 'Kredit nicht gefunden.' };

        const repayAmount = Math.min(amount, loan.remaining, player.gold);
        if (repayAmount <= 0) {
            return { success: false, message: 'Nicht genug Gold zur Tilgung!' };
        }

        player.gold -= repayAmount;
        loan.remaining -= repayAmount;

        if (loan.remaining <= 0) {
            // Loan fully repaid
            player.loans = player.loans.filter(l => l.id !== loanId);
            // Boost credit rating for early repayment
            if (loan.monthsLeft > 0) {
                player.creditRating = Math.min(100, player.creditRating + 5);
            }
            return {
                success: true,
                message: `${loan.name} vollstaendig getilgt! Kreditwuerdigkeit gestiegen.`,
                fullyRepaid: true
            };
        }

        return {
            success: true,
            message: `${Utils.formatGold(repayAmount)} getilgt. Restschuld: ${Utils.formatGold(loan.remaining)}`,
            fullyRepaid: false
        };
    },

    // Monthly processing: collect interest, reduce months, handle defaults
    monthlyProcess(gameState) {
        const player = gameState.player;
        this.ensureBankState(player);
        if (player.loans.length === 0) return;

        let totalInterest = 0;
        const defaultedLoans = [];

        player.loans.forEach(loan => {
            // Charge interest
            const interest = Math.ceil(loan.remaining * loan.interest);
            totalInterest += interest;
            loan.remaining += interest; // Interest compounds on remaining

            loan.monthsLeft--;

            // Check for loan default (overdue)
            if (loan.monthsLeft <= 0 && loan.remaining > 0) {
                defaultedLoans.push(loan);
            }
        });

        // Deduct interest from gold
        if (totalInterest > 0) {
            player.gold -= totalInterest;
            UI.addLogMessage(`Monatliche Zinsen: ${Utils.formatGold(totalInterest)}`, 'warning');
        }

        // Handle defaults
        defaultedLoans.forEach(loan => {
            // Penalty: remaining debt stays, credit rating drops
            player.creditRating = Math.max(0, player.creditRating - 15);
            UI.addLogMessage(`WARNUNG: ${loan.name} ist überfaellig! Kreditwürdigkeit gesunken.`, 'danger');
            UI.showNotification(`${loan.name} überfaellig! Tilgt eure Schulden!`, 'danger');

            // Extend loan with penalty interest
            loan.monthsLeft = 3; // 3 month grace period
            loan.interest = Math.min(0.10, loan.interest * 1.5); // Increase interest rate
        });

        // Small credit rating recovery for being current
        if (defaultedLoans.length === 0 && player.loans.length > 0) {
            player.creditRating = Math.min(100, player.creditRating + 1);
        }
    },

    // Helper: average reputation across cities
    _getAverageReputation(player) {
        const reps = Object.values(player.reputation || {});
        if (reps.length === 0) return 0;
        return reps.reduce((s, r) => s + r, 0) / reps.length;
    }
};
