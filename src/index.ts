import { Timer, Group, Matrix4, PMREMGenerator, Vector3, MathUtils } from 'three';
import { Renderer } from './renderer';
import { random, ActorManager } from './boat';
import { Ocean } from './ocean';
import { Atmosphere } from './sky';
import { TIME_TO_CREATE, TIME_TO_DESTROY } from './boat/config';

async function init(): Promise<void> {
    const renderer = new Renderer();

    const ocean = new Ocean();
    renderer.add(ocean.water);

    const actorGroup = new Group();
    renderer.add(actorGroup);

    const actorManager = new ActorManager(actorGroup, ocean);

    const sun = new Vector3();

    const parameters = {
        elevation: 10,
        azimuth: 180,
    };

    const phi = MathUtils.degToRad(90 - parameters.elevation);
    const theta = MathUtils.degToRad(parameters.azimuth);

    sun.setFromSphericalCoords(1, phi, theta);

    const atmosphere = new Atmosphere();
    renderer.add(atmosphere.sky);

    atmosphere.sun = sun;
    ocean.sun = sun;

    const pmremGenerator = new PMREMGenerator(renderer.renderer);

    renderer.scene.environment = pmremGenerator.fromScene(atmosphere.sky as any).texture;

    const clock = new Timer();

    const modelPath = 'models/russian_archipelago_frigate_svjatoi_nikolai.glb';

    const generate = async () => {
        const currActor = await actorManager.spawn(modelPath);
        const { height } = currActor;
        const ratio = 50;
        currActor.applyMatrix((new Matrix4().makeTranslation(random(-ratio, ratio), height * 2 / 5, 0).multiply(new Matrix4().makeRotationY(Math.PI / 2))));
        currActor.startTransition();
        setTimeout(() => {
            actorManager.destroy(currActor);
        }, TIME_TO_DESTROY);

        setTimeout(generate, TIME_TO_CREATE);
    }
    generate();

    function animate(timestamp: number) {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();

        actorManager.update(delta, timestamp);
        ocean.update(delta);
        renderer.update();

        clock.update();
    }
    requestAnimationFrame(animate);
}

init().catch((err) => console.error(err));
