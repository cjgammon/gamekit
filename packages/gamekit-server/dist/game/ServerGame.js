import { Game, Scene, } from "@cjgammon/gamekit";
import { NetServer } from "../net/NetServer.js";
/**
 * Headless authoritative game. Reuses the core fixed-timestep loop: `start()`
 * drives `step(fixedStep)` from a self-correcting Node timer (exactly one
 * fixedUpdate → one snapshot per tick), and the protected `render` seam — fired
 * once per step — serializes and broadcasts the snapshot.
 *
 * For deterministic tests, drive `tick()` manually instead of `start()`.
 */
export class ServerGame extends Game {
    constructor(config, options = {}) {
        super(config);
        this._tickCount = 0;
        this._timer = null;
        this._loop = () => {
            if (!this.running)
                return;
            const start = this._now();
            this.tick();
            const elapsed = this._now() - start;
            const delay = Math.max(0, this.fixedStep * 1000 - elapsed);
            this._timer = setTimeout(this._loop, delay);
        };
        this._now = options.now ?? Date.now;
        this.scene = new Scene();
        this.switchScene(this.scene);
        this.net = new NetServer(this.scene, this.tickRate, this.width, this.height, options.createPlayer, options.codec);
    }
    /** Attach a transport (real WS connection or in-memory pair) as a client. */
    accept(transport) {
        this.net.addConnection(transport, this._now());
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this._loop();
    }
    stop() {
        this.running = false;
        if (this._timer !== null) {
            clearTimeout(this._timer);
            this._timer = null;
        }
    }
    /** Advance exactly one fixed tick. Used by start()'s loop and by tests. */
    tick() {
        this.net.consumeInputs(); // one queued input per client, before the fixed step
        this.step(this.fixedStep);
    }
    render(_alpha) {
        this._tickCount++;
        this.net.broadcast(this._tickCount, this._now());
    }
}
