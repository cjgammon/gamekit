import { Scene } from "./Scene.js";
export interface GameConfig {
    width: number;
    height: number;
    /** Fixed logic ticks per second. Default 20 — matches the server tick rate. */
    tickRate?: number;
    /**
     * Default camera zoom applied to each scene as it becomes active (before its
     * `create()` runs, so a scene can still override it). Omit to leave each
     * scene's camera at its own zoom — the headless server never sets this. The
     * WebGPU `RenderGame` derives it from a `fov` to keep the field of view
     * constant across device-pixel ratios.
     */
    defaultZoom?: number;
}
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
export declare class Game {
    /** Largest real dt fed into a single step, in seconds. Guards the
     *  "spiral of death" when a frame stalls (tab backgrounded, GC pause). */
    static readonly MAX_FRAME_DT = 0.25;
    /** Backing/viewport size in pixels (the world size on the headless server,
     *  where it never changes). The WebGPU `RenderGame` updates these when the
     *  canvas resizes; the server treats them as fixed world bounds. */
    width: number;
    height: number;
    readonly tickRate: number;
    /** Fixed logic step in seconds (1 / tickRate). */
    readonly fixedStep: number;
    /** Camera zoom applied to each scene on activation, or null to leave it. */
    defaultZoom: number | null;
    currentScene: Scene | null;
    /** Set by switchScene; promoted at the top of the next step (never mid-tick). */
    pendingScene: Scene | null;
    accumulator: number;
    running: boolean;
    private _lastTime;
    private _frameId;
    constructor(config: GameConfig);
    /** Queue a scene to become active at the start of the next step. */
    switchScene(scene: Scene): void;
    /**
     * Start the browser render loop. Requires `requestAnimationFrame`; in a
     * headless environment, call `step(dt)` from your own loop instead.
     */
    start(): void;
    /** Stop the render loop. Safe to call when not running. */
    stop(): void;
    /**
     * Advance the world by `realDt` seconds. Pure — no clock, no DOM — so the
     * server and tests can call it directly with a synthetic dt.
     */
    step(realDt: number): void;
    /**
     * Render hook. No-op until a renderer is wired. `alpha` is the 0..1
     * interpolation factor between the last two fixed states.
     */
    protected render(_alpha: number): void;
    private _promotePendingScene;
    private _tick;
}
