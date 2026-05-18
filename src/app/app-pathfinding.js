import {Pathfinding, PathfindingHelper} from 'three-pathfinding';
import * as THREE from "three";

export default class AppPathfinding {
    constructor(scene, camera, playerGroup) {
        this.scene = scene;
        this.camera = camera;
        this.playerGroup = playerGroup;

        this.pathfinding = new Pathfinding();
        this.pathfindingHelper = new PathfindingHelper();

        this.speed = 5;
        this.zone = "fac"
        this.groupID = null;

        this.navmesh = null;
        this.isNavMeshLoaded = false;

        this.isMoving = false;
        this.splineCurve = null;
        this.splineProgress = 0;
        this.splineTotalLength = 0;
        this.visualPathLine = null; // Pour afficher la courbe

        this.isGuiding = false;
        this.guidingPath = null;
        this.guideDestinationName = null;
        this.guideDestinationDiplayName = null;
    }

    /**
     * Injecte la référence à playerPos après sa déclaration dans app.js.
     * @param {THREE.Vector3} playerPos
     */
    setPlayerPos(playerPos) {
        this.playerPos = playerPos;
    }

    showHelper() {
        this.scene.add(this.pathfindingHelper);
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
                        opacity: 0,
                        wireframe: true,
                        depthTest: true // Garde true pour voir où il s'enfonce dans le décor
                    });

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

    // NAVIGATION AUTOMATIQUE AVEC COURBE ET AFFICHAGE
    findAutoPathTo(name, zones) {
        let target = null;
        zones.forEach(zone => {
            if(zone.name === name) return target = zone.pathCoords;
        })


        if (!this.isNavMeshLoaded) return;

        this.groupID = this.pathfinding.getGroup(this.zone, this.playerGroup.position);
        const start = this.snapToNavMesh(this.playerGroup.position);
        const end = this.snapToNavMesh(target);

        if (this.groupID !== null && start && end) {
            const path = this.pathfinding.findPath(start, end, this.zone, this.groupID);
            if (path && path.length > 0) {
                // Création de la courbe Catmull-Rom
                const smooth = this.smoothPath(path);
                const points = [this.playerGroup.position.clone(), ...smooth];
                this.splineCurve = new THREE.CatmullRomCurve3(points, false, 'chordal');
                this.splineTotalLength = this.splineCurve.getLength();
                this.splineProgress = 0;

                // --- AFFICHAGE DE LA VRAIE COURBE ---
                if (this.visualPathLine) {
                    this.scene.remove(this.visualPathLine);
                    this.visualPathLine.geometry.dispose();
                }
                const curvePoints = this.splineCurve.getPoints(50); // 50 points pour un lissage propre
                const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
                const material = new THREE.LineBasicMaterial({color: 0x00ffff, linewidth: 2});
                this.visualPathLine = new THREE.Line(geometry, material);
                this.scene.add(this.visualPathLine);
                // ------------------------------------

                document.getElementById("walkPanel").style.display = "flex";
                document.getElementById("walkPanel-p").innerHTML = "Marche auto..."
                this.pathfindingHelper.reset().setPlayerPosition(start).setTargetPosition(end).setPath(path);
            }
        }
    }

    smoothPath(path) {
        const smoothed = [];
        for (let i = 0; i < path.length - 1; i++) {
            const current = path[i];
            const next = path[i + 1];

            smoothed.push(current);

            // point intermédiaire
            const mid = new THREE.Vector3().addVectors(current, next).multiplyScalar(0.5);
            smoothed.push(mid);
        }
        smoothed.push(path[path.length - 1]);
        return smoothed;
    }


    // TODO : Pouvoir annuler mouvement automatique
    move(delta) {
        if (!this.splineCurve || this.splineTotalLength <= 0) {
            this.isMoving = false;
            return;
        }

        this.isMoving = true
        this.playerGroup.visible = false;

        this.splineProgress = Math.min(
            this.splineProgress + (this.speed * delta) / this.splineTotalLength,
            1
        );

        const t = this.splineCurve.getUtoTmapping(this.splineProgress, null);
        const newPos = this.splineCurve.getPoint(t);


        // Calcul d'un point un tout petit peu plus loin sur la courbe (+5% de progression)
        const lookAtProgress = Math.min(this.splineProgress + 0.05, 1);
        const lookAtT = this.splineCurve.getUtoTmapping(lookAtProgress, null);
        const lookAtTarget = this.splineCurve.getPoint(lookAtT);

        // On fait regarder la caméra vers ce point cible
        this.camera.lookAt(lookAtTarget);

        // Position physique (FPS)
        if (this.playerPos) {
            // On garde le Y actuel (physique) pour éviter les snaps
            if (this.playerPos) {
                this.playerPos.x = newPos.x;
                this.playerPos.z = newPos.z;
            }
        }

        // Modèle visuel
        this.playerGroup.position.copy(newPos);


        if (this.isMoving &&  document.getElementById("walkPanel").style.display === "none") {
            document.getElementById("walkPanel").style.display = "flex";
            document.getElementById("walkPanel-p").innerHTML = "Marche auto..."
        }


        // Fin du déplacement
        if (this.splineProgress >= 1) {
            this.splineCurve = null;
            this.isMoving = false;
            this.playerGroup.visible = true;

            document.getElementById("walkPanel").style.display = "none";
            document.getElementById("walkPanel-p").innerHTML = ""


            if (this.visualPathLine) {
                // this.scene.remove(this.visualPathLine); // Retire la ligne de la scène
                // this.visualPathLine.geometry.dispose(); // Libère la mémoire
                // this.visualPathLine.material.dispose();
                this.visualPathLine = null;
            }
        }
    }

    findGuidedPathTo(name, displayName, zones) {
        let target = null;
        this.guideDestinationName = name;
        this.guideDestinationDiplayName = displayName;
        zones.forEach(zone => {
            if (zone.name === name) return target = zone.pathCoords;
        });

        if (!this.isNavMeshLoaded || !target) return;

        this.groupID = this.pathfinding.getGroup(this.zone, this.playerGroup.position);
        const start = this.snapToNavMesh(this.playerGroup.position);
        const end   = this.snapToNavMesh(target);

        if (this.groupID !== null && start && end) {
            const path = this.pathfinding.findPath(start, end, this.zone, this.groupID);

            if (path && path.length > 0) {
                // Construit la spline sur le chemin brut
                const spline = new THREE.CatmullRomCurve3(
                    [this.playerGroup.position.clone(), ...path],
                    false, 'chordal'
                );

                // Densité constante : 1 point tous les 0.5 unités
                const nbPoints = Math.ceil(spline.getLength() / 0.5);
                this.guidingPath = spline.getPoints(nbPoints);


                document.getElementById("walkPanel").style.display = "flex";
                document.getElementById("walkPanel-p").innerHTML = "Marche guidée...";
                this.pathfindingHelper.reset().setPlayerPosition(start).setTargetPosition(end).setPath(path);
            }
        }
    }

    // TODO : Pouvoir annuler guidage
    guide(zones, current_room) {
        const guidedNavPanel = document.getElementById("guidedNavPanel");

        if (!this.guidingPath) return

        if(!this.isGuiding){
            const crossedZones = this.getCrossedZones(zones);

            const INSTRUCTION_RULES = {
                stairs: (zone, prev, next) => {
                    const goingUp = next?.triggerBox.min.y > zone.triggerBox.min.y;
                    let deltaAlt = Math.abs(next?.triggerBox.min.y - prev?.triggerBox.min.y);
                    console.log(deltaAlt);
                    let floors = 0;
                    // TODO : Régler le seuil et uniformiser les bbox (min y) des étages
                    while(deltaAlt >= 2){
                        floors++;
                        deltaAlt -= 2;
                    }
                    const direction = goingUp ? "Montez" : "Descendez";
                    const etages     = floors <= 1 ? "étage" : "étages";
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

        if(this.isGuiding){
            if (guidedNavPanel.style.display === "none"){
                guidedNavPanel.style.display = "flex";
            }

            if (document.getElementById("walkPanel").style.display === "none") {
                document.getElementById("walkPanel").style.display = "flex";
                document.getElementById("walkPanel-p").innerHTML = "Marche guidée...";
            }

            if(current_room.name === this.guideDestinationName){
                this.guidingPath = null;
                this.guideDestinationName = null;
                this.guideDestinationDiplayName = null;
                this.isMoving = false;
                document.getElementById("guidedNavPanel").style.display = "none";
                document.getElementById("walkPanel").style.display = "none";
                document.getElementById("walkPanel-p").innerHTML = "";
            }
        }
    }

    getCrossedZones(zones){
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

    getInstructionsText(current_room){
        const title = current_room.displayName + " vers " + this.guideDestinationDiplayName;
        const texte = document.getElementById("navInstructions").innerText;
        return title + "\n\r" + texte;
    }

    getInstructionsTitle(current_room){
        return current_room.displayName + " vers " + this.guideDestinationDiplayName;
    }
}