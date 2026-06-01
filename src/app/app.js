import * as THREE from 'three';
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast} from 'three-mesh-bvh';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import {ZoneManager} from '../map-manager/zone-manager.js'
import {PersonSearcher} from "./panels/person-searcher.js";
import {ZoneSearcher} from "./panels/zone-searcher.js";
import {PanelUtils} from "./panels/panel-utils.js";
import AppPathfinding from "./app-pathfinding.js";
import InitLoader from "../utils/init-loader.js";
import AppPhysicsBvh from "./app-physics-bvh.js";
import AppDebugUtils from "./app-debug-utils.js";
import jsonParser from "../utils/json-parser.js"
import AppFpsPlayer from "./app-fps-player.js";
import SceneSetup from "./app-scene-setup.js";

// Monkey-patch three-mesh-bvh
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// ================= CONFIG =================
const DEBUG_MODE = false;
const DEBUG_MODE_STATS = false;

const CONFIG = {
    zonesJsonPath: "/data/zones.json",
    navMeshPath: "/models/navmeshes/navmesh_mesh.glb",
    startZone: 'floor0hall',
    spawnPoint: new THREE.Vector3(65, 4.24, -32),
    // ATTENTION : Le Y du vecteur de regard doit être similaire à celui du point d'apparition pour regarder tout droit
    lookAt: new THREE.Vector3(64.99, 4.24, -31.88),
    playerPath: "/models/characters/man.glb",
    playerRadius: 0.4,
    playerHeight: 1.3,
    moveSpeed: 8,
    gravity: 30,
    debugMode: DEBUG_MODE,
};

const sceneSetup = new SceneSetup(CONFIG);
const panelUtils = new PanelUtils();
const parser = new jsonParser();
const timer = new THREE.Timer();
const stats = new Stats();

let scene, camera, renderer;
let gltfLoader;
let ZONES = [];
const colliderMeshes = [];
let fpsPlayer, playerGroup, playerPos;
let controls;
let pathfinding;
let bvhPhysicsUtils;
let currentOverlay;
let startButton, menuPanel, infosPanel, guidedNavPanel, keyBindPanel, walkPanel, helpPanel, settingsPanel, roomFindPanel, personFindPanel, roomFindPanelInput, personFindPanelInput;

// ================= PARSING DES ZONES DE zones.json =================
ZONES = await parser.fillZonesTab(ZONES, CONFIG.zonesJsonPath)

// ================= SETUP SCENE =================
scene = sceneSetup.getScene();
renderer = sceneSetup.buildRenderer();
camera = sceneSetup.buildCamera();
sceneSetup.buildSky();
sceneSetup.buildLights();
sceneSetup.buildCrossHair(camera);
sceneSetup.initResize(camera, renderer);

// ================= INITIALISATION LOADER =================
gltfLoader = new InitLoader().initGltfLoader(renderer);

// ================= CHARGEMENT DU PERSONNAGE =================
fpsPlayer = new AppFpsPlayer(scene, gltfLoader, camera, CONFIG);
playerGroup = fpsPlayer.initFpsCharacter(CONFIG.playerPath);
controls = new PointerLockControls(camera, renderer.domElement);

// ================= ZONE MANAGER =================
// On passe colliderMeshes au ZoneManager
// Il y ajoute/retire les meshes de collision selon les zones visibles
const zoneManager = new ZoneManager(scene, gltfLoader, colliderMeshes, DEBUG_MODE);
// Enregistrement des zones dans le manager de zones
zoneManager.registerMultiZones(ZONES);

// Chargement de la zone de début
await zoneManager.init(CONFIG.startZone);

if (DEBUG_MODE) {
    ZONES.forEach(zone => {
        const helper = new THREE.Box3Helper(zone.triggerBox, 0xffff00);
        scene.add(helper);
    });
}

// Initialisation des panels
currentOverlay = "menu";
await _initUI();

// ================= INITIALISATION PATHFINDING =================
pathfinding = new AppPathfinding(scene, camera, playerGroup, DEBUG_MODE);
pathfinding.showHelper();
pathfinding.loadNavMesh(CONFIG.navMeshPath, gltfLoader);

// ================= INITIALISATION PHYSIQUE =================

// La capsule est représentée par sa position (centre bas) + rayon + hauteur.
playerPos = CONFIG.spawnPoint.clone();  // position du bas de la capsule
pathfinding.setPlayerPos(playerPos);
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
const _capsuleBottom = new THREE.Vector3();
const _capsuleTop = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
let playerOnFloor = false;

bvhPhysicsUtils = new AppPhysicsBvh(CONFIG, camera, colliderMeshes,
    playerPos, playerVelocity, playerDirection,
    playerOnFloor, _capsuleTop, _capsuleBottom, _normal, _matrix);

// ================= OUTILS =================
const debugUtil = new AppDebugUtils(scene, CONFIG, stats);

if(DEBUG_MODE){
    // Affiche l'overlay de debug
    debugUtil.renderDebugMessage();
}

let statsPanels = [];
if(DEBUG_MODE_STATS) {
    document.body.appendChild(stats.dom);
    statsPanels = debugUtil.createStatsPanels();
}

// Capsule de joueur affichée en mode DEBUG
const capsuleHelper = debugUtil.buildPlayerCapsuleHelper();

// ================= OVERLAY =================

controls.addEventListener('lock', () => {
    if (startButton) startButton.innerText = "Continuer la visite";

    // Affichage du HUD uniquement
    if (menuPanel) menuPanel.style.display = 'none';
    if (helpPanel) helpPanel.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'none';
    if (roomFindPanel) roomFindPanel.style.display = 'none';
    if (personFindPanel) personFindPanel.style.display = 'none';
    if (guidedNavPanel) guidedNavPanel.style.display = 'none';
    if (infosPanel) infosPanel.style.display = 'flex';
    if (keyBindPanel) keyBindPanel.style.display = 'flex';

    if (roomFindPanelInput) roomFindPanelInput.value = "";
    if (personFindPanelInput) personFindPanelInput.value = "";
});

controls.addEventListener('unlock', () => {
    if (menuPanel) menuPanel.style.display = 'none';
    if (infosPanel) infosPanel.style.display = 'none';
    if (guidedNavPanel) guidedNavPanel.style.display = 'none';
    if (keyBindPanel) keyBindPanel.style.display = 'none';
    if (walkPanel) walkPanel.style.display = 'none';

    // Choix du panel à afficher
    switch (currentOverlay) {
        case 'room':
            if (roomFindPanel) roomFindPanel.style.display = 'flex';
            if (roomFindPanelInput) roomFindPanelInput.focus();
            zoneSearcher.updateRoomSearch();
            break;
        case 'person':
            if (personFindPanel) personFindPanel.style.display = 'flex';
            if (personFindPanelInput) personFindPanelInput.focus();
            personSearcher.updateRoomSearch();
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

// ================= MOTEUR DE RECHERCHE =================

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

// Écouteur sur les barres de recherche
if (roomFindPanelInput) roomFindPanelInput.addEventListener('input', () => zoneSearcher.updateRoomSearch());
if (personFindPanelInput) personFindPanelInput.addEventListener('input', () => personSearcher.updateRoomSearch());

// Écouteur sur les filtres
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


// ================= PARAMETRES =================

// Changement de la vitesse de marche
document.getElementById('settings-speed').addEventListener('change', (e) => {
    CONFIG.moveSpeed = parseInt(e.target.value);
})

// Affichage de la description de la zone en-dessous de son nom
const settingsShowZoneDesc = document.getElementById('settings-show-zone')
let showZoneDesc = settingsShowZoneDesc.checked;
document.getElementById('settings-show-zone').addEventListener('change', (e) => {
    document.getElementById('current_zone_desc').innerHTML = "";
    showZoneDesc = e.target.checked;
})

// Affichage du chemin lors de la navigation guidée/automatique
document.getElementById('settings-show-path').addEventListener('change', (e) => {
    pathfinding.showPath = e.target.checked;
})

// ================= INPUT (AZERTY) =================
const keyMap = {};
document.addEventListener('keydown', e => keyMap[e.code] = true);
document.addEventListener('keyup', e => keyMap[e.code] = false);


document.addEventListener('keydown', e => {
    // Permet de taper les touches de raccourcis dans les barres de recherche
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // Ouverture des panels
    if (e.code === 'KeyF') _togglePanel(e, "room");
    if (e.code === 'KeyQ') _togglePanel(e, "person");
    if (e.code === 'KeyH') _togglePanel(e, "help");
    if (e.code === 'KeyP') _togglePanel(e, "settings");

    // Retour au point d'apparition
    if (e.code === 'F6') {
        e.preventDefault();
        bvhPhysicsUtils.backToSpawnPoint();
    }

    // Copie des instructions dans le presse-papier
    if (e.code === 'KeyC') {
        if (pathfinding.isGuiding){
            const kbdElement = document.getElementById("copy_kbd");

            // Uniquement en HTTPS
            navigator.clipboard.writeText(pathfinding.getInstructionsText(zoneManager.currentRoom)).then(
                () => {
                    kbdElement.style.backgroundColor = "rgba(40,167,69,0.56)";
                    kbdElement.style.color = "white";

                    setTimeout(() => {
                        kbdElement.style.backgroundColor = "";
                        kbdElement.style.color = "";
                    }, 500);
                }
            );
        }
    }

    // Téléchargement des instructions
    if (e.code === 'KeyT') {
        if (pathfinding.isGuiding){
            const kbdElement = document.getElementById("download_kbd");


            const element = document.createElement("a");
            const file = new Blob([pathfinding.getInstructionsText(zoneManager.currentRoom)], {
                type: "text/plain"
            });
            element.href = URL.createObjectURL(file);
            element.download = pathfinding.getInstructionsTitle(zoneManager.currentRoom);
            document.body.appendChild(element);
            element.click();

            kbdElement.style.backgroundColor = "rgba(40,167,69,0.56)";
            kbdElement.style.color = "white";

            setTimeout(() => {
                kbdElement.style.backgroundColor = "";
                kbdElement.style.color = "";
            }, 500);
        }
    }

    // Arrêt d'une navigation
    if (e.code === 'Enter'){
        e.preventDefault();
        if (pathfinding.isGuiding){
            pathfinding.endGuide();
        }
        if (pathfinding.isMoving){
            pathfinding.endMove(fpsPlayer);
        }
    }

    // Touches mode DEBUG
    if (DEBUG_MODE) {
        if (e.code === 'F1'){
            e.preventDefault();
            zoneManager.getStatus();
        }
        if (e.code === 'F2'){
            e.preventDefault();
            debugUtil.buildColliderMeshesHelper(colliderMeshes);
        }
        if (e.code === 'F3') {
            e.preventDefault();
            console.log("📍 Position :", camera.position.clone());
            console.log("🗺️  Zone actuelle :", zoneManager.currentZone?.name ?? 'aucune');
            console.log("🗺️  Salle actuelle :", zoneManager.currentRoom?.name ?? 'aucune');
        }
    }
});

// ================= BOUCLE DE RENDU =================
function animate(timestamp) {
    requestAnimationFrame(animate);

    timer.update(timestamp);
    const deltaTime = Math.min(0.05, timer.getDelta());

    // Mise à jour du mixer d'animations
    if (fpsPlayer.mixer) fpsPlayer.mixer.update(deltaTime);

    document.getElementById('current_zone').innerHTML = (zoneManager.currentRoom?.displayName ?? 'aucune');
    if(showZoneDesc) document.getElementById('current_zone_desc').innerHTML = (zoneManager.currentRoom?.description ?? '');

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

        // Changement d'animation en fonction de l'action
        if (fpsPlayer.model?.userData.actions) {
            fpsPlayer.model.userData.actions['walk'].paused = !isMoving;
            fpsPlayer.model.userData.actions['idle'].paused = isMoving;
        }

        // ZoneManager : détection de transition à chaque frame
        if (controls.isLocked) {
            zoneManager.update(camera.position);

            // ATTENTION : Si le manager charge une zone, on fige le joueur
            if (zoneManager._transitioning) {
                playerVelocity.set(0, 0, 0); // On annule la gravité et l'élan
            } else {
                bvhPhysicsUtils.updatePlayerYVelocity(deltaTime);
                bvhPhysicsUtils.playerCollisionsSubStepping(8, deltaTime);
            }
        }

        // Limite le regard vertical
        fpsPlayer.playerPitchLimit();

        // Caméra FPS
        fpsPlayer.cameraFollowPlayer(playerPos)
        fpsPlayer.playerYawFollow(playerGroup, playerPos);

        //Pathfinding
        pathfinding.move(deltaTime, fpsPlayer);
        pathfinding.guide(ZONES, zoneManager.currentRoom);

        if (DEBUG_MODE) {
            debugUtil.playerCapsuleHelperFollow(capsuleHelper, playerPos);
            debugUtil.showCoordinates(playerPos, camera);
            pathfinding.showNearestPointSegment();
        }
    }

    if (DEBUG_MODE_STATS) {
        stats.update();
        /**
         * Attention, les stats sont faussées par l'affichage des composantes de debug, pour obtenir les vraies valeurs :
         * Mettre DEBUG_MODE = false et DEBUG_MODE_STATS = true;
         */
        statsPanels[0].update(renderer.info.render.calls, 1000);
        // Nombre de zones chargées
        statsPanels[1].update(zoneManager.managedZones.size, 20);
        // Nombre de géométries de la scène en VRAM
        statsPanels[2].update(renderer.info.memory.geometries, 1000);
        // Nombre de triangles de la scène
        statsPanels[3].update(renderer.info.render.triangles, 10000000);

    }

    renderer.render(scene, camera);
}

requestAnimationFrame(animate);


async function _initUI() {

    // Chargement des panels de l'UI
    await panelUtils.loadAllHtmlPanels([
        ['menuPanel',      './panels/html/menu-panel.html'],
        ['keyBindPanel',   './panels/html/keybind-panel.html'],
        ['walkPanel',      './panels/html/walk-panel.html'],
        ['infosPanel',     './panels/html/infos-panel.html'],
        ['guidedNavPanel', './panels/html/guided-nav-panel.html'],
        ['helpPanel',      './panels/html/help-panel.html'],
        ['settingsPanel',  './panels/html/settings-panel.html'],
        ['roomFindPanel',  './panels/html/room-find-panel.html'],
        ['personFindPanel','./panels/html/person-find-panel.html'],
    ]);

    // Récupération des éléments dynamique de l'UI après son chargement
    startButton = document.getElementById("startButton");
    menuPanel = document.getElementById('menuPanel');
    infosPanel = document.getElementById('infosPanel');
    guidedNavPanel = document.getElementById('guidedNavPanel');
    keyBindPanel = document.getElementById("keyBindPanel");
    walkPanel = document.getElementById("walkPanel");
    helpPanel = document.getElementById("helpPanel");
    settingsPanel = document.getElementById("settingsPanel");
    roomFindPanel = document.getElementById("roomFindPanel");
    personFindPanel = document.getElementById("personFindPanel");

    roomFindPanelInput = document.getElementById("searchBar-input");
    personFindPanelInput = document.getElementById("searchBar-p-input");

    panelUtils.onPanelBtnClick("startButton", () => controls.lock());

    panelUtils.onPanelBtnClick("settingsButton", () => {
        controls.lock();
        currentOverlay = "settings";
        controls.unlock();
    });

    // Clique sur les boutons d'aide
    panelUtils.onPanelBtnClick("helpButton", () => {
        controls.lock();
        currentOverlay = "help";
        controls.unlock();
    });
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

    // Clique sur les boutons retour
    _backToGame("helpBackBtn", "help");
    _backToGame("findRoomBackBtn", "room");
    _backToGame("findPersonBackBtn", "person");
    _backToGame("settingsBackBtn", "settings");
}

function _togglePanel(e, overlay){
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

function _backToGame(id, overlay){
    panelUtils.onPanelBtnClick(id, () =>{
        if (currentOverlay === overlay) {
            controls.lock();
            currentOverlay = "menu";
        }
    })
}