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

// Monkey-patch Three.js
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const DEBUG_STATS = true;
const DEBUG_BBOX_COLOR = true;

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



// ================= LOADING SCREEN UI =================
const loadingScreen = document.createElement('div');
loadingScreen.style.cssText = `
    position: fixed; inset: 0; background: #1a1a2e;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    z-index: 100; color: white; font-family: sans-serif;
`;
loadingScreen.innerHTML = `
    <p style="margin-bottom: 12px; font-size: 1rem; opacity: 0.8;">Chargement...</p>
    <div style="width: 300px; height: 6px; background: #333; border-radius: 3px; overflow: hidden;">
        <div id="loading-bar" style="height:100%; width:0; background:#4466ff; transition:width 0.3s;"></div>
    </div>
    <p id="loading-percent" style="margin-top: 8px; font-size: 0.85rem; opacity: 0.6;">0%</p>
`;
document.body.appendChild(loadingScreen);

// ================= SCENE SETUP =================
const sceneSetup = new SceneSetup(CONFIG);

const scene = sceneSetup.getScene();
sceneSetup.buildSky();
sceneSetup.buildLights();
const camera = sceneSetup.buildCamera();
const renderer = sceneSetup.buildRenderer();
sceneSetup.initResize(camera, renderer);

const debugUtil = new AppDebugUtils(scene, CONFIG);

// ================= TOOLS =================
const stats = new Stats();
if(DEBUG_STATS) {
    document.body.appendChild(stats.dom);
}

// Debug capsule
const capsuleHelper = debugUtil.buildPlayerCapsuleHelper();

// ================= CONTROLS =================
const menuPanel = document.getElementById('menuPanel');
const startButton = document.getElementById('startButton');
const controls = new PointerLockControls(camera, renderer.domElement);

startButton?.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
    if (menuPanel) menuPanel.style.display = 'none';
});
controls.addEventListener('unlock', () => {
    if (menuPanel) menuPanel.style.display = 'block';
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

// Chargement initial — seule la zone de départ est bloquante
document.getElementById('loading-bar').style.width = '30%';
document.getElementById('loading-percent').textContent = 'Zone initiale...';

await zoneManager.init(CONFIG.startZone);

document.getElementById('loading-bar').style.width = '100%';
document.getElementById('loading-percent').textContent = '100%';

loadingScreen.style.transition = 'opacity 0.5s';
loadingScreen.style.opacity = '0';
setTimeout(() => loadingScreen.remove(), 500);

// ================= PHYSIQUE =================
const clock = new THREE.Clock();

// La capsule est représentée par sa position (centre bas) + rayon + hauteur.
const playerPos = CONFIG.spawnPoint.clone();  // position du bas de la capsule
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = false;

const _capsuleBottom = new THREE.Vector3();
const _capsuleTop = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

const bvhPysicsUtils = new AppPhysicsBvh(CONFIG, camera, colliderMeshes,
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
});

// --- Fin du chrono ---
const t1 = performance.now();
console.log(`⏱️ Temps de chargement total : ${((t1 - t0) / 1000).toFixed(3)} secondes.`);

// ================= BOUCLE DE RENDU =================
function animate() {
    const deltaTime = Math.min(0.05, clock.getDelta());

    // Mise à jour du mixer
    if (fpsPlayer.mixer) fpsPlayer.mixer.update(deltaTime);

    if (controls.isLocked) {
        const speed = CONFIG.moveSpeed;
        const yVel = playerVelocity.y;
        playerVelocity.set(0, yVel, 0);

        const isMoving =
            keyMap['KeyW'] || keyMap['ArrowUp'] ||
            keyMap['KeyS'] || keyMap['ArrowDown'] ||
            keyMap['KeyA'] || keyMap['ArrowLeft'] ||
            keyMap['KeyD'] || keyMap['ArrowRight'];

        if (keyMap['KeyW'] || keyMap['ArrowUp']) playerVelocity.add(bvhPysicsUtils.getForwardVector().multiplyScalar(speed));
        if (keyMap['KeyS'] || keyMap['ArrowDown']) playerVelocity.add(bvhPysicsUtils.getForwardVector().multiplyScalar(-speed));
        if (keyMap['KeyA'] || keyMap['ArrowLeft']) playerVelocity.add(bvhPysicsUtils.getSideVector().multiplyScalar(-speed));
        if (keyMap['KeyD'] || keyMap['ArrowRight']) playerVelocity.add(bvhPysicsUtils.getSideVector().multiplyScalar(speed));

        if (fpsPlayer.model?.userData.walkAction) {
            fpsPlayer.model.userData.walkAction.paused = !isMoving;
        }

        bvhPysicsUtils.updatePlayerYVelocity(deltaTime);
        bvhPysicsUtils.playerCollisionsSubStepping(8, deltaTime);

        // Limite le regard vertical
        fpsPlayer.playerPitchLimit();

        // Caméra FPS
        fpsPlayer.cameraFollowPlayer(playerPos)
        fpsPlayer.playerYawFollow(player, playerPos);

        // ZoneManager : détection de transition à chaque frame
        zoneManager.update(camera.position);
        zoneManager.checkImpostorsVisibility();

        if (CONFIG.debugCapsule) {
            debugUtil.playerCapsuleHelperFollow(capsuleHelper, playerPos);
        }
    }

    // P : log position + zone courante
    if (keyMap['KeyP']) {
        console.log("📍 Position :", camera.position.clone());
        console.log("🗺️  Zone actuelle :", zoneManager.currentZone?.name ?? 'aucune');
    }

    if(DEBUG_STATS){
        stats.update();
    }
    document.getElementById('current_zone').innerHTML = "Salle actuelle : " + (zoneManager.currentRoom?.name ?? 'aucune') + "<br>" + "Type : " + (zoneManager.currentRoom?.type  ?? "Empty") + "<br>" + "Description : " + (zoneManager.currentRoom?.description  ?? "Empty");

    // console.log(renderer.info.render.calls);
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
