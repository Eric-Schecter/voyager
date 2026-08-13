import { Group } from "three";
import { Actor } from "./actor";
import { ActorCreator } from "./actor_creator";
import { TRANSITION_DURATION } from "./config";

export class ActorManager {
    private _actors: Actor[] = [];
    private _actorCreator = new ActorCreator();

    public constructor(private _actorGroup: Group) { }

    public async spawn(modelPath: string) {
        const actor = await this._actorCreator.createActor(modelPath);
        this._actors.push(actor);
        this._actorGroup.add(actor.points);
        this._actorGroup.add(actor.rayGroup);
        this._actorGroup.add(actor.meshes);
        return actor;
    }

    public destroy(actor: Actor) {
        actor.destroy();

        setTimeout(() => {
            this._actors.splice(this._actors.indexOf(actor), 1);

            this._actorGroup.remove(actor.rayGroup);
            this._actorGroup.remove(actor.meshes);
            this._actorGroup.remove(actor.points);
        }, TRANSITION_DURATION);
    }

    public update(delta: number, timestamp: number) {
        this._actors.forEach(actor => actor.update(delta, timestamp));
    }
}
