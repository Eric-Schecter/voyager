import { Timer, Group, Matrix4 } from 'three';
import { Renderer } from './renderer';
import { ActorManager } from './actor_manager';
import { TRANSITION_DURATION } from './config';
import { random } from './utils';


async function init(): Promise<void> {
    const renderer = new Renderer();

    const actorGroup = new Group();
    renderer.add(actorGroup);

    const actorManager = new ActorManager(actorGroup);

    const clock = new Timer();

    const modelPath = 'models/russian_archipelago_frigate_svjatoi_nikolai.glb';

    const generate = async () => {
        const currActor = await actorManager.spawn(modelPath);
        const ratio = 5;
        currActor.applyMatrix((new Matrix4().makeTranslation(random(-1, 1) * ratio, 0, 0).multiply(new Matrix4().makeRotationY(Math.PI / 2))));
        setTimeout(() => {
            actorManager.destroy(currActor);
        }, TRANSITION_DURATION + 500);

        setTimeout(generate, 2000);
    }
    generate();

    function animate(timestamp: number) {
        requestAnimationFrame(animate);

        const delta = clock.getDelta();

        actorManager.update(delta, timestamp);

        renderer.update();

        clock.update();
    }
    requestAnimationFrame(animate);
}

init().catch((err) => console.error(err));
