/**
 * Gère la recherche, le filtrage par type et l'affichage des lieux/salles (zones).
 */
export class ZoneSearcher {
    /**
     * @param {Array<Object>} zones - Liste complète des zones de la map.
     * @param {Object} pathfinding - Instance du moteur de calcul d'itinéraire.
     * @param {Function} onNavigate - Callback de fermeture/nettoyage de l'UI lors de la navigation.
     */
    constructor(zones, pathfinding, onNavigate) {
        this.zones = zones;
        this.pathfinding = pathfinding;
        this.onNavigate = onNavigate;
    }

    // ================= RECHERCHE =================

    /**
     * Filtre les zones selon une chaîne de caractères (nom principal ou alias).
     * @param {string} str - Texte de recherche.
     * @returns {Array<Object>} Zones correspondantes triées par nom d'affichage.
     */
    zoneSearchByString(str){
        str = str.toLowerCase();
        const filteredZones = this.zones.filter(zone => {
            // Vérifie le nom d'affichage
            const matchDisplayName = zone.displayName.toLowerCase().includes(str);

            // Vérifie les autres noms possibles (alias)
            const matchOtherNames = zone.otherNames.some(name =>
                name.toLowerCase().includes(str)
            );

            return matchDisplayName || matchOtherNames;
        });

        return filteredZones.sort((a,b) => a.displayName.localeCompare(b.displayName, "fr"));
    }

    /**
     * Filtre un tableau de zones selon leurs types (bureaux, toilettes, etc.).
     * @param {Array<string>} types - Liste des types acceptés.
     * @param {Array<Object>} zones - Le tableau de zones à filtrer.
     * @returns {Array<Object>}
     */
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

    /**
     * Combine la recherche textuelle et le filtrage par catégorie.
     * @param {string} str - Texte de recherche.
     * @param {Array<string>} types - Types sélectionnés.
     * @returns {Array<Object>}
     */
    zoneSearchAndFilter(str, types){
        return this.zonesFilterByType(types, this.zoneSearchByString(str));
    }

    /**
     * Met à jour la liste des résultats dans le DOM en fonction de l'input
     * et des filtres (chips) sélectionnés.
     */
    updateRoomSearch() {
        const searchInput = document.querySelector('#searchBar input');
        const resultsList = document.getElementById('resultsList');
        if (!searchInput || !resultsList) return;

        const searchText = searchInput.value.toLowerCase();

        // Récupère les types cochés dans l'interface (filtres sous forme de "chips")
        const selectedTypes = Array.from(document.querySelectorAll('#roomFilters .chip.selected'))
            .map(chip => chip.getAttribute('data-type'));

        const results = this.zoneSearchAndFilter(searchText, selectedTypes);

        // Nettoyage de la liste UI
        resultsList.innerHTML = "";

        results.forEach(zone => {
            // Attribution dynamique de l'icône selon le type
            let icon = "meeting_room";
            if(zone.type === "office") icon = "person";
            if(zone.type === "toilets") icon = "wc";
            if(zone.type === "misc") icon = "distance";

            let title = zone.displayName;
            let des = zone.description;

            // Enrichissement de la description si c'est un bureau (ajoute les noms des occupants)
            if(zone.type === "office"){
                const personNames = zone.persons.map(p => p.name).join(", ");
                des = zone.description + " - " + personNames;
            }

            // Affichage des alias dans le titre s'ils existent
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

            // Setup des actions de navigation
            item.querySelector('.guided-btn').addEventListener('click', () => {
                if (this.onNavigate) this.onNavigate();
                this.pathfinding.findGuidedPathTo(zone.name, zone.displayName, this.zones);
            });

            item.querySelector('.auto-btn').addEventListener('click', () => {
                if (this.onNavigate) this.onNavigate();
                this.pathfinding.findAutoPathTo(zone.name, this.zones);
            });

            resultsList.appendChild(item);
        });
    }
}