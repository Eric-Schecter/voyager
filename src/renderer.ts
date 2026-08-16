import {
    Scene, PerspectiveCamera, WebGLRenderer, Object3D, ACESFilmicToneMapping
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class Renderer {

    private _scene: Scene;
    private _camera: PerspectiveCamera;
    private _renderer: WebGLRenderer;
    private _controls: OrbitControls;

    public constructor() {
        this._scene = new Scene();

        this._camera = new PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
        this._camera.position.set(40, 20, 30);

        this._renderer = new WebGLRenderer({ antialias: true });
        this._renderer.setSize(window.innerWidth, window.innerHeight);
        this._renderer.setPixelRatio(window.devicePixelRatio);
        this._renderer.toneMapping = ACESFilmicToneMapping;
        // this._renderer.toneMappingExposure = 0.5;
        document.body.appendChild(this._renderer.domElement);

        this._controls = new OrbitControls(this._camera, this._renderer.domElement);
        this._controls.enableDamping = true;
        this._controls.dampingFactor = 0.05;
        this._controls.target.set(0, 12.5, 0);
        this._controls.maxDistance = 100;
        this._controls.maxPolarAngle = Math.PI * 0.495;
        this._controls.update();

        window.addEventListener('resize', () => {
            const { innerWidth, innerHeight } = window;
            this._camera.aspect = innerWidth / innerHeight;
            this._camera.updateProjectionMatrix();
            this._renderer.setSize(innerWidth, innerHeight);
        });
    }

    public update() {
        this._controls.update();
        this._renderer.render(this._scene, this._camera);
    }

    public add(object: Object3D) {
        this._scene.add(object);
    }

    public get scene() {
        return this._scene;
    }

    public get renderer() {
        return this._renderer;
    }
}
