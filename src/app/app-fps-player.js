import * as THREE from 'three';

export default class AppFpsPlayer {
    FPS_HIDDEN_PARTS = ['head', 'hair', 'eyes', 'internal', 'internal2'];

    constructor(scene, gltfLoader, camera, config) {
        this.scene = scene;
        this.gltfLoader = gltfLoader;
        this.camera = camera;
        this.config = config
        this.mixer = null;
        this.model = null;
    }

    initFpsCharacter(path) {
        const player = new THREE.Group();
        this.scene.add(player);

        this.gltfLoader.load(path, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(0.8, 0.8, 0.8);
            this.model.position.y = 0;
            this.model.rotation.y = Math.PI; // Rotation de 180 deg

            this.model.traverse(node => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                    const nameLower = node.name.toLowerCase();
                    node.visible = !this.FPS_HIDDEN_PARTS.some(part => nameLower.includes(part));
                }
            });

            this.mixer = new THREE.AnimationMixer(this.model);

            const animations = gltf.animations;
            const clip = animations[0];

            // Supprime les déplacements du modèle (root motion)
            clip.tracks = clip.tracks.filter(track => {
                return !(track.name.includes('position') &&
                    (track.name.includes('Hips') || track.name.includes('hips')));
            });

            const walkAction = this.mixer.clipAction(clip);
            walkAction.play();
            walkAction.paused = true;
            this.model.userData.walkAction = walkAction;

            player.add(this.model);

        }, undefined, (error) => console.error("Erreur chargement personnage :", error));

        return player
    }

    camera

    cameraFollowPlayer(playerPos) {
        const camera = this.camera;
        const CONFIG = this.config;

        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        camera.position.set(
            playerPos.x + forward.x * 0.12, // 0.12 pour être juste devant les yeux
            playerPos.y + CONFIG.playerHeight,
            playerPos.z + forward.z * 0.12 // 0.12 pour être juste devant les yeux
        );
    }

    playerYawFollow(player, playerPos){
        const camera = this.camera;

        player.position.copy(playerPos);
        if (this.model) {
            const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
            this.model.rotation.y = yaw + Math.PI;
        }
    }

    playerPitchLimit(){
        const camera = this.camera;

        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
        euler.x = Math.max(-0.9, Math.min(Math.PI / 2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }
}