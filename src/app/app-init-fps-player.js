import * as THREE from 'three';

export default class AppInitFpsPlayer {
    FPS_HIDDEN_PARTS = ['head', 'hair', 'eyes', 'internal', 'internal2'];

    constructor(scene, gltfLoader) {
        this.scene = scene;
        this.gltfLoader = gltfLoader;
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

            // Supprime les déplacement du modèle (root motion)
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
}