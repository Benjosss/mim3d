import * as THREE from 'three';

/**
 * Gère l'avatar du joueur en vue à la première personne (FPS).
 * Responsable du chargement du modèle, de la gestion des animations,
 * et de l'asservissement de la caméra sur le corps du personnage.
 * * @class AppFpsPlayer
 */
export default class AppFpsPlayer {
    /** @type {string[]} Liste des mots-clés pour identifier les parties du corps à masquer (pour éviter de voir l'intérieur de sa propre tête). */
    FPS_HIDDEN_PARTS = ['head', 'hair', 'eyes'];

    /** @type {number} Facteur d'échelle appliqué au modèle 3D. */
    SCALING_FACTOR = 0.9;

    /** @type {number} Limite d'inclinaison de la caméra vers le bas (en radians) pour éviter les rotations à 360°. */
    NEGATIVE_PITCH_LIMIT = -0.9;

    /**
     * @param {THREE.Scene} scene - La scène principale.
     * @param {GLTFLoader} gltfLoader - Le chargeur de modèles 3D.
     * @param {THREE.Camera} camera - La caméra attachée au joueur.
     * @param {Object} config - Configuration globale (hauteur du joueur, etc.).
     */
    constructor(scene, gltfLoader, camera, config) {
        this.scene = scene;
        this.gltfLoader = gltfLoader;
        this.camera = camera;
        this.config = config;

        /** @type {THREE.AnimationMixer|null} Moteur d'animations Three.js. */
        this.mixer = null;

        /** @type {THREE.Group|null} Référence au modèle 3D chargé. */
        this.model = null;
    }

    /**
     * Charge et initialise le personnage FPS.
     * * Mécanique :
     * 1. Charge le fichier GLB/GLTF.
     * 2. Parcourt le modèle pour masquer la tête (confort visuel en FPS).
     * 3. Active les ombres pour le corps.
     * 4. Initialise les animations (marche, repos, geste).
     * * @param {string} path - Chemin vers le fichier du modèle 3D.
     * @returns {THREE.Group} Le groupe contenant le joueur.
     */
    initFpsCharacter(path) {
        const player = new THREE.Group();
        this.scene.add(player);

        this.gltfLoader.load(path, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(this.SCALING_FACTOR, this.SCALING_FACTOR, this.SCALING_FACTOR);
            this.model.position.y = 0;

            // On tourne le modèle de 180° car les modèles sont souvent orientés vers l'arrière par défaut
            this.model.rotation.y = Math.PI;

            this.model.traverse(node => {
                if (node.isMesh) {
                    // Le corps du joueur projette et reçoit des ombres
                    node.castShadow = true;
                    node.receiveShadow = true;

                    // Masquage sélectif des parties de la tête pour ne pas gêner la caméra
                    const nameLower = node.name.toLowerCase();
                    node.visible = !this.FPS_HIDDEN_PARTS.some(part => nameLower.includes(part));
                }
            });

            // --- Gestion des Animations ---
            this.mixer = new THREE.AnimationMixer(this.model);
            const actions = {};

            // Stockage de toutes les animations disponibles dans un dictionnaire
            gltf.animations.forEach(clip => {
                actions[clip.name.toLowerCase()] = this.mixer.clipAction(clip);
            });

            // Sauvegarde des actions dans userData pour un accès facile via d'autres classes (ex: Pathfinding)
            this.model.userData.actions = actions;

            // Préparation des états d'animation (lancés mais mis en pause)
            const walkAction = actions['walk'];
            walkAction.play();
            walkAction.paused = true;

            const idleAction = actions['idle'];
            idleAction.play();
            idleAction.paused = true;

            const handAction = actions['pointing'];
            handAction.play();
            handAction.paused = true;

            player.add(this.model);

        }, undefined, (error) => console.error("Erreur de chargement du modèle personnage :", error));

        return player;
    }

    /**
     * Positionne la caméra au niveau des yeux du personnage.
     * * @param {THREE.Vector3} playerPos - Position actuelle des pieds du joueur.
     */
    cameraFollowPlayer(playerPos) {
        const camera = this.camera;
        const CONFIG = this.config;

        // On calcule la direction du regard pour décaler légèrement la caméra vers l'avant
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);

        // Positionnement : Pieds + Hauteur yeux + petit décalage frontal (0.12) pour éviter de voir l'intérieur du cou
        camera.position.set(
            playerPos.x + forward.x * 0.12,
            playerPos.y + CONFIG.playerHeight,
            playerPos.z + forward.z * 0.12
        );
    }

    /**
     * Aligne l'orientation du corps (Yaw / lacet) sur l'orientation de la caméra.
     * Le modèle 3D tournera horizontalement pour suivre le regard.
     * * @param {THREE.Group} player - Le groupe d'objets du joueur.
     * @param {THREE.Vector3} playerPos - Position cible.
     */
    playerYawFollow(player, playerPos){
        const camera = this.camera;

        player.position.copy(playerPos);

        if (this.model) {
            // Extraction de l'angle de rotation Y (horizontal) de la caméra
            const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
            // On applique cet angle au modèle (avec compensation de 180° / PI)
            this.model.rotation.y = yaw + Math.PI;
        }
    }

    /**
     * Limite la rotation verticale (Pitch / tangage) de la caméra.
     * Empêche le joueur de "faire le tour" en regardant trop haut ou trop bas.
     */
    playerPitchLimit(){
        const camera = this.camera;

        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');

        // Clamp de la rotation X (verticale) entre la limite basse et le zénith (PI/2)
        euler.x = Math.max(this.NEGATIVE_PITCH_LIMIT, Math.min(Math.PI / 2, euler.x));

        camera.quaternion.setFromEuler(euler);
    }
}