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
    private readonly _bounds;
    constructor(x?: number, y?: number);
    /**
     * World-space AABB (axis-aligned, ignores rotation — fine for broad-phase).
     * Reuses an internal instance; copy it if you need to retain the value.
     */
    get bounds(): AABB;
    get centerX(): number;
    get centerY(): number;
    /** Mark for removal. The owning Group will destroy it on its next update. */
    kill(): void;
    create(): void;
    /** Fixed-step update — physics, game logic. dt is constant. */
    fixedUpdate(dt: number): void;
    /** Variable-step update — animation, visuals. Runs once per rendered frame. */
    update(_dt: number): void;
    destroy(): void;
    private _integrateMotion;
    private static _computeVelocity;
}
