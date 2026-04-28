import {Zone} from "../map-manager/zone.js";
import * as THREE from "three";

export default class JsonParser {
    /**
     * Constructeur du parseur
     */
    constructor() {
    }

    /**
     * Lit et parse le fichier de données
     * @returns {Promise<any>}
     */
    fetchJSONData(filePath) {
        return fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur, statut : ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                return data;
            })
            .catch(error => {
                console.error('Erreur lors de la récupération :', error);
            });
    }

    /**
     * Rempli le tableau des zones à partir du fichier de données
     * @param ZONES Tableau de zones
     * @param path Fichier de données
     * @returns {Promise<*>}
     */
    async fillZonesTab(ZONES, path) {
        const jsonData = await this.fetchJSONData(path);

        if (!jsonData) {
            console.log("Impossible de charger les zones");
        } else {
            jsonData.forEach((zone) => {
                ZONES.push(
                    new Zone({
                        name: zone.name,
                        path: zone.path,
                        impostorPath: zone.impostorPath,
                        physics: zone.physics,
                        type: zone.type,
                        description: zone.description,
                        adjacentZoneNames: zone.adjacentZoneNames || [],
                        triggerBox: new THREE.Box3(
                            new THREE.Vector3(...zone.triggerBox.min),
                            new THREE.Vector3(...zone.triggerBox.max)
                        ),
                    })
                );
            });
        }
        return ZONES;
    }
}