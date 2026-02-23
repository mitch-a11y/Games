/* HANSE - UI Fleet Module */

Object.assign(UI, {
    updateFleetTab() {
        const panel = document.getElementById('fleet-list');
        const player = Game.state ? Game.state.player : null;
        if (!player) return;

        let html = '';

        if (player.ships.length === 0) {
            html = '<p style="color:var(--text-dim)">Keine Schiffe. Kaufe eines in einer Stadt mit Werft!</p>';
        }

        player.ships.forEach(ship => {
            const type = SHIP_TYPES[ship.typeId];
            const cargoCount = getCargoCount(ship);
            const cargoPercent = Math.round(cargoCount / ship.capacity * 100);
            const hullPercent = Math.round(ship.hull / ship.maxHull * 100);

            let statusText = '';
            let statusClass = '';
            if (ship.status === 'docked') {
                statusText = `Angedockt: ${CITIES_DATA[ship.location] ? CITIES_DATA[ship.location].displayName : ship.location}`;
                statusClass = 'docked';
            } else if (ship.status === 'sailing') {
                const dest = ship.route ? ship.route[ship.route.length - 1] : ship.destination;
                const destName = CITIES_DATA[dest] ? CITIES_DATA[dest].displayName : dest;
                const progressPct = ship.route ? Math.round((ship.routeIndex + ship.progress) / (ship.route.length - 1) * 100) : 0;
                statusText = `Unterwegs: ${destName} (${progressPct}%)`;
                statusClass = 'sailing';
            }

            // Cargo summary
            let cargoText = '';
            const cargoEntries = Object.entries(ship.cargo).filter(([, v]) => v > 0);
            if (cargoEntries.length > 0) {
                cargoText = cargoEntries.map(([gid, amt]) => `${GOODS[gid].icon}${amt}`).join(' ');
            }

            html += `<div class="ship-card ${this.selectedShipId === ship.id ? 'selected' : ''}" onclick="UI.selectShip('${ship.id}')">
                <div class="ship-card-header">
                    <span class="ship-card-name">${ship.name}</span>
                    <span class="ship-card-type">${type.name}</span>
                </div>
                <div class="ship-card-stats">
                    <div class="ship-stat"><span class="ship-stat-label">Rumpf:</span><span class="ship-stat-value" style="color:${hullPercent > 50 ? 'var(--text)' : (hullPercent > 25 ? 'var(--warning)' : 'var(--danger)')}">${hullPercent}%</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Fracht:</span><span class="ship-stat-value">${cargoCount}/${ship.capacity}</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Crew:</span><span class="ship-stat-value">${ship.crew}/${ship.maxCrew || ship.crew}</span></div>
                    <div class="ship-stat"><span class="ship-stat-label">Kanonen:</span><span class="ship-stat-value">${ship.cannons}</span></div>
                </div>
                <div class="ship-cargo-bar"><div class="ship-cargo-fill" style="width:${cargoPercent}%"></div></div>
                ${cargoText ? `<div style="font-size:10px;margin-top:4px;color:var(--text-dim)">${cargoText}</div>` : ''}
                ${ship.convoyId ? `<div style="font-size:10px;color:var(--accent);margin-top:2px">⚓ Konvoi</div>` : ''}
                <div class="ship-status ${statusClass}">${statusText}</div>
            </div>`;

            // Navigation options for selected docked ship
            if (this.selectedShipId === ship.id && ship.status === 'docked') {
                html += this.renderNavigationOptions(ship);
                html += this.renderConvoyOptions(ship);
            }
        });

        panel.innerHTML = html;
        this.updateShipyard();
    },

    renderNavigationOptions(ship) {
        // Show ALL reachable ports, not just directly connected ones
        const allCities = CITY_IDS.filter(cid => cid !== ship.location);
        let html = '<div style="padding:8px;background:rgba(15,52,96,0.4);border-radius:4px;margin-bottom:8px">';
        html += '<div style="font-size:12px;color:var(--accent);margin-bottom:6px;font-weight:bold">Ziel wählen:</div>';

        // Build destinations with shortest-path distances
        const destinations = allCities.map(destId => {
            const route = findShortestPath(ship.location, destId);
            return { destId, distance: route ? route.distance : Infinity, travelDays: route ? route.distance : '?' };
        }).filter(d => d.distance < Infinity)
          .sort((a, b) => a.distance - b.distance);

        // Group: nearby (direct connections) vs. distant
        const directNeighbors = new Set(getConnectedCities(ship.location));
        const nearby = destinations.filter(d => directNeighbors.has(d.destId));
        const distant = destinations.filter(d => !directNeighbors.has(d.destId));

        if (nearby.length > 0) {
            html += '<div style="font-size:10px;color:var(--text-dim);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">Nahe Häfen</div>';
            nearby.forEach(dest => {
                const city = CITIES_DATA[dest.destId];
                html += `<button class="trade-btn buy" style="margin:2px;padding:4px 8px;font-size:11px;width:calc(50% - 4px)"
                    onclick="UI.sailShip('${ship.id}','${dest.destId}')">${city.displayName} <span style="color:var(--text-dim)">(~${dest.travelDays}d)</span></button>`;
            });
        }

        if (distant.length > 0) {
            html += '<div style="font-size:10px;color:var(--text-dim);margin:6px 0 4px;text-transform:uppercase;letter-spacing:0.5px">Fernziele</div>';
            distant.forEach(dest => {
                const city = CITIES_DATA[dest.destId];
                html += `<button class="trade-btn buy" style="margin:2px;padding:4px 8px;font-size:11px;width:calc(50% - 4px)"
                    onclick="UI.sailShip('${ship.id}','${dest.destId}')">${city.displayName} <span style="color:var(--text-dim)">(~${dest.travelDays}d)</span></button>`;
            });
        }

        // Repair option
        if (ship.hull < ship.maxHull) {
            const repairCost = Math.ceil((ship.maxHull - ship.hull) * 10);
            html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
                <button class="build-buy-btn" style="width:100%" onclick="UI.repairShip('${ship.id}')"
                ${Game.state.player.gold < repairCost ? 'disabled' : ''}>Reparieren - ${Utils.formatGold(repairCost)}</button>
            </div>`;
        }

        // Crew management
        html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
            <button class="shipyard-buy-btn" style="width:100%;padding:4px" onclick="UI.showCrewManagement('${ship.id}')">👥 Crew verwalten (${ship.crew}/${ship.maxCrew || ship.crew})</button>
        </div>`;

        // Auto-Trade
        html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">`;
        if (ship.autoTrade) {
            const atA = CITIES_DATA[ship.autoTrade.cityA]?.displayName || '?';
            const atB = CITIES_DATA[ship.autoTrade.cityB]?.displayName || '?';
            html += `<div style="font-size:11px;color:var(--accent);margin-bottom:4px">🔄 Auto-Handel aktiv</div>`;
            html += `<div style="font-size:10px;color:var(--text-dim);margin-bottom:6px">${atA} ↔ ${atB} (Min. ${ship.autoTrade.minProfit || 10}% Gewinn)</div>`;
            html += `<button class="trade-btn sell" style="width:100%;padding:4px" onclick="UI.stopAutoTrade('${ship.id}')">⏹ Auto-Handel stoppen</button>`;
        } else {
            html += `<button class="shipyard-buy-btn" style="width:100%;padding:4px" onclick="UI.showAutoTradeSetup('${ship.id}')">🔄 Auto-Handel einrichten</button>`;
        }
        html += `</div>`;

        // Sell ship option
        const sellPrice = Math.floor(SHIP_TYPES[ship.typeId].cost * 0.4);
        if (Game.state.player.ships.length > 1) {
            html += `<div style="margin-top:4px">
                <button class="trade-btn sell" style="width:100%;padding:4px" onclick="UI.sellShip('${ship.id}')"
                    title="Schiff verkaufen">Verkaufen (${Utils.formatGold(sellPrice)})</button>
            </div>`;
        }

        html += '</div>';
        return html;
    },

    renderConvoyOptions(ship) {
        const player = Game.state.player;
        // Find other docked ships at same location
        const otherShips = player.ships.filter(s =>
            s.id !== ship.id && s.status === 'docked' && s.location === ship.location
        );

        if (otherShips.length === 0 && !ship.convoyId) return '';

        let html = '<div style="padding:8px;background:rgba(230,168,23,0.08);border:1px solid rgba(230,168,23,0.15);border-radius:4px;margin-bottom:8px">';
        html += '<div style="font-size:12px;color:var(--accent);margin-bottom:6px;font-weight:bold">⚓ Konvoi</div>';

        if (ship.convoyId) {
            // Already in convoy — show members & option to leave
            const convoyShips = Convoy.getShips(player.ships, ship.convoyId);
            html += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">';
            html += 'Mitglieder: ' + convoyShips.map(s => s.name).join(', ');
            html += '</div>';
            html += `<button class="trade-btn sell" style="width:100%;padding:4px" onclick="UI.leaveConvoy('${ship.id}')">Konvoi verlassen</button>`;
        } else if (otherShips.length > 0) {
            // Can form convoy
            html += '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">';
            html += `${otherShips.length} andere(s) Schiff(e) hier. Konvoi bilden für gemeinsame Reise & Kampfbonus.`;
            html += '</div>';

            // Checkboxes for each ship
            otherShips.forEach(s => {
                html += `<label style="display:block;font-size:11px;padding:3px 0;color:var(--text);cursor:pointer">
                    <input type="checkbox" class="convoy-check" value="${s.id}" checked style="margin-right:6px">
                    ${s.name} (${SHIP_TYPES[s.typeId].name})
                </label>`;
            });

            html += `<button class="shipyard-buy-btn" style="width:100%;margin-top:6px" onclick="UI.formConvoy('${ship.id}')">Konvoi bilden</button>`;
        }

        html += '</div>';
        return html;
    },

    formConvoy(leadShipId) {
        const player = Game.state.player;
        const leadShip = player.ships.find(s => s.id === leadShipId);
        if (!leadShip) return;

        // Get checked ships from checkboxes
        const checks = document.querySelectorAll('.convoy-check:checked');
        const shipIds = [leadShipId];
        checks.forEach(cb => shipIds.push(cb.value));

        const ships = shipIds.map(id => player.ships.find(s => s.id === id)).filter(Boolean);
        if (ships.length < 2) {
            this.showNotification('Mindestens 2 Schiffe für einen Konvoi nötig!', 'warning');
            return;
        }

        Convoy.create(ships);
        Sound.play('click');
        this.addLogMessage(`Konvoi gebildet: ${ships.map(s => s.name).join(', ')}`, 'info');
        this.showNotification(`Konvoi mit ${ships.length} Schiffen gebildet!`, 'success');
        this.updateFleetTab();
    },

    leaveConvoy(shipId) {
        const player = Game.state.player;
        const ship = player.ships.find(s => s.id === shipId);
        if (!ship || !ship.convoyId) return;

        const convoyId = ship.convoyId;
        const remaining = Convoy.getShips(player.ships, convoyId).filter(s => s.id !== shipId);

        // Remove this ship from convoy
        delete ship.convoyId;
        delete ship.convoySpeed;

        // If only 1 ship remains, disband entirely
        if (remaining.length <= 1) {
            Convoy.disband(player.ships, convoyId);
        }

        Sound.play('click');
        this.addLogMessage(`${ship.name} hat den Konvoi verlassen.`, 'info');
        this.updateFleetTab();
    },

    showAutoTradeSetup(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship || ship.status !== 'docked' || !ship.location) return;

        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');

        // Get connected cities for auto-trade route
        const connectedIds = CITY_IDS.filter(cid => cid !== ship.location && findShortestPath(ship.location, cid));

        let html = `<div style="max-width:380px">`;
        html += `<h3 style="margin:0 0 12px;color:var(--accent)">🔄 Auto-Handel einrichten</h3>`;
        html += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:12px">${ship.name} pendelt automatisch zwischen zwei Städten und handelt profitabel.</div>`;

        html += `<div style="margin-bottom:12px">`;
        html += `<label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Heimatstadt</label>`;
        html += `<div style="font-size:13px;color:var(--text);padding:6px;background:rgba(255,255,255,0.05);border-radius:4px">${CITIES_DATA[ship.location].displayName}</div>`;
        html += `</div>`;

        html += `<div style="margin-bottom:12px">`;
        html += `<label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Zielstadt</label>`;
        html += `<select id="at-dest" style="width:100%;padding:6px;background:var(--panel-bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:12px">`;
        connectedIds.forEach(cid => {
            const route = findShortestPath(ship.location, cid);
            const days = route ? route.distance : '?';
            html += `<option value="${cid}">${CITIES_DATA[cid].displayName} (~${days}d)</option>`;
        });
        html += `</select></div>`;

        html += `<div style="margin-bottom:12px">`;
        html += `<label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Min. Gewinn pro Ware: <span id="at-profit-val">10</span>%</label>`;
        html += `<input type="range" id="at-profit" min="5" max="50" value="10" step="5" style="width:100%" oninput="document.getElementById('at-profit-val').textContent=this.value">`;
        html += `</div>`;

        html += `<div style="margin-bottom:12px">`;
        html += `<label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Max. Einkauf: <span id="at-spend-val">50</span>% des Goldes</label>`;
        html += `<input type="range" id="at-spend" min="10" max="90" value="50" step="10" style="width:100%" oninput="document.getElementById('at-spend-val').textContent=this.value">`;
        html += `</div>`;

        html += `<div style="display:flex;gap:8px;margin-top:16px">`;
        html += `<button class="shipyard-buy-btn" style="flex:1" onclick="UI.startAutoTrade('${ship.id}')">Starten</button>`;
        html += `<button class="modal-btn secondary" style="flex:1" onclick="document.getElementById('modal-overlay').classList.add('hidden')">Abbrechen</button>`;
        html += `</div></div>`;

        content.innerHTML = html;
        overlay.classList.remove('hidden');
    },

    startAutoTrade(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        const destSelect = document.getElementById('at-dest');
        const profitSlider = document.getElementById('at-profit');
        const spendSlider = document.getElementById('at-spend');
        if (!destSelect) return;

        const destCity = destSelect.value;
        const minProfit = parseInt(profitSlider?.value || '10');
        const maxSpendPct = parseInt(spendSlider?.value || '50');

        ship.autoTrade = {
            cityA: ship.location,
            cityB: destCity,
            minProfit: minProfit,
            maxSpend: Game.state.player.gold * (maxSpendPct / 100)
        };

        // Close modal
        document.getElementById('modal-overlay').classList.add('hidden');

        Sound.play('click');
        this.addLogMessage(`${ship.name}: Auto-Handel gestartet ${CITIES_DATA[ship.location].displayName} ↔ ${CITIES_DATA[destCity].displayName}`, 'trade');
        this.showNotification('Auto-Handel aktiviert!', 'success');

        // Immediately start first run
        if (ship.status === 'docked') {
            Trading.processAutoTrade(Game.state, ship);
        }

        this.updateFleetTab();
    },

    stopAutoTrade(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        ship.autoTrade = null;
        Sound.play('click');
        this.addLogMessage(`${ship.name}: Auto-Handel gestoppt.`, 'info');
        this.showNotification('Auto-Handel deaktiviert.', 'info');
        this.updateFleetTab();
    },

    selectShip(shipId) {
        this.selectedShipId = this.selectedShipId === shipId ? null : shipId;
        Sound.play('click');
        this.updateFleetTab();
    },

    sailShip(shipId, destId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship || ship.status !== 'docked') return;

        const route = findShortestPath(ship.location, destId);
        if (!route) {
            this.showNotification('Keine Route gefunden!', 'warning');
            return;
        }

        // If ship is in a convoy, send all convoy members
        if (ship.convoyId) {
            Convoy.sail(Game.state.player.ships, ship.convoyId, route.path);
            const convoyShips = Convoy.getShips(Game.state.player.ships, ship.convoyId);
            Sound.play('sail');
            this.addLogMessage(`Konvoi (${convoyShips.length} Schiffe) segelt nach ${CITIES_DATA[destId].displayName}.`, 'info');
        } else {
            ship.route = route.path;
            ship.routeIndex = 0;
            ship.progress = 0;
            ship.status = 'sailing';
            ship.destination = destId;
            ship.location = null;
            Sound.play('sail');
            this.addLogMessage(`${ship.name} segelt nach ${CITIES_DATA[destId].displayName}.`, 'info');
        }

        this.selectedShipId = null;
        this.updateFleetTab();
    },

    repairShip(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship) return;

        const repairCost = Math.ceil((ship.maxHull - ship.hull) * 10);
        if (Game.state.player.gold < repairCost) {
            this.showNotification('Nicht genug Gold!', 'warning');
            return;
        }

        Game.state.player.gold -= repairCost;
        ship.hull = ship.maxHull;
        ship.damaged = false;

        Sound.play('build');
        this.addLogMessage(`${ship.name} wurde fuer ${Utils.formatGold(repairCost)} repariert.`, 'info');
        this.updateFleetTab();
        this.updateTopBar(Game.state);
    },

    sellShip(shipId) {
        const ship = Game.state.player.ships.find(s => s.id === shipId);
        if (!ship || Game.state.player.ships.length <= 1) return;

        const sellPrice = Math.floor(SHIP_TYPES[ship.typeId].cost * 0.4);

        this.showModal(`<div class="event-popup">
            <h3>Schiff verkaufen?</h3>
            <div class="event-text">"${ship.name}" (${SHIP_TYPES[ship.typeId].name}) fuer ${Utils.formatGold(sellPrice)} verkaufen?<br>
            ${getCargoCount(ship) > 0 ? '<span style="color:var(--warning)">Achtung: Fracht geht verloren!</span>' : ''}</div>
            <div class="modal-buttons">
                <button class="modal-btn danger" onclick="UI.confirmSellShip('${shipId}')">Verkaufen</button>
                <button class="modal-btn secondary" onclick="UI.hideModal()">Abbrechen</button>
            </div>
        </div>`);
    },

    confirmSellShip(shipId) {
        const idx = Game.state.player.ships.findIndex(s => s.id === shipId);
        if (idx === -1) return;

        const ship = Game.state.player.ships[idx];
        const sellPrice = Math.floor(SHIP_TYPES[ship.typeId].cost * 0.4);
        Game.state.player.gold += sellPrice;
        Game.state.player.ships.splice(idx, 1);

        Sound.play('sell');
        this.addLogMessage(`${ship.name} fuer ${Utils.formatGold(sellPrice)} verkauft.`, 'trade');
        this.hideModal();
        this.selectedShipId = null;
        this.updateFleetTab();
        this.updateTopBar(Game.state);
    },

    updateShipyard() {
        const section = document.getElementById('shipyard-section');
        const list = document.getElementById('shipyard-list');
        const cityId = GameMap.selectedCity;

        if (!cityId || !CITIES_DATA[cityId].hasShipyard) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');

        const hasPresence = Game.state.player.ships.some(s => s.location === cityId) ||
            (Game.state.cities[cityId].playerBuildings || []).some(b => b.type === 'kontor');

        if (!hasPresence) {
            list.innerHTML = '<p style="color:var(--text-dim);font-size:12px">Ihr braucht ein Kontor oder Schiff hier.</p>';
            return;
        }

        let html = '';
        SHIP_TYPE_IDS.forEach(typeId => {
            const type = SHIP_TYPES[typeId];
            const canAfford = Game.state.player.gold >= type.cost;
            html += `<div class="shipyard-item">
                <div class="shipyard-item-header">
                    <span class="shipyard-item-name">${type.name}</span>
                    <span class="shipyard-item-cost">${Utils.formatGold(type.cost)}</span>
                </div>
                <div class="shipyard-item-stats">
                    Fracht: ${type.capacity} | Geschw: ${type.speed} | Rumpf: ${type.hull} | Kanonen: ${type.cannons}
                    <br><span style="color:var(--text-dim)">${type.description}</span>
                </div>
                <button class="shipyard-buy-btn" onclick="UI.buyShip('${typeId}','${cityId}')"
                    ${canAfford ? '' : 'disabled'}>${canAfford ? 'Kaufen' : 'Zu teuer'}</button>
            </div>`;
        });

        list.innerHTML = html;
    },

    buyShip(typeId, cityId) {
        const type = SHIP_TYPES[typeId];
        if (Game.state.player.gold < type.cost) {
            this.showNotification('Nicht genug Gold!', 'warning');
            return;
        }

        Game.state.player.gold -= type.cost;
        const name = generateShipName();
        const ship = createShip(typeId, name, cityId);
        Game.state.player.ships.push(ship);

        Sound.play('build');
        this.addLogMessage(`Neues Schiff "${name}" (${type.name}) in ${CITIES_DATA[cityId].displayName} gekauft!`, 'trade');
        this.showNotification(`${type.name} "${name}" erworben!`, 'success');
        this.updateFleetTab();
        this.updateTopBar(Game.state);
    }
});
