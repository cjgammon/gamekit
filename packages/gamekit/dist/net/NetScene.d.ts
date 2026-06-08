import { Scene } from "../core/Scene.js";
import { NetClient, type EntityFactory, type SimulateFn } from "./NetClient.js";
import type { Transport } from "./Transport.js";
export interface NetSceneOptions {
    now?: () => number;
    /** Enables local-player prediction (2b); omit for interpolate-all (2a). */
    simulate?: SimulateFn;
}
/**
 * A Scene driven by a {@link NetClient}: spawned entities are added to the
 * scene, despawned entities are killed (and swept by the root Group), the local
 * player is predicted each fixed step, and interpolated transforms for remote
 * entities are written each frame in `update`.
 */
export declare class NetScene extends Scene {
    readonly client: NetClient;
    constructor(transport: Transport, factory: EntityFactory, options?: NetSceneOptions);
    fixedUpdate(dt: number): void;
    update(dt: number): void;
}
