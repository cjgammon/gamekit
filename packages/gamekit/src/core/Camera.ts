import { Mat3 } from "../math/Mat3.js";
import { Vec2 } from "../math/Vec2.js";
import type { Entity } from "./Entity.js";

/** World-space rectangle the camera center is kept inside. */
export interface CameraBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Half-extents (world units) of a centered rectangle the follow target may
 *  roam inside before the camera moves. */
export interface CameraDeadzone {
  x: number;
  y: number;
}

/**
 * A 2D view onto the world. Holds a center (`x`, `y` in world space), `zoom`,
 * and `rotation`, and produces the matrices the renderer uploads each frame:
 * {@link viewProjection} (world → clip space) for the GPU, plus
 * {@link worldToScreen}/{@link screenToWorld} for input picking and HUD layout.
 *
 * Pure math — no DOM, no GPU types — so it stays in the isomorphic core. The
 * server allocates one per Scene but never reads it.
 *
 * Per-frame behavior (follow, bounds clamp, shake) is advanced by {@link update},
 * which the owning Scene calls once per rendered frame.
 */
export class Camera {
  /** Camera center in world space (the world point shown at the viewport center). */
  x = 0;
  y = 0;
  /** Center at the start of the current fixed tick — the render-interpolation
   *  origin, mirroring `Entity.prevX/prevY`. */
  prevX = 0;
  prevY = 0;
  /** Pixels-per-world-unit. >1 zooms in, <1 zooms out. */
  zoom = 1;
  /** View rotation in radians (rotates the world about the viewport center). */
  rotation = 0;

  /** View rotation in **degrees** — a convenience view over the radian
   *  {@link rotation}. */
  get rotationDegrees(): number {
    return (this.rotation * 180) / Math.PI;
  }
  set rotationDegrees(deg: number) {
    this.rotation = (deg * Math.PI) / 180;
  }

  /** Visible region in screen pixels. */
  viewportWidth: number;
  viewportHeight: number;

  /** Per-fixed-tick follow smoothing in [0, 1]: 1 snaps to the target, smaller
   *  values ease toward it. */
  followLerp = 1;
  /** When set, the target may move within these half-extents (world units)
   *  around the camera center before the camera tracks it. */
  deadzone: CameraDeadzone | null = null;

  /** When set, the camera center is clamped so the viewport stays inside it.
   *  Clamping ignores rotation (matches the Flixel model). */
  bounds: CameraBounds | null = null;

  /** Random source for shake, injectable so tests are deterministic. */
  random: () => number = Math.random;

  private _target: Entity | null = null;
  private _shakeDuration = 0;
  private _shakeTime = 0;
  private _shakeIntensity = 0;
  private _shakeX = 0;
  private _shakeY = 0;

  constructor(viewportWidth = 0, viewportHeight = 0) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  // ---- Configuration ----

  /** Resize the visible region (e.g. on canvas resize). */
  resize(width: number, height: number): this {
    this.viewportWidth = width;
    this.viewportHeight = height;
    return this;
  }

  /** Snap the center to a world point immediately (no interpolation smear). */
  centerOn(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    return this;
  }

  /**
   * Track an entity's center. `lerp` is the per-frame smoothing (1 = snap).
   * The camera does not jump on the first frame — call {@link snapToTarget}
   * first if you want it centered immediately.
   */
  follow(target: Entity, lerp = 1): this {
    this._target = target;
    this.followLerp = lerp;
    return this;
  }

  /** Stop following the current target (the camera holds its position). */
  stopFollow(): this {
    this._target = null;
    return this;
  }

  /** Jump the center onto the follow target (then clamp to bounds). */
  snapToTarget(): this {
    if (this._target) {
      this.x = this._target.x + this._target.width / 2;
      this.y = this._target.y + this._target.height / 2;
      this._clampToBounds();
      this.syncPrev(); // snap interpolation origin so there's no first-frame smear
    }
    return this;
  }

  /**
   * Shake the view for `duration` seconds. The offset is random within
   * ±`intensity` world units and decays linearly to zero. Calling again
   * restarts the shake.
   */
  shake(intensity: number, duration: number): this {
    this._shakeIntensity = intensity;
    this._shakeDuration = duration;
    this._shakeTime = duration;
    return this;
  }

  /** True while a shake is in progress. */
  get shaking(): boolean {
    return this._shakeTime > 0;
  }

  // ---- Per-tick / per-frame ----

  /**
   * Snapshot the center as the interpolation origin for the coming tick.
   * Called by the framework before {@link update}, matching `Entity.syncPrev`.
   */
  syncPrev(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }

  /**
   * Advance follow + bounds clamp by one fixed tick. Driven from the same fixed
   * step as entity motion (via `Scene.fixedUpdate`) and snapshots `prev` first,
   * so the rendered view interpolates in lockstep with the entities it frames —
   * no per-tick jitter between sprites and the camera.
   */
  update(_dt: number): void {
    this.syncPrev();
    this._followStep();
    this._clampToBounds();
  }

  /**
   * Advance the shake decay by real elapsed time. Shake is a purely visual
   * offset, so it runs per rendered frame (not per fixed tick) to stay smooth.
   */
  advanceShake(realDt: number): void {
    this._updateShake(realDt);
  }

  // ---- Matrices & coordinate conversion ----

  /**
   * World → screen-pixel transform at interpolation factor `alpha` (0..1, from
   * `Game.render`). The center is `lerp(prev, current, alpha)` plus shake;
   * `alpha = 1` (the default) yields the current center.
   */
  view(alpha = 1): Mat3 {
    const cx = this._centerX(alpha);
    const cy = this._centerY(alpha);
    return Mat3.translation(this.viewportWidth / 2, this.viewportHeight / 2)
      .multiplySelf(Mat3.rotation(this.rotation))
      .multiplySelf(Mat3.scaling(this.zoom, this.zoom))
      .multiplySelf(Mat3.translation(-cx, -cy));
  }

  /** World → clip-space [-1, 1] transform at `alpha`, ready for GPU upload. */
  viewProjection(alpha = 1): Mat3 {
    return Mat3.ortho(this.viewportWidth, this.viewportHeight).multiplySelf(
      this.view(alpha),
    );
  }

  /** Map a world point to screen pixels (using the current center). */
  worldToScreen(p: Vec2): Vec2 {
    return this.view(1).transformPoint(p);
  }

  /** Map a screen-pixel point back to world space (inverse of the current view). */
  screenToWorld(p: Vec2): Vec2 {
    const cx = this._centerX(1);
    const cy = this._centerY(1);
    const inv = Mat3.translation(cx, cy)
      .multiplySelf(Mat3.scaling(1 / this.zoom, 1 / this.zoom))
      .multiplySelf(Mat3.rotation(-this.rotation))
      .multiplySelf(
        Mat3.translation(-this.viewportWidth / 2, -this.viewportHeight / 2),
      );
    return inv.transformPoint(p);
  }

  private _centerX(alpha: number): number {
    return this.prevX + (this.x - this.prevX) * alpha + this._shakeX;
  }

  private _centerY(alpha: number): number {
    return this.prevY + (this.y - this.prevY) * alpha + this._shakeY;
  }

  // ---- Internal ----

  private _followStep(): void {
    const t = this._target;
    if (!t) return;
    const tx = t.x + t.width / 2;
    const ty = t.y + t.height / 2;

    let goalX = tx;
    let goalY = ty;
    if (this.deadzone) {
      // Only move enough to keep the target within the deadzone half-extents.
      goalX = this._clampGoal(this.x, tx, this.deadzone.x);
      goalY = this._clampGoal(this.y, ty, this.deadzone.y);
    }

    this.x += (goalX - this.x) * this.followLerp;
    this.y += (goalY - this.y) * this.followLerp;
  }

  /** Goal center for one axis so `target` sits within `half` of `current`. */
  private _clampGoal(current: number, target: number, half: number): number {
    if (target - current > half) return target - half;
    if (current - target > half) return target + half;
    return current; // inside the deadzone — don't move
  }

  private _clampToBounds(): void {
    const b = this.bounds;
    if (!b) return;
    const halfW = this.viewportWidth / (2 * this.zoom);
    const halfH = this.viewportHeight / (2 * this.zoom);

    // If the world is narrower than the viewport, center on it; else clamp.
    if (b.maxX - b.minX <= 2 * halfW) this.x = (b.minX + b.maxX) / 2;
    else this.x = Math.min(Math.max(this.x, b.minX + halfW), b.maxX - halfW);

    if (b.maxY - b.minY <= 2 * halfH) this.y = (b.minY + b.maxY) / 2;
    else this.y = Math.min(Math.max(this.y, b.minY + halfH), b.maxY - halfH);
  }

  private _updateShake(dt: number): void {
    if (this._shakeTime <= 0) return;
    this._shakeTime -= dt;
    if (this._shakeTime <= 0) {
      this._shakeTime = 0;
      this._shakeX = 0;
      this._shakeY = 0;
      return;
    }
    const decay = this._shakeTime / this._shakeDuration; // 1 → 0
    this._shakeX = (this.random() * 2 - 1) * this._shakeIntensity * decay;
    this._shakeY = (this.random() * 2 - 1) * this._shakeIntensity * decay;
  }
}
