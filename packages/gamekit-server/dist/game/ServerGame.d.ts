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
export declare class ServerGame extends Game {
    readonly net: NetServer;
    readonly scene: Scene;
    private readonly _now;
    private _tickCount;
    private _timer;
    constructor(config: GameConfig, options?: ServerGameOptions);
    /** Attach a transport (real WS connection or in-memory pair) as a client. */
    accept(transport: Transport): void;
    start(): void;
    stop(): void;
    /** Advance exactly one fixed tick. Used by start()'s loop and by tests. */
    tick(): void;
    protected render(_alpha: number): void;
    private _loop;
}
