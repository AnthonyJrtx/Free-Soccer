/**
 * ===================================================================
 * FREE SOCCER - LÓGICA PRINCIPAL DEL JUEGO (main.js)
 * ===================================================================
 * Este archivo controla el flujo de la aplicación, el renderizado de 
 * pantallas, la gestión del estado del juego y la interacción del
 * usuario con los menús. Orquesta la comunicación con los módulos
 * de creación de dimensiones y simulación de partidos.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. ESTADO GLOBAL Y CONSTANTES ---

    const gameContainer = document.getElementById('game-container');
    const importFileInput = document.getElementById('import-file-input');
    
    let gameState = {
        dimension: null,
        careerMode: null,
        playerClubId: null,
        currentClub: null,
        activeSimulator: null
    };

    const DEFAULT_MINIFACE_PATH = "assets/images/minifaces/MiniFaceDefault.jpg";
    const DEFAULT_LOGO_PATH = "assets/images/logos/clubes/default.png";
    const ICON_BALL_PATH = "assets/images/icons/ball.svg"; // Asegúrate de tener este icono

    // --- 2. FUNCIÓN UTILITARIA CENTRAL ---

    function renderScreen(templateId) {
        const template = document.getElementById(templateId);
        if (!template) { console.error(`La plantilla "${templateId}" no existe.`); return; }
        gameContainer.innerHTML = '';
        gameContainer.appendChild(template.content.cloneNode(true));
    }

    // --- 3. FLUJO DE NAVEGACIÓN PRINCIPAL ---

    function showSplashScreen() {
        renderScreen('splash-screen-template');
        setTimeout(showDimensionMenu, 2500);
    }

    function showDimensionMenu() {
        renderScreen('dimension-menu-template');
        gameContainer.querySelector('.menu-options-container').addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button) return;
            switch (button.dataset.action) {
                case 'play-dimension': showSelectDimensionScreen(); break;
                case 'create-dimension': showDimensionCreator(); break;
                case 'import-dimension': importFileInput.click(); break;
                default: alert(`Función "${button.dataset.action}" no implementada.`);
            }
        });
    }

    function showSelectDimensionScreen() {
        renderScreen('select-dimension-template');
        gameContainer.querySelector('[data-action="back-to-dimension-menu"]').addEventListener('click', showDimensionMenu);
        gameContainer.querySelector('.list-container').addEventListener('click', async (event) => {
            if (event.target.closest('button')?.dataset.dimensionId === 'default') {
                await loadDimension('data/default_dimension.json');
            }
        });
    }

    async function loadDimension(source) {
        try {
            const dimensionData = typeof source === 'string' ? await (await fetch(source)).json() : source;
            gameState.dimension = dimensionData;
            showMainMenu();
        } catch (error) {
            console.error("Error al cargar la dimensión:", error);
            alert("No se pudo cargar la dimensión.");
        }
    }

    function showDimensionCreator() {
        renderScreen('dimension-creator-template');
        new DimensionCreator(gameContainer.querySelector('#dimension-creator-screen'), showDimensionMenu);
    }

    async function handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const zip = await JSZip.loadAsync(file);
            const dimensionFile = zip.file("dimension.json");
            if (!dimensionFile) throw new Error("Archivo .zip/.fsd inválido.");
            const content = await dimensionFile.async("string");
            const importedDimension = JSON.parse(content);
            alert(`Dimensión "${importedDimension.dimensionName}" importada.`);
            await loadDimension(importedDimension);
        } catch (error) {
            console.error("Error al importar:", error);
            alert("Hubo un error al importar el archivo.");
        } finally {
            event.target.value = '';
        }
    }

    function showMainMenu() {
        renderScreen('main-menu-template');
        gameContainer.querySelector('#dimension-name-title').textContent = gameState.dimension.dimensionName;
        gameContainer.querySelector('.menu-options-container').addEventListener('click', (event) => {
            const action = event.target.closest('button')?.dataset.action;
            if (!action) return;
            switch (action) {
                case 'play-exhibition': showTeamVsSelectionScreen(); break;
                case 'career-dt': gameState.careerMode = 'DT'; showTeamSelectionScreen(); break;
                case 'career-president': gameState.careerMode = 'President'; showTeamSelectionScreen(); break;
            }
        });
        gameContainer.querySelector('[data-action="quit-dimension"]').addEventListener('click', showDimensionMenu);
    }
    
    // --- 4. LÓGICA DE PARTIDO DE EXHIBICIÓN ---

    function showTeamVsSelectionScreen() {
        renderScreen('team-vs-selection-template');
        let selectedTeams = { home: null, away: null };
        let activeSelection = 'away';
        const awayPanel = document.getElementById('away-team-panel');
        const homePanel = document.getElementById('home-team-panel');
        const startBtn = document.getElementById('start-match-btn');
        const teamListContainer = document.getElementById('vs-team-list');
        const clubs = gameState.dimension.continents[0].countries[0].leagues[0].clubs;

        teamListContainer.innerHTML = '';
        clubs.forEach((club, index) => {
            const teamCardHTML = `<div class="team-card" data-club-id="${club.id}" style="animation-delay: ${index * 50}ms"><img src="${club.logo || DEFAULT_LOGO_PATH}" class="team-logo" alt="Logo de ${club.name}" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_PATH}';"><span class="team-name">${club.name}</span></div>`;
            teamListContainer.insertAdjacentHTML('beforeend', teamCardHTML);
        });

        const updateActivePanel = () => {
            homePanel.classList.toggle('active-selection', activeSelection === 'home');
            awayPanel.classList.toggle('active-selection', activeSelection === 'away');
        };

        teamListContainer.addEventListener('click', (event) => {
            const clubId = event.target.closest('.team-card')?.dataset.clubId;
            if (!clubId) return;
            const club = clubs.find(c => c.id === clubId);
            selectedTeams[activeSelection] = club;
            const panel = document.getElementById(`${activeSelection}-team-panel`);
            panel.querySelector('.vs-panel-logo').src = club.logo || DEFAULT_LOGO_PATH;
            panel.querySelector('.vs-panel-name').textContent = club.name;
            activeSelection = (activeSelection === 'away') ? 'home' : 'away';
            updateActivePanel();
            if (selectedTeams.home && selectedTeams.away) {
                startBtn.disabled = false;
            }
        });

        startBtn.addEventListener('click', () => {
            if (selectedTeams.home && selectedTeams.away) {
                showPreMatchLoadingScreen(selectedTeams.home, selectedTeams.away);
            }
        });
        gameContainer.querySelector('[data-action="back-to-main-menu"]').addEventListener('click', showMainMenu);
        updateActivePanel();
    }

    function showPreMatchLoadingScreen(homeClub, awayClub) {
        renderScreen('pre-match-loading-template');
        document.querySelector('#pre-match-home img').src = homeClub.logo || DEFAULT_LOGO_PATH;
        document.querySelector('#pre-match-home span').textContent = homeClub.name;
        document.querySelector('#pre-match-away img').src = awayClub.logo || DEFAULT_LOGO_PATH;
        document.querySelector('#pre-match-away span').textContent = awayClub.name;
        const timerEl = document.getElementById('pre-match-timer');
        let countdown = 5;
        const interval = setInterval(() => {
            countdown--;
            timerEl.textContent = countdown > 0 ? countdown : "¡VAMOS!";
            if (countdown < 0) {
                clearInterval(interval);
                showMatchSimulation(homeClub, awayClub);
            }
        }, 1000);
    }
    
    function showMatchSimulation(homeClub, awayClub) {
        renderScreen('match-sim-template');
        const scoreEl = document.getElementById('sim-score');
        const timeEl = document.getElementById('sim-time');
        
        document.getElementById('sim-home-name').textContent = homeClub.name.split(' ').pop().toUpperCase();
        document.getElementById('sim-away-name').textContent = awayClub.name.split(' ').pop().toUpperCase();
        document.getElementById('sim-home-logo').src = homeClub.logo || DEFAULT_LOGO_PATH;
        document.getElementById('sim-away-logo').src = awayClub.logo || DEFAULT_LOGO_PATH;

        const addCommentary = (message) => {
            const log = document.getElementById('commentary-log');
            if (!log) return;
            const li = document.createElement('li');
            li.textContent = `[${String(Math.floor(gameState.activeSimulator.state.simulatedTime)).padStart(2, '0')}] ${message}`;
            log.prepend(li);
        };
        
        const simulator = new MatchSimulator(homeClub, awayClub, { duration: 5 }, {
            onTick: (simTime, score, addedTime) => {
                const minutes = Math.floor(simTime);
                if (minutes >= 90 && addedTime > 0) {
                    timeEl.textContent = `90' +${Math.ceil(simTime - 90)}`;
                } else {
                    timeEl.textContent = `${String(minutes).padStart(2, '0')}'`;
                }
                scoreEl.textContent = `${score.home} - ${score.away}`;
            },
            onEvent: (message) => addCommentary(message),
            onGoal: (event) => showGoalNotification(event),
            onCard: (event) => {},
            onHalfTime: () => showHalfTimeMenu(),
            onEnd: (finalScore, matchEvents) => {
                setTimeout(() => {
                    showPostMatchSummary(homeClub, awayClub, finalScore, matchEvents);
                }, 1500);
            }
        });

        gameState.activeSimulator = simulator;
        simulator.start();
    }

    function showGoalNotification(goalEvent) {
        const template = document.getElementById('goal-notification-template');
        const notification = template.content.cloneNode(true);
        const content = notification.querySelector('.goal-notification-content');
        content.querySelector('.goal-club-logo').src = goalEvent.team.logo || DEFAULT_LOGO_PATH;
        content.querySelector('.goal-scorer-name').textContent = goalEvent.scorer;
        content.querySelector('.goal-minute').textContent = `${goalEvent.minute}'`;
        content.querySelector('.goal-score').textContent = goalEvent.newScore;
        document.body.appendChild(notification);
        setTimeout(() => document.querySelector('.goal-notification-overlay')?.remove(), 4500);
    }
    
    function showHalfTimeMenu() {
        const simulator = gameState.activeSimulator;
        if (!simulator) return;

        const template = document.getElementById('half-time-menu-template');
        const menu = template.content.cloneNode(true);
        document.body.appendChild(menu);

        const overlay = document.querySelector('.half-time-overlay');
        const pitchList = overlay.querySelector('#pitch-players');
        const benchList = overlay.querySelector('#bench-players');
        const confirmSubBtn = overlay.querySelector('#confirm-sub-btn');
        const subsRemainingEl = overlay.querySelector('#subs-remaining');
    
        let selectedPitchPlayer = null;
        let selectedBenchPlayer = null;
        const homeTeam = simulator.homeTeam; // Asumimos que el jugador controla al local
    
        function populatePlayerLists() {
            pitchList.innerHTML = '';
            benchList.innerHTML = '';
            const order = { 'POR': 1, 'DEF': 2, 'MED': 3, 'DEL': 4 };
            homeTeam.players.sort((a,b) => (order[a.position] || 5) - (order[b.position] || 5));
            homeTeam.substitutes.sort((a,b) => (order[a.position] || 5) - (order[b.position] || 5));
    
            homeTeam.players.forEach(p => {
                pitchList.innerHTML += `<li class="sub-player-item" data-player-id="${p.id}">${p.name} <span class="player-position pos-${p.position}">${p.position}</span> ${p.rating}</li>`;
            });
            homeTeam.substitutes.forEach(p => {
                benchList.innerHTML += `<li class="sub-player-item" data-player-id="${p.id}">${p.name} <span class="player-position pos-${p.position}">${p.position}</span> ${p.rating}</li>`;
            });
            subsRemainingEl.textContent = simulator.state.maxSubstitutions - simulator.state.homeSubstitutions;
        }
    
        function updateSubButtonState() {
            confirmSubBtn.disabled = !(selectedPitchPlayer && selectedBenchPlayer);
        }
    
        overlay.querySelector('#substitutions-area').addEventListener('click', (e) => {
            const target = e.target.closest('.sub-player-item');
            if (!target) return;
            
            const playerId = parseInt(target.dataset.playerId);
            const parentList = target.parentElement;
    
            if (parentList.id === 'pitch-players') {
                if (selectedPitchPlayer) selectedPitchPlayer.classList.remove('selected');
                selectedPitchPlayer = target;
                target.classList.add('selected');
            } else if (parentList.id === 'bench-players') {
                if (selectedBenchPlayer) selectedBenchPlayer.classList.remove('selected');
                selectedBenchPlayer = target;
                target.classList.add('selected');
            }
            updateSubButtonState();
        });
    
        confirmSubBtn.addEventListener('click', () => {
            const playerOutId = parseInt(selectedPitchPlayer.dataset.playerId);
            const playerInId = parseInt(selectedBenchPlayer.dataset.playerId);
    
            if (simulator.makeSubstitution('home', playerOutId, playerInId)) {
                selectedPitchPlayer = null;
                selectedBenchPlayer = null;
                populatePlayerLists();
                updateSubButtonState();
            } else {
                alert("No puedes realizar más sustituciones.");
            }
        });

        overlay.querySelector('.tactic-buttons').addEventListener('click', (e) => {
            const button = e.target.closest('.tactic-btn');
            if (button) {
                overlay.querySelectorAll('.tactic-btn').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                simulator.setMentality('home', button.dataset.mentality);
            }
        });
        
        overlay.querySelector('#resume-match-btn').addEventListener('click', () => {
            overlay.remove();
            simulator.resumeFromHalfTime();
        });
    
        populatePlayerLists();
    }

    function showPostMatchSummary(home, away, score, events) {
        renderScreen('post-match-summary-template');
        
        document.querySelector('#summary-home img').src = home.logo || DEFAULT_LOGO_PATH;
        document.querySelector('#summary-home .team-name').textContent = home.name;
        document.querySelector('#summary-away img').src = away.logo || DEFAULT_LOGO_PATH;
        document.querySelector('#summary-away .team-name').textContent = away.name;
        document.querySelector('.summary-score').textContent = `${score.home} - ${score.away}`;
        
        const list = document.getElementById('summary-events-list');
        list.innerHTML = '';
        events.filter(e => e.type === 'Goal' || e.type === 'Card' || e.type === 'Substitution').forEach(event => {
            let eventHTML = `<li><span class="event-minute">${event.minute}'</span>`;
            if (event.type === 'Goal') {
                eventHTML += `<img src="${ICON_BALL_PATH}" class="event-icon" alt="Gol">
                              <div class="event-details">
                                <strong>GOL: ${event.scorer}</strong> (${event.team.name})<br>
                                Asistencia: ${event.assist}
                              </div>`;
            } else if (event.type === 'Card') {
                eventHTML += `<div class="event-card ${event.cardType.toLowerCase()}"></div>
                              <div class="event-details">
                                <strong>${event.player}</strong> (${event.team.name})
                              </div>`;
            } else if (event.type === 'Substitution') {
                 eventHTML += `<img src="assets/images/icons/sub.svg" class="event-icon" alt="Cambio">
                              <div class="event-details">
                                <strong>Cambio en ${event.team.name}</strong><br>
                                Entra ${event.playerIn}, sale ${event.playerOut}
                              </div>`;
            }
            eventHTML += `</li>`;
            list.innerHTML += eventHTML;
        });

        document.querySelector('[data-action="back-to-main-menu"]').addEventListener('click', showMainMenu);
    }

    // --- 5. LÓGICA DEL MODO CARRERA (HUB, MODAL, ETC.) ---

    function showTeamSelectionScreen() {
        renderScreen('team-selection-template');
        const teamGridContainer = gameContainer.querySelector('#team-grid-container');
        const clubs = gameState.dimension.continents[0].countries[0].leagues[0].clubs;
        
        teamGridContainer.innerHTML = '';
        clubs.forEach((club, index) => {
            const logoSrc = club.logo || DEFAULT_LOGO_PATH;
            const teamCardHTML = `<div class="team-card" data-club-id="${club.id}" style="animation-delay: ${index * 50}ms"><img src="${logoSrc}" class="team-logo" alt="Logo de ${club.name}" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_PATH}';"><span class="team-name">${club.name}</span></div>`;
            teamGridContainer.insertAdjacentHTML('beforeend', teamCardHTML);
        });
        
        gameContainer.querySelector('[data-action="back-to-main-menu"]').addEventListener('click', showMainMenu);
        
        teamGridContainer.addEventListener('click', (event) => {
            const clubId = event.target.closest('.team-card')?.dataset.clubId;
            if (clubId) {
                gameState.playerClubId = clubId;
                showTeamHub(clubId);
            }
        });
    }

    function showTeamHub(clubId) {
        renderScreen('team-hub-template');
        const selectedClub = gameState.dimension.continents[0].countries[0].leagues[0].clubs.find(c => c.id === clubId);
        if (!selectedClub) { console.error(`Club con ID "${clubId}" no encontrado.`); showTeamSelectionScreen(); return; }
        gameState.currentClub = selectedClub;

        gameContainer.querySelector('#hub-club-logo').src = selectedClub.logo || DEFAULT_LOGO_PATH;
        gameContainer.querySelector('#hub-club-name').textContent = selectedClub.name;
        gameContainer.querySelector('#hub-club-money').textContent = (selectedClub.money || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 });
        
        const sidebar = gameContainer.querySelector('.hub-sidebar');
        let sidebarHTML = `<button class="hub-menu-button active" data-section="office">Oficina</button><div class="hub-menu-item-with-submenu"><button class="hub-menu-button" data-section="squad">Plantilla</button><div class="hub-submenu-container"></div></div><button class="hub-menu-button" data-section="calendar">Calendario</button><button class="hub-menu-button" data-section="transfers">Fichajes</button>`;
        if (gameState.careerMode === 'President') sidebarHTML += `<hr class="sidebar-divider"><button class="hub-menu-button" data-section="finances">Finanzas</button><button class="hub-menu-button" data-section="facilities">Instalaciones</button><button class="hub-menu-button" data-section="staff">Personal</button>`;
        else if (gameState.careerMode === 'DT') sidebarHTML += `<hr class="sidebar-divider"><button class="hub-menu-button" data-section="job-market">Buscar Empleo</button>`;
        sidebar.innerHTML = sidebarHTML;
        
        sidebar.addEventListener('click', (event) => {
            const button = event.target.closest('.hub-menu-button');
            if (button) {
                if(!button.classList.contains('active')) {
                    sidebar.querySelectorAll('.hub-menu-button.active').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                }
                const submenuContainer = button.closest('.hub-menu-item-with-submenu')?.querySelector('.hub-submenu-container');
                document.querySelectorAll('.hub-submenu-container').forEach(sub => sub !== submenuContainer && sub.classList.remove('show-submenu'));
                if (submenuContainer) {
                    if (!submenuContainer.innerHTML) submenuContainer.innerHTML = `<button class="hub-menu-button submenu-button" data-section="strategy">Estrategia</button>`;
                    submenuContainer.classList.toggle('show-submenu');
                }
                if (!submenuContainer) renderHubContent(button.dataset.section, gameState.currentClub);
            }
        });
        
        gameContainer.querySelector('[data-action="back-to-team-selection"]').addEventListener('click', showTeamSelectionScreen);
        renderHubContent('office', gameState.currentClub);
    }

    function renderHubContent(section, clubData) {
        const contentArea = gameContainer.querySelector('.hub-main-content');
        contentArea.innerHTML = '';
        const isPresident = gameState.careerMode === 'President';

        switch (section) {
            case 'office': contentArea.innerHTML = `<h2>Bienvenido, ${isPresident ? 'Presidente' : 'Míster'}.</h2><p>Gestiona todos los aspectos del ${clubData.name} desde el menú de la izquierda.</p>`; break;
            case 'squad':
                contentArea.innerHTML = `<div class="squad-view-container"><div class="squad-tabs"><button class="squad-tab-button active" data-squad-type="main">Primer Equipo</button><button class="squad-tab-button" data-squad-type="youth">Cantera</button><button class="squad-tab-button" data-squad-type="edit-dorsals">Editar Dorsales</button></div><div id="squad-content-area"></div></div>`;
                renderSquadList(clubData.players, 'squad-content-area', clubData);
                contentArea.querySelector('.squad-tabs').addEventListener('click', (event) => {
                    const button = event.target.closest('.squad-tab-button');
                    if (button) {
                        contentArea.querySelectorAll('.squad-tab-button').forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        const squadType = button.dataset.squadType;
                        if (squadType === 'main') renderSquadList(clubData.players, 'squad-content-area', clubData);
                        else if (squadType === 'youth') renderSquadList(clubData.youthSquad, 'squad-content-area', clubData);
                        else if (squadType === 'edit-dorsals') renderDorsalEditor(clubData, 'squad-content-area');
                    }
                });
                break;
            case 'strategy': contentArea.innerHTML = `<div class="strategy-view-container"><h2>Estrategia y Tácticas</h2><div class="tactic-board-visual" id="tactic-board"></div></div>`; renderTacticBoard(clubData.players); break;
            case 'calendar': contentArea.innerHTML = `<h2>Calendario de Partidos</h2><p>Próximos partidos y resultados (en desarrollo).</p>`; break;
            case 'transfers': contentArea.innerHTML = `<h2>Mercado de Fichajes</h2><p>Buscar jugadores, lista de transferibles y negociaciones (en desarrollo).</p>`; break;
            case 'finances': if (!isPresident) { contentArea.innerHTML = `<h2>Acceso Denegado</h2>`; break; } contentArea.innerHTML = `<h2>Finanzas y Patrocinadores</h2><p>Resumen de ingresos, gastos y salarios (en desarrollo).</p>`; break;
            case 'facilities': if (!isPresident) { contentArea.innerHTML = `<h2>Acceso Denegado</h2>`; break; } const stadium = clubData.stadium || { name: 'Estadio Básico', level: 1, capacity: 10000 }; contentArea.innerHTML = `<h2>Instalaciones del Club</h2><div class="facility-card"><h3>Estadio: ${stadium.name}</h3><p>Nivel: ${stadium.level} | Capacidad: ${stadium.capacity.toLocaleString()}</p><button class="menu-button" style="width: 250px; transform: skewX(0); opacity: 1;">Mejorar Estadio</button></div>`; break;
            case 'staff': if (!isPresident) { contentArea.innerHTML = `<h2>Acceso Denegado</h2>`; break; } contentArea.innerHTML = `<h2>Personal del Club</h2><p>Contratar y gestionar al Director Técnico, ojeadores, etc. (en desarrollo).</p>`; break;
            case 'job-market': if (isPresident) { contentArea.innerHTML = `<h2>Acceso Denegado</h2>`; break; } contentArea.innerHTML = `<h2>Mercado de Entrenadores</h2><p>Lista de clubes que buscan nuevo mánager (en desarrollo).</p>`; break;
            default: contentArea.innerHTML = `<h2>Sección no encontrada: ${section}</h2>`;
        }
    }
    
    function renderSquadList(playerArray, containerId, clubData) {
        const container = document.getElementById(containerId); container.className = 'player-roster'; container.innerHTML = '';
        if (!playerArray || playerArray.length === 0) { container.innerHTML = "<p>No hay jugadores en esta sección.</p>"; return; }
        const order = { 'POR': 1, 'DEF': 2, 'MED': 3, 'DEL': 4 };
        playerArray.sort((a, b) => (order[a.position] || 5) - (order[b.position] || 5) || b.rating - a.rating);
        playerArray.forEach(player => {
            const playerCard = document.createElement('div'); playerCard.className = 'player-card'; playerCard.dataset.playerId = player.id;
            playerCard.innerHTML = `<img src="${player.miniface || DEFAULT_MINIFACE_PATH}" alt="${player.name}" class="miniface-img" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_PATH}';"><div class="player-info"><span class="player-name">${player.dorsal || '#'} - ${player.name}</span><span class="player-details"><span class="player-position pos-${player.position}">${player.position}</span> | EDAD: ${player.age} | VAL: ${player.rating}</span></div>`;
            playerCard.addEventListener('click', () => showPlayerModal(player.id, clubData)); container.appendChild(playerCard);
        });
    }

    function renderDorsalEditor(clubData, containerId) {
        const container = document.getElementById(containerId);
        container.className = 'dorsal-editor-container';
        container.innerHTML = `<h2>Editor de Dorsales</h2><div class="dorsal-editor-list"></div>`;
        const list = container.querySelector('.dorsal-editor-list');

        clubData.players.sort((a, b) => (a.dorsal || 999) - (b.dorsal || 999)).forEach(player => {
            list.insertAdjacentHTML('beforeend', `<div class="dorsal-editor-row"><span class="dorsal-editor-name">${player.name} (${player.position})</span><input type="number" class="dorsal-editor-input" value="${player.dorsal || ''}" min="1" max="99" data-player-id="${player.id}"></div>`);
        });

        list.addEventListener('change', (event) => {
            const input = event.target;
            if (input.tagName !== 'INPUT') return;
            const newDorsal = parseInt(input.value, 10);
            const playerId = parseInt(input.dataset.playerId, 10);
            const playerToUpdate = clubData.players.find(p => p.id === playerId);
            const isTaken = clubData.players.some(p => p.dorsal === newDorsal && p.id !== playerId);

            if (isTaken && newDorsal) {
                alert(`El dorsal ${newDorsal} ya está en uso.`);
                input.value = playerToUpdate.dorsal || '';
            } else {
                playerToUpdate.dorsal = newDorsal || null;
                input.style.border = '1px solid #2ecc71';
                setTimeout(() => { input.style.border = ''; }, 1500);
            }
        });
    }

    function renderTacticBoard(players) {
        const board = document.getElementById('tactic-board');
        const formationSlots = ['POR', 'DEF', 'DEF', 'DEF', 'DEF', 'MED', 'MED', 'MED', 'MED', 'DEL', 'DEL'];
        const positionClasses = ['POR', 'DEF-1', 'DEF-2', 'DEF-3', 'DEF-4', 'MED-1', 'MED-2', 'MED-3', 'MED-4', 'DEL-1', 'DEL-2'];
        const bestXI = calculateBestXI(players, formationSlots);
        
        board.innerHTML = '';
        bestXI.forEach((player, index) => {
            const tokenClass = `player-token-visual token-pos-${positionClasses[index]}`;
            if (player) {
                const targetPosition = formationSlots[index];
                const adjustedRating = getAdjustedRating(player, targetPosition);
                board.innerHTML += `<div class="${tokenClass}"><img src="${player.miniface || DEFAULT_MINIFACE_PATH}" class="token-miniface" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_PATH}';"><div class="token-info pos-${targetPosition}"><div class="token-name">${player.name.split(' ').pop()}</div><div class="token-rating">${adjustedRating}</div></div></div>`;
            } else {
                board.innerHTML += `<div class="${tokenClass}"><div class="token-empty">?</div></div>`;
            }
        });
    }

    function getAdjustedRating(player, targetPosition) {
        if (player.naturalPositions.includes(targetPosition)) return player.rating;
        const mainPos = player.position;
        const penalties = { 'DEF-MED': 8, 'MED-DEF': 10, 'MED-DEL': 12, 'DEL-MED': 15, 'DEF-DEL': 20, 'DEL-DEF': 25 };
        return player.rating - (penalties[`${mainPos}-${targetPosition}`] || 30);
    }
    
    function calculateBestXI(players, formation) {
        let availablePlayers = [...players];
        let bestXI = new Array(formation.length).fill(null);
        formation.forEach((position, i) => {
            let bestPlayerForPosition = null, bestRating = -1, playerIndex = -1;
            availablePlayers.forEach((player, index) => {
                let currentRating = getAdjustedRating(player, position);
                if (currentRating > bestRating) {
                    bestRating = currentRating; bestPlayerForPosition = player; playerIndex = index;
                }
            });
            if (bestPlayerForPosition) {
                bestXI[i] = bestPlayerForPosition;
                availablePlayers.splice(playerIndex, 1);
            }
        });
        return bestXI;
    }

    function showPlayerModal(playerId, clubData) {
        const allPlayers = [...(clubData.players || []), ...(clubData.substitutes || []), ...(clubData.youthSquad || [])];
        const player = allPlayers.find(p => p.id === playerId);
        if (!player || document.querySelector('.modal-overlay')) return;
        
        const modalTemplate = document.getElementById('player-details-modal-template');
        document.body.appendChild(modalTemplate.content.cloneNode(true));
        
        const modalOverlay = document.querySelector('.modal-overlay');
        modalOverlay.querySelector('.modal-player-miniface').src = player.miniface || DEFAULT_MINIFACE_PATH;
        modalOverlay.querySelector('.modal-player-name').textContent = player.name;
        modalOverlay.querySelector('.player-dorsal-number').textContent = player.dorsal || '#';
        modalOverlay.querySelector('.player-position-tag').textContent = player.position;
        modalOverlay.querySelector('.player-position-tag').className = `player-position-tag pos-${player.position}`;
        modalOverlay.querySelector('.player-role-tag').textContent = player.role || "Sin Rol";
        modalOverlay.querySelector('.player-nationality-tag').textContent = player.nationality || "N/A";
        modalOverlay.querySelector('.player-foot-tag').textContent = `Pie: ${player.preferredFoot || "N/A"}`;
        modalOverlay.querySelector('.market-value').textContent = (player.marketValue || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
        const statsGrid = modalOverlay.querySelector('.modal-stats-grid');
        statsGrid.innerHTML = '';
        if (player.stats) for (const [stat, value] of Object.entries(player.stats)) statsGrid.innerHTML += `<div class="modal-stat"><span>${stat}</span><span class="modal-stat-value">${value}</span></div>`;
        
        modalOverlay.querySelector('.modal-close-button').addEventListener('click', closePlayerModal);
        modalOverlay.addEventListener('click', (event) => { if (event.target === modalOverlay) closePlayerModal(); });
        document.addEventListener('keydown', handleEscKey);
    }
    
    function closePlayerModal() {
        const modalOverlay = document.querySelector('.modal-overlay');
        if (modalOverlay) { modalOverlay.remove(); document.removeEventListener('keydown', handleEscKey); }
    }
    
    function handleEscKey(event) { if (event.key === 'Escape') closePlayerModal(); }

    // --- INICIALIZACIÓN ---
    importFileInput.addEventListener('change', handleFileImport);
    showSplashScreen();
});