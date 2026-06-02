import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {KTX2Loader} from "three/addons/loaders/KTX2Loader.js";

/**
 * Classe responsable de l'initialisation des chargeurs de ressources 3D.
 * Configure les décodeurs Draco et KTX2 pour optimiser les performances de chargement.
 */
export default class InitLoader{
    /**
     * Crée une instance de InitLoader.
     */
    constructor(){}

    /**
     * Initialise et configure un GLTFLoader avec le support de la compression Draco et KTX2.
     * @param {THREE.WebGLRenderer} renderer - Le moteur de rendu utilisé pour détecter le support des textures.
     * @returns {GLTFLoader} Le chargeur GLTF configuré et prêt à l'emploi.
     */
    initGltfLoader(renderer){
        // --- Décodeur Draco ---
        // Utilisé pour décompresser les maillages (géométries) compressés
        const dracoLoader = new DRACOLoader();
        // Chemin vers les bibliothèques WebAssembly/JS de Google Draco
        dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
        dracoLoader.setDecoderConfig({type: "js"});

        // --- Décodeur KTX2 ---
        // Utilisé pour les textures compressées au format GPU natif (plus rapide et moins de VRAM)
        const ktx2Loader = new KTX2Loader();
        // Chemin vers les décodeurs de base nécessaires au transcodage
        ktx2Loader.setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/");
        ktx2Loader.detectSupport(renderer);

        // --- Loader Principal .gltf/.glb ---
        const loader = new GLTFLoader();
        // Injection des plugins de décompression dans le chargeur principal
        loader.setDRACOLoader(dracoLoader);
        loader.setKTX2Loader(ktx2Loader);

        return loader;
    }
}