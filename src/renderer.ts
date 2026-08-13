import {
    Scene, Color, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight, Object3D
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class Renderer {

    private _scene: Scene;
    private _camera: PerspectiveCamera;
    private _renderer: WebGLRenderer;
    private _controls: OrbitControls;

    public constructor() {
        this._scene = new Scene();
        this._scene.background = new Color(0x222222);

        this._camera = new PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
        this._camera.position.set(4, 2, 4);
        this._camera.lookAt(0, 0, 0);

        this._renderer = new WebGLRenderer({ antialias: true });
        this._renderer.setSize(window.innerWidth, window.innerHeight);
        this._renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this._renderer.domElement);

        this._controls = new OrbitControls(this._camera, this._renderer.domElement);
        this._controls.enableDamping = true;
        this._controls.dampingFactor = 0.05;
        this._controls.target.set(0, 0, 0);
        this._controls.update();

        const ambientLight = new AmbientLight(0x404060);
        this._scene.add(ambientLight);

        const dirLight = new DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(2, 5, 3);
        this._scene.add(dirLight);

        const backLight = new DirectionalLight(0x4488ff, 0.5);
        backLight.position.set(-3, 1, -2);
        this._scene.add(backLight);

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
}
