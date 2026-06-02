import * as THREE from "three";

/**
 * Gestion de la physique du joueur via BVH (Bounding Volume Hierarchy).
 */
export default class AppPhysicsBvh {

    /**
     * @param {Object}          config                - Configuration globale du joueur.
     * @param {THREE.Camera}    camera                - Caméra principale.
     * @param {THREE.Mesh[]}    colliderMeshes        - Meshes de collision actifs.
     * @param {THREE.Vector3}   playerPos             - Position (partagée).
     * @param {THREE.Vector3}   playerVelocity        - Vélocité (partagée).
     * @param {THREE.Vector3}   playerDirection       - Direction (partagée).
     * @param {boolean}         playerOnFloor         - État sol.
     * @param {THREE.Vector3}   capsuleTop            - Vecteur sommet capsule.
     * @param {THREE.Vector3}   capsuleBottom         - Vecteur base capsule.
     * @param {THREE.Vector3}   normal                - Vecteur normale.
     * @param {THREE.Matrix4}   matrix                - Matrice de calcul.
     */
    constructor(config, camera, colliderMeshes, playerPos, playerVelocity, playerDirection, playerOnFloor, capsuleTop, capsuleBottom, normal, matrix) {
        this.config = config;
        this.camera = camera;
        this.colliderMeshes = colliderMeshes;
        this.playerPos = playerPos;
        this.playerVelocity = playerVelocity;
        this.playerDirection = playerDirection;
        this.playerOnFloor = playerOnFloor;
        this.capsuleTop = capsuleTop;
        this.capsuleBottom = capsuleBottom;
        this.normal = normal;
        this.matrix = matrix;

        /** @type {THREE.Vector3} Vecteur de déplacement réutilisable. */
        this._deltaMove = new THREE.Vector3();
    }

    /**
     * Résout les collisions entre la capsule du joueur et le monde.
     */
    playerCollisions() {
        const CONFIG = this.config;
        const colliderMeshes = this.colliderMeshes;
        const playerPos = this.playerPos;
        const playerVelocity = this.playerVelocity;

        // Réinitialise l'état au sol avant de vérifier les contacts
        this.playerOnFloor = false;

        const _capsuleTop = this.capsuleTop;
        const _capsuleBottom = this.capsuleBottom;
        const _matrix = this.matrix;
        const _normal = this.normal;

        const EPS = 0.0001;          // Seuil de précision pour éviter les flottements
        const MAX_PUSH = 10;         // Limite itérative pour stabiliser les coins/angles morts
        let pushCount = 0;

        // Définit les points de segment de la capsule (base et sommet) selon le rayon
        _capsuleBottom.copy(playerPos);
        _capsuleBottom.y = playerPos.y + CONFIG.playerRadius;

        _capsuleTop.copy(playerPos);
        _capsuleTop.y = playerPos.y + CONFIG.playerHeight - CONFIG.playerRadius;

        // Itération sur chaque mesh collisionneur présent dans la scène
        for (const mesh of colliderMeshes) {
            // Sécurité : on ignore les meshes sans structure BVH
            if (!mesh.geometry.boundsTree) continue;

            pushCount = 0;

            // Calcul de la matrice inverse pour transformer le joueur dans l'espace local du mesh
            const invMat = _matrix.copy(mesh.matrixWorld).invert();

            // Transformation des points de la capsule dans l'espace local
            const localBottom = _capsuleBottom.clone().applyMatrix4(invMat);
            const localTop = _capsuleTop.clone().applyMatrix4(invMat);

            // Ajustement du rayon en fonction de l'échelle du mesh pour garder une collision cohérente
            const scale = mesh.matrixWorld.getMaxScaleOnAxis();
            const localR = CONFIG.playerRadius / scale;

            // Lancement du test de collision BVH
            mesh.geometry.boundsTree.shapecast({
                /**
                 * Phase 1 : Test rapide sur les volumes englobants (AABB)
                 */
                intersectsBounds: box => {
                    const capsuleBox = new THREE.Box3();

                    // Création d'une boîte englobante autour de la capsule
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

                    // Si les boîtes ne se touchent pas, on ignore cette branche de l'arbre
                    return capsuleBox.intersectsBox(box);
                },

                /**
                 * Phase 2 : Test précis sur les triangles intersectés
                 */
                intersectsTriangle: tri => {
                    // Sortie anticipée si on a déjà fait trop de corrections sur ce mesh
                    if (pushCount >= MAX_PUSH) return false;

                    // Mise à jour de la position locale de la capsule (peut changer entre deux triangles)
                    localBottom.copy(_capsuleBottom).applyMatrix4(invMat);
                    localTop.copy(_capsuleTop).applyMatrix4(invMat);
                    const capsuleSeg = new THREE.Line3(localBottom, localTop);

                    const closestPointOnTriangle = new THREE.Vector3();
                    const closestPointOnSegment = new THREE.Vector3();

                    // Trouve la distance la plus courte entre le segment (capsule) et le triangle
                    tri.closestPointToSegment(
                        capsuleSeg,
                        closestPointOnTriangle,
                        closestPointOnSegment
                    );

                    const distance = closestPointOnSegment.distanceTo(closestPointOnTriangle);

                    // Vérifie si la distance est inférieure au rayon (pénétration réelle)
                    if (distance >= localR - EPS) return false;

                    // Calcul de la profondeur de pénétration
                    const depth = localR - distance;

                    // Calcul de la normale de collision (direction de la poussée)
                    _normal.subVectors(closestPointOnSegment, closestPointOnTriangle);

                    // Sécurité si les points sont superposés
                    if (_normal.lengthSq() === 0) return false;

                    _normal.normalize();

                    // Transformation de la normale locale en direction monde
                    const worldNormal = _normal.clone().transformDirection(mesh.matrixWorld);

                    // --- LOGIQUE DE SURFACE ---

                    // Si la normale pointe vers le haut (> 45°), c'est un SOL
                    if (worldNormal.y > 0.5) {
                        this.playerOnFloor = true;

                        // Annulation de la vélocité verticale descendante pour éviter de traverser
                        if (playerVelocity.y < 0) playerVelocity.y = 0;
                    }

                    // Si la normale pointe vers le bas, c'est un PLAFOND
                    else if (worldNormal.y < -0.5) {
                        // Stoppe l'ascension en cas de choc au plafond
                        if (playerVelocity.y > 0) playerVelocity.y = 0;
                    }

                    // Sinon, c'est un MUR ou un plan incliné
                    else {
                        // Projection de la vélocité sur le plan du mur (glissement)
                        const dot = playerVelocity.dot(worldNormal);
                        if (dot < 0) {
                            playerVelocity.addScaledVector(worldNormal, -dot);
                        }
                    }

                    // --- RÉSOLUTION DE LA POSITION ---
                    // Pousse le joueur hors du triangle pour annuler la pénétration
                    const push = depth * scale + EPS;
                    playerPos.addScaledVector(worldNormal, push);

                    pushCount++;

                    return false; // Continue le shapecast vers d'autres triangles
                }
            });
        }
    }

    /**
     * Retourne le vecteur avant du joueur (plan XZ).
     */
    getForwardVector() {
        const camera = this.camera;
        const playerDirection = this.playerDirection;

        // Récupère l'orientation de la caméra
        camera.getWorldDirection(playerDirection);
        // Supprime l'inclinaison verticale pour rester sur un plan horizontal
        playerDirection.y = 0;
        playerDirection.normalize();

        return playerDirection;
    }

    /**
     * Retourne le vecteur latéral (droite) du joueur.
     */
    getSideVector() {
        const camera = this.camera;
        const playerDirection = this.playerDirection;

        // Récupère l'orientation avant
        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();

        // Calcule le produit vectoriel avec l'axe Y (Haut) pour obtenir la droite
        playerDirection.cross(camera.up);

        return playerDirection;
    }

    /**
     * Met à jour la gravité du joueur.
     */
    updatePlayerYVelocity(deltaTime) {
        const playerVelocity = this.playerVelocity;
        const CONFIG = this.config;

        // Applique l'accélération gravitationnelle si le joueur ne touche pas le sol
        if (!this.playerOnFloor) {
            playerVelocity.y -= CONFIG.gravity * deltaTime;
        } else {
            // Au sol, on s'assure que la vélocité n'est jamais négative (accumulation de force vers le bas)
            playerVelocity.y = Math.max(0, playerVelocity.y);
        }
    }

    /**
     * Intègre le mouvement via sous-pas de temps pour la stabilité.
     */
    playerCollisionsSubStepping(steps, deltaTime) {
        // Découpe le temps de la frame en petits intervalles
        const subDelta = deltaTime / steps;

        for (let i = 0; i < steps; i++) {
            // 1. Application de la gravité pour ce sous-pas
            if (!this.playerOnFloor) {
                this.playerVelocity.y -= this.config.gravity * subDelta;
            }

            // 2. Application du déplacement (Position = Position + Vitesse * Temps)
            this._deltaMove.copy(this.playerVelocity).multiplyScalar(subDelta);
            this.playerPos.add(this._deltaMove);

            // 3. Résolution des collisions après le mouvement
            this.playerCollisions();

            // 4. Système de sécurité (Respawn)
            // Déclenché si vitesse de chute extrême (bug physique) ou sortie de map (Y < -1)
            if (this.playerVelocity.y < -30 && !this.playerOnFloor || this.playerPos.y < -1) {
                this.backToSpawnPoint();
            }
        }
    }

    /**
     * Téléporte le joueur au point de spawn.
     */
    backToSpawnPoint() {
        const spawn = this.config.spawnPoint.clone();
        // Réinitialisation de la position
        this.playerPos.copy(spawn);
        // Annulation de toute inertie résiduelle
        this.playerVelocity.set(0, 0, 0);
    }
}