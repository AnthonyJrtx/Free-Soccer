// CREA UN NUEVO ARCHIVO: js/dimension_creator.js

class DimensionCreator {
    constructor(container, onFinishCallback) {
        this.container = container;
        this.onFinish = onFinishCallback; // Función a llamar al terminar (ej. volver al menú principal)
        this.dimension = {
            dimensionName: "",
            continents: []
        };
        this.currentStep = 0;
        
        // Bancos de nombres para la generación automática
        this.nameBanks = {
            prefixes: ["Real", "Atlético", "Deportivo", "Sporting", "United", "City", "Wanderers", "FC", "SC"],
            locations: ["Capital", "Norte", "Sur", "Costa", "Montaña", "Valle", "Río", "Puerto"],
            surnames: ["Rojo", "Blanco", "Azul", "Verde", "Dorado", "Plateado"],
            playerFirstNames: ["Alex", "Bruno", "Carlos", "David", "Esteban", "Fabio", "Gael", "Hugo", "Ivan", "Javier"],
            playerLastNames: ["García", "López", "Pérez", "Sánchez", "Romero", "Díaz", "Torres", "Vega", "Reyes", "Cruz"]
        };

        this.init();
    }

    init() {
        this.attachEventListeners();
        this.showStep(0);
    }

    attachEventListeners() {
        this.container.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            const mode = button.dataset.creationMode;

            // Navegación principal
            if (mode === 'step-by-step') this.showStep(1);
            if (mode === 'automatic') this.showStep('auto');
            if (action === 'back-to-step-0') this.showStep(0);
            if (action === 'back-to-dimension-menu') this.onFinish();

            // Lógica de generación y exportación
            if (button.id === 'start-auto-generation') this.handleAutoGeneration();
            if (button.id === 'export-dimension-btn') this.exportDimension();
        });
    }

    showStep(step) {
        this.currentStep = step;
        this.container.querySelectorAll('.creator-step').forEach(s => s.classList.remove('active-step'));
        const nextStepEl = this.container.querySelector(`.creator-step[data-step="${step}"]`);
        if (nextStepEl) nextStepEl.classList.add('active-step');
    }

    // --- GENERACIÓN AUTOMÁTICA ---
    handleAutoGeneration() {
        const name = document.getElementById('auto-dim-name').value || "Dimensión Automática";
        const numContinents = parseInt(document.getElementById('auto-num-continents').value);
        const numCountries = parseInt(document.getElementById('auto-num-countries').value);
        const numLeagues = parseInt(document.getElementById('auto-num-leagues').value);
        const numClubs = parseInt(document.getElementById('auto-num-clubs').value);
        
        this.dimension.dimensionName = name;
        this.dimension.continents = [];

        for (let i = 0; i < numContinents; i++) {
            const continent = this.generateContinent(i);
            for (let j = 0; j < numCountries; j++) {
                const country = this.generateCountry(j);
                for (let k = 0; k < numLeagues; k++) {
                    const league = this.generateLeague(k);
                    for (let l = 0; l < numClubs; l++) {
                        const club = this.generateClub(l);
                        league.clubs.push(club);
                    }
                    country.leagues.push(league);
                }
                continent.countries.push(country);
            }
            this.dimension.continents.push(continent);
        }

        console.log("Dimensión generada automáticamente:", this.dimension);
        this.exportDimension(); // Exportar directamente después de generar
    }
    
    // --- MÉTODOS DE GENERACIÓN DE DATOS ALEATORIOS ---
    
    generateName(type) {
        const { prefixes, locations, surnames, playerFirstNames, playerLastNames } = this.nameBanks;
        const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

        switch(type) {
            case 'continent': return `${randomItem(locations)}ia`;
            case 'country': return `${randomItem(surnames)}landia`;
            case 'league': return `Liga ${randomItem(prefixes)} ${randomItem(locations)}`;
            case 'club': return `${randomItem(prefixes)} ${randomItem(locations)} ${randomItem(surnames)}`;
            case 'player': return `${randomItem(playerFirstNames)} ${randomItem(playerLastNames)}`;
            default: return "Nombre Aleatorio";
        }
    }

    generateContinent(index) {
        return { id: `cont_${index}`, name: this.generateName('continent'), countries: [] };
    }

    generateCountry(index) {
        return { id: `country_${index}`, name: this.generateName('country'), reputation: 50 + Math.floor(Math.random() * 20), leagues: [] };
    }
    
    generateLeague(index) {
        const tiers = ['A', 'B', 'C', 'D'];
        return { id: `league_${index}`, name: this.generateName('league'), tier: tiers[index], reputation: 40 + Math.floor(Math.random() * 20), clubs: [] };
    }

    generateClub(index) {
        const club = {
            id: `club_auto_${Date.now()}_${index}`,
            name: this.generateName('club'),
            logo: 'assets/images/logos/clubes/default.png', // Logo por defecto
            money: 500000 + Math.floor(Math.random() * 2000000),
            reputation: 30 + Math.floor(Math.random() * 30),
            stadium: { name: "Estadio Municipal", level: 1, capacity: 5000 + Math.floor(Math.random() * 10000) },
            players: [],
            youthSquad: []
        };
        // Generar 22 jugadores para el primer equipo
        for (let i = 0; i < 22; i++) {
            club.players.push(this.generatePlayer());
        }
        return club;
    }

    generatePlayer() {
        const positions = ["POR", "DEF", "MED", "DEL"];
        const pos = positions[Math.floor(Math.random() * positions.length)];
        return {
            id: `player_auto_${Date.now()}_${Math.random()}`,
            name: this.generateName('player'),
            age: 18 + Math.floor(Math.random() * 12),
            dorsal: 1 + Math.floor(Math.random() * 98),
            naturalPositions: [pos],
            position: pos,
            rating: 45 + Math.floor(Math.random() * 25),
            role: "Jugador de Plantilla",
            marketValue: 100000 + Math.floor(Math.random() * 500000),
            nationality: "Auto-Generado",
            preferredFoot: Math.random() > 0.5 ? "Derecho" : "Izquierdo",
            stats: { Stat1: 50, Stat2: 50, Stat3: 50 } // Stats simplificados
        };
    }

    // --- LÓGICA DE EXPORTACIÓN ---
    async exportDimension() {
        // Necesitas incluir la librería JSZip en tu HTML
        // <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
        const zip = new JSZip();
        
        // 1. Añadir el archivo JSON principal
        const dimensionName = this.dimension.dimensionName.replace(/\s/g, '_');
        zip.file("dimension.json", JSON.stringify(this.dimension, null, 2));

        // (Opcional) Aquí iría la lógica para añadir imágenes subidas por el usuario
        // Por ahora, solo exportamos el JSON.
        
        // 2. Generar el archivo .zip en memoria
        const content = await zip.generateAsync({ type: "blob" });

        // 3. Descargar el archivo
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = `${dimensionName}.fsd`; // Usamos una extensión personalizada
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`¡Dimensión "${this.dimension.dimensionName}" exportada con éxito!`);
        this.showStep('final'); // Mostrar pantalla de finalización
    }
}