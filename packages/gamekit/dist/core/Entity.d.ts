import { Vec2 } from "../math/Vec2.js";
import { AABB } from "../math/AABB.js";
import { Signal } from "./Signal.js";
/** An interpolated transform, filled by {@link Entity.sampleRender}. */
export interface RenderTransform {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
}
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
export declare class Entity {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
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
    /**
     * When true (default), the renderer draws this entity at
     * `lerp(prev, current, alpha)` to smooth fixed-step motion across rendered
     * frames. Set false for entities positioned every frame by other means
     * (net-interpolated entities, per-frame tweens) — they're drawn at their
     * current transform with no lerp.
     */
    interpolate: boolean;
    /** Transform at the start of the current fixed tick (the lerp origin). */
    prevX: number;
    prevY: number;
    prevRotation: number;
    prevScaleX: number;
    prevScaleY: number;
    private readonly _bounds;
    constructor(x?: number, y?: number);
    /**
     * World-space AABB (axis-aligned, ignores rotation — fine for broad-phase).
     * Reuses an internal instance; copy it if you need to retain the value.
     */
    get bounds(): AABB;
    get centerX(): number;
    get centerY(): number;
    /**
     * Rotation in **degrees** — a convenience view over the radian
     * {@link rotation} (degrees are how most people think about angles). Reads
     * and writes the same underlying value: `e.rotationDegrees = 90` is identical
     * to `e.rotation = Math.PI / 2`.
     */
    get rotationDegrees(): number;
    set rotationDegrees(deg: number);
    /** Mark for removal. The owning Group will destroy it on its next update
     *  (or, in a recycling Group, keep it for reuse via `recycle()`). */
    kill(): void;
    /**
     * Bring a killed entity back to life for reuse (the recycle counterpart of
     * {@link kill}). Re-enables update/render; the caller positions it afterward,
     * preferably via {@link setPosition} so it doesn't smear from its old spot.
     */
    revive(): void;
    /**
     * Snapshot the current transform as the lerp origin for the coming fixed
     * tick. The framework calls this on the whole tree once per fixed step,
     * before `fixedUpdate`, so after the tick `prev` holds the pre-tick pose and
     * the live fields hold the post-tick pose. Synced for every entity (not just
     * active ones) so stationary bodies keep `prev == current` and never flicker.
     */
    syncPrev(): void;
    /**
     * Fill `out` with the transform to draw this frame: the interpolated pose
     * `lerp(prev, current, alpha)` when {@link interpolate} is set, otherwise the
     * current transform. `alpha` is `Game.render`'s 0..1 factor. Allocation-free
     * — the caller reuses one `out`.
     */
    sampleRender(alpha: number, out: RenderTransform): RenderTransform;
    /**
     * Move to `(x, y)`. By default this also snaps `prev` so the entity does not
     * smear across the gap (use for teleports/spawns); pass `snap = false` to let
     * the move interpolate like ordinary motion.
     */
    setPosition(x: number, y: number, snap?: boolean): void;
    create(): void;
    /** Fixed-step update — physics, game logic. dt is constant. */
    fixedUpdate(dt: number): void;
    /** Variable-step update — animation, visuals. Runs once per rendered frame. */
    update(_dt: number): void;
    destroy(): void;
    private _integrateMotion;
    private static _computeVelocity;
}
