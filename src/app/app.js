import * as THREE from 'three';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import {computeBoundsTree, disposeBoundsTree, acceleratedRaycast} from 'three-mesh-bvh';
import jsonParser from "../utils/json-parser.js"
import {ZoneManager} from '../map-manager/zone-manager.js'
import SceneSetup from "../utils/app-scene-setup.js";
import InitLoader from "../utils/init-loader.js";
import AppInitFpsPlayer from "../utils/app-init-fps-player.js";

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

// ================= DÉFINITION DES ZONES =================
let ZONES = [];
const parser = new jsonParser();
ZONES = await parser.fillZonesTab(ZONES, "/data/zones.json")


// --- Chrono ---
const t0 = performance.now();

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


// ================= TOOLS =================
const stats = new Stats();
if(DEBUG_STATS) {
    document.body.appendChild(stats.dom);
}

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

// Debug capsule
const debugMat = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});
const capsuleHelper = new THREE.Group();
const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.playerRadius, CONFIG.playerRadius, CONFIG.playerHeight, 8), debugMat);
const sphereTop = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.playerRadius, 8, 8), debugMat);
const sphereBot = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.playerRadius, 8, 8), debugMat);
sphereTop.position.y = CONFIG.playerHeight / 2;
sphereBot.position.y = -CONFIG.playerHeight / 2;
capsuleHelper.add(bodyMesh, sphereTop, sphereBot);
capsuleHelper.visible = CONFIG.debugCapsule;
scene.add(capsuleHelper);

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
const playerInit = new AppInitFpsPlayer(scene, gltfLoader);
const player = playerInit.initFpsCharacter("/models/characters/woman_anim.glb");

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

// --- Fin du chrono ---
const t1 = performance.now();
const res_load = `⏱️ Temps de chargement total : ${((t1 - t0) / 1000).toFixed(3)} secondes.`
console.log(`⏱️ Temps de chargement total : ${((t1 - t0) / 1000).toFixed(3)} secondes.`);


function printHierarchy() {
    const zones = zoneManager.zones;

    let types = [];
    let sort = [];
    zones.forEach((zone) => {
        if(!types.includes(zone.type)) {
            types.push(zone.type);
        }
    })
    types.forEach((type) => {
        zones.forEach((zone) => {
            if(zone.type === type) {
                sort.push({
                    name: zone.name,
                    type: zone.type,
                    description: zone.description,
                });
            }
        })
    })
    console.table(types);
    console.table(sort);
}

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
        debugColliderMeshes();
    }
    if (e.code === 'F4') {
        e.preventDefault();
        printHierarchy();
    }
});


// ================= PHYSIQUE BVH =================

function debugColliderMeshes() {

    colliderMeshes.forEach(mesh => {
        // On crée un clone visuel en fil de fer pour ne pas casser le matériau original
        const wireframeGeom = new THREE.WireframeGeometry(mesh.geometry);
        const wireframe = new THREE.LineSegments(wireframeGeom);

        // On applique la même position/rotation que le mesh original
        wireframe.matrixAutoUpdate = false;
        wireframe.matrix.copy(mesh.matrixWorld);

        // Couleur rouge pour les collisions
        wireframe.material.color.set(0xff0000);
        wireframe.material.opacity = 0.5;
        wireframe.material.transparent = true;

        scene.add(wireframe);
    });
}

/**
 * Résolution des collisions capsule/monde via BVH.
 * Teste chaque mesh de collision actif dans colliderMeshes.
 * Pousse le joueur hors des surfaces de manière itérative.
 */
function playerCollisions() {
    playerOnFloor = false;

    const EPS = 0.002;          // seuil anti micro-collisions
    const MAX_PUSH = 3;         // limite de corrections par mesh
    let pushCount = 0;

    _capsuleBottom.copy(playerPos);
    _capsuleBottom.y = playerPos.y + CONFIG.playerRadius;

    _capsuleTop.copy(playerPos);
    _capsuleTop.y = playerPos.y + CONFIG.playerHeight - CONFIG.playerRadius;

    for (const mesh of colliderMeshes) {
        if (!mesh.geometry.boundsTree) continue;

        pushCount = 0;

        const invMat = _matrix.copy(mesh.matrixWorld).invert();

        const localBottom = _capsuleBottom.clone().applyMatrix4(invMat);
        const localTop = _capsuleTop.clone().applyMatrix4(invMat);

        const scale = mesh.matrixWorld.getMaxScaleOnAxis();
        const localR = CONFIG.playerRadius / scale;

        mesh.geometry.boundsTree.shapecast({
            intersectsBounds: box => {
                const capsuleBox = new THREE.Box3();

                capsuleBox.min.set(
                    Math.min(localBottom.x, localTop.x) - localR,
                    Math.min(localBottom.y, localTop.y) - localR,
                    Math.min(localBottom.z, localTop.z) - localR
                );

                capsuleBox.max.set(
                    Math.max(localBottom.x, localTop.x) + localR,
                    Math.max(localBottom.y, localTop.y) + localR,
                    Math.max(localBottom.z, localTop.z) + localR
                );

                return capsuleBox.intersectsBox(box);
            },

            intersectsTriangle: tri => {

                if (pushCount >= MAX_PUSH) return false;

                const capsuleSeg = new THREE.Line3(localBottom, localTop);

                const closestPointOnTriangle = new THREE.Vector3();
                const closestPointOnSegment = new THREE.Vector3();

                tri.closestPointToSegment(
                    capsuleSeg,
                    closestPointOnTriangle,
                    closestPointOnSegment
                );

                const distance = closestPointOnSegment.distanceTo(closestPointOnTriangle);

                // seuil anti jitter
                if (distance >= localR - EPS) return false;

                const depth = localR - distance;

                _normal.subVectors(closestPointOnSegment, closestPointOnTriangle);

                if (_normal.lengthSq() === 0) return false;

                _normal.normalize();

                const worldNormal = _normal.clone().transformDirection(mesh.matrixWorld);

                // --- SOL ---
                if (worldNormal.y > 0.5) {
                    playerOnFloor = true;

                    // empêche rebond vertical
                    if (playerVelocity.y < 0) playerVelocity.y = 0;

                    // colle légèrement au sol (empêche les micro-sauts)
                    playerPos.y -= EPS;
                }

                // --- PLAFOND ---
                else if (worldNormal.y < -0.5) {
                    if (playerVelocity.y > 0) playerVelocity.y = 0;
                }

                // --- MUR / ESCALIER ---
                else {
                    // glissement
                    const dot = playerVelocity.dot(worldNormal);
                    if (dot < 0) {
                        playerVelocity.addScaledVector(worldNormal, -dot);
                    }
                }

                // correction position avec clamp
                const push = depth * scale + 0.003;
                playerPos.addScaledVector(worldNormal, push);

                pushCount++;

                return false;
            }
        });
    }
}

function getForwardVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    return playerDirection;
}

function getSideVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross(camera.up);
    return playerDirection;
}

// ================= BOUCLE DE RENDU =================
function animate() {
    const deltaTime = Math.min(0.05, clock.getDelta());

    // Mise à jour du mixer
    if (playerInit.mixer) playerInit.mixer.update(deltaTime);

    if (controls.isLocked) {
        const speed = CONFIG.moveSpeed;
        const yVel = playerVelocity.y;
        playerVelocity.set(0, yVel, 0);

        const isMoving =
            keyMap['KeyW'] || keyMap['ArrowUp'] ||
            keyMap['KeyS'] || keyMap['ArrowDown'] ||
            keyMap['KeyA'] || keyMap['ArrowLeft'] ||
            keyMap['KeyD'] || keyMap['ArrowRight'];

        if (keyMap['KeyW'] || keyMap['ArrowUp']) playerVelocity.add(getForwardVector().multiplyScalar(speed));
        if (keyMap['KeyS'] || keyMap['ArrowDown']) playerVelocity.add(getForwardVector().multiplyScalar(-speed));
        if (keyMap['KeyA'] || keyMap['ArrowLeft']) playerVelocity.add(getSideVector().multiplyScalar(-speed));
        if (keyMap['KeyD'] || keyMap['ArrowRight']) playerVelocity.add(getSideVector().multiplyScalar(speed));

        if (playerInit.model?.userData.walkAction) {
            playerInit.model.userData.walkAction.paused = !isMoving;
        }

        if (!playerOnFloor) {
            playerVelocity.y -= CONFIG.gravity * deltaTime;
        } else {
            playerVelocity.y = Math.max(0, playerVelocity.y);
        }

        const steps = 8;
        const subDelta = deltaTime / steps;

        for (let i = 0; i < steps; i++) {

            // appliquer gravité
            if (!playerOnFloor) {
                playerVelocity.y -= CONFIG.gravity * subDelta;
            }

            // déplacement
            const deltaMove = playerVelocity.clone().multiplyScalar(subDelta);
            playerPos.add(deltaMove);

            // collisions
            playerCollisions();

        }

        // Limite le regard vertical
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        euler.x = Math.max(-0.9, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);

        // Caméra FPS
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        camera.position.set(
            playerPos.x + forward.x * 0.12, // 0.12 pour être juste devant les yeux
            playerPos.y + CONFIG.playerHeight,
            playerPos.z + forward.z * 0.12 // 0.12 pour être juste devant les yeux
        );

        // Modèle visible
        player.position.copy(playerPos);
        if (playerInit.model) {
            const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
            playerInit.model.rotation.y = yaw + Math.PI;
        }

        // ZoneManager : détection de transition à chaque frame
        zoneManager.update(camera.position);
        zoneManager.checkImpostorsVisibility();

        if (CONFIG.debugCapsule) {
            capsuleHelper.position.set(
                playerPos.x,
                playerPos.y + CONFIG.playerHeight / 2,
                playerPos.z
            );
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
