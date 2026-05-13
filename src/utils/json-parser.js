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
                const newZone = {
                    name: zone.name,
                    displayName: zone.displayName,
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
                };

                if (zone.type !== "corridor" && zone.type !== "stairs") {
                    try{
                        newZone.pathCoords = new THREE.Vector3(...zone.pathCoords);
                    }catch(e){
                        console.error(`Impossible de récupérer les coordonées d'arrivée pour la zone ${zone.name}`, e);
                    }
                }

                if (zone.type === "office"){
                    try{
                        newZone.persons = [...zone.persons];
                    }catch(e){
                        console.error(`Impossible de récupérer les personnes occupants la zone ${zone.name}`, e)
                    }
                }

                ZONES.push(new Zone(newZone));
            });
        }
        return ZONES;
    }
}