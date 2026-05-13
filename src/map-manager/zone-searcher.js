export class ZoneSearcher {
    constructor(zones, pathfinding, onNavigate) {
        this.zones = zones;
        this.pathfinding = pathfinding;
        this.onNavigate = onNavigate;
    }

    /**
     * Affiche toutes les zones triées par types
     */
    printHierarchy() {
        const zones = this.zones;

        let types = [];
        let sort = [];
        zones.forEach((zone) => {
            if(!types.includes(zone.type)) {
                types.push(zone.type);
            }
        })
        types.forEach((type) => {
            zones.forEach((zone) => {
                if(zone.type === type) {
                    sort.push({
                        name: zone.name,
                        type: zone.type,
                        description: zone.description,
                    });
                }
            })
        })
        console.table(types);
        console.table(sort);
    }

    /**
     * Affiche toutes les zones dont le type est le paramètre type
     * @param type
     */
    printHierarchyByType(type) {
        const zones = this.zones;

        let sort = [];
        zones.forEach((zone) => {
            if(zone.type === type) {
                sort.push({
                    name: zone.name,
                    type: zone.type,
                    description: zone.description,
                });
            }
        })
        console.table(sort);
    }

    // ================= RESEARCH =================

    zoneSearchByString(str){
        str = str.toLowerCase();
        const filteredZones = this.zones.filter(zone => zone.displayName.toLowerCase().includes(str));
        return filteredZones.sort((a,b) => a.displayName.localeCompare(b.displayName, "fr"));
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

            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
            <div class="result-info">
                <span class="material-symbols-outlined icon-main">${icon}</span>
                <div>
                    <span class="room-name">${zone.displayName}</span>
                    <span class="room-details">${zone.description || 'x places'}</span>
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