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
import {ZoneSearcher} from "./panels/zone-searcher.js";
import {PersonSearcher} from "./panels/person-searcher.js";
import {PanelUtils} from "./panels/panel-utils.js";

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
const panelUtils = new PanelUtils();

const menuPanel = document.getElementById('menuPanel');
const infosPanel = document.getElementById('infosPanel');
const keyBindPanel = document.getElementById("keyBindPanel");
const walkPanel = document.getElementById("walkPanel");
const helpPanel = document.getElementById("helpPanel");
const settingsPanel = document.getElementById("settingsPanel");
const roomFindPanel = document.getElementById("roomFindPanel");
const personFindPanel = document.getElementById("personFindPanel");

const roomFindPanelInput = document.getElementById("searchBar-input");
const personFindPanelInput = document.getElementById("searchBar-p-input");

panelUtils.onPanelBtnClick("startButton", () => controls.lock());
panelUtils.onPanelBtnClick("helpButton", () => {
    controls.lock();
    currentOverlay = "help";
    controls.unlock();
});
panelUtils.onPanelBtnClick("settingsButton", () => {
    controls.lock();
    currentOverlay = "settings";
    controls.unlock();
});

const controls = new PointerLockControls(camera, renderer.domElement);

// startButton?.addEventListener('click', () => controls.lock());
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
            if (roomFindPanelInput) roomFindPanelInput.focus();
            break;
        case 'person':
            if (personFindPanel) personFindPanel.style.display = 'flex';
            if (personFindPanelInput) personFindPanelInput.focus();
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

// ================= ZONE SEARCHER =================

const zoneSearcher = new ZoneSearcher(ZONES, pathfinding, () => {
    // CallBack pour lock et lancer la marche auto
    if (roomFindPanel) roomFindPanel.style.display = 'none';
    controls.lock();
    currentOverlay = "menu";
});

const personSearcher = new PersonSearcher(ZONES, pathfinding, () => {
    // CallBack pour lock et lancer la marche auto
    if (personFindPanel) personFindPanel.style.display = 'none';
    controls.lock();
    currentOverlay = "menu";
});


// Écouteur sur la barre de recherche
const input = document.querySelector('#searchBar input');
if (input) input.addEventListener('input', () => zoneSearcher.updateRoomSearch());

// Écouteur sur les filtres (Chips)
document.querySelectorAll('#roomFilters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
        // Toggle de la sélection
        const checkbox = chip.querySelector('input');
        checkbox.checked = !checkbox.checked;
        chip.classList.toggle('selected', checkbox.checked);

        // Relancer la recherche
        zoneSearcher.updateRoomSearch();
    });
});

const input_p = document.querySelector('#searchBar-p input');
if (input_p) input_p.addEventListener('input', () => personSearcher.updateRoomSearch());

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


function onTogglePanel(e, overlay){
    e.preventDefault();
    if (currentOverlay === overlay){
        controls.lock();
        currentOverlay = "menu";
    } else {
        if (controls.isLocked) {
            currentOverlay = overlay;
            controls.unlock();
        }
    }
}

document.addEventListener('keydown', e => {
    // Permet de taper les touches de raccourcis dans les barres de recherche
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

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
        console.log("📍 Position :", camera.position.clone());
        console.log("🗺️  Zone actuelle :", zoneManager.currentZone?.name ?? 'aucune');
    }

    if (e.code === 'KeyF') {
        onTogglePanel(e, "room");
    }
    if (e.code === 'KeyQ') {
        onTogglePanel(e, "person");

    }
    if (e.code === 'KeyH') {
        onTogglePanel(e, "help");

    }
    if (e.code === 'KeyP') {
        onTogglePanel(e, "settings");
    }
});

function onBackToGame(id, overlay){
    panelUtils.onPanelBtnClick(id, () =>{
        if (currentOverlay === overlay) {
            controls.lock();
            currentOverlay = "menu";
        }
    })
}

onBackToGame("helpBackBtn", "help");
onBackToGame("findRoomBackBtn", "room");
onBackToGame("findPersonBackBtn", "person");

panelUtils.onPanelBtnClick("findRoomHelpBtn", () =>{
        if(currentOverlay === "room") {
            if (roomFindPanel) roomFindPanel.style.display = 'none';
            controls.lock();
            currentOverlay = "help";
            controls.unlock();
        }
});
panelUtils.onPanelBtnClick("findPersonHelpBtn", () =>{
        if(currentOverlay === "person") {
            if (personFindPanel) personFindPanel.style.display = 'none';
            controls.lock();
            currentOverlay = "help";
            controls.unlock();
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

    if (DEBUG_STATS) {
        stats.update();
    }
    document.getElementById('current_zone').innerHTML = (zoneManager.currentRoom?.displayName ?? 'aucune');

    // console.log(renderer.info.render.calls);
    renderer.render(scene, camera);
}

requestAnimationFrame(animate);