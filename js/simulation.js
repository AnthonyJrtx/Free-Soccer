/**
 * ===================================================================
 * FREE SOCCER - MOTOR DE SIMULACIÓN DE PARTIDO v4.0 (FATIGA Y TIEMPO EXTRA)
 * ===================================================================
 * Este motor simula un partido basado en zonas, fatiga, lesiones,
 * mentalidades tácticas y un registro completo de eventos.
 */

class MatchSimulator {
    constructor(homeTeam, awayTeam, options, callbacks) {
        this.homeTeam = JSON.parse(JSON.stringify(homeTeam));
        this.awayTeam = JSON.parse(JSON.stringify(awayTeam));
        this.options = { realTimeDuration: (options.duration || 5) * 60 * 1000, ...options };
        this.callbacks = callbacks;

        // Inicializar estado dinámico para cada jugador al comienzo del partido
        const allPlayers = [...this.homeTeam.players, ...this.homeTeam.substitutes, ...this.awayTeam.players, ...this.awayTeam.substitutes];
        allPlayers.forEach(p => {
            p.currentStamina = 100;
            p.isInjured = false;
        });

        this.state = {
            simulatedTime: 0,
            matchDuration: 90, // Puede cambiar a 120 en tiempo extra
            score: { home: 0, away: 0 },
            isPlaying: false,
            gameInterval: null,
            addedTime: 0,
            possession: 'home',
            fieldZone: 'MIDFIELD',
            isHalfTime: false,
            halfTimeTriggered: false,
            isExtraTime: false,
            homeMentality: 'Equilibrada',
            awayMentality: 'Equilibrada',
            matchEvents: [],
            homeSubstitutions: 0,
            awaySubstitutions: 0,
            maxSubstitutions: 3
        };
        
        this.PROB_FOUL_PER_TURN = 0.02;
        this.PROB_CARD_ON_FOUL = 0.20;
        this.PROB_RED_ON_CARD = 0.05;
        this.PROB_INJURY_ON_FOUL_CRITICAL = 0.60;
    }

    // --- MÉTODOS DE CONTROL PÚBLICOS ---

    start() {
        if (this.state.isPlaying) return;
        this.state.isPlaying = true;
        this.logEvent({ type: 'Start', message: "¡El árbitro pita el inicio del partido!" });

        const tickRate = 250;
        const simTimePerTick = 90 / (this.options.realTimeDuration / tickRate);

        this.state.gameInterval = setInterval(() => {
            if (!this.state.isPlaying) return;

            if (this.state.simulatedTime >= 45 && !this.state.halfTimeTriggered) {
                this.pauseForHalfTime();
                return;
            }

            this.state.simulatedTime += simTimePerTick;
            
            if (this.state.simulatedTime < (this.state.matchDuration + this.state.addedTime)) {
                this.processTurn();
            } else {
                this.end();
            }
            this.callbacks.onTick(this.state.simulatedTime, this.state.score, this.state.addedTime, this.state.matchDuration);
        }, tickRate);
    }

    pauseForHalfTime() {
        this.state.isPlaying = false;
        this.state.isHalfTime = true;
        this.state.halfTimeTriggered = true;
        this.logEvent({ type: 'HalfTime', message: "Descanso. Los equipos se retiran a los vestuarios." });
        this.callbacks.onHalfTime();
    }

    resumeFromHalfTime() {
        if (!this.state.isHalfTime) return;
        this.state.isHalfTime = false;
        this.state.isPlaying = true;
        this.logEvent({ type: 'SecondHalf', message: "¡Comienza la segunda mitad!" });
    }

    startExtraTime() {
        if (this.state.isExtraTime) return;
        this.state.isExtraTime = true;
        this.state.matchDuration = 120;
        this.state.maxSubstitutions = 4; // Un cambio extra
        this.logEvent({type: 'Info', message: "¡Comienza el tiempo extra!"});
        // Recuperación de energía para la prórroga
        [...this.homeTeam.players, ...this.awayTeam.players].forEach(p => {
            if (!p.isInjured) {
                p.currentStamina = Math.min(100, p.currentStamina + 15);
            }
        });
        this.state.isPlaying = true;
    }

    setMentality(teamSide, mentality) {
        this.state[`${teamSide}Mentality`] = mentality;
        const teamName = teamSide === 'home' ? this.homeTeam.name : this.awayTeam.name;
        this.logEvent({type: 'Tactic', message: `${teamName} cambia a una mentalidad ${mentality}.`});
    }
    
    makeSubstitution(teamSide, playerOutId, playerInId) {
        const subsMade = this.state[`${teamSide}Substitutions`];
        if (subsMade >= this.state.maxSubstitutions) {
            this.logEvent({ type: 'Info', message: `Límite de cambios alcanzado.` });
            return false;
        }

        const team = this[teamSide + 'Team'];
        const playerOutIndex = team.players.findIndex(p => p.id === playerOutId);
        const playerInIndex = team.substitutes.findIndex(p => p.id === playerInId);

        if (playerOutIndex === -1 || playerInIndex === -1) {
            console.error("Error en la sustitución: jugador no encontrado.");
            return false;
        }

        const playerOut = team.players[playerOutIndex];
        const playerIn = team.substitutes[playerInIndex];
        team.players[playerOutIndex] = playerIn;
        team.substitutes[playerInIndex] = playerOut;

        this.state[`${teamSide}Substitutions`]++;
        this.state.addedTime += 0.5;
        this.logEvent({ type: 'Substitution', team: team, playerOut: playerOut.name, playerIn: playerIn.name, message: `Cambio en ${team.name}: sale ${playerOut.name}, entra ${playerIn.name}.` });
        return true;
    }

    end(forceEnd = false) {
        // Si es empate al final de los 90', y no estamos en prórroga, pide decisión
        if (this.state.score.home === this.state.score.away && !this.state.isExtraTime && !forceEnd) {
            this.state.isPlaying = false;
            clearInterval(this.state.gameInterval);
            this.callbacks.onDrawDecision();
            return;
        }
        
        clearInterval(this.state.gameInterval);
        this.state.isPlaying = false;
        this.logEvent({ type: 'End', message: "¡FINAL DEL PARTIDO!" });
        this.callbacks.onEnd(this.state.score, this.state.matchEvents);
    }

    // --- LÓGICA CENTRAL DE SIMULACIÓN ---

    processTurn() {
        this.updateStamina();
        const attacker = this.state.possession === 'home' ? this.homeTeam : this.awayTeam;
        const defender = this.state.possession === 'home' ? this.awayTeam : this.homeTeam;
        const attackerMentality = this.state[`${this.state.possession}Mentality`];
        const defenderMentality = this.state[`${this.state.possession === 'home' ? 'away' : 'home'}Mentality`];
        const mentalityModifier = { 'Defensiva': 0.85, 'Equilibrada': 1.0, 'Ofensiva': 1.15 };
        
        const attackerPower = this.getTeamRating(attacker, ['MED', 'DEL']) * mentalityModifier[attackerMentality];
        const defenderPower = this.getTeamRating(defender, ['DEF', 'MED']) * mentalityModifier[defenderMentality];

        if (attackerPower * Math.random() > defenderPower * Math.random()) {
             this.advanceZone(attacker, defender);
        } else {
            this.losePossession(attacker, defender);
        }

        if (Math.random() < this.PROB_FOUL_PER_TURN) {
            this.processFoul(defender, attacker);
        }
    }
    
    advanceZone(attacker, defender) {
        const zoneOrder = ['AWAY_BOX', 'AWAY_ATTACK', 'MIDFIELD', 'HOME_ATTACK', 'HOME_BOX'];
        let currentZoneIndex = zoneOrder.indexOf(this.state.fieldZone);
        
        if (this.state.fieldZone === 'HOME_BOX' || this.state.fieldZone === 'AWAY_BOX') {
            this.processShotOpportunity(attacker, defender);
            return;
        }
        
        currentZoneIndex += (this.state.possession === 'home' ? 1 : -1);
        this.state.fieldZone = zoneOrder[currentZoneIndex];
    }
    
    losePossession(attacker, defender) {
        this.state.possession = (this.state.possession === 'home') ? 'away' : 'home';
        const zoneOrder = ['AWAY_BOX', 'AWAY_ATTACK', 'MIDFIELD', 'HOME_ATTACK', 'HOME_BOX'];
        let currentZoneIndex = zoneOrder.indexOf(this.state.fieldZone);
        currentZoneIndex += (this.state.possession === 'home' ? 1 : -1);
        this.state.fieldZone = zoneOrder[Math.max(0, Math.min(zoneOrder.length - 1, currentZoneIndex))];
    }
    
    processShotOpportunity(attacker, defender) {
        const shooter = this.getWeightedRandomPlayer(attacker);
        const keeper = this.getRandomPlayer(defender, ['POR']);
        
        const shotPower = ((shooter.stats['Definición'] || 50) + (shooter.stats['Potencia'] || 50)) / 2 * this.getPerformanceModifier(shooter);
        const keeperPower = ((keeper.stats['Reflejos'] || 50) + (keeper.stats['Paradas'] || 50)) / 2 * this.getPerformanceModifier(keeper);
        const positionModifier = shooter.position === 'DEF' ? 0.7 : (shooter.position === 'MED' ? 0.9 : 1.1);
        
        if ((shotPower * positionModifier * Math.random()) > (keeperPower * (0.6 + Math.random() * 0.7))) {
            this.state.score[this.state.possession]++;
            this.state.addedTime += 0.5;
            const goalEvent = { type: 'Goal', team: attacker, scorer: shooter.name, assist: this.getWeightedRandomPlayer(attacker, [shooter.id]).name, minute: Math.floor(this.state.simulatedTime), newScore: `${this.state.score.home} - ${this.state.score.away}` };
            this.logEvent(goalEvent);
            this.callbacks.onGoal(goalEvent);
        } else {
             this.logEvent({ type: 'Shot', message: `¡Tiro de ${shooter.name} que detiene ${keeper.name}!` });
        }

        this.state.possession = (this.state.possession === 'home') ? 'away' : 'home';
        this.state.fieldZone = this.state.possession === 'home' ? 'AWAY_ATTACK' : 'HOME_ATTACK';
    }
    
    processFoul(foulingTeam, victimTeam) {
        const victimPlayer = this.getRandomPlayer(victimTeam, ['DEF', 'MED', 'DEL']);
        this.state.addedTime += 0.3;
        this.logEvent({ type: 'Foul', message: `Falta de ${foulingTeam.name} sobre ${victimPlayer.name}.` });

        if (victimPlayer.currentStamina < 10 && Math.random() < this.PROB_INJURY_ON_FOUL_CRITICAL) {
            victimPlayer.isInjured = true;
            this.state.addedTime += 1.0; // Más tiempo por lesión
            this.logEvent({type: 'Injury', team: victimTeam, player: victimPlayer.name, message: `¡${victimPlayer.name} ha caído lesionado y no puede continuar!`});
        }

        if (Math.random() < this.PROB_CARD_ON_FOUL) {
            const cardType = Math.random() < this.PROB_RED_ON_CARD ? 'Red' : 'Yellow';
            const playerFouling = this.getRandomPlayer(foulingTeam, ['DEF', 'MED']);
            this.state.addedTime += 0.5;
            const cardEvent = { type: 'Card', team: foulingTeam, player: playerFouling.name, minute: Math.floor(this.state.simulatedTime), cardType: cardType };
            this.logEvent(cardEvent);
            this.callbacks.onCard(cardEvent);
        }
    }
    
    updateStamina() {
        const allPlayers = [...this.homeTeam.players, ...this.awayTeam.players];
        allPlayers.forEach(player => {
            if (player.isInjured) return;
            const resistanceModifier = (100 - (player.stats.Resistencia || 75)) / 1000;
            const mentality = this.homeTeam.players.includes(player) ? this.state.homeMentality : this.state.awayMentality;
            const mentalityModifier = { 'Defensiva': 0.8, 'Equilibrada': 1.0, 'Ofensiva': 1.25 };
            let staminaDrain = (0.1 + resistanceModifier) * mentalityModifier[mentality];
            player.currentStamina = Math.max(0, player.currentStamina - staminaDrain);
        });
    }

    logEvent(event) {
        event.minute = Math.min(this.state.matchDuration, Math.floor(this.state.simulatedTime));
        this.state.matchEvents.push(event);
        if(event.message) this.callbacks.onEvent(event.message);
    }
    
    // --- FUNCIONES DE AYUDA ---

    getEffectiveRating(player) {
        if (player.isInjured) return 10;
        return player.rating * this.getPerformanceModifier(player);
    }
    
    getPerformanceModifier(player) {
        if (player.isInjured) return 0.1;
        const staminaPercentage = player.currentStamina / 100;
        return 0.6 + (staminaPercentage * 0.4); // Rinde al 60% como mínimo
    }

    getTeamRating(team, positions) {
        const players = team.players.filter(p => positions.includes(p.position));
        if (players.length === 0) return 60;
        const totalEffectiveRating = players.reduce((sum, p) => sum + this.getEffectiveRating(p), 0);
        return totalEffectiveRating / players.length;
    }

    getRandomPlayer(team, positions) {
        const eligiblePlayers = team.players.filter(p => positions.includes(p.position) && !p.isInjured);
        if (eligiblePlayers.length === 0) return team.players.find(p => !p.isInjured) || team.players[0];
        return eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
    }
    
    getWeightedRandomPlayer(team, excludeIds = []) {
        const eligiblePlayers = team.players.filter(p => !excludeIds.includes(p.id) && !p.isInjured);
        const forwards = eligiblePlayers.filter(p => p.position === 'DEL');
        const midfielders = eligiblePlayers.filter(p => p.position === 'MED');
        const defenders = eligiblePlayers.filter(p => p.position === 'DEF');
        const weightedPool = [...Array(6).fill(forwards).flat(), ...Array(3).fill(midfielders).flat(), ...Array(1).fill(defenders).flat()];
        if (weightedPool.length === 0) return eligiblePlayers[0] || team.players[0];
        return weightedPool[Math.floor(Math.random() * weightedPool.length)];
    }
}