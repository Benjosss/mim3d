import * as THREE from "three";

/**
 * Représente une unité spatiale (salle, couloir) de l'application.
 * Gère son propre chargement 3D (HD et Imposteur), ses collisions (BVH) et sa mémoire.
 */
export class Zone {
    /**
     * @param {Object} config - Objet de configuration de la zone.
     * @param {string} config.name - Identifiant unique de la zone.
     * @param {string} config.displayName - Nom lisible affiché dans l'UI.
     * @param {string[]} [config.otherNames] - Synonymes ou alias de la zone.
     * @param {string} config.path - URL du modèle GLB haute définition.
     * @param {string} [config.impostorPath] - URL du modèle GLB basse résolution.
     * @param {boolean} config.physics - Indique si la zone bloque le passage (collisions).
     * @param {string} config.type - Catégorie (office, toilets, misc, etc.).
     * @param {string} config.description - Texte descriptif.
     * @param {Array} [config.persons] - Occupants (pour les bureaux).
     * @param {string[]} [config.adjacentZoneNames] - Zones connectées pour le streaming.
     * @param {THREE.Box3} config.triggerBox - Boîte englobante pour la détection de présence.
     * @param {THREE.Vector3} config.pathCoords - Point d'arrivée pour le pathfinding.
     */
    constructor(config) {
        this.name = config.name;
        this.displayName = config.displayName;
        this.otherNames = config.otherNames ?? [];
        this.modelPath = config.path;
        this.impostorPath = config.impostorPath;
        this.physics = config.physics;
        this.type = config.type;
        this.description = config.description;
        this.persons = config.persons ?? [];
        this.adjacentZoneNames = config.adjacentZoneNames ?? [];
        this.triggerBox = config.triggerBox;
        this.pathCoords = config.pathCoords;

        /** @type {THREE.Group|null} Modèle HD */
        this.content = null;
        /** @type {THREE.Group|null} Modèle basse résolution */
        this.impostorContent = null;
        /** @type {THREE.Mesh[]} Maillages servant aux collisions */
        this.colliderMeshes = [];

        this.isLoaded = false;
        this.isImpostorLoaded = false;
        this.isLoading = false;
        this.isVisible = false;
    }

    /**
     * Charge le modèle HD, configure les matériaux et calcule les arbres de collision (BVH).
     * @param {GLTFLoader} loader - Instance du chargeur Three.js.
     * @returns {Promise<void>}
     */
    async load(loader) {
        if (this.isLoaded || this.isLoading) return;
        this.isLoading = true;

        try {
            const gltf = await loader.loadAsync(this.modelPath);
            this.content = gltf.scene;
            this.content.visible = false;
            this.colliderMeshes = [];

            // Propriétés des meshes
            this.content.traverse(child => {
                if (child.isMesh) {
                    // Ajustement automatique du métal pour éviter l'aspect trop brillant
                    child.traverse(node => {
                        if (node.isMesh && node.material.metalness === 1) {
                            node.material.metalness = 0.3;
                            node.material.roughness = 0.5;
                        }
                    });

                    // Configuration des objets décoratifs (sans collisions ou tag NOCOL)
                    if (!this.physics || child.name.includes("NOCOL")) {
                        child.visible = true;
                        // Ombrages
                        child.castShadow = true;
                        child.receiveShadow = true;

                        // Gestion spécifique des matériaux transparents/verre
                        const mat = child.material;
                        if (mat.map) mat.map.anisotropy = 16;
                        if (mat.transparent || mat.opacity < 1) {
                            mat.transparent = true;
                            mat.opacity = Math.max(mat.opacity, 0.3);
                            mat.side = THREE.DoubleSide;
                            mat.depthWrite = false;
                            child.renderOrder = 1;
                        }
                    }

                    // Extraction et calcul BVH pour les maillages de collision (SIMP_COL)
                    if (this.physics && child.name.includes("SIMP_COL")) {
                        if (!child.geometry.boundsTree) {
                            child.visible = false;
                            child.geometry.computeBoundsTree(); // Génération de l'arbre de collision
                            child.updateMatrixWorld(true);
                            this.colliderMeshes.push(child);
                        }
                    }
                }
            });

            this.isLoaded = true;
            this.isLoading = false;
        } catch (e) {
            this.isLoading = false;
            throw e;
        }
    }

    /**
     * Charge le modèle "Imposteur" (basse qualité) pour l'affichage lointain.
     * @param {GLTFLoader} loader
     * @param {boolean} debugMode - Si vrai, rend l'imposteur semi-transparent.
     */
    async loadImpostor(loader, debugMode) {
        if (this.isImpostorLoaded || !this.impostorPath) return;

        const gltf = await loader.loadAsync(this.impostorPath);
        this.impostorContent = gltf.scene;

        this.impostorContent.traverse(child => {
            if (child.isMesh) {
                // Mode Debug : vision "fantôme" des zones non chargées
                if (debugMode) {
                    child.material.format = THREE.RGBAFormat;
                    child.material.transparent = true;
                    child.material.opacity = 0.5;
                }
                // Cache les collisionneurs simplifiés de l'imposteur
                if (child.name.includes("SIMP_COL")) child.visible = false;
            }
        });

        // Aligne l'imposteur sur la position du modèle HD
        if (this.content) {
            this.impostorContent.position.copy(this.content.position);
            this.impostorContent.rotation.copy(this.content.rotation);
            this.impostorContent.scale.copy(this.content.scale);
        }

        this.impostorContent.visible = false;
        this.isImpostorLoaded = true;
    }

    /**
     * Ajoute le modèle HD à la scène.
     * @param {THREE.Scene} scene
     */
    show(scene) {
        if (!this.isLoaded || this.isVisible) return;
        scene.add(this.content);
        this.content.visible = true;
        this.isVisible = true;
    }

    /**
     * Retire le modèle HD de la scène (garde les données en mémoire).
     * @param {THREE.Scene} scene
     */
    hide(scene) {
        if (!this.isVisible) return;
        scene.remove(this.content);
        this.isVisible = false;
    }

    /**
     * Supprime le modèle de la scène et libère les ressources GPU (Géométries, Textures, BVH).
     * @param {THREE.Scene} scene
     */
    unload(scene) {
        if (!this.isLoaded) return;
        this.hide(scene);

        this.hide(scene); // On retire le modèle HD de la scène

        // On vide uniquement le contenu lourd (Meshes HD + BVH)
        this.content.traverse(child => {
            if (child.isMesh) {
                // Libération spécifique au plugin mesh-bvh
                if (child.geometry.boundsTree) child.geometry.disposeBoundsTree();
                child.geometry.dispose();

                if (Array.isArray(child.material)) {
                    child.material.forEach(m => this._disposeMaterial(m));
                } else {
                    this._disposeMaterial(child.material);
                }
            }
        });

        this.content = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.colliderMeshes = [];
    }

    /**
     * Nettoie proprement un matériau et ses textures.
     * @private
     */
    _disposeMaterial(material) {
        for (const key of Object.keys(material)) {
            const value = material[key];
            if (value && value.isTexture) value.dispose();
        }
        material.dispose();
    }

    /**
     * Vérifie si un point (ex: position joueur) se trouve dans la TriggerBox.
     * @param {THREE.Vector3} point
     * @returns {boolean}
     */
    isPointInside(point) {
        return this.triggerBox.containsPoint(point);
    }
}