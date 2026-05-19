import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {KTX2Loader} from "three/addons/loaders/KTX2Loader.js";

export default class InitLoader{
    constructor(){
    }

    initGltfLoader(renderer){
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
        dracoLoader.setDecoderConfig({type: "js"});

        const ktx2Loader = new KTX2Loader();
        ktx2Loader.setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/basis/");
        ktx2Loader.detectSupport(renderer);

        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);
        loader.setKTX2Loader(ktx2Loader);

        return loader;
    }
}