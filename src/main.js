import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader";

// ── Cursor ──────────────────────────────────────────────
const cursor = document.getElementById('cursor');
document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
});
document.querySelectorAll('a, button, .btn-primary').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('big'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('big'));
});

// ── Three.js setup ──────────────────────────────────────
const canvas = document.getElementById('three-canvas');
const W = canvas.parentElement.clientWidth;
const H = canvas.parentElement.clientHeight;

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
});
renderer.setSize(W, H);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 10000);
camera.position.set(60, 40, 80);
camera.lookAt(0, 0, 0);

// ── Lumières ────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xf5ece0, 0.6);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xfff5e0, 2.5);
key.position.set(80, 120, 60);
scene.add(key);

const fill = new THREE.DirectionalLight(0xc0d8ff, 0.8);
fill.position.set(-60, 40, -80);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xff8855, 0.4);
rim.position.set(0, -30, -100);
scene.add(rim);

const pivot = new THREE.Group();
scene.add(pivot);

const dLoader = new DRACOLoader();
dLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dLoader);

gltfLoader.load('public/models/landing-page/ufr_mim.glb', (gltf) => {
    const model = gltf.scene;

    const SCALE_FACTOR = 0.6;
    model.scale.set(SCALE_FACTOR, SCALE_FACTOR, SCALE_FACTOR);

    const box = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    box.getCenter(center);

    model.position.x = -center.x;
    model.position.z = -center.z;


    pivot.add(model);
});


// ── Rotation auto + parallaxe souris ────────────────────
let targetRotY = 0;
let currentRotY = 0;
let mouseInfluence = 0;

document.addEventListener('mousemove', e => {
    const half = window.innerWidth / 2;
    mouseInfluence = ((e.clientX - half) / half) * 0.08;
});

// ── Particules flottantes ────────────────────────────────
const particlesGeo = new THREE.BufferGeometry();
const N = 120;
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
});
const particles = new THREE.Points(particlesGeo, particlesMat);
scene.add(particles);

// ── Grid au sol ──────────────────────────────────────────
const gridHelper = new THREE.GridHelper(100, 30, 0x2a2520, 0x1a1814);
gridHelper.position.y = -8;
gridHelper.material.opacity = 0.4;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// ── Resize ───────────────────────────────────────────────
const ro = new ResizeObserver(() => {
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
});
ro.observe(canvas.parentElement);

// ── Boucle ───────────────────────────────────────────────
const clock = new THREE.Clock();
let introAngle = 0;
const INTRO_DURATION = 1.5;

function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const delta = clock.getDelta();

    // Intro — zoom et rotation d'entrée
    if (t < INTRO_DURATION) {
        const p = t / INTRO_DURATION;
        const ease = 1 - Math.pow(1 - p, 3);
        camera.position.set(
            60 * (1 + (1 - ease) * 0.4),
            40 * (1 + (1 - ease) * 0.2),
            80 * (1 + (1 - ease) * 0.4)
        );
        camera.lookAt(0, 0, 0);
    }

    // Rotation auto lente
    targetRotY += 0.01 + mouseInfluence * 0.01;
    currentRotY += (targetRotY - currentRotY) * 0.05;
    pivot.rotation.y = currentRotY;

    // Légère oscillation verticale
    pivot.position.y = Math.sin(t * 0.4) * 0.5;

    // Particules — mouvement lent
    particles.rotation.y = t * 0.02;
    particles.rotation.x = t * 0.01;

    renderer.render(scene, camera);
}

animate();