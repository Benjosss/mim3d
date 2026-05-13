export class PersonSearcher {
    constructor(zones, pathfinding, onNavigate) {
        this.zones = zones;
        this.pathfinding = pathfinding;
        this.onNavigate = onNavigate;
    }


    // ================= RESEARCH =================

    zoneSearchByString(str) {
        str = str.toLowerCase();

        const filteredZones = this.zones.filter(zone => {
            if (zone.type !== "office") return false;
            return zone.persons.some(person => person.toLowerCase().includes(str));
        });

        // Trie par la première personne du bureau
        return filteredZones.sort((a, b) =>
            a.persons[0].localeCompare(b.persons[0], "fr")
        );
    }

    /**
     * Fonction principale de mise à jour des résultats
     */
    updateRoomSearch() {
        const searchInput = document.querySelector('#searchBar-p input');
        const resultsList = document.getElementById('personResultsList');
        if (!searchInput || !resultsList) return;

        const searchText = searchInput.value;

        const results = this.zoneSearchByString(searchText);



        // On vide et on remplit
        resultsList.innerHTML = "";
        results.forEach(zone => {
            const searchText = document.querySelector('#searchBar-p input').value.toLowerCase();
            const matched = zone.persons.filter(p => p.toLowerCase().includes(searchText));
            const others  = zone.persons.filter(p => !p.toLowerCase().includes(searchText));
            const display = [...matched, ...others].join(", ");

            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
            <div class="result-info">
                <span class="material-symbols-outlined icon-main">person</span>
                <div>
                    <span class="room-name">${display}</span>
                    <span class="room-details">${zone.displayName} - ${zone.description}</span>
                </div>
            </div>
            <div class="result-actions">
                <span class="material-symbols-outlined">directions_walk</span>
                <button class="btn-action guided-btn">Guidé</button>
                <button class="btn-action auto-btn">Automatique</button>
            </div>
            `;

            item.querySelector('.guided-btn').addEventListener('click', () => {
                alert('Cette fonctionnalité sera bientôt disponible !');
            });
            // Bouton Automatique
            item.querySelector('.auto-btn').addEventListener('click', () => {
                if (this.onNavigate) this.onNavigate();
                this.pathfinding.findPathTo(zone.name, this.zones);
            });
            resultsList.appendChild(item);
        });
    }

}