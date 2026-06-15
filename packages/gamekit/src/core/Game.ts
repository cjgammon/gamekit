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
export class Game {
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

  currentScene: Scene | null = null;
  /** Set by switchScene; promoted at the top of the next step (never mid-tick). */
  pendingScene: Scene | null = null;

  accumulator = 0;
  running = false;

  private _lastTime = 0;
  private _frameId: number | null = null;

  constructor(config: GameConfig) {
    this.width = config.width;
    this.height = config.height;
    this.tickRate = config.tickRate ?? 20;
    this.fixedStep = 1 / this.tickRate;
    this.defaultZoom = config.defaultZoom ?? null;
  }

  // ---- Scene management ----

  /** Queue a scene to become active at the start of the next step. */
  switchScene(scene: Scene): void {
    this.pendingScene = scene;
  }

  // ---- Loop ----

  /**
   * Start the browser render loop. Requires `requestAnimationFrame`; in a
   * headless environment, call `step(dt)` from your own loop instead.
   */
  start(): void {
    if (this.running) return;
    if (typeof requestAnimationFrame === "undefined") {
      throw new Error(
        "Game.start() requires requestAnimationFrame. In a headless " +
          "environment, drive step(dt) from your own fixed-rate loop " +
          "(see gamekit-server's ServerGame).",
      );
    }
    this.running = true;
    this._lastTime = performance.now();
    this._frameId = requestAnimationFrame(this._tick);
  }

  /** Stop the render loop. Safe to call when not running. */
  stop(): void {
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
  step(realDt: number): void {
    this._promotePendingScene();

    const scene = this.currentScene;
    if (!scene) return;

    // Clamp before accumulating so a long stall can't trigger a step storm.
    if (realDt > Game.MAX_FRAME_DT) realDt = Game.MAX_FRAME_DT;

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
  protected render(_alpha: number): void {}

  // ---- Internal ----

  private _promotePendingScene(): void {
    if (!this.pendingScene) return;
    if (this.currentScene) this.currentScene.destroy();
    this.currentScene = this.pendingScene;
    this.pendingScene = null;
    this.accumulator = 0;
    // Default the camera viewport to the game size; create() may override.
    this.currentScene.camera.resize(this.width, this.height);
    // Apply the default zoom (if configured) before create(), so a scene can
    // still override it. Skipped when null, preserving each camera's own zoom.
    if (this.defaultZoom !== null) {
      this.currentScene.camera.zoom = this.defaultZoom;
    }
    this.currentScene.create();
  }

  // Arrow so it stays bound when handed to requestAnimationFrame.
  private _tick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const realDt = (now - this._lastTime) / 1000; // ms → seconds
    this._lastTime = now;
    this.step(realDt);
    this._frameId = requestAnimationFrame(this._tick);
  };
}
