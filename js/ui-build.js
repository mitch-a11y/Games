/* HANSE - UI Build Module */

Object.assign(UI, {
    _buildProductionChainHTML(bType, level, market) {
        if (!bType.consumes && !bType.produces) return '';
        let html = '<div class="production-chain">';
        if (bType.consumes) {
            // Input → Output chain
            const inputs = Object.entries(bType.consumes).map(([goodId, amount]) => {
                const good = GOODS[goodId];
                const needed = amount * level;
                const available = market && market[goodId] ? market[goodId].stock : 0;
                const enough = available >= needed;
                return `<span class="chain-resource ${enough ? 'chain-ok' : 'chain-missing'}">${good.icon} ${needed} ${good.name} <span class="chain-stock">(${available} vorhanden)</span></span>`;
            });
            const output = GOODS[bType.produces];
            html += `<div class="chain-flow">${inputs.join(' + ')} <span class="chain-arrow">→</span> <span class="chain-resource chain-output">${output.icon} ${level} ${output.name}</span></div>`;
        } else if (bType.produces) {
            // Simple production (no inputs)
            const output = GOODS[bType.produces];
            html += `<div class="chain-flow"><span class="chain-resource chain-output">${output.icon} ${level} ${output.name}/Zyklus</span></div>`;
        }
        html += '</div>';
        return html;
    },

    updateBuildTab() {
        const panel = document.getElementById('build-list');
        const cityId = GameMap.selectedCity;

        if (!cityId || !Game.state) {
            panel.innerHTML = '<p style="color:var(--text-dim)">Waehle eine Stadt zum Bauen.</p>';
            return;
        }

        const cityState = Game.state.cities[cityId];
        const market = cityState.market || {};
        const available = Buildings.getAvailable(Game.state, cityId);

        let html = `<p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">${CITIES_DATA[cityId].displayName}</p>`;

        // Show existing buildings
        if (cityState.playerBuildings && cityState.playerBuildings.length > 0) {
            html += '<h4 style="color:var(--text-dim);font-size:11px;text-transform:uppercase;margin-bottom:6px">Eure Gebaeude</h4>';
            cityState.playerBuildings.forEach(b => {
                const type = BUILDING_TYPES[b.type];
                // Production status indicator
                let statusHTML = '';
                if (type.produces) {
                    if (type.consumes) {
                        const producing = b._lastProduced === true;
                        statusHTML = producing
                            ? '<span class="prod-status prod-active">● Produziert</span>'
                            : '<span class="prod-status prod-idle">● Rohstoffe fehlen</span>';
                    } else {
                        statusHTML = '<span class="prod-status prod-active">● Produziert</span>';
                    }
                }
                const chainHTML = this._buildProductionChainHTML(type, b.level, market);
                html += `<div class="build-item" style="border-color:var(--success)">
                    <div class="build-item-header">
                        <span class="build-item-name">${type.icon} ${type.name}</span>
                        <span style="display:flex;align-items:center;gap:6px">
                            ${statusHTML}
                            <span style="color:var(--text-dim);font-size:11px">Stufe ${b.level}</span>
                        </span>
                    </div>
                    ${chainHTML}
                    <div style="font-size:10px;color:var(--text-dim)">Unterhalt: ${type.maintenance * b.level} G/Monat</div>
                </div>`;
            });
            html += '<div style="height:12px"></div>';
        }

        // Available buildings
        html += '<h4 style="color:var(--text-dim);font-size:11px;text-transform:uppercase;margin-bottom:6px">Verfuegbar</h4>';

        if (available.length === 0 && (!cityState.playerBuildings || cityState.playerBuildings.length === 0)) {
            html += '<p style="color:var(--text-dim);font-size:12px">Errichtet zuerst ein Handelskontor!</p>';
        } else if (available.length === 0) {
            html += '<p style="color:var(--text-dim);font-size:12px">Alle Gebaeude errichtet.</p>';
        }

        available.forEach(item => {
            const canAfford = Game.state.player.gold >= item.cost;
            const chainHTML = this._buildProductionChainHTML(item.type, 1, market);
            html += `<div class="build-item">
                <div class="build-item-header">
                    <span class="build-item-name">${item.type.icon} ${item.isUpgrade ? 'Ausbau: ' : ''}${item.type.name}</span>
                    <span class="build-item-cost">${Utils.formatGold(item.cost)}</span>
                </div>
                <div class="build-item-desc">${item.type.description}</div>
                ${chainHTML}
                <button class="build-buy-btn" onclick="UI.buildBuilding('${cityId}','${item.typeId}')"
                    ${canAfford ? '' : 'disabled'}>${item.isUpgrade ? 'Ausbauen' : (canAfford ? 'Bauen' : 'Zu teuer')}</button>
            </div>`;
        });

        panel.innerHTML = html;
    },

    buildBuilding(cityId, typeId) {
        const result = Buildings.build(Game.state, cityId, typeId);
        if (result.success) {
            Sound.play('build');
            this.addLogMessage(result.message, 'trade');
            this.showNotification(result.message, 'success');
        } else {
            this.showNotification(result.message, 'warning');
        }
        this.updateBuildTab();
        this.updateTopBar(Game.state);
    }
});
