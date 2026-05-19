import * as THREE from 'three';
import InitLoader from "./utils/init-loader.js";

// ── Curseur ──────────────────────────────────────────────
const cursor = document.getElementById('cursor');
document.addEventListener('mousemove', e => {
    cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
}, { passive: true });

document.querySelectorAll('a, button, .btn-primary').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('big'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('big'));
});

// ── Three.js setup ───────────────────────────────────────
const canvas = document.getElementById('three-canvas');
const container = canvas.parentElement;

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: window.devicePixelRatio < 2, // Désactive l'antialiasing sur les écrans haute densité (inutile)
    alpha: true,
    powerPreference: "high-performance",
    stencil: false,   // Inutilisé — économise de la mémoire GPU
    depth: true,
});

renderer.setSize(container.clientWidth, container.clientHeight);
// Limiter à 1.0 sur mobile/dpr élevé pour un gain FPS massif
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// Désactiver les fonctionnalités inutilisées
renderer.shadowMap.enabled = false;
renderer.info.autoReset = false; // Reset manuel pour éviter le overhead

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000); // Far plane réduit : 10000 → 1000
camera.position.set(60, 40, 80);
camera.lookAt(0, 0, 0);

// ── Lumières ─────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xf5ece0, 0.5);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xfff5e0, 2.5);
key.position.set(80, 120, 60);
key.matrixAutoUpdate = false; // Lumière statique — pas besoin de recalculer la matrice
key.updateMatrix();
scene.add(key);

const fill = new THREE.DirectionalLight(0xc0d8ff, 0.8);
fill.position.set(-60, 40, -80);
fill.matrixAutoUpdate = false;
fill.updateMatrix();
scene.add(fill);

const rim = new THREE.DirectionalLight(0xff8855, 0.4);
rim.position.set(0, -30, -100);
rim.matrixAutoUpdate = false;
rim.updateMatrix();
scene.add(rim);

const pivot = new THREE.Group();
scene.add(pivot);

// ── Chargement et Centrage ───────────────────────────────
let modelLoaded = false;
const gltfLoader = new InitLoader().initGltfLoader(renderer);

gltfLoader.load('models/landing-page/ufr_mim.glb', (gltf) => {
    const model = gltf.scene;
    const SCALE_FACTOR = 0.6;
    model.scale.set(SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR);

    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);
    model.position.x = -center.x;
    model.position.z = -center.z;

    // Désactiver matrixAutoUpdate sur tous les meshes statiques du modèle
    model.traverse(node => {
        if (node.isMesh) {
            node.matrixAutoUpdate = false;
            node.updateMatrix();
            node.frustumCulled = true; // S'assurer que le culling est actif
        }
    });

    pivot.add(model);
    modelLoaded = true;
});

// ── Particules ───────────────────────────────────────────
const N = 30; // Réduit de 100 → 60 (gain direct sur le vertex shader)
const particlesGeo = new THREE.BufferGeometry();
const pos = new Float32Array(N * 3);
for (let i = 0; i < N; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 80;
    pos[i*3+1] = (Math.random() - 0.5) * 60;
    pos[i*3+2] = (Math.random() - 0.5) * 80;
}
particlesGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
const particlesMat = new THREE.PointsMaterial({
    color: 0x9a8e7e,
    size: 0.15,
    transparent: true,
    opacity: 0.5,
    depthWrite: false, // Évite les artefacts de tri + léger gain GPU
});
const particles = new THREE.Points(particlesGeo, particlesMat);
scene.add(particles);

// ── Grid ─────────────────────────────────────────────────
const gridHelper = new THREE.GridHelper(100, 20, 0x2a2520, 0x1a1814); // Divisions réduites : 30 → 20
gridHelper.position.y = -8;
gridHelper.material.opacity = 0.4;
gridHelper.material.transparent = true;
gridHelper.matrixAutoUpdate = false; // Statique
gridHelper.updateMatrix();
scene.add(gridHelper);

// ── Resize (throttlé) ─────────────────────────────────────
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }, 150);
});

// ── Boucle d'animation (cap 60 FPS) ─────────────────────
const clock = new THREE.Clock();
const TARGET_FPS = 60;
const FRAME_INTERVAL = 1 / TARGET_FPS;
let lastFrameTime = 0;

function animate(timestamp) {
    requestAnimationFrame(animate);

    // Cap à 60 FPS — évite de pousser 120+ FPS sur les écrans haute fréquence
    const seconds = timestamp * 0.001;
    if (seconds - lastFrameTime < FRAME_INTERVAL) return;
    lastFrameTime = seconds - ((seconds - lastFrameTime) % FRAME_INTERVAL);

    const t = clock.getElapsedTime();

    pivot.rotation.y += 0.005;
    pivot.position.y = Math.sin(t * 0.4) * 0.5;

    particles.rotation.y = t * 0.02;
    particles.rotation.x = t * 0.01;


    renderer.render(scene, camera);
    renderer.info.reset(); // Reset manuel des stats internes
}

animate(0);