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
        this.zone = "floor2"
        this.groupID = null;

        this.navmesh = null;
        this.isNavMeshLoaded = false;

        this.isMoving = false;
        this.splineCurve = null;
        this.splineProgress = 0;
        this.splineTotalLength = 0;
        this.visualPathLine = null; // Pour afficher la courbe
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

    // NAVIGATION AVEC COURBE ET AFFICHAGE
    findPathTo(name, zones) {
        let targetBox = null;
        zones.forEach(zone => {
            if (zone.name === name) return targetBox = zone.triggerBox;
        })
        let target = new THREE.Vector3();
        targetBox.getCenter(target);

        if (!this.isNavMeshLoaded) return;

        this.groupID = this.pathfinding.getGroup(this.zone, this.playerGroup.position);
        const start = this.snapToNavMesh(this.playerGroup.position);
        const end = this.snapToNavMesh(target);

        if (this.groupID !== null && start && end) {
            const path = this.pathfinding.findPath(start, end, this.zone, this.groupID);
            if (path && path.length > 0) {
                // Création de la courbe Catmull-Rom
                const points = [this.playerGroup.position.clone(), ...path];
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

                this.pathfindingHelper.reset().setPlayerPosition(start).setTargetPosition(end).setPath(path);
            }
        }
    }


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


        // Fin du déplacement
        if (this.splineProgress >= 1) {
            this.splineCurve = null;
            this.isMoving = false;
            this.playerGroup.visible = true;


            if (this.visualPathLine) {
                // this.scene.remove(this.visualPathLine); // Retire la ligne de la scène
                // this.visualPathLine.geometry.dispose(); // Libère la mémoire
                // this.visualPathLine.material.dispose();
                this.visualPathLine = null;
            }
        }
    }

}