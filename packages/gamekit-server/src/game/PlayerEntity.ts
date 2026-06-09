import {
  Entity,
  EMPTY_INPUT,
  PLAYER_SIZE,
  PLAYER_SPEED,
  simulatePlayer,
  type InputState,
} from "@cjgammon/gamekit";

/**
 * Server-side player. Its latest input (set by NetServer) drives the shared,
 * deterministic {@link simulatePlayer} step in the fixed tick — the same step
 * the client uses for prediction, so the two stay in agreement.
 */
export class PlayerEntity extends Entity {
  input: InputState = { ...EMPTY_INPUT };

  constructor(
    x: number,
    y: number,
    private readonly _worldW: number,
    private readonly _worldH: number,
  ) {
    super(x, y);
    this.width = PLAYER_SIZE;
    this.height = PLAYER_SIZE;
  }

  override fixedUpdate(_dt: number): void {
    simulatePlayer(this, this.input, _dt, {
      speed: PLAYER_SPEED,
      worldW: this._worldW,
      worldH: this._worldH,
    });
  }
}
