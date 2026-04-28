import {DRACOLoader} from "three/examples/jsm/loaders/DRACOLoader";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

export default class InitLoader{
    constructor(){
    }

    initGltfLoader(){
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
        dracoLoader.setDecoderConfig({type: "js"});

        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        return loader;
    }
}