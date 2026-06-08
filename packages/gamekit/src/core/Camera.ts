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
  /** Pixels-per-world-unit. >1 zooms in, <1 zooms out. */
  zoom = 1;
  /** View rotation in radians (rotates the world about the viewport center). */
  rotation = 0;

  /** Visible region in screen pixels. */
  viewportWidth: number;
  viewportHeight: number;

  /** Per-frame follow smoothing in [0, 1]: 1 snaps to the target, smaller
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

  /** Snap the center to a world point immediately. */
  centerOn(x: number, y: number): this {
    this.x = x;
    this.y = y;
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

  // ---- Per-frame ----

  /** Advance follow, bounds clamping, and shake. Called once per frame. */
  update(dt: number): void {
    this._followStep();
    this._clampToBounds();
    this._updateShake(dt);
  }

  // ---- Matrices & coordinate conversion ----

  /**
   * World → screen-pixel transform (viewport origin at top-left, y-down).
   * This is the "view" half of the pipeline; the renderer wants
   * {@link viewProjection}.
   */
  view(): Mat3 {
    const cx = this.x + this._shakeX;
    const cy = this.y + this._shakeY;
    return Mat3.translation(this.viewportWidth / 2, this.viewportHeight / 2)
      .multiplySelf(Mat3.rotation(this.rotation))
      .multiplySelf(Mat3.scaling(this.zoom, this.zoom))
      .multiplySelf(Mat3.translation(-cx, -cy));
  }

  /** World → clip-space [-1, 1] transform, ready for GPU upload. */
  viewProjection(): Mat3 {
    return Mat3.ortho(this.viewportWidth, this.viewportHeight).multiplySelf(
      this.view(),
    );
  }

  /** Map a world point to screen pixels. */
  worldToScreen(p: Vec2): Vec2 {
    return this.view().transformPoint(p);
  }

  /** Map a screen-pixel point back to world space (inverse of the view). */
  screenToWorld(p: Vec2): Vec2 {
    const cx = this.x + this._shakeX;
    const cy = this.y + this._shakeY;
    const inv = Mat3.translation(cx, cy)
      .multiplySelf(Mat3.scaling(1 / this.zoom, 1 / this.zoom))
      .multiplySelf(Mat3.rotation(-this.rotation))
      .multiplySelf(
        Mat3.translation(-this.viewportWidth / 2, -this.viewportHeight / 2),
      );
    return inv.transformPoint(p);
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
