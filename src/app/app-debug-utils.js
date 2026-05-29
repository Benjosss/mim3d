import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";

export default class AppDebugUtils{
    constructor(scene, config, stats){
        this.scene = scene;
        this.config = config;
        this.stats = stats;
    }

    buildPlayerCapsuleHelper(){
        const scene = this.scene;
        const CONFIG = this.config;

        const debugMat = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});
        const capsuleHelper = new THREE.Group();
        const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.playerRadius, CONFIG.playerRadius, CONFIG.playerHeight, 8), debugMat);
        const sphereTop = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.playerRadius, 8, 8), debugMat);
        const sphereBot = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.playerRadius, 8, 8), debugMat);
        sphereTop.position.y = CONFIG.playerHeight / 2;
        sphereBot.position.y = -CONFIG.playerHeight / 2;
        capsuleHelper.add(bodyMesh, sphereTop, sphereBot);
        capsuleHelper.visible = CONFIG.debugMode;
        scene.add(capsuleHelper);

        return capsuleHelper;
    }

    playerCapsuleHelperFollow(capsuleHelper, playerPos){
        const CONFIG = this.config;

        capsuleHelper.position.set(
            playerPos.x,
            playerPos.y + CONFIG.playerHeight / 2,
            playerPos.z
        );
    }

    buildColliderMeshesHelper(colliderMeshes){
        const scene = this.scene;

        colliderMeshes.forEach(mesh => {
            // On crée un clone visuel en fil de fer pour ne pas casser le matériau original
            const wireframeGeom = new THREE.WireframeGeometry(mesh.geometry);
            const wireframe = new THREE.LineSegments(wireframeGeom);

            // On applique la même position/rotation que le mesh original
            wireframe.matrixAutoUpdate = false;
            wireframe.matrix.copy(mesh.matrixWorld);

            // Couleur rouge pour les collisions
            wireframe.material.color.set(0xffF0F0);
            wireframe.material.opacity = 0.5;
            wireframe.material.transparent = true;

            scene.add(wireframe);
        });
    }

    createStatsPanels(){
        const stats = this.stats;

        const drawCallsPanel = new Stats.Panel("GPU calls", "#FF8000", "#221")
        stats.addPanel(drawCallsPanel);

        const zoneNumberPanel = new Stats.Panel("Zones", "#fbfbfb", "#3e3e3e")
        stats.addPanel(zoneNumberPanel);

        const geometriesCountPanel = new Stats.Panel("Geometries", "#ff5454", "#3a1d1d")
        stats.addPanel(geometriesCountPanel);

        const trianglesCountPanel = new Stats.Panel("Triangles", "#00d7ff", "#003c5a")
        stats.addPanel(trianglesCountPanel);

        stats.dom.style.display = 'flex';
        stats.dom.style.flexDirection = 'row';
        stats.dom.style.gap = '5px';

        // Affiche tous les panels
        Array.from(stats.dom.children).forEach((child) => {
            child.style.display = 'block';
        });

        return [drawCallsPanel, zoneNumberPanel, geometriesCountPanel, trianglesCountPanel];
    }

    renderDebugMessage(){
        const div = document.createElement('div');
        div.className = 'toast-notification';
        div.innerHTML = "<span style='color: red'>[MODE DEBUG]</span> <br>" +
            "<br> <span style='color: white'>=> 'F1' pour afficher l'état des zones en console</span>" +
            "<br> <span style='color: white'>=> 'F2' pour afficher les boites de collisions</span>" +
            "<br> <span style='color: white'>=> 'F3' pour afficher les coordonées actuelles en console</span> <br>" +
            "<br> <span style='color: green'>NavMesh </span> " +
            "<br> <span style='color: yellow'>TriggerBoxes </span> " +
            "<br> <span style='color: red'>Capsule joueur </span> " +
            "<br> <span style='color: rgba(255,255,255,0.62)'>Imposteurs (transparents)</span> ";
        div.style.zIndex = "9999";
        div.style.position = "absolute";
        div.style.top = "5px";
        div.style.left = "5px";
        div.style.fontSize = "20px";
        div.style.fontWeight = "bold";
        document.body.appendChild(div);

        const coordinatesDiv = document.createElement('div');
        coordinatesDiv.className = 'toast-notification';
        coordinatesDiv.innerHTML = "<span style='color: white' id='debug-coordinates'></span> <br>";
        coordinatesDiv.style.zIndex = "9999";
        coordinatesDiv.style.position = "absolute";
        coordinatesDiv.style.bottom = "5px";
        coordinatesDiv.style.right = "5px";
        coordinatesDiv.style.fontSize = "20px";
        coordinatesDiv.style.fontWeight = "bold";
        document.body.appendChild(coordinatesDiv);
    }

    showCoordinates(playerPos, camera){
        const div = document.getElementById("debug-coordinates");
        const look = new THREE.Vector3();
        camera.getWorldPosition(look);
        div.innerHTML = "<p> Position (X/Y/Z) : " + playerPos.toArray().map(c => c.toFixed(2)).join(" • ") + "<br> Regard (X/Y/Z) : " + look.toArray().map(c => c.toFixed(2)).join(" • ") + "</p>";
    }

}