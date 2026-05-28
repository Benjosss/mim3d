import * as THREE from "three";
import {BackSide, PCFShadowMap} from "three";
import {HDRLoader} from "three/addons";

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

        const hdrLoader = new HDRLoader();
        hdrLoader.load('/models/skybox/day_ibl.hdr', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            scene.environmentIntensity = 0.3;
            scene.environment = texture; // éclaire tous les matériaux
            scene.background  = texture; // remplace la skybox
        });

        // let texture_ft = new THREE.TextureLoader().load('/models/skybox/miramar_ft.jpg', () => {}, () => {}, () => {} );
        // let texture_bk = new THREE.TextureLoader().load('/models/skybox/miramar_bk.jpg', () => {}, () => {}, () => {});
        // let texture_up = new THREE.TextureLoader().load('/models/skybox/miramar_up.jpg', () => {}, () => {}, () => {});
        // let texture_dn = new THREE.TextureLoader().load('/models/skybox/miramar_dn.jpg', () => {}, () => {}, () => {});
        // let texture_rt = new THREE.TextureLoader().load('/models/skybox/miramar_rt.jpg', () => {}, () => {}, () => {});
        // let texture_lf = new THREE.TextureLoader().load('/models/skybox/miramar_lf.jpg', () => {}, () => {}, () => {});
        //
        // let skyArray = [
        //     new THREE.MeshBasicMaterial({map: texture_ft}),
        //     new THREE.MeshBasicMaterial({map: texture_bk}),
        //     new THREE.MeshBasicMaterial({map: texture_up}),
        //     new THREE.MeshBasicMaterial({map: texture_dn}),
        //     new THREE.MeshBasicMaterial({map: texture_rt}),
        //     new THREE.MeshBasicMaterial({map: texture_lf})
        // ]
        //
        // for (let i = 0; i < 6; i++) {
        //     skyArray[i].side = BackSide;
        // }
        //
        // let skyboxGeo = new THREE.BoxGeometry(10000, 10000, 10000);
        // let skybox = new THREE.Mesh(skyboxGeo, skyArray);
        // scene.add(skybox);
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
        renderer.shadowMap.type = PCFShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        document.body.appendChild(renderer.domElement);

        return renderer;
    }

    buildLights() {
        const scene = this.scene;

        const ambientLight = new THREE.AmbientLight(0xe8f4ff, 0.5);

        const sunLight = new THREE.DirectionalLight(0xfff4d6, 3.5);
        sunLight.position.set(60, 80, 40);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width  = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far  = 200;
        sunLight.shadow.camera.left   = -80;
        sunLight.shadow.camera.right  =  80;
        sunLight.shadow.camera.top    =  80;
        sunLight.shadow.camera.bottom = -80;
        sunLight.shadow.radius  = 4;
        sunLight.shadow.bias = -0.001;

        const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.3); // bleu très atténué
        fillLight.position.set(-40, 30, -20);

        const hemiLight = new THREE.HemisphereLight(
            0xd6ecff,
            0xc8b89a,
            0.6
        );

        scene.fog = new THREE.FogExp2(0xe8f4ff, 0.001);

        scene.add(ambientLight);
        scene.add(sunLight);
        scene.add(fillLight);
        scene.add(hemiLight);

    }

    initResize(camera, renderer){
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}