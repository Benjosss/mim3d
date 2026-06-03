import { Pathfinding, PathfindingHelper } from 'three-pathfinding';
import * as THREE from "three";

/**
 * Gestion du pathfinding et de la navigation assistée via NavMesh.
 * * Cette classe gère le chargement du maillage de navigation (NavMesh), le calcul
 * de trajectoires fluides (lissage laplacien), ainsi que deux modes de navigation :
 * 1. Marche automatique : déplacement cinématique du joueur le long d'une courbe.
 * 2. Guidage visuel : affichage d'un tracé au sol et d'instructions directionnelles.
 *
 * @class AppPathfinding
 */
export default class AppPathfinding {
    /**
     * @param {THREE.Scene}  scene         - Scène Three.js pour l'affichage des helpers et tracés.
     * @param {THREE.Camera} camera        - Caméra pour l'orientation du regard en mode auto.
     * @param {THREE.Group}  playerGroup   - Groupe 3D représentant le joueur.
     * @param {boolean}      debugMode     - Active l'affichage visuel du NavMesh.
     */
    constructor(scene, camera, playerGroup, debugMode) {
        this.scene = scene;
        this.camera = camera;
        this.playerGroup = playerGroup;
        this.debugMode = debugMode;

        /** @type {boolean} État d'affichage du tracé visuel (tube 3D). */
        this.showPath = document.getElementById('settings-show-path').checked;

        this.pathfinding = new Pathfinding();
        this.pathfindingHelper = new PathfindingHelper();

        this.speed = 4;                 // Vitesse de déplacement en unités/seconde
        this.zone = "fac";              // Identifiant de la zone de navigation
        this.groupID = null;            // ID du groupe (îlot) de navigation actuel
        this.navmesh = null;
        this.isNavMeshLoaded = false;

        this.isMoving = false;          // État du déplacement automatique
        this.targetZoneCenter = new THREE.Vector3();
        this.splineCurve = null;        // Tableau de points formant le chemin lisse
        this.splineProgress = 0;        // Progression actuelle (en unités de distance)
        this.splineTotalLength = 0;     // Longueur totale du chemin
        this.visualPathLine = null;     // Mesh (Tube) représentant le chemin visuel
        this.smoothLookAt = null;       // Cible du regard lissée pour la caméra

        this.isGuiding = false;         // État du guidage visuel actif
        this.guidingPath = null;
        this.guideDestinationName = null;
        this.guideDestinationDiplayName = null;
        this.currentSegment = null;
    }

    /** @type {number} Nombre de points d'anticipation pour le calcul du regard. */
    LOOK_AHEAD_INDEX = 12;

    /**
     * Injecte la référence de position du joueur.
     * @param {THREE.Vector3} playerPos - Position partagée du joueur.
     */
    setPlayerPos(playerPos) {
        this.playerPos = playerPos;
    }

    /**
     * Ajoute l'aide visuelle du pathfinding à la scène si le mode debug est actif.
     */
    showHelper() {
        if (this.debugMode) {
            this.scene.add(this.pathfindingHelper);
        }
    }

    /**
     * Charge le fichier GLTF du NavMesh et initialise les données de zone.
     * @param {string} path - URL du fichier GLTF.
     * @param {THREE.GLTFLoader} loader - Instance du chargeur.
     */
    loadNavMesh(path, loader) {
        loader.load(path, (gltf) => {
            let navMeshObject = null;

            // Parcours pour trouver le mesh de navigation
            gltf.scene.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    navMeshObject = child;

                    // Matériau de visualisation (semi-transparent en debug)
                    child.material = new THREE.MeshBasicMaterial({
                        color: 0x00ff00,
                        transparent: true,
                        wireframe: true,
                        depthTest: true
                    });

                    this.debugMode ? child.material.opacity = 0.5 : child.material.opacity = 0;

                    // Élévation légère pour éviter la superposition parfaite avec le sol
                    child.position.y += 0.05;
                }
            });

            if (!navMeshObject) {
                console.error("No navMesh object found.");
                return;
            }

            // Transformation de la géométrie dans l'espace monde pour le pathfinding
            navMeshObject.updateWorldMatrix(true, false);
            const geometry = navMeshObject.geometry.clone();
            geometry.applyMatrix4(navMeshObject.matrixWorld);

            // Création de la structure de données spatiale (BVH interne à three-pathfinding)
            this.pathfinding.setZoneData(this.zone, Pathfinding.createZone(geometry));

            // Décommenter pour voir les nodes du navmesh, LES PERFORMANCES SERONT FORTEMENT AFFECTEES
            // const zoneData = this.pathfinding.zones[this.zone];
            //
            // if (!zoneData || !zoneData.groups) {
            //     console.error("Invalid NavMesh");
            //     return;
            // }
            //
            // zoneData.groups.forEach((group) => {
            //     group.forEach((node) => {
            //         const centroid = node.centroid;
            //
            //         const sphere = new THREE.Mesh(
            //             new THREE.SphereGeometry(0.1, 8, 8),
            //             new THREE.MeshBasicMaterial({ color: 0xff0000 })
            //         );
            //
            //         sphere.position.copy(centroid);
            //         this.scene.add(sphere);
            //     });
            // });

            this.navmesh = navMeshObject;
            this.isNavMeshLoaded = true;

            this.scene.add(gltf.scene);

            // Recalage initial du joueur sur le NavMesh au point (0,0,0)
            const start = this.snapToNavMesh(new THREE.Vector3(0, 0, 0));
            if (start) this.playerGroup.position.copy(start);
        });
    }

    /**
     * Projette une position 3D sur le point le plus proche du NavMesh.
     * @param {THREE.Vector3} position - Position source.
     * @returns {THREE.Vector3|null} Position recalée ou null.
     */
    snapToNavMesh(position) {
        // Trouve l'îlot (groupe) de navigation sous la position
        const group = this.pathfinding.getGroup(this.zone, position);
        if (group === null) return null;
        // Trouve le triangle (node) le plus proche
        const node = this.pathfinding.getClosestNode(position, this.zone, group);
        return node ? node.centroid.clone() : null;
    }

    /**
     * Calcule un chemin fluide pour la marche automatique.
     * @param {string} name - Nom de la zone de destination.
     * @param {Array}  zones - Liste des zones de déclenchement.
     */
    findAutoPathTo(name, zones) {
        if (this.isGuiding || this.isMoving) {
            alert("Un guidage est déjà en cours !");
            return;
        }

        // --- Résolution de la cible ---
        let target = null;
        zones.forEach(zone => {
            if (zone.name === name){
                target = zone.pathCoords;
                zone.triggerBox.getCenter(this.targetZoneCenter);
            }
        })

        if (!this.isNavMeshLoaded || !target) return;

        // --- Calcul du chemin A* ---
        this.groupID = this.pathfinding.getGroup(this.zone, this.playerGroup.position);
        const start = this.snapToNavMesh(this.playerGroup.position);
        const end = this.snapToNavMesh(target);

        if (this.groupID === null || !start || !end) return;

        // Retourne les points de passage bruts (sommets de triangles)
        const path = this.pathfinding.findPath(start, end, this.zone, this.groupID);

        if (!path || path.length === 0) return;

        const pathfindingZone = this.pathfinding.zones[this.zone];
        const group = pathfindingZone.groups[this.groupID];


        // --- Construction du chemin enrichi ---

        // Inclut le point de départ pour couvrir le premier segment
        const fullPath = [start, ...path];
        // 1. Échantillonnage des centres de triangles traversés
        const orderedCentroids = this.sampleIntermediatesPoints(group, fullPath, 1);
        if (orderedCentroids.length === 0) return;

        // 2. Éloignement des centres par rapport aux murs (Lissage Laplacien)
        const safeCentroids = this.pushAwayFromWalls(orderedCentroids, group, 3);

        // 3. Densification : création d'une liste de points à intervalle régulier (0.5m)
        const linearPath = [];
        const allPoints = [this.playerGroup.position.clone(), ...safeCentroids];

        allPoints.forEach((point, i) => {
            if (i === 0) return;
            const prev = allPoints[i - 1];
            const steps = Math.ceil(prev.distanceTo(point) / 0.5);

            for (let s = 0; s <= steps; s++) {
                linearPath.push(new THREE.Vector3().lerpVectors(prev, point, s / steps));
            }
        });

        // --- Préparation des données de mouvement ---
        this.splineCurve = linearPath;
        let totalDist = 0;
        for (let i = 1; i < linearPath.length; i++) {
            totalDist += linearPath[i].distanceTo(linearPath[i - 1]);
        }
        this.splineTotalLength = totalDist;
        this.splineProgress = 0;

        // Mise à jour visuelle des outils de debug
        this.pathfindingHelper.reset().setPlayerPosition(start).setTargetPosition(end).setPath(this.splineCurve);

        if (this.showPath) {
            this._createVisualPath(linearPath);
        }
    }

    /**
     * Boucle de mise à jour du mouvement automatique (appelée à chaque frame).
     * @param {number} delta - Temps écoulé.
     * @param {Object} fpsPlayer - Contrôleur du joueur.
     */
    move(delta, fpsPlayer) {
        if (!this.splineCurve || this.splineCurve.length === 0) {
            this.isMoving = false;
            return;
        }

        this.isMoving = true;
        this.playerGroup.visible = false; // Masquage du modèle pour la vue caméra

        // Avancement sur la distance totale
        this.splineProgress += this.speed * delta;

        // Cherche le point correspondant à cette distance dans le tableau
        let accumulated = 0;
        let newPos = this.splineCurve[this.splineCurve.length - 1];
        let lookAtTarget = this.splineCurve[Math.min(10, this.splineCurve.length - 1)];

        // Recherche du segment correspondant à la progression actuelle
        for (let i = 1; i < this.splineCurve.length; i++) {
            const segDist = this.splineCurve[i].distanceTo(this.splineCurve[i - 1]);
            if (accumulated + segDist >= this.splineProgress) {
                // Interpolation précise entre deux points du chemin
                const t = (this.splineProgress - accumulated) / segDist;
                newPos = new THREE.Vector3().lerpVectors(this.splineCurve[i - 1], this.splineCurve[i], t);

                // Détermination du point de regard (anticipation)
                const lookIdx = Math.min(i + this.LOOK_AHEAD_INDEX, this.splineCurve.length - 1);
                lookAtTarget = this.splineCurve[lookIdx];
                break;
            }
            accumulated += segDist;
        }

        // Lissage de l'orientation (Interpolation de la cible du regard)
        if (!this.smoothLookAt) this.smoothLookAt = lookAtTarget.clone();
        this.smoothLookAt.lerp(lookAtTarget, 0.06);

        // Élévation du regard à 1m (hauteur d'yeux)
        const eyeLevelTarget = this.smoothLookAt.clone();
        eyeLevelTarget.y += 1;

        this.camera.lookAt(eyeLevelTarget);

        // Synchronisation des positions logique et visuelle
        if (this.playerPos) {
            this.playerPos.x = newPos.x;
            this.playerPos.z = newPos.z;
        }
        this.playerGroup.position.copy(newPos);

        const panel = document.getElementById("walkPanel");
        // Affichage de l'interface de contrôle
        if (panel.style.display === "none") {
            panel.style.display = "flex";
            document.getElementById("walkPanel-p").innerHTML = "Marche auto... <br> [Entrée] pour arrêter";
        }

        // Condition d'arrêt
        if (this.splineProgress >= this.splineTotalLength) {
            this.endMove(fpsPlayer);
        }
    }

    /**
     * Termine la marche automatique et lance l'animation finale.
     * @param {Object} fpsPlayer - Contrôleur du joueur.
     */
    endMove(fpsPlayer) {
        this.camera.lookAt(this.targetZoneCenter);
        this.targetZoneCenter = new THREE.Vector3();
        this.splineCurve = null;
        this.isMoving = false;
        this.playerGroup.visible = true;
        this.smoothLookAt = null;

        // Déclenchement de l'animation de geste (montrer la pièce)
        const gestureAction = fpsPlayer.model.userData.actions['pointing'];

        if (gestureAction) {
            gestureAction.reset().setLoop(THREE.LoopOnce).play();
        }

        document.getElementById("walkPanel").style.display = "none";
        document.getElementById("walkPanel-p").innerHTML = "";

        this._clearVisualPath();
    }

    /**
     * Initialise un guidage visuel vers une destination.
     */
    findGuidedPathTo(name, displayName, zones) {
        // Empêche le lancement d'un nouveau guidage si un déplacement ou guidage est déjà en cours
        if (this.isGuiding || this.isMoving) {
            alert("Un guidage est déjà en cours !");
            return;
        }

        // --- Résolution de la destination ---
        let target = null;
        this.guideDestinationName = name;
        this.guideDestinationDiplayName = displayName;

        zones.forEach(zone => {
            if (zone.name === name) target = zone.pathCoords;
        });

        // Abandon si le NavMesh n'est pas chargé ou si la destination est introuvable
        if (!this.isNavMeshLoaded || !target) return;

        // --- Initialisation du pathfinding ---

        // Détermine le groupe de navigation correspondant à la position actuelle du joueur
        this.groupID = this.pathfinding.getGroup(this.zone, this.playerGroup.position);

        // Snap des positions de départ et d'arrivée sur le NavMesh
        const start = this.snapToNavMesh(this.playerGroup.position);
        const end = this.snapToNavMesh(target);

        if (this.groupID === null || !start || !end) return;

        // --- Calcul du chemin brut ---

        // Retourne un tableau de Vector3 représentant les waypoints du chemin
        const path = this.pathfinding.findPath(start, end, this.zone, this.groupID);
        if (!path || path.length === 0) return;

        // Récupère les nœuds du groupe de navigation actif
        const pathfindingZone = this.pathfinding.zones[this.zone];
        const group = pathfindingZone.groups[this.groupID];

        // Construction du chemin avec lissage identique à la marche auto
        const fullPath = [start, ...path];
        const orderedCentroids = this.sampleIntermediatesPoints(group, fullPath, 1);
        const safeCentroids = this.pushAwayFromWalls(orderedCentroids, group, 2);

        // --- Densification linéaire du chemin final ---

        // Interpole linéairement entre chaque centroid pour obtenir
        // un chemin dense et régulier (1 point toutes les 0.5 unités)
        const linearPath = [];
        const allPoints = [this.playerGroup.position.clone(), ...safeCentroids];

        allPoints.forEach((point, i) => {
            if (i === 0) return;
            const prev = allPoints[i - 1];
            const steps = Math.ceil(prev.distanceTo(point) / 0.5);

            for (let s = 0; s <= steps; s++) {
                linearPath.push(new THREE.Vector3().lerpVectors(prev, point, s / steps));
            }
        });

        // Stocke le chemin final et met à jour le helper de visualisation
        this.guidingPath = linearPath;
        this.pathfindingHelper.reset().setPlayerPosition(start).setTargetPosition(end).setPath(this.guidingPath);

        if (this.showPath) {
            this._createVisualPath(linearPath);
        }
    }

    /**
     * Extrait les centres des triangles traversés par un chemin pour un tracé fluide.
     * @returns {THREE.Vector3[]}
     */
    sampleIntermediatesPoints(group, path, threshold, density = 0.8) {
        const visitedNodes = new Set();
        const orderedCentroids = [];

        path.forEach((point, i) => {
            if (i === 0) return;
            const segStart = path[i - 1];
            const segEnd = point;

            // Subdiviser chaque segment en sous-points
            const segLength = segStart.distanceTo(segEnd);
            const steps = Math.ceil(segLength / density);

            for (let s = 0; s <= steps; s++) {
                const sample = new THREE.Vector3().lerpVectors(segStart, segEnd, s / steps);
                let closest = null;
                let closestDist = threshold;

                // On cherche quel triangle du NavMesh se trouve sous ce point échantillonné
                group.forEach(node => {
                    const d = node.centroid.distanceTo(sample);
                    if (d < closestDist) {
                        closestDist = d;
                        closest = node;
                    }
                });

                if (closest && !visitedNodes.has(closest)) {
                    visitedNodes.add(closest);
                    orderedCentroids.push(closest.centroid.clone());
                }
            }
        });

        return orderedCentroids;
    }

    /**
     * Pousse les points vers le centre des polygones pour éviter de raser les murs.
     * @returns {THREE.Vector3[]}
     */
    pushAwayFromWalls(centroids, group, iterations = 2) {
        let points = centroids.map(c => c.clone());

        for (let iter = 0; iter < iterations; iter++) {
            points = points.map((point, i) => {
                if (i === 0 || i === points.length - 1) return point;

                // Trouver le noeud correspondant
                const node = group.find(n => n.centroid.distanceTo(point) < 0.5);
                if (!node) return point;

                // Moyenne de position entre le point et ses voisins de navigation
                const neighbourCentroids = node.neighbours
                    .map(id => group[id])
                    .filter(Boolean)
                    .map(n => n.centroid);

                if (neighbourCentroids.length === 0) return point;

                const avg = new THREE.Vector3();
                neighbourCentroids.forEach(c => avg.add(c));
                avg.divideScalar(neighbourCentroids.length);

                // Déplace légèrement vers la moyenne
                return point.clone().lerp(avg, 0.5);
            });
        }
        return points;
    }

    /**
     * Met à jour les instructions textuelles et directionnelles du guidage.
     */
    guide(zones, current_room) {
        const guidedNavPanel = document.getElementById("guidedNavPanel");

        if (!this.guidingPath) return;

        // --- Phase Initiale : Calcul des étapes (Escaliers, couloirs) ---
        if (!this.isGuiding) {
            const crossedZones = this.getCrossedZones(zones);

            const INSTRUCTION_RULES = {
                stairs: (zone, prev, next) => {
                    let goingUp = (next?.triggerBox.min.y ?? zone?.triggerBox.min.y) > (prev?.triggerBox.min.y ?? zone?.triggerBox.min.y);
                    let deltaAlt = Math.abs(next?.triggerBox.min.y - prev?.triggerBox.min.y);
                    let floors = Math.floor(deltaAlt / 2.8);
                    const direction = goingUp ? "Montez" : "Descendez";
                    const etagesText = floors > 0 ? ` de ${floors} étage${floors > 1 ? 's' : ''}` : "";
                    return `${direction} l'escalier ${zone.displayName ?? ""} ${etagesText}`.trim();
                },
                corridor: (zone, prev, next) => `Dirigez-vous vers ${next?.displayName ?? this?.guideDestinationDiplayName ?? ""}`,
            };

            const navInstructions = document.getElementById("navInstructions");
            crossedZones.forEach((zone, index) => {
                const rule = INSTRUCTION_RULES[zone.type] ?? (() => "Continuez");
                const item = document.createElement('p');
                item.innerHTML = rule(zone, crossedZones[index - 1], crossedZones[index + 1]);
                navInstructions.appendChild(item);
            });

            this.isGuiding = true;
            guidedNavPanel.style.display = "flex";
        }

        // --- Phase Dynamique : Calcul des flèches/directions relatives ---
        if (this.isGuiding) {
            const nearestNode = this.getNearestGuidedPathPointFromPlayer();
            const angle = this.getRelativeAngleToTarget(nearestNode);
            const angleDeg = angle * (180 / Math.PI);

            const nextZone = this.getZoneAtPoint(nearestNode, zones);
            const dirInst = document.getElementById("directionInstructions");

            // Détermination de l'instruction selon l'angle et l'altitude relative
            if(nearestNode.y < this.playerPos.y) {
                dirInst.innerHTML = "<p>Descendez l'escalier</p>";
            } else if (nearestNode.y > this.playerPos.y + 1) {
                dirInst.innerHTML = "<p>Montez l'escalier</p>";
            } else if (angleDeg > -30 && angleDeg <= 30) {
                dirInst.innerHTML = `<p>Continuez tout droit vers '${nextZone?.displayName || "la suite"}'</p>`;
            } else if (angleDeg > 30 && angleDeg <= 150) {
                dirInst.innerHTML = `<p>Tournez à droite vers '${nextZone?.displayName || "la suite"}'</p>`;
            } else if (angleDeg < -30 && angleDeg >= -150) {
                dirInst.innerHTML = `<p>Tournez à gauche vers '${nextZone?.displayName || "la suite"}'</p>`;
            } else {
                dirInst.innerHTML = "<p>Retournez-vous</p>";
            }


            if (guidedNavPanel.style.display === "none") {
                guidedNavPanel.style.display = "flex";
            }

            if (document.getElementById("walkPanel").style.display === "none") {
                document.getElementById("walkPanel").style.display = "flex";
                document.getElementById("walkPanel-p").innerHTML = "Marche guidée... <br> [Entrée] pour arrêter";
            }

            if (current_room.name === this.guideDestinationName) {
                this.endGuide();
            }
        }
    }

    /**
     * Calcule l'angle relatif (en radians) entre le regard de la caméra et un point cible.
     * @returns {number} Angle normalisé entre -PI et PI.
     */
    getRelativeAngleToTarget(targetPos) {
        const playerPos = this.camera.position;

        // 1. Direction de la cible par rapport au joueur
        const dx = targetPos.x - playerPos.x;
        const dz = targetPos.z - playerPos.z;

        // Angle du monde vers la cible
        const worldTargetAngle = Math.atan2(-dz, dx);

        // Direction actuelle de la caméra
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);

        // 2. Calcul de l'angle du monde du regard
        const worldLookAngle = Math.atan2(-forward.z, forward.x);

        // 3. Calcul de la différence
        let relativeAngle = worldTargetAngle - worldLookAngle;

        // Normalisation stricte
        while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
        while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

        // Si c'est encore inversé par rapport à ton ressenti :
        // On multiplie par -1 pour inverser le sens horaire/anti-horaire
        return -relativeAngle;
    }

    /**
     * Arrête le guidage et nettoie l'interface.
     */
    endGuide() {
        this.guidingPath = null;
        this.guideDestinationName = null;
        this.guideDestinationDiplayName = null;
        this.isGuiding = false;
        document.getElementById("guidedNavPanel").style.display = "none";
        document.getElementById("navInstructions").innerHTML = "";
        document.getElementById("walkPanel").style.display = "none";
        this._clearVisualPath();
    }

    /**
     * Analyse le chemin de guidage pour lister les zones traversées sans doublon.
     * @returns {Array} Liste des objets zones.
     */
    getCrossedZones(zones) {
        const crossedZones = [];
        this.guidingPath.forEach(node => {
            const zone = this.getZoneAtPoint(node, zones);
            if (!zone) return;
            const last = crossedZones.at(-1);
            if (!last || last.name !== zone.name) crossedZones.push(zone);
        });
        return crossedZones;
    }

    /**
     * Trouve la zone (salle/escalier) contenant un point 3D.
     * @returns {Object|null}
     */
    getZoneAtPoint(point, zones) {
        const furnitures = ["CM", "TD", "TP", "toilets", "office", "misc"]
        const candidates = zones.filter(z => z.triggerBox.containsPoint(point) && !furnitures.includes(z.type));

        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        // Retourne la zone avec le plus petit volume pour plus de précision (emboîtement)
        return candidates.reduce((smallest, zone) => {
            const sizeA = new THREE.Vector3(), sizeB = new THREE.Vector3();
            smallest.triggerBox.getSize(sizeA);
            zone.triggerBox.getSize(sizeB);
            return (sizeB.x * sizeB.y * sizeB.z) < (sizeA.x * sizeA.y * sizeA.z) ? zone : smallest;
        });
    }

    getInstructionsText(current_room) {
        const title = current_room.displayName + " vers " + this.guideDestinationDiplayName;
        const texte = document.getElementById("navInstructions").innerText;
        return title + "\n\r" + texte;
    }

    getInstructionsTitle(current_room) {
        return current_room.displayName + " vers " + this.guideDestinationDiplayName;
    }

    /**
     * Trouve le point du chemin de guidage situé juste devant le joueur pour les calculs.
     * @returns {THREE.Vector3|null}
     */
    getNearestGuidedPathPointFromPlayer(){
        if(!this.isGuiding || !this.guidingPath || this.guidingPath.length === 0) return null;

        let closestIndex = -1, closestDist = Infinity;

        this.guidingPath.forEach((node, index) => {
            const dist = node.distanceToSquared(this.playerPos);
            if (dist < closestDist) {
                closestDist = dist;
                closestIndex = index;
            }
        })

        // On renvoie un point situé "LOOK_AHEAD" index plus loin pour anticiper la direction
        const aheadIndex = Math.min(closestIndex + this.LOOK_AHEAD_INDEX, this.guidingPath.length - 1);
        return this.guidingPath[aheadIndex];
    }

    showNearestPointSegment() {
        if (this.currentSegment) {
            this.scene.remove(this.currentSegment);
            this.currentSegment.geometry.dispose();  // Libère la mémoire de la géométrie
            this.currentSegment.material.dispose();  // Libère la mémoire du matériau
            this.currentSegment = null;
        }

        if (!this.isGuiding || !this.guidingPath || this.guidingPath.length === 0) return;

        const closestNode = this.getNearestGuidedPathPointFromPlayer();
        if (!closestNode) return;

        const points = [this.playerPos, closestNode];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 10 });

        // 2. Assigner le nouveau segment à notre variable de classe
        this.currentSegment = new THREE.Line(geometry, material);
        this.scene.add(this.currentSegment);
    }

    /**
     * Crée un tube 3D pour visualiser le chemin dans la scène.
     * @private
     */
    _createVisualPath(linearPath) {
        this._clearVisualPath();

        // Réduction du nombre de points pour la performance (max 100 segments)
        const step = Math.max(1, Math.floor(linearPath.length / 100));
        const tubePoints = linearPath.filter((_, i) => i % step === 0);
        if (tubePoints.at(-1) !== linearPath.at(-1)) tubePoints.push(linearPath.at(-1));

        const curve = new THREE.CatmullRomCurve3(tubePoints, false, 'centripetal', 0.5);
        const tubeGeo = new THREE.TubeGeometry(curve, tubePoints.length * 2, 0.1, 10, false);
        const tubeMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.75,
            depthWrite: false
        });

        this.visualPathLine = new THREE.Mesh(tubeGeo, tubeMat);
        this.scene.add(this.visualPathLine);
    }

    /**
     * Supprime le tracé visuel et libère la mémoire GPU.
     * @private
     */
    _clearVisualPath() {
        if (this.visualPathLine) {
            this.scene.remove(this.visualPathLine);
            this.visualPathLine.geometry.dispose();
            this.visualPathLine.material.dispose();
            this.visualPathLine = null;
        }
    }
}