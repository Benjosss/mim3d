import * as THREE from "three";

export default class SceneSetup {
    constructor(config) {
        this.scene = new THREE.Scene();
        this.config = config;
    }

    getScene() {
        return this.scene;
    }

    buildSky(){
        const scene = this.scene;
        scene.background = new THREE.Color(0x1a1a2e);

        let texture_ft = new THREE.TextureLoader().load('/models/skybox/miramar_ft.jpg', () => {}, () => {}, () => {} );
        let texture_bk = new THREE.TextureLoader().load('/models/skybox/miramar_bk.jpg', () => {}, () => {}, () => {});
        let texture_up = new THREE.TextureLoader().load('/models/skybox/miramar_up.jpg', () => {}, () => {}, () => {});
        let texture_dn = new THREE.TextureLoader().load('/models/skybox/miramar_dn.jpg', () => {}, () => {}, () => {});
        let texture_rt = new THREE.TextureLoader().load('/models/skybox/miramar_rt.jpg', () => {}, () => {}, () => {});
        let texture_lf = new THREE.TextureLoader().load('/models/skybox/miramar_lf.jpg', () => {}, () => {}, () => {});

        let skyArray = [
            new THREE.MeshBasicMaterial({map: texture_ft}),
            new THREE.MeshBasicMaterial({map: texture_bk}),
            new THREE.MeshBasicMaterial({map: texture_up}),
            new THREE.MeshBasicMaterial({map: texture_dn}),
            new THREE.MeshBasicMaterial({map: texture_rt}),
            new THREE.MeshBasicMaterial({map: texture_lf})
        ]

        for (let i = 0; i < 6; i++) {
            skyArray[i].side = THREE.BackSide;
        }

        let skyboxGeo = new THREE.BoxGeometry(10000, 10000, 10000);
        let skybox = new THREE.Mesh(skyboxGeo, skyArray);
        scene.add(skybox);
    }

    buildCamera(){
        const scene = this.scene;
        const CONFIG = this.config;

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        camera.position.set(...CONFIG.spawnPoint);
        scene.add(camera);

        return camera;
    }

    buildCrossHair(camera) {
        const geometry = new THREE.CircleGeometry(0.005, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            depthTest: false,
            transparent: true,
            opacity: 0.8
        });

        const crossHair = new THREE.Mesh(geometry, material);
        crossHair.position.set(0, 0, -1);
        camera.add(crossHair);
    }

    buildRenderer(){
        const renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(renderer.domElement);

        return renderer;
    }

    buildLights(){
        const scene = this.scene;

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        const dirLight = new THREE.DirectionalLight(0xffffff, 3);
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;

        scene.add(ambientLight);
        scene.add(dirLight);
    }

    initResize(camera, renderer){
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}