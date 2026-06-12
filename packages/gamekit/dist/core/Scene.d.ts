import { Camera } from "./Camera.js";
import { Entity } from "./Entity.js";
import { Group } from "./Group.js";
import { TimerManager, type Timer, type TimerCallback } from "./Timer.js";
import { TweenManager, type Tween, type TweenOptions, type TweenProps } from "./Tween.js";
/** Called for each overlapping/colliding pair. */
export type CollisionCallback = (a: Entity, b: Entity) => void;
/**
 * Top-level container for a screen's worth of game objects.
 *
 * A Scene owns a root {@link Group}; everything added to the scene lives under
 * it. The Game loop drives the scene by calling `fixedUpdate` (fixed step) and
 * `update` (per frame), which forward to the root group. Subclass a Scene and
 * override `create` to populate it.
 *
 * Collision helpers (`overlap`, `collide`) operate on absolute world-space
 * AABBs — matching the engine's Flixel-style absolute coordinate model.
 *
 * A Scene owns the {@link Camera} the renderer reads; it's advanced once per
 * frame in `update`. On the headless server the camera is allocated but unused.
 */
export declare class Scene {
    /** Root container. Add entities to the scene via `scene.add(...)`. */
    readonly root: Group<Entity>;
    /** The view the renderer uploads. Game sizes it to the viewport on activation. */
    readonly camera: Camera;
    /** Scene-managed countdown/repeat timers, advanced on `update`. */
    readonly timers: TimerManager;
    /** Scene-managed property tweens, advanced on `update`. */
    readonly tweens: TweenManager;
    /**
     * Screen-space overlay drawn on top of the world with **no camera transform** —
     * put HUDs, score text, and menus here and they stop needing per-frame camera
     * math. Coordinates are screen pixels from the top-left. Add via {@link addHud}.
     */
    readonly hud: Group<Entity>;
    /**
     * Cell size (world units) for the spatial-hash broad-phase used by
     * {@link overlap}/{@link collide}. Roughly your typical colliding entity's
     * size works well; too small wastes cells, too large packs many candidates
     * per cell. Tune per game if collision is a hot path.
     */
    collisionCellSize: number;
    private readonly _leavesA;
    private readonly _leavesB;
    private readonly _grid;
    private readonly _bucketPool;
    private _seen;
    private readonly _cands;
    private _queryId;
    private _bpBusy;
    /** Override to build the scene. Called once when the scene becomes active. */
    create(): void;
    /** Fixed-step update — physics & game logic. Forwards to the root group.
     *  Snapshots transforms first so the renderer can interpolate this tick, then
     *  advances the camera in the same step so it tracks entities in lockstep. */
    fixedUpdate(dt: number): void;
    /** Variable-step update — animation, tweens, sweep. Forwards to the root. */
    update(dt: number): void;
    /** Tear down the scene and everything in it. */
    destroy(): void;
    /** Add an entity to the root group. */
    add<T extends Entity>(entity: T): T;
    /** Add an entity to the screen-space {@link hud} overlay (pixels from top-left). */
    addHud<T extends Entity>(entity: T): T;
    /** Remove an entity from the root group. */
    remove(entity: Entity): boolean;
    /**
     * Schedule a callback after `duration` seconds. `loops` is the number of
     * times to fire (default 1; 0 repeats forever).
     */
    addTimer(duration: number, callback: TimerCallback, loops?: number): Timer;
    /**
     * Tween numeric properties of `target` toward `to` over `duration` seconds.
     * e.g. `scene.tween(sprite, { x: 100 }, 0.5, { ease: Ease.quadOut })`.
     */
    tween<T extends object>(target: T, to: TweenProps<T>, duration: number, options?: TweenOptions): Tween<T>;
    /**
     * Test every alive leaf of `a` against every alive leaf of `b` for AABB
     * overlap, invoking `onOverlap` for each overlapping pair. Pass a single
     * argument to test a group against itself (each unordered pair once).
     *
     * Uses a uniform spatial-hash broad-phase, so it scales ~linearly instead of
     * O(n²); the pairs and their order match an exhaustive test. Tune
     * {@link collisionCellSize} if collision is a hot path.
     *
     * @returns true if any pair overlapped.
     */
    overlap(a: Entity, b?: Entity, onOverlap?: CollisionCallback): boolean;
    /**
     * Like {@link overlap}, but also separates overlapping pairs along the axis
     * of least penetration. Both bodies share the correction equally and have
     * their velocity zeroed along the contact normal.
     *
     * Note: this is symmetric basic separation. Immovable bodies (walls, floors,
     * one-sided platforms) — where one body absorbs the entire correction — are a
     * follow-up that requires an `immovable` flag on Entity.
     *
     * @returns true if any pair collided.
     */
    collide(a: Entity, b?: Entity, onCollide?: CollisionCallback): boolean;
    /**
     * Spatial-hash broad-phase shared by {@link overlap}/{@link collide}. Buckets
     * `b`'s leaves into a uniform grid, then for each `a` leaf gathers candidates
     * from the cells its AABB spans, de-dupes them, and tests AABBs in ascending
     * index order — identical pairs and order to the exhaustive O(n²) loop, minus
     * the far-apart pairs the grid prunes. `onPair` runs for each overlapping
     * pair. Two AABBs that overlap always share a cell, so no pair is missed.
     */
    private _broadphase;
    /** Return all buckets to the pool and clear the grid for the next call. */
    private _resetGrid;
    /** Hash a cell coordinate to a bucket key. Hash collisions only add extra
     *  candidates (filtered by the AABB test), so correctness is preserved. */
    private static _cellKey;
    /**
     * Flatten an entity-or-group into the alive, collidable leaf entities under
     * it, appended to `out` (which is returned). Groups are containers, not
     * bodies, so they're recursed into; a plain entity is its own single leaf.
     * Writes into the caller's array — no per-call allocation or array spreads.
     */
    private static _leaves;
    /** Push two overlapping entities apart along the least-penetration axis. */
    private static _separate;
}
