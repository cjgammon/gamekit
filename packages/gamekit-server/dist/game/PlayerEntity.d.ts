import { Entity, type InputState } from "gamekit";
/**
 * Server-side player. Its latest input (set by NetServer) drives the shared,
 * deterministic {@link simulatePlayer} step in the fixed tick — the same step
 * the client uses for prediction, so the two stay in agreement.
 */
export declare class PlayerEntity extends Entity {
    private readonly _worldW;
    private readonly _worldH;
    input: InputState;
    constructor(x: number, y: number, _worldW: number, _worldH: number);
    fixedUpdate(_dt: number): void;
}
