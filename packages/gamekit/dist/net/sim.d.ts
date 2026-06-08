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
export declare const PLAYER_SPEED = 200;
/** Default player box size, px. */
export declare const PLAYER_SIZE = 32;
export interface PlayerSimOptions {
    speed: number;
    worldW: number;
    worldH: number;
}
export declare function simulatePlayer(e: Entity, input: InputState, dt: number, o: PlayerSimOptions): void;
