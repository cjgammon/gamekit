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
export class NetScene extends Scene {
  readonly client: NetClient;

  constructor(
    transport: Transport,
    factory: EntityFactory,
    options: NetSceneOptions = {},
  ) {
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

  override fixedUpdate(dt: number): void {
    super.fixedUpdate(dt); // passive synced entities are skipped
    this.client.predict(dt); // advance local prediction + send input
  }

  override update(dt: number): void {
    super.update(dt); // sweep dead, advance timers/tweens
    this.client.apply(); // interpolate remotes (local is predicted)
  }
}
