import { Scene } from "../core/Scene.js";
import { NetClient } from "./NetClient.js";
/**
 * A Scene driven by a {@link NetClient}: spawned entities are added to the
 * scene, despawned entities are killed (and swept by the root Group), the local
 * player is predicted each fixed step, and interpolated transforms for remote
 * entities are written each frame in `update`.
 */
export class NetScene extends Scene {
    constructor(transport, factory, options = {}) {
        super();
        this.client = new NetClient({
            transport,
            factory,
            onSpawn: (_id, entity) => this.add(entity),
            onDespawn: (_id, entity) => entity.kill(),
            now: options.now,
            simulate: options.simulate,
        });
    }
    fixedUpdate(dt) {
        super.fixedUpdate(dt); // passive synced entities are skipped
        this.client.predict(dt); // advance local prediction + send input
    }
    update(dt) {
        super.update(dt); // sweep dead, advance timers/tweens
        this.client.apply(); // interpolate remotes (local is predicted)
    }
}
