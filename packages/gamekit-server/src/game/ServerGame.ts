import { Game, Scene, type GameConfig, type Transport } from "@cjgammon/gamekit";
import { NetServer } from "../net/NetServer.js";

export interface ServerGameOptions {
  /** Injectable clock (ms). Defaults to Date.now; tests pass a fake clock. */
  now?: () => number;
}

/**
 * Headless authoritative game. Reuses the core fixed-timestep loop: `start()`
 * drives `step(fixedStep)` from a self-correcting Node timer (exactly one
 * fixedUpdate → one snapshot per tick), and the protected `render` seam — fired
 * once per step — serializes and broadcasts the snapshot.
 *
 * For deterministic tests, drive `tick()` manually instead of `start()`.
 */
export class ServerGame extends Game {
  readonly net: NetServer;
  readonly scene: Scene;

  private readonly _now: () => number;
  private _tickCount = 0;
  private _timer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: GameConfig, options: ServerGameOptions = {}) {
    super(config);
    this._now = options.now ?? Date.now;
    this.scene = new Scene();
    this.switchScene(this.scene);
    this.net = new NetServer(this.scene, this.tickRate, this.width, this.height);
  }

  /** Attach a transport (real WS connection or in-memory pair) as a client. */
  accept(transport: Transport): void {
    this.net.addConnection(transport, this._now());
  }

  override start(): void {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  override stop(): void {
    this.running = false;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /** Advance exactly one fixed tick. Used by start()'s loop and by tests. */
  tick(): void {
    this.net.consumeInputs(); // one queued input per client, before the fixed step
    this.step(this.fixedStep);
  }

  protected override render(_alpha: number): void {
    this._tickCount++;
    this.net.broadcast(this._tickCount, this._now());
  }

  private _loop = (): void => {
    if (!this.running) return;
    const start = this._now();
    this.tick();
    const elapsed = this._now() - start;
    const delay = Math.max(0, this.fixedStep * 1000 - elapsed);
    this._timer = setTimeout(this._loop, delay);
  };
}
