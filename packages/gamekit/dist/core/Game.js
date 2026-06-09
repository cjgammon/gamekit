/**
 * The engine entry point: a fixed-timestep loop plus scene management.
 *
 * Logic and rendering are decoupled. Each frame, `step` drains an accumulator,
 * running `fixedUpdate` zero-or-more times at a constant dt (deterministic,
 * server-compatible), then `update` exactly once (visuals), then `render`.
 *
 * `step(dt)` is pure stepping logic with no clock or DOM dependency, so the
 * headless server can drive it from its own fixed-rate loop. `start()` wires a
 * browser `requestAnimationFrame` loop for convenience; in a headless
 * environment, drive `step(dt)` yourself instead.
 */
export class Game {
    constructor(config) {
        this.currentScene = null;
        /** Set by switchScene; promoted at the top of the next step (never mid-tick). */
        this.pendingScene = null;
        this.accumulator = 0;
        this.running = false;
        this._lastTime = 0;
        this._frameId = null;
        // Arrow so it stays bound when handed to requestAnimationFrame.
        this._tick = () => {
            if (!this.running)
                return;
            const now = performance.now();
            const realDt = (now - this._lastTime) / 1000; // ms → seconds
            this._lastTime = now;
            this.step(realDt);
            this._frameId = requestAnimationFrame(this._tick);
        };
        this.width = config.width;
        this.height = config.height;
        this.tickRate = config.tickRate ?? 20;
        this.fixedStep = 1 / this.tickRate;
    }
    // ---- Scene management ----
    /** Queue a scene to become active at the start of the next step. */
    switchScene(scene) {
        this.pendingScene = scene;
    }
    // ---- Loop ----
    /**
     * Start the browser render loop. Requires `requestAnimationFrame`; in a
     * headless environment, call `step(dt)` from your own loop instead.
     */
    start() {
        if (this.running)
            return;
        if (typeof requestAnimationFrame === "undefined") {
            throw new Error("Game.start() requires requestAnimationFrame. In a headless " +
                "environment, drive step(dt) from your own fixed-rate loop " +
                "(see gamekit-server's ServerGame).");
        }
        this.running = true;
        this._lastTime = performance.now();
        this._frameId = requestAnimationFrame(this._tick);
    }
    /** Stop the render loop. Safe to call when not running. */
    stop() {
        this.running = false;
        if (this._frameId !== null && typeof cancelAnimationFrame !== "undefined") {
            cancelAnimationFrame(this._frameId);
        }
        this._frameId = null;
    }
    /**
     * Advance the world by `realDt` seconds. Pure — no clock, no DOM — so the
     * server and tests can call it directly with a synthetic dt.
     */
    step(realDt) {
        this._promotePendingScene();
        const scene = this.currentScene;
        if (!scene)
            return;
        // Clamp before accumulating so a long stall can't trigger a step storm.
        if (realDt > Game.MAX_FRAME_DT)
            realDt = Game.MAX_FRAME_DT;
        this.accumulator += realDt;
        while (this.accumulator >= this.fixedStep) {
            scene.fixedUpdate(this.fixedStep);
            this.accumulator -= this.fixedStep;
        }
        scene.update(realDt);
        // alpha = how far we are into the next fixed step (0..1), for the renderer
        // to interpolate entity positions between fixed states.
        this.render(this.accumulator / this.fixedStep);
    }
    /**
     * Render hook. No-op until a renderer is wired. `alpha` is the 0..1
     * interpolation factor between the last two fixed states.
     */
    render(_alpha) { }
    // ---- Internal ----
    _promotePendingScene() {
        if (!this.pendingScene)
            return;
        if (this.currentScene)
            this.currentScene.destroy();
        this.currentScene = this.pendingScene;
        this.pendingScene = null;
        this.accumulator = 0;
        // Default the camera viewport to the game size; create() may override.
        this.currentScene.camera.resize(this.width, this.height);
        this.currentScene.create();
    }
}
/** Largest real dt fed into a single step, in seconds. Guards the
 *  "spiral of death" when a frame stalls (tab backgrounded, GC pause). */
Game.MAX_FRAME_DT = 0.25;
