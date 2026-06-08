import { Vec2 } from "../math/Vec2.js";
import { AABB } from "../math/AABB.js";
import { Signal } from "./Signal.js";

/**
 * Base class for all game objects.
 *
 * Coordinate model: positions are absolute world coordinates. Groups are
 * logical containers, not transform nodes — a Group does not offset its
 * children. (Nested transforms can come later if needed.)
 *
 * Lifecycle hooks, called by the owning Group / Scene:
 *  - create()           once, when added
 *  - fixedUpdate(dt)    fixed step — physics & game logic (deterministic)
 *  - update(dt)         variable step, every frame — animation, tweens, visuals
 *  - destroy()          once, when removed
 */
export class Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // radians
  scaleX: number;
  scaleY: number;

  /** If false, skips update/fixedUpdate. */
  active: boolean;
  /** If false, skips rendering. */
  visible: boolean;
  /** If false, the owning Group sweeps this entity out on its next update. */
  alive: boolean;

  /** Velocity in pixels/second. Integrated in fixedUpdate. */
  readonly velocity: Vec2;
  /** Acceleration in pixels/second². */
  readonly acceleration: Vec2;
  /** Deceleration applied per axis when acceleration on that axis is zero. */
  readonly drag: Vec2;
  /** Per-axis velocity clamp. 0 means unclamped on that axis. */
  readonly maxVelocity: Vec2;

  /** Set by the owning Group. */
  parent: Entity | null;

  /** Fires when this entity is destroyed. */
  readonly onDestroy: Signal<Entity>;

  private readonly _bounds: AABB;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.width = 0;
    this.height = 0;
    this.rotation = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.active = true;
    this.visible = true;
    this.alive = true;
    this.velocity = new Vec2();
    this.acceleration = new Vec2();
    this.drag = new Vec2();
    this.maxVelocity = new Vec2();
    this.parent = null;
    this.onDestroy = new Signal<Entity>();
    this._bounds = new AABB();
  }

  /**
   * World-space AABB (axis-aligned, ignores rotation — fine for broad-phase).
   * Reuses an internal instance; copy it if you need to retain the value.
   */
  get bounds(): AABB {
    return this._bounds.set(this.x, this.y, this.width, this.height);
  }

  get centerX(): number {
    return this.x + this.width * 0.5;
  }
  get centerY(): number {
    return this.y + this.height * 0.5;
  }

  /** Mark for removal. The owning Group will destroy it on its next update. */
  kill(): void {
    this.alive = false;
  }

  // ---- Lifecycle (override in subclasses) ----

  create(): void {}

  /** Fixed-step update — physics, game logic. dt is constant. */
  fixedUpdate(dt: number): void {
    this._integrateMotion(dt);
  }

  /** Variable-step update — animation, visuals. Runs once per rendered frame. */
  update(_dt: number): void {}

  destroy(): void {
    this.onDestroy.emit(this);
    this.onDestroy.clear();
  }

  // ---- Motion integration (Flixel-style) ----

  private _integrateMotion(dt: number): void {
    this.velocity.x = Entity._computeVelocity(
      this.velocity.x,
      this.acceleration.x,
      this.drag.x,
      this.maxVelocity.x,
      dt,
    );
    this.velocity.y = Entity._computeVelocity(
      this.velocity.y,
      this.acceleration.y,
      this.drag.y,
      this.maxVelocity.y,
      dt,
    );
    this.x += this.velocity.x * dt;
    this.y += this.velocity.y * dt;
  }

  private static _computeVelocity(
    v: number,
    accel: number,
    drag: number,
    max: number,
    dt: number,
  ): number {
    if (accel !== 0) {
      v += accel * dt;
    } else if (drag !== 0) {
      const d = drag * dt;
      if (v - d > 0) v -= d;
      else if (v + d < 0) v += d;
      else v = 0;
    }
    if (max !== 0 && v < -max) v = -max;
    else if (max !== 0 && v > max) v = max;
    return v;
  }
}
