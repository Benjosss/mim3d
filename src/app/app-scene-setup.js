import * as THREE from "three";
import { PCFShadowMap } from "three";
import { HDRLoader } from "three/addons";

/**
 * Classe responsable de la configuration initiale de la scène Three.js.
 * Elle gère la création des lumières, de la caméra, du moteur de rendu,
 * de la skybox et des événements de redimensionnement.
 * * @class SceneSetup
 */
export default class SceneSetup {
    /**
     * @param {Object} config - Objet de configuration globale contenant les points de spawn et de regard.
     */
    constructor(config) {
        /** @type {THREE.Scene} La scène principale de l'application. */
        this.scene = new THREE.Scene();
        /** @type {Object} Référence à la configuration globale. */
        this.config = config;
    }

    /** @type {string} Chemin vers le fichier HDR pour l'éclairage global et la skybox. */
    SKY_PATH = '/models/skybox/day_ibl.hdr'

    /**
     * Retourne l'instance de la scène.
     * @returns {THREE.Scene}
     */
    getScene() {
        return this.scene;
    }

    /**
     * Configure l'environnement céleste (Skybox) et l'éclairage basé sur une image (IBL).
     * Utilise un chargeur HDR pour obtenir des reflets et des couleurs plus réalistes.
     */
    buildSky() {
        const scene = this.scene;
        // Couleur de fond par défaut en attendant le chargement de l'image
        scene.background = new THREE.Color(0x1a1a2e);

        const hdrLoader = new HDRLoader();
        hdrLoader.load(this.SKY_PATH, (texture) => {
            // Mapping équirectangulaire pour projeter l'image sur une sphère infinie
            texture.mapping = THREE.EquirectangularReflectionMapping;

            // Intensité des reflets générés par l'environnement sur les matériaux
            scene.environmentIntensity = 0.3;

            // Applique la texture comme source de lumière pour tous les objets PBR
            scene.environment = texture;

            // Définit la texture comme fond visible
            scene.background = texture;
        });
    }

    /**
     * Initialise la caméra de perspective et la place selon la configuration.
     * @returns {THREE.PerspectiveCamera} La caméra configurée.
     */
    buildCamera() {
        const scene = this.scene;
        const CONFIG = this.config;

        // Paramètres : FOV (75°), Aspect Ratio, Near (0.1), Far (10000)
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);

        // Positionnement initial défini dans app.js
        camera.position.set(...CONFIG.spawnPoint);

        // Oriente la caméra vers la cible par défaut
        camera.lookAt(CONFIG.lookAt);

        scene.add(camera);

        return camera;
    }

    /**
     * Ajoute un réticule (crosshair) fixe au centre de l'écran.
     * Le réticule est attaché à la caméra pour rester immobile par rapport au regard.
     * @param {THREE.Camera} camera - La caméra sur laquelle attacher le réticule.
     */
    buildCrossHair(camera) {
        // Petit cercle blanc
        const geometry = new THREE.CircleGeometry(0.005, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            depthTest: false,   // S'affiche toujours par-dessus le reste
            transparent: true,
            opacity: 0.8
        });

        const crossHair = new THREE.Mesh(geometry, material);

        // Placé à 1 unité devant la caméra
        crossHair.position.set(0, 0, -1);
        camera.add(crossHair);
    }

    /**
     * Configure le moteur de rendu WebGL avec les options de post-processing et d'ombres.
     * @returns {THREE.WebGLRenderer}
     */
    buildRenderer() {
        const renderer = new THREE.WebGLRenderer({ antialias: true });

        renderer.setSize(window.innerWidth, window.innerHeight);

        // --- Configuration des ombres ---
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PCFShadowMap; // Ombres douces (Percentage Closer Filtering)

        // --- Configuration des couleurs et du Tone Mapping ---
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; // Rendu cinématique des contrastes
        renderer.toneMappingExposure = 1; // Exposition globale

        // Injection du canvas dans le DOM
        document.body.appendChild(renderer.domElement);

        return renderer;
    }

    /**
     * Met en place le système d'éclairage complexe de la scène.
     * Inclut une lumière ambiante, un soleil directionnel (ombres), une lumière de remplissage et un brouillard.
     */
    buildLights() {
        const scene = this.scene;

        // 1. Lumière Ambiante : apporte une luminosité de base globale
        const ambientLight = new THREE.AmbientLight(0xe8f4ff, 0.5);

        // 2. Soleil (DirectionalLight) : source principale qui projette des ombres
        const sunLight = new THREE.DirectionalLight(0xfff4d6, 3.5);
        sunLight.position.set(100, 80, 40);
        sunLight.castShadow = true;

        // Configuration de la résolution des ombres (plus haut = plus net)
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;

        // Définition de la zone de calcul des ombres (le frustum)
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.camera.left = -80;
        sunLight.shadow.camera.right = 80;
        sunLight.shadow.camera.top = 80;
        sunLight.shadow.camera.bottom = -80;

        // Flou des bords d'ombres et correction de l'auto-ombrage (bias)
        sunLight.shadow.radius = 4;
        sunLight.shadow.bias = -0.001;

        // 3. Lumière de remplissage (Fill Light) : débouche les ombres trop noires
        const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.3);
        fillLight.position.set(-40, 30, -20);

        // 4. Lumière Hémisphérique : simule la réflexion du ciel et du sol
        const hemiLight = new THREE.HemisphereLight(
            0xd6ecff, // Couleur du ciel
            0xc8b89a, // Couleur du sol
            0.6       // Intensité
        );

        // 5. Brouillard : réduit la visibilité au loin pour le réalisme (FogExp2 = exponentiel)
        scene.fog = new THREE.FogExp2(0xe8f4ff, 0.001);

        // Ajout de tous les éléments à la scène
        scene.add(ambientLight);
        scene.add(sunLight);
        scene.add(fillLight);
        scene.add(hemiLight);
    }

    /**
     * Initialise l'écouteur d'événement pour le redimensionnement de la fenêtre.
     * Met à jour le ratio de la caméra et la taille du rendu pour éviter les distorsions.
     * @param {THREE.Camera} camera
     * @param {THREE.WebGLRenderer} renderer
     */
    initResize(camera, renderer) {
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}