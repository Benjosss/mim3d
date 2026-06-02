import * as THREE from "three";
import {Zone} from "../map-manager/zone.js";

/**
 * Classe utilitaire pour charger et transformer les fichiers JSON de configuration en objets Zone.
 */
export default class JsonParser {
    /**
     * Crée une instance de JsonParser.
     */
    constructor() {}

    /**
     * Effectue une requête fetch pour récupérer les données JSON brutes.
     * @param {string} filePath - Le chemin vers le fichier .json.
     * @returns {Promise<Object|Array>} Les données JSON parsées.
     * @throws {Error} Si le fichier est introuvable ou illisible.
     */
    fetchJSONData(filePath) {
        return fetch(filePath)
            .then(response => {
                // Vérification du statut de la réponse HTTP
                if (!response.ok) {
                    throw new Error(`Error, status : ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                return data;
            })
            .catch(error => {
                // Log de l'erreur en cas d'échec réseau ou de syntaxe JSON
                console.error('Error while fetching :', error);
            });
    }

    /**
     * Lit les données JSON et les convertit en instances de la classe Zone.
     * Gère la conversion des types simples (JSON) vers les types complexes (Three.js).
     * @param {Zone[]} ZONES - Le tableau de zones à remplir.
     * @param {string} path - Chemin du fichier JSON source.
     * @returns {Promise<Zone[]>} Le tableau de zones complété.
     */
    async fillZonesTab(ZONES, path) {
        const jsonData = await this.fetchJSONData(path);

        // Sécurité si les données sont vides ou n'ont pas pu être chargées
        if (!jsonData) {
            console.log("Zones loading error");
            return ZONES;
        }

        jsonData.forEach((zone) => {
            // Création de l'objet de base avec les propriétés communes
            const newZone = {
                name: zone.name,
                displayName: zone.displayName,
                path: zone.path,
                impostorPath: zone.impostorPath,
                physics: zone.physics,
                type: zone.type,
                description: zone.description,
                adjacentZoneNames: zone.adjacentZoneNames || [],
                // Conversion des coordonnées min/max du JSON en instance de Box3 Three.js
                triggerBox: new THREE.Box3(
                    new THREE.Vector3(...zone.triggerBox.min),
                    new THREE.Vector3(...zone.triggerBox.max)
                ),
            };

            // Traitement spécifique pour les zones qui ne sont pas des escaliers ou des couloirs
            if (zone.type !== "corridor" && zone.type !== "stairs") {
                try {
                    // Conversion des coordonnées de destination du pathfinding
                    newZone.pathCoords = new THREE.Vector3(...zone.pathCoords);
                } catch(e) {
                    console.error(`Unable to fetch target coordinates for zone ${zone.name}`, e);
                }

                // Gestion des alias (sauf pour les toilettes qui n'en ont généralement pas)
                if (zone.type !== "toilets"){
                    newZone.otherNames = zone.otherNames || [];
                }
            }

            // Traitement spécifique aux bureaux pour la gestion du personnel (occupants)
            if (zone.type === "office") {
                try {
                    newZone.persons = zone.persons || [];
                } catch(e) {
                    console.error(`Unable to fetch employees of zone ${zone.name}`, e);
                }
            }

            // Instanciation de la classe Zone et ajout au tableau global
            ZONES.push(new Zone(newZone));
        });

        return ZONES;
    }
}