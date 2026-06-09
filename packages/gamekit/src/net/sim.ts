import type { Entity } from "../core/Entity.js";
import type { InputState } from "./protocol.js";

/**
 * Shared, deterministic player simulation. The server and the client's
 * prediction MUST advance the local player with the exact same step or
 * prediction drifts from authority — so both call this one function.
 *
 * Direct velocity from input (no acceleration/drag), integrate, clamp to the
 * world. Kept minimal and allocation-free.
 */

/** Default player movement speed, px/s. */
export const PLAYER_SPEED = 200;
/** Default player box size, px. */
export const PLAYER_SIZE = 32;

export interface PlayerSimOptions {
  speed: number;
  worldW: number;
  worldH: number;
}

export function simulatePlayer(
  entity: Entity,
  input: InputState,
  dt: number,
  opts: PlayerSimOptions,
): void {
  entity.velocity.x = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * opts.speed;
  entity.velocity.y = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * opts.speed;

  entity.x += entity.velocity.x * dt;
  entity.y += entity.velocity.y * dt;

  if (entity.x < 0) entity.x = 0;
  else if (entity.x + entity.width > opts.worldW) {
    entity.x = opts.worldW - entity.width;
  }
  if (entity.y < 0) entity.y = 0;
  else if (entity.y + entity.height > opts.worldH) {
    entity.y = opts.worldH - entity.height;
  }
}
