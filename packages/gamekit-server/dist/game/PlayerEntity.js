import { Entity, EMPTY_INPUT, PLAYER_SIZE, PLAYER_SPEED, simulatePlayer, } from "@cjgammon/gamekit";
/**
 * Server-side player. Its latest input (set by NetServer) drives the shared,
 * deterministic {@link simulatePlayer} step in the fixed tick — the same step
 * the client uses for prediction, so the two stay in agreement.
 */
export class PlayerEntity extends Entity {
    constructor(x, y, _worldW, _worldH) {
        super(x, y);
        this._worldW = _worldW;
        this._worldH = _worldH;
        this.input = { ...EMPTY_INPUT };
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
    }
    fixedUpdate(_dt) {
        simulatePlayer(this, this.input, _dt, {
            speed: PLAYER_SPEED,
            worldW: this._worldW,
            worldH: this._worldH,
        });
    }
}
