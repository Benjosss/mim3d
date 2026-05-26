import * as THREE from "three";

export default class AppDebugUtils{
    constructor(scene, config){
        this.scene = scene;
        this.config = config;
    }

    buildPlayerCapsuleHelper(){
        const scene = this.scene;
        const CONFIG = this.config;

        const debugMat = new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true});
        const capsuleHelper = new THREE.Group();
        const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.playerRadius, CONFIG.playerRadius, CONFIG.playerHeight, 8), debugMat);
        const sphereTop = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.playerRadius, 8, 8), debugMat);
        const sphereBot = new THREE.Mesh(new THREE.SphereGeometry(CONFIG.playerRadius, 8, 8), debugMat);
        sphereTop.position.y = CONFIG.playerHeight / 2;
        sphereBot.position.y = -CONFIG.playerHeight / 2;
        capsuleHelper.add(bodyMesh, sphereTop, sphereBot);
        capsuleHelper.visible = CONFIG.debugMode;
        scene.add(capsuleHelper);

        return capsuleHelper;
    }

    playerCapsuleHelperFollow(capsuleHelper, playerPos){
        const CONFIG = this.config;

        capsuleHelper.position.set(
            playerPos.x,
            playerPos.y + CONFIG.playerHeight / 2,
            playerPos.z
        );
    }

    buildColliderMeshesHelper(colliderMeshes){
        const scene = this.scene;

        colliderMeshes.forEach(mesh => {
            // On crée un clone visuel en fil de fer pour ne pas casser le matériau original
            const wireframeGeom = new THREE.WireframeGeometry(mesh.geometry);
            const wireframe = new THREE.LineSegments(wireframeGeom);

            // On applique la même position/rotation que le mesh original
            wireframe.matrixAutoUpdate = false;
            wireframe.matrix.copy(mesh.matrixWorld);

            // Couleur rouge pour les collisions
            wireframe.material.color.set(0xff0000);
            wireframe.material.opacity = 0.5;
            wireframe.material.transparent = true;

            scene.add(wireframe);
        });
    }

}