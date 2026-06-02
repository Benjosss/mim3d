/**
 * Gère la recherche et l'affichage des personnes (membres du personnel) au sein des zones.
 */
export class PersonSearcher {
    /**
     * @param {Array<Object>} zones - Liste des données de zones/bureaux.
     * @param {Object} pathfinding - Instance du moteur de calcul d'itinéraire.
     * @param {Function} onNavigate - Callback exécuté lors du lancement d'une navigation.
     */
    constructor(zones, pathfinding, onNavigate) {
        this.zones = zones;
        this.pathfinding = pathfinding;
        this.onNavigate = onNavigate;
    }

    // ================= RECHERCHE =================

    /**
     * Filtre les zones de type "office" pour trouver des personnes par nom ou fonction.
     * @param {string} str - La chaîne de caractères à rechercher.
     * @returns {Array<Object>} Liste des zones filtrées et triées par nom.
     */
    zoneSearchByString(str) {
        // Normalise la recherche en minuscules
        str = str.toLowerCase();

        const filteredZones = this.zones.filter(zone => {
            // On ne recherche que dans les bureaux
            if (zone.type !== "office") return false;

            // Vérifie si au moins une personne correspond au nom ou à la fonction
            return zone.persons.some(person =>
                person.name.toLowerCase().includes(str) ||
                person.function.toLowerCase().includes(str)
            );
        });

        // Trie alphabétiquement par le nom de la zone (bureau)
        return filteredZones.sort((a, b) =>
            a.name.localeCompare(b.name, "fr")
        );
    }

    /**
     * Méthode principale qui lit l'input de recherche, filtre les résultats
     * et met à jour dynamiquement la liste dans le DOM.
     */
    updateRoomSearch() {
        // Récupération des éléments DOM nécessaires
        const searchInput = document.querySelector('#searchBar-p input');
        const resultsList = document.getElementById('personResultsList');

        // Sécurité si les éléments ne sont pas encore chargés
        if (!searchInput || !resultsList) return;

        const searchText = searchInput.value;
        const results = this.zoneSearchByString(searchText);

        // On vide la liste actuelle avant de la reconstruire
        resultsList.innerHTML = "";

        results.forEach(zone => {
            const str = searchText.toLowerCase();

            // On récupère uniquement les personnes de la zone qui matchent la recherche
            const matched = zone.persons.filter(p =>
                p.name.toLowerCase().includes(str) ||
                p.function.toLowerCase().includes(str)
            );

            matched.forEach(person => {
                // Création de l'élément de résultat
                const item = document.createElement('div');
                item.className = 'result-item';
                item.innerHTML = `
                <div class="result-info">
                    <span class="material-symbols-outlined icon-main">person</span>
                    <div>
                        <span class="room-name">${person.name}</span>
                        <span class="room-details">${zone.displayName} - ${person.function}</span>
                    </div>
                </div>
                <div class="result-actions">
                    <span class="material-symbols-outlined">directions_walk</span>
                    <button class="btn-action guided-btn">Guidé</button>
                    <button class="btn-action auto-btn">Automatique</button>
                </div>
                `;

                // Événement pour le mode "Guidé" (manuel/étape par étape)
                item.querySelector('.guided-btn').addEventListener('click', () => {
                    if (this.onNavigate) this.onNavigate();
                    this.pathfinding.findGuidedPathTo(zone.name, zone.displayName, this.zones);
                });

                // Événement pour le mode "Automatique" (déplacement autonome)
                item.querySelector('.auto-btn').addEventListener('click', () => {
                    if (this.onNavigate) this.onNavigate();
                    this.pathfinding.findAutoPathTo(zone.name, this.zones);
                });

                resultsList.appendChild(item);
            });
        });
    }
}