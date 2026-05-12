import * as THREE from 'three';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast} from 'three-mesh-bvh';
import jsonParser from "../utils/json-parser.js"
import {ZoneManager} from '../map-manager/zone-manager.js'
import SceneSetup from "./app-scene-setup.js";
import InitLoader from "../utils/init-loader.js";
import AppFpsPlayer from "./app-fps-player.js";
import AppDebugUtils from "./app-debug-utils.js";
import AppPhysicsBvh from "./app-physics-bvh.js";
import AppPathfinding from "./app-pathfinding.js";

// Monkey-patch Three.js
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const DEBUG_STATS = true;
const DEBUG_BBOX_COLOR = false;

// ================= CONFIG =================
const CONFIG = {
    startZone: 'floor0hall',
    spawnPoint: new THREE.Vector3(65, 5.5, -32),
    playerRadius: 0.4,
    playerHeight: 1.3,
    moveSpeed: 8,
    gravity: 30,
    debugCapsule: false,
};
// --- Chrono ---
const t0 = performance.now();

// ================= DÉFINITION DES ZONES =================
let ZONES = [];
const parser = new jsonParser();
ZONES = await parser.fillZonesTab(ZONES, "/data/zones.json")

// ================= SCENE SETUP =================
const sceneSetup = new SceneSetup(CONFIG);

const scene = sceneSetup.getScene();
sceneSetup.buildSky();
sceneSetup.buildLights();
const camera = sceneSetup.buildCamera();
sceneSetup.buildCrossHair(camera);
const renderer = sceneSetup.buildRenderer();
sceneSetup.initResize(camera, renderer);

const debugUtil = new AppDebugUtils(scene, CONFIG);

// ================= TOOLS =================
const stats = new Stats();
if (DEBUG_STATS) {
    document.body.appendChild(stats.dom);
}

// Debug capsule
const capsuleHelper = debugUtil.buildPlayerCapsuleHelper();

let currentOverlay = "menu";

// ================= CONTROLS =================
const menuPanel = document.getElementById('menuPanel');
const infosPanel = document.getElementById('infosPanel');
const keyBindPanel = document.getElementById("keyBindPanel");
const walkPanel = document.getElementById("walkPanel");
const helpPanel = document.getElementById("helpPanel");
const settingsPanel = document.getElementById("settingsPanel");
const roomFindPanel = document.getElementById("roomFindPanel");
const personFindPanel = document.getElementById("personFindPanel");
const startButton = document.getElementById('startButton');
const helpButton = document.getElementById('helpButton');
const settingsButton = document.getElementById('settingsButton');
const controls = new PointerLockControls(camera, renderer.domElement);

startButton?.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
    if (menuPanel) menuPanel.style.display = 'none';
    if (helpPanel) helpPanel.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'none';
    if (roomFindPanel) roomFindPanel.style.display = 'none';
    if (personFindPanel) personFindPanel.style.display = 'none';
    if (infosPanel) infosPanel.style.display = 'flex';
    if (keyBindPanel) keyBindPanel.style.display = 'flex';
});
controls.addEventListener('unlock', () => {
    if (menuPanel) menuPanel.style.display = 'none';
    if (infosPanel) infosPanel.style.display = 'none';
    if (keyBindPanel) keyBindPanel.style.display = 'none';
    if (walkPanel) walkPanel.style.display = 'none';


    switch (currentOverlay) {
        case 'room':
            if (roomFindPanel) roomFindPanel.style.display = 'flex';
            break;
        case 'person':
            if (personFindPanel) personFindPanel.style.display = 'flex';
            break;
        case 'help':
            if (helpPanel) helpPanel.style.display = 'flex';
            break;
        case 'settings' :
            if (settingsPanel) settingsPanel.style.display = 'flex';
            break;
        default:
            if (menuPanel) menuPanel.style.display = 'flex';
    }
});

helpButton?.addEventListener('click', () => {
    controls.lock();
    currentOverlay = "help";
    controls.unlock();
});
settingsButton?.addEventListener('click', () => {
    controls.lock();
    currentOverlay = "settings";
    controls.unlock();
})


// ================= LOAD ASSETS =================
const gltfLoader = new InitLoader().initGltfLoader();

// ================= CHARGEMENT DU PERSONNAGE =================
const fpsPlayer = new AppFpsPlayer(scene, gltfLoader, camera, CONFIG);
const player = fpsPlayer.initFpsCharacter("/models/characters/woman_anim.glb");

// ================= ZONE MANAGER =================
// On passe colliderMeshes au ZoneManager
// Il y ajoute/retire les meshes de collision selon les zones visibles
const colliderMeshes = [];
const zoneManager = new ZoneManager({scene, loader: gltfLoader, colliderMeshes});
zoneManager.registerMultiZones(ZONES);
if (DEBUG_BBOX_COLOR) {
    ZONES.forEach(zone => {
        const helper = new THREE.Box3Helper(zone.triggerBox, 0xffff00);
        scene.add(helper);
    });
}
await zoneManager.init(CONFIG.startZone);

// ================= PATHFINDING =================

const pathfinding = new AppPathfinding(scene, camera, player);
pathfinding.showHelper();
pathfinding.loadNavMesh("/models/navmeshes/navmesh_mesh.glb", gltfLoader);

// ================= PHYSIQUE =================
const timer = new THREE.Timer();

// La capsule est représentée par sa position (centre bas) + rayon + hauteur.
const playerPos = CONFIG.spawnPoint.clone();  // position du bas de la capsule
pathfinding.setPlayerPos(playerPos);
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = false;

const _capsuleBottom = new THREE.Vector3();
const _capsuleTop = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

const bvhPhysicsUtils = new AppPhysicsBvh(CONFIG, camera, colliderMeshes,
    playerPos, playerVelocity, playerDirection,
    playerOnFloor, _capsuleTop, _capsuleBottom, _normal, _matrix);


// ================= INPUT (AZERTY) =================
const keyMap = {};
document.addEventListener('keydown', e => keyMap[e.code] = true);
document.addEventListener('keyup', e => keyMap[e.code] = false);

document.addEventListener('keydown', e => {
    if (e.code === 'F1') {
        e.preventDefault();
        CONFIG.debugCapsule = !CONFIG.debugCapsule;
        capsuleHelper.visible = CONFIG.debugCapsule;
        console.log(`Capsule debug : ${CONFIG.debugCapsule ? 'ON' : 'OFF'}`);
    }
    if (e.code === 'F2') {
        e.preventDefault();
        zoneManager.getStatus(); // Affiche le tableau des zones dans la console
    }
    if (e.code === 'F3') {
        e.preventDefault();
        debugUtil.buildColliderMeshesHelper(colliderMeshes);
    }
    if (e.code === 'F4') {
        e.preventDefault();
        zoneManager.printHierarchy();
    }
    if (e.code === 'F6') {
        e.preventDefault();
        zoneManager.printHierarchyByType("TD");
    }
    if (e.code === 'F7') {
        e.preventDefault();
        pathfinding.findPathTo("BN2-005", ZONES)
    }
    if (e.code === 'F8') {
        e.preventDefault();
        pathfinding.findPathTo("ARJ-015", ZONES)
    }
    if (e.code === 'F9') {
        e.preventDefault();
        pathfinding.findPathTo("Petit-Amphi", ZONES)
    }
    if (e.code === 'KeyF') {
        e.preventDefault();
        if (currentOverlay === "room") {
            controls.lock();
            currentOverlay = "menu";
        } else {
            if (controls.isLocked) {
                currentOverlay = "room";
                controls.unlock();
            }
        }
    }
    if (e.code === 'KeyQ') {
        e.preventDefault();
        if (currentOverlay === "person") {
            controls.lock();
            currentOverlay = "menu";
        } else {
            if (controls.isLocked) {
                currentOverlay = "person";
                controls.unlock();
            }
        }
    }
    if (e.code === 'KeyH') {
        e.preventDefault();
        if (currentOverlay === "help") {
            controls.lock();
            currentOverlay = "menu";
        } else {
            if (controls.isLocked) {
                currentOverlay = "help";
                controls.unlock();
            }
        }
    }
    if (e.code === 'KeyP') {
        e.preventDefault();
        if (currentOverlay === "settings") {
            controls.lock();
            currentOverlay = "menu";
        } else {
            if (controls.isLocked) {
                currentOverlay = "settings";
                controls.unlock();
            }
        }
    }
});

// --- Fin du chrono ---
const t1 = performance.now();
console.log(`⏱️ Temps de chargement total : ${((t1 - t0) / 1000).toFixed(3)} secondes.`);

// ================= BOUCLE DE RENDU =================
function animate(timestamp) {
    requestAnimationFrame(animate);

    timer.update(timestamp);
    const deltaTime = Math.min(0.05, timer.getDelta());


    // Mise à jour du mixer
    if (fpsPlayer.mixer) fpsPlayer.mixer.update(deltaTime);

    if (controls.isLocked) {
        const speed = CONFIG.moveSpeed;
        const yVel = playerVelocity.y;
        playerVelocity.set(0, yVel, 0);

        const isKeyboardMoving =
            keyMap['KeyW'] || keyMap['ArrowUp'] ||
            keyMap['KeyS'] || keyMap['ArrowDown'] ||
            keyMap['KeyA'] || keyMap['ArrowLeft'] ||
            keyMap['KeyD'] || keyMap['ArrowRight'];

        const isAutoMoving = pathfinding.isMoving;

        const isMoving = isKeyboardMoving || isAutoMoving;

        if (pathfinding.isMoving) {
            CONFIG.playerRadius = 0.2;
        } else {
            CONFIG.playerRadius = 0.4;
        }

        if (keyMap['KeyW'] || keyMap['ArrowUp']) playerVelocity.add(bvhPhysicsUtils.getForwardVector().multiplyScalar(speed));
        if (keyMap['KeyS'] || keyMap['ArrowDown']) playerVelocity.add(bvhPhysicsUtils.getForwardVector().multiplyScalar(-speed));
        if (keyMap['KeyA'] || keyMap['ArrowLeft']) playerVelocity.add(bvhPhysicsUtils.getSideVector().multiplyScalar(-speed));
        if (keyMap['KeyD'] || keyMap['ArrowRight']) playerVelocity.add(bvhPhysicsUtils.getSideVector().multiplyScalar(speed));

        if (fpsPlayer.model?.userData.walkAction) {
            fpsPlayer.model.userData.walkAction.paused = !isMoving;
        }

        // ZoneManager : détection de transition à chaque frame
        if (controls.isLocked) {
            zoneManager.update(camera.position);
            zoneManager.checkImpostorsVisibility();

            // SÉCURITÉ CRITIQUE : Si le manager charge une zone, on fige la physique
            if (zoneManager._transitioning) {
                playerVelocity.set(0, 0, 0); // On annule la gravité et l'élan
                // On ne va pas plus loin dans cette frame
            } else {
                bvhPhysicsUtils.updatePlayerYVelocity(deltaTime);
                bvhPhysicsUtils.playerCollisionsSubStepping(8, deltaTime);
            }
        }


        // Limite le regard vertical
        fpsPlayer.playerPitchLimit();

        // Caméra FPS
        fpsPlayer.cameraFollowPlayer(playerPos)
        fpsPlayer.playerYawFollow(player, playerPos);


        if (CONFIG.debugCapsule) {
            debugUtil.playerCapsuleHelperFollow(capsuleHelper, playerPos);
        }

        //Pathfinding
        pathfinding.move(deltaTime);
    }

    // P : log position + zone courante
    if (keyMap['KeyG']) {
        console.log("📍 Position :", camera.position.clone());
        console.log("🗺️  Zone actuelle :", zoneManager.currentZone?.name ?? 'aucune');
    }

    if (DEBUG_STATS) {
        stats.update();
    }
    document.getElementById('current_zone').innerHTML = "Salle actuelle : " + (zoneManager.currentRoom?.name ?? 'aucune');

    // console.log(renderer.info.render.calls);
    renderer.render(scene, camera);
}

requestAnimationFrame(animate);