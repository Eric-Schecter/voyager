import { Group } from "three";
import { Ocean } from "../ocean";
import { Actor } from "./actor";
import { ActorCreator } from "./actor_creator";
import { TRANSITION_DURATION } from "./config";

export class ActorManager {
    private _actorCreator = new ActorCreator();

    public constructor(private _actorGroup: Group, private _ocean: Ocean) { }

    public async spawn(modelPath: string) {
        const actor = await this._actorCreator.createActor(modelPath);
        this._actorGroup.add(actor);
        this._actorGroup.add(actor.rayGroup);
        return actor;
    }

    public destroy(actor: Actor) {
        actor.destroy();

        setTimeout(() => {
            this._actorGroup.remove(actor);
            this._actorGroup.remove(actor.rayGroup);
        }, TRANSITION_DURATION);
    }

    public update(delta: number, timestamp: number) {
        this._actorGroup.children.forEach(actor => {
            if (!(actor instanceof Actor)) {
                return;
            }
            const { worldPos } = actor;
            const waveInfo = this._ocean.getWaveInfo(worldPos.x, worldPos.z, this._ocean.time);
            (actor as Actor).update(delta, timestamp, waveInfo)
        });
    }
}
