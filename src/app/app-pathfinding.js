import {Pathfinding, PathfindingHelper} from 'three-pathfinding';
import * as THREE from "three";

export default class AppPathfinding {
    constructor(scene, camera, playerGroup, debugMode) {
        this.scene = scene;
        this.camera = camera;
        this.playerGroup = playerGroup;
        this.debugMode = debugMode;

        this.pathfinding = new Pathfinding();
        this.pathfindingHelper = new PathfindingHelper();

        this.speed = 4;
        this.zone = "fac"
        this.groupID = null;

        this.navmesh = null;
        this.isNavMeshLoaded = false;

        this.isMoving = false;
        this.splineCurve = null;
        this.splineProgress = 0;
        this.splineTotalLength = 0;
        this.visualPathLine = null; // Pour afficher la courbe
        this.smoothLookAt = null;

        this.isGuiding = false;
        this.guidingPath = null;
        this.guideDestinationName = null;
        this.guideDestinationDiplayName = null;
        this.currentSegment = null;
    }

    /**
     * Injecte la référence à playerPos après sa déclaration dans app.js.
     * @param {THREE.Vector3} playerPos
     */
    setPlayerPos(playerPos) {
        this.playerPos = playerPos;
    }

    showHelper() {
        if (this.debugMode) {
            this.scene.add(this.pathfindingHelper);
        }
    }

    loadNavMesh(path, loader) {
        loader.load(path, (gltf) => {
            let navMeshObject = null;

            gltf.scene.traverse((child) => {
                if (child.isMesh && child.geometry) {
                    navMeshObject = child;

                    child.material = new THREE.MeshBasicMaterial({
                        color: 0x00ff00,
                        transparent: true,
                        wireframe: true,
                        depthTest: true
                    });

                    this.debugMode ? child.material.opacity = 0.5 : child.material.opacity = 0;

                    child.position.y += 0.05;
                }
            });

            if (!navMeshObject) {
                console.error("Aucun mesh trouvé dans le fichier NavMesh");
                return;
            }

            // Préparation de la géométrie pour la logique de pathfinding
            navMeshObject.updateWorldMatrix(true, false);
            const geometry = navMeshObject.geometry.clone();
            geometry.applyMatrix4(navMeshObject.matrixWorld);

            // Initialisation de la zone de navigation
            this.pathfinding.setZoneData(this.zone, Pathfinding.createZone(geometry));

            // Décommenter pour voir les nodes du navmesh, LES PERFORMANCES SERONT FORTEMENT AFFECTEES
            // const zoneData = this.pathfinding.zones[this.zone];
            //
            // if (!zoneData || !zoneData.groups) {
            //     console.error("Zone navmesh invalide");
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

            // Positionnement initial du joueur
            const start = this.snapToNavMesh(new THREE.Vector3(85, 20, -3));
            if (start) this.playerGroup.position.copy(start);

            console.log("NavMesh chargé et affiché.");
        });
    }

    snapToNavMesh(position) {
        const group = this.pathfinding.getGroup(this.zone, position);
        if (group === null) return null;
        const node = this.pathfinding.getClosestNode(position, this.zone, group);
        return node ? node.centroid.clone() : null;
    }

    findAutoPathTo(name, zones) {
        if (this.isGuiding || this.isMoving) {
            alert("Un guidage est déjà en cours !");
            return;
        }

        let target = null;
        zones.forEach(zone => {
            if (zone.name === name) target = zone.pathCoords;
        })

        if (!this.isNavMeshLoaded || !target) return;

        this.groupID = this.pathfinding.getGroup(this.zone, this.playerGroup.position);
        const start = this.snapToNavMesh(this.playerGroup.position);
        const end = this.snapToNavMesh(target);

        if (this.groupID === null || !start || !end) return;

        const path = this.pathfinding.findPath(start, end, this.zone, this.groupID);

        if (!path || path.length === 0) return;

        const pathfindingZone = this.pathfinding.zones[this.zone];
        const group = pathfindingZone.groups[this.groupID];

        const THRESHOLD = 1;

        // --- Construction du chemin enrichi ---

        // Inclut le point de départ pour couvrir le premier segment
        const fullPath = [start, ...path];

        // Collecte les centroids de tous les nœuds traversés, ordonnés selon le chemin
        const orderedCentroids = this.sampleIntermediatesPoints(group, fullPath, THRESHOLD);

        if (orderedCentroids.length === 0) return;

        // Lissage laplacien : déplace les centroids vers la moyenne de leurs voisins
        // afin de s'éloigner des parois du NavMesh
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
        this.splineCurve = linearPath;
        let totalDist = 0;
        for (let i = 1; i < linearPath.length; i++) {
            totalDist += linearPath[i].distanceTo(linearPath[i - 1]);
        }
        this.splineTotalLength = totalDist; // distance réelle en unités monde
        this.splineProgress = 0;
        this.pathfindingHelper
            .reset()
            .setPlayerPosition(start)
            .setTargetPosition(end)
            .setPath(this.splineCurve);


    }

    move(delta) {
        if (!this.splineCurve || this.splineCurve.length === 0) {
            this.isMoving = false;
            return;
        }

        this.isMoving = true;
        this.playerGroup.visible = false;

        // splineProgress accumule la distance parcourue en unités monde
        this.splineProgress += this.speed * delta;

        // Cherche le point correspondant à cette distance dans le tableau
        let accumulated = 0;
        let newPos = this.splineCurve[this.splineCurve.length - 1];
        let lookAtTarget = this.splineCurve[Math.min(10, this.splineCurve.length - 1)];

        for (let i = 1; i < this.splineCurve.length; i++) {
            const segDist = this.splineCurve[i].distanceTo(this.splineCurve[i - 1]);
            if (accumulated + segDist >= this.splineProgress) {
                // Interpolation dans ce segment
                const t = (this.splineProgress - accumulated) / segDist;
                newPos = new THREE.Vector3().lerpVectors(this.splineCurve[i - 1], this.splineCurve[i], t);

                // Regarder 12 unités plus loin
                const lookIdx = Math.min(i + 12, this.splineCurve.length - 1);
                lookAtTarget = this.splineCurve[lookIdx];
                break;
            }
            accumulated += segDist;
        }

        if (!this.smoothLookAt) {
            this.smoothLookAt = lookAtTarget.clone();
        }
        this.smoothLookAt.lerp(lookAtTarget, 0.06); // 0.05 = inertie, ajuste entre 0.01 (très lent) et 0.15 (plus réactif)

        // Élève le point de regard à hauteur des yeux
        const eyeLevelTarget = this.smoothLookAt.clone();
        eyeLevelTarget.y += 1;

        this.camera.lookAt(eyeLevelTarget);

        if (this.playerPos) {
            this.playerPos.x = newPos.x;
            this.playerPos.z = newPos.z;
        }

        this.playerGroup.position.copy(newPos);

        if (document.getElementById("walkPanel").style.display === "none") {
            document.getElementById("walkPanel").style.display = "flex";
            document.getElementById("walkPanel-p").innerHTML = "Marche auto... <br> [Entrée] pour arrêter";
        }

        if (this.splineProgress >= this.splineTotalLength) {
            this.endMove();
        }
    }

    endMove() {
        this.splineCurve = null;
        this.isMoving = false;
        this.playerGroup.visible = true;
        this.smoothLookAt = null;

        document.getElementById("walkPanel").style.display = "none";
        document.getElementById("walkPanel-p").innerHTML = ""


        if (this.visualPathLine) {
            // this.scene.remove(this.visualPathLine); // Retire la ligne de la scène
            // this.visualPathLine.geometry.dispose(); // Libère la mémoire
            // this.visualPathLine.material.dispose();
            this.visualPathLine = null;
        }
    }

    /**
     * Calcule et initialise un chemin de guidage vers une destination nommée.
     *
     * Le chemin est construit en plusieurs étapes :
     *  1. Recherche des coordonnées cibles dans la liste des zones fournies.
     *  2. Calcul du chemin brut via le système de pathfinding sur le NavMesh.
     *  3. Échantillonnage des centroids de nœuds le long de chaque segment du chemin.
     *  4. Lissage laplacien pour éloigner les points des murs.
     *  5. Densification linéaire du chemin final pour un déplacement fluide.
     *
     * @param {string} name         - Identifiant unique de la destination cible.
     * @param {string} displayName  - Nom lisible affiché à l'utilisateur pendant le guidage.
     * @param {Array}  zones        - Liste des zones disponibles, chacune contenant { name, pathCoords }.
     * @returns {void}
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

        // Rayon de recherche pour associer un sample à un nœud voisin
        const THRESHOLD = 1;

        // --- Construction du chemin enrichi ---

        // Inclut le point de départ pour couvrir le premier segment
        const fullPath = [start, ...path];

        // Collecte les centroids de tous les nœuds traversés, ordonnés selon le chemin
        const orderedCentroids = this.sampleIntermediatesPoints(group, fullPath, THRESHOLD);

        if (orderedCentroids.length === 0) return;

        // Lissage laplacien : déplace les centroids vers la moyenne de leurs voisins
        // afin de s'éloigner des parois du NavMesh
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
        this.pathfindingHelper
            .reset()
            .setPlayerPosition(start)
            .setTargetPosition(end)
            .setPath(this.guidingPath);
    }

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
                const t = s / steps;
                const sample = new THREE.Vector3().lerpVectors(segStart, segEnd, t);

                // Trouver le noeud le plus proche de ce sample
                let closest = null;
                let closestDist = threshold;

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

    pushAwayFromWalls(centroids, group, iterations = 2) {
        let points = centroids.map(c => c.clone());

        for (let iter = 0; iter < iterations; iter++) {
            points = points.map((point, i) => {
                if (i === 0 || i === points.length - 1) return point; // garde start/end

                // Trouver le noeud correspondant
                const node = group.find(n => n.centroid.distanceTo(point) < 0.5);
                if (!node) return point;

                // Moyenne des centroids voisins
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

    guide(zones, current_room) {
        const guidedNavPanel = document.getElementById("guidedNavPanel");

        if (!this.guidingPath) return

        if (!this.isGuiding) {
            const crossedZones = this.getCrossedZones(zones);

            const INSTRUCTION_RULES = {
                stairs: (zone, prev, next) => {
                    let goingUp;
                    if (!prev) {
                        goingUp = next?.triggerBox.min.y > zone?.triggerBox.min.y;
                    } else {
                        goingUp = next?.triggerBox.min.y > prev?.triggerBox.min.y;
                    }
                    let deltaAlt = Math.abs(next?.triggerBox.min.y - prev?.triggerBox.min.y);
                    console.log(deltaAlt);
                    let floors = 0;
                    // TODO : Régler le seuil et uniformiser les bbox (min y) des étages
                    while (deltaAlt >= 2) {
                        floors++;
                        deltaAlt -= 2;
                    }
                    const direction = goingUp ? "Montez" : "Descendez";
                    const etages = floors <= 1 ? "étage" : "étages";
                    const etagesText = floors !== 0 ? "de " + floors + " " + etages : "";
                    return `${direction} l'escalier ${zone.displayName ?? ""} ${etagesText}`.trim();
                },
                corridor: (zone, prev, next) => `Dirigez-vous vers ${next?.displayName ?? this?.guideDestinationDiplayName ?? ""}`,
            };

            const navInstructions = document.getElementById("navInstructions");
            crossedZones.forEach((zone, index) => {
                const prev = crossedZones[index - 1] ?? null;
                const next = crossedZones[index + 1] ?? null;

                const rule = INSTRUCTION_RULES[zone.type] ?? (() => "Continuez");
                const text = rule(zone, prev, next);

                const item = document.createElement('p');
                item.innerHTML = text;

                navInstructions.appendChild(item);

                this.isGuiding = true;
                guidedNavPanel.style.display = "flex";
            });
        }

        if (this.isGuiding) {
            const nearestNode = this.getNearestGuidedPathPointFromPlayer(this.playerPos)
            const angle = this.getRelativeAngleToTarget(nearestNode);
            const angleDeg = angle * (180 / Math.PI);

            const dirInst = document.getElementById("directionInstructions");
            if(nearestNode.y < this.playerPos.y) {
                dirInst.innerHTML = "<p>Descendez l'escalier</p>";
            } else if (nearestNode.y > this.playerPos.y + 1) {
                dirInst.innerHTML = "<p>Montez l'escalier</p>";
            } else if (angleDeg > -30 && angleDeg <= 30) {
                dirInst.innerHTML = "<p>Continuez tout droit</p>";
            } else if (angleDeg > 30 && angleDeg <= 150) {
                dirInst.innerHTML = "<p>Tournez à droite</p>";
            } else if (angleDeg < -30 && angleDeg >= -150) {
                dirInst.innerHTML = "<p>Tournez à gauche</p>";
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

    getRelativeAngleToTarget(targetPos) {
        const playerPos = this.camera.position;

        // 1. Direction de la cible par rapport au joueur
        const dx = targetPos.x - playerPos.x;
        const dz = targetPos.z - playerPos.z;

        // Calcul de l'angle du monde vers la cible
        // On utilise -dz car dans Three.js, l'avant est vers -Z
        const worldTargetAngle = Math.atan2(-dz, dx);

        // 2. Direction du regard (Forward)
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);

        // Calcul de l'angle du monde du regard
        const worldLookAngle = Math.atan2(-forward.z, forward.x);

        // 3. Calcul de la différence
        let relativeAngle = worldTargetAngle - worldLookAngle;

        // 4. Normalisation stricte entre -PI et PI
        // C'est ici qu'on s'assure que "tourner à gauche" reste une valeur négative
        // et "tourner à droite" une valeur positive (ou l'inverse selon ton choix)
        while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
        while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

        // Si c'est encore inversé par rapport à ton ressenti :
        // On multiplie par -1 pour inverser le sens horaire/anti-horaire
        return -relativeAngle;
    }

    endGuide() {
        this.guidingPath = null;
        this.guideDestinationName = null;
        this.guideDestinationDiplayName = null;
        this.isGuiding = false;
        document.getElementById("guidedNavPanel").style.display = "none";
        document.getElementById("navInstructions").innerHTML = "";
        document.getElementById("walkPanel").style.display = "none";
        document.getElementById("walkPanel-p").innerHTML = "";
    }

    getCrossedZones(zones) {
        const crossedZones = [];

        this.guidingPath.forEach(node => {
            const zone = this.getZoneAtPoint(node, zones);
            if (!zone) return;

            const last = crossedZones.at(-1);
            if (!last || last.name !== zone.name) {
                crossedZones.push(zone);
            }
        });

        return crossedZones;
    }

    getZoneAtPoint(point, zones) {
        const furnitures = ["CM", "TD", "TP", "toilets", "office"]
        const candidates = zones.filter(z => z.triggerBox.containsPoint(point) && !furnitures.includes(z.type));

        if (candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];

        // En cas de superposition, prend la plus petite box (la plus précise)
        return candidates.reduce((smallest, zone) => {
            const sizeA = new THREE.Vector3();
            const sizeB = new THREE.Vector3();
            smallest.triggerBox.getSize(sizeA);
            zone.triggerBox.getSize(sizeB);
            const volA = sizeA.x * sizeA.y * sizeA.z;
            const volB = sizeB.x * sizeB.y * sizeB.z;
            return volB < volA ? zone : smallest;
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

    getNearestGuidedPathPointFromPlayer(){
        if(!this.isGuiding || !this.guidingPath || this.guidingPath.length === 0) return null;

        let closestIndex = -1
        let closestDist = Number.MAX_SAFE_INTEGER;

        this.guidingPath.forEach((node, index) => {
            const dist = node.distanceToSquared(this.playerPos);
            if (dist < closestDist) {
                closestDist = dist;
                closestIndex = index;
            }
        })

        // TODO : Nombre magique = 12 ! A ajuster
        const aheadIndex = Math.min(closestIndex + 12, this.guidingPath.length - 1);

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

        const closestNode = this.getNearestGuidedPathPointFromPlayer(this.playerPos);
        if (!closestNode) return;

        const points = [this.playerPos, closestNode];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x0000FF, linewidth: 10 });

        // 2. Assigner le nouveau segment à notre variable de classe
        this.currentSegment = new THREE.Line(geometry, material);
        this.scene.add(this.currentSegment);
    }
}