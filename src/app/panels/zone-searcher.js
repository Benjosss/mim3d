export class ZoneSearcher {
    constructor(zones, pathfinding, onNavigate) {
        this.zones = zones;
        this.pathfinding = pathfinding;
        this.onNavigate = onNavigate;
    }

    // ================= RESEARCH =================

    zoneSearchByString(str){
        str = str.toLowerCase();
        const filteredZones = this.zones.filter(zone => {
            const matchDisplayName = zone.displayName.toLowerCase().includes(str);

            const matchOtherNames = zone.otherNames.some(name =>
                name.toLowerCase().includes(str)
            );

            return matchDisplayName || matchOtherNames;
        });        return filteredZones.sort((a,b) => a.displayName.localeCompare(b.displayName, "fr"));
    }

    zonesFilterByType(types, zones){
        let filteredZones = [];
        zones.forEach((zone) => {
            types.forEach((type) => {
                if(zone.type === type) {
                    filteredZones.push(zone);
                }
            })
        })
        return filteredZones;
    }

    zoneSearchAndFilter(str, types){
        return this.zonesFilterByType(types, this.zoneSearchByString(str));
    }

    /**
     * Fonction principale de mise à jour des résultats
     */
    updateRoomSearch() {
        const searchInput = document.querySelector('#searchBar input');
        const resultsList = document.getElementById('resultsList');
        if (!searchInput || !resultsList) return;

        const searchText = searchInput.value.toLowerCase();

        // Récupère les types cochés
        const selectedTypes = Array.from(document.querySelectorAll('#roomFilters .chip.selected'))
            .map(chip => chip.getAttribute('data-type'));

        const results = this.zoneSearchAndFilter(searchText, selectedTypes);

        // On vide et on remplit
        resultsList.innerHTML = "";
        results.forEach(zone => {
            // Choisi l'icone selon le type de salle
            let icon = "meeting_room";
            if(zone.type === "office"){
                icon = "person";
            }
            if(zone.type === "toilets"){
                icon = "wc";
            }
            if(zone.type === "misc"){
                icon = "distance";
            }

            let title = zone.displayName;
            let des = zone.description;
            if(zone.type === "office"){
                const personNames = zone.persons.map(p => p.name).join(", ");
                des = zone.description + " - " + personNames;
            }
            if(zone.otherNames.length > 0){
                const otherNames = zone.otherNames.join(" • ");
                title = zone.displayName + " • " + otherNames;
            }

            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
            <div class="result-info">
                <span class="material-symbols-outlined icon-main">${icon}</span>
                <div>
                    <span class="room-name">${title}</span>
                    <span class="room-details">${des}</span>
                </div>
            </div>
            <div class="result-actions">
                <span class="material-symbols-outlined">directions_walk</span>
                <button class="btn-action guided-btn">Guidé</button>
                <button class="btn-action auto-btn">Automatique</button>
            </div>
            `;

            item.querySelector('.guided-btn').addEventListener('click', () => {
                if (this.onNavigate) this.onNavigate();
                this.pathfinding.findGuidedPathTo(zone.name, zone.displayName, this.zones);
            });
            // Bouton Automatique
            item.querySelector('.auto-btn').addEventListener('click', () => {
                if (this.onNavigate) this.onNavigate();
                this.pathfinding.findAutoPathTo(zone.name, this.zones);
            });
            resultsList.appendChild(item);
        });
    }
}