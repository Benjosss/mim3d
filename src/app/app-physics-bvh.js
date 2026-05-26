import * as THREE from "three";

export default class AppPhysicsBvh {
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
        this._deltaMove = new THREE.Vector3();
    }

    /**
     * Résolution des collisions capsule/monde via BVH.
     * Teste chaque mesh de collision actif dans colliderMeshes.
     * Pousse le joueur hors des surfaces de manière itérative.
     */
    playerCollisions() {
        const CONFIG = this.config;
        const colliderMeshes = this.colliderMeshes;
        const playerPos = this.playerPos;
        const playerVelocity = this.playerVelocity;
        this.playerOnFloor = false;
        const _capsuleTop = this.capsuleTop;
        const _capsuleBottom = this.capsuleBottom;
        const _matrix = this.matrix;
        const _normal = this.normal;

        const EPS = 0.0001;          // seuil anti micro-collisions
        const MAX_PUSH = 10;         // limite de corrections par mesh
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

                    localBottom.copy(_capsuleBottom).applyMatrix4(invMat);
                    localTop.copy(_capsuleTop).applyMatrix4(invMat);
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
                        this.playerOnFloor = true;

                        // empêche rebond vertical
                        if (playerVelocity.y < 0) playerVelocity.y = 0;

                        // colle légèrement au sol (empêche les micro-sauts)
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
                    const push = depth * scale + EPS;
                    playerPos.addScaledVector(worldNormal, push);

                    pushCount++;

                    return false;
                }
            });
        }
    }

    getForwardVector() {
        const camera = this.camera;
        const playerDirection = this.playerDirection;

        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();

        return playerDirection;
    }

    getSideVector() {
        const camera = this.camera;
        const playerDirection = this.playerDirection;

        camera.getWorldDirection(playerDirection);
        playerDirection.y = 0;
        playerDirection.normalize();
        playerDirection.cross(camera.up);

        return playerDirection;
    }

    updatePlayerYVelocity(deltaTime) {
        const playerVelocity = this.playerVelocity;
        const CONFIG = this.config;

        if (!this.playerOnFloor) {
            playerVelocity.y -= CONFIG.gravity * deltaTime;
        } else {
            playerVelocity.y = Math.max(0, playerVelocity.y);
        }
    }

    playerCollisionsSubStepping(steps, deltaTime) {
        const subDelta = deltaTime / steps;

        for (let i = 0; i < steps; i++) {
            if (!this.playerOnFloor) {
                this.playerVelocity.y -= this.config.gravity * subDelta;
            }

            this._deltaMove.copy(this.playerVelocity).multiplyScalar(subDelta);
            this.playerPos.add(this._deltaMove);

            this.playerCollisions();

            if (this.playerVelocity.y < -30 && !this.playerOnFloor || this.playerPos.y < -1) {
                this.backToSpawnPoint();
            }
        }
    }

    backToSpawnPoint(){
            const spawn = this.config.spawnPoint.clone();
            this.playerPos.copy(spawn);
            this.playerVelocity.set(0, 0, 0);
    }
}