import { AABB } from "../math/AABB.js";
import { Camera } from "./Camera.js";
import { Entity } from "./Entity.js";
import { Group } from "./Group.js";
import { TimerManager, type Timer, type TimerCallback } from "./Timer.js";
import {
  TweenManager,
  type Tween,
  type TweenOptions,
  type TweenProps,
} from "./Tween.js";

/** Called for each overlapping/colliding pair. */
export type CollisionCallback = (a: Entity, b: Entity) => void;

/** Ascending numeric comparator (reused; avoids a per-sort closure). */
const ASC = (x: number, y: number): number => x - y;

/** Empty an array in place and return it. */
function clear<T>(a: T[]): T[] {
  a.length = 0;
  return a;
}

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
export class Scene {
  /** Root container. Add entities to the scene via `scene.add(...)`. */
  readonly root = new Group();
  /** The view the renderer uploads. Game sizes it to the viewport on activation. */
  readonly camera = new Camera();
  /** Scene-managed countdown/repeat timers, advanced on `update`. */
  readonly timers = new TimerManager();
  /** Scene-managed property tweens, advanced on `update`. */
  readonly tweens = new TweenManager();

  /**
   * Screen-space overlay drawn on top of the world with **no camera transform** —
   * put HUDs, score text, and menus here and they stop needing per-frame camera
   * math. Coordinates are screen pixels from the top-left. Add via {@link addHud}.
   */
  readonly hud = new Group();

  /**
   * Cell size (world units) for the spatial-hash broad-phase used by
   * {@link overlap}/{@link collide}. Roughly your typical colliding entity's
   * size works well; too small wastes cells, too large packs many candidates
   * per cell. Tune per game if collision is a hot path.
   */
  collisionCellSize = 128;

  // Reusable broad-phase scratch — allocation-free in the common (non-nested)
  // case. Re-entrant calls (overlap/collide from inside a callback) fall back
  // to fresh allocations so results never corrupt.
  private readonly _leavesA: Entity[] = [];
  private readonly _leavesB: Entity[] = [];
  private readonly _grid = new Map<number, number[]>();
  private readonly _bucketPool: number[][] = [];
  private _seen = new Int32Array(0);
  private readonly _cands: number[] = [];
  private _queryId = 0;
  private _bpBusy = false;
  /** Reused swept-AABB box for {@link overlapSwept}. */
  private readonly _sweptAABB = new AABB();

  // ---- Lifecycle (Game drives these; subclasses override `create`) ----

  /** Override to build the scene. Called once when the scene becomes active. */
  create(): void {}

  /** Fixed-step update — physics & game logic. Forwards to the root group.
   *  Snapshots transforms first so the renderer can interpolate this tick, then
   *  advances the camera in the same step so it tracks entities in lockstep. */
  fixedUpdate(dt: number): void {
    this.root.syncPrev();
    this.root.fixedUpdate(dt);
    this.camera.update(dt); // follow + bounds, against post-step positions
    this.hud.syncPrev();
    this.hud.fixedUpdate(dt);
  }

  /** Variable-step update — animation, tweens, sweep. Forwards to the root. */
  update(dt: number): void {
    this.root.update(dt);
    this.timers.update(dt);
    this.tweens.update(dt);
    this.camera.advanceShake(dt); // visual-only, real-time decay
    this.hud.update(dt);
  }

  /** Tear down the scene and everything in it. */
  destroy(): void {
    this.timers.clear();
    this.tweens.clear();
    this.root.destroy();
    this.hud.destroy();
  }

  // ---- Convenience ----

  /** Add an entity to the root group. */
  add<T extends Entity>(entity: T): T {
    this.root.add(entity);
    return entity;
  }

  /** Add an entity to the screen-space {@link hud} overlay (pixels from top-left). */
  addHud<T extends Entity>(entity: T): T {
    this.hud.add(entity);
    return entity;
  }

  /** Remove an entity from the root group. */
  remove(entity: Entity): boolean {
    return this.root.remove(entity);
  }

  /**
   * Schedule a callback after `duration` seconds. `loops` is the number of
   * times to fire (default 1; 0 repeats forever).
   */
  addTimer(
    duration: number,
    callback: TimerCallback,
    loops = 1,
  ): Timer {
    return this.timers.add(duration, callback, loops);
  }

  /**
   * Tween numeric properties of `target` toward `to` over `duration` seconds.
   * e.g. `scene.tween(sprite, { x: 100 }, 0.5, { ease: Ease.quadOut })`.
   */
  tween<T extends object>(
    target: T,
    to: TweenProps<T>,
    duration: number,
    options?: TweenOptions,
  ): Tween<T> {
    return this.tweens.add(target, to, duration, options);
  }

  // ---- Collision ----

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
  overlap(a: Entity, b: Entity = a, onOverlap?: CollisionCallback): boolean {
    return this._broadphase(a, b, onOverlap);
  }

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
  collide(a: Entity, b: Entity = a, onCollide?: CollisionCallback): boolean {
    return this._broadphase(a, b, (ea, eb) => {
      Scene._separate(ea, eb);
      onCollide?.(ea, eb);
    });
  }

  /**
   * Like {@link overlap}, but tests each `a` leaf's **swept** AABB — the box
   * covering its motion from its previous position to its current one — against
   * `b`. This catches fast movers that would tunnel through a target between
   * fixed ticks: a bullet that jumps past an enemy in one step still registers a
   * hit. Detection only (no separation) — use it for hit tests like
   * bullets→enemies, not for physical response.
   *
   * @returns true if any pair overlapped.
   */
  overlapSwept(a: Entity, b: Entity = a, onOverlap?: CollisionCallback): boolean {
    return this._broadphase(a, b, onOverlap, true);
  }

  // ---- Internal ----

  /**
   * Spatial-hash broad-phase shared by {@link overlap}/{@link collide}. Buckets
   * `b`'s leaves into a uniform grid, then for each `a` leaf gathers candidates
   * from the cells its AABB spans, de-dupes them, and tests AABBs in ascending
   * index order — identical pairs and order to the exhaustive O(n²) loop, minus
   * the far-apart pairs the grid prunes. `onPair` runs for each overlapping
   * pair. Two AABBs that overlap always share a cell, so no pair is missed.
   */
  private _broadphase(
    aRoot: Entity,
    bRoot: Entity,
    onPair?: CollisionCallback,
    swept = false,
  ): boolean {
    const reuse = !this._bpBusy;
    this._bpBusy = true;
    try {
      const self = bRoot === aRoot;
      const as = Scene._leaves(aRoot, reuse ? clear(this._leavesA) : []);
      const bs = self ? as : Scene._leaves(bRoot, reuse ? clear(this._leavesB) : []);
      const n = as.length;
      const m = bs.length;
      if (n === 0 || m === 0) return false;

      const inv = 1 / this.collisionCellSize;
      const grid = reuse ? this._grid : new Map<number, number[]>();
      if (reuse) this._resetGrid();

      // Bucket b's leaves into every cell their AABB spans.
      for (let j = 0; j < m; j++) {
        const bb = bs[j].bounds;
        const cx1 = Math.floor(bb.right * inv);
        const cy1 = Math.floor(bb.bottom * inv);
        for (let cx = Math.floor(bb.left * inv); cx <= cx1; cx++) {
          for (let cy = Math.floor(bb.top * inv); cy <= cy1; cy++) {
            const key = Scene._cellKey(cx, cy);
            let bucket = grid.get(key);
            if (!bucket) {
              bucket = reuse ? this._bucketPool.pop() ?? [] : [];
              bucket.length = 0;
              grid.set(key, bucket);
            }
            bucket.push(j);
          }
        }
      }

      let seen = reuse ? this._seen : new Int32Array(m);
      if (seen.length < m) {
        seen = new Int32Array(m);
        if (reuse) this._seen = seen;
      }
      const cands = reuse ? this._cands : [];

      let hit = false;
      for (let i = 0; i < n; i++) {
        const ea = as[i];
        // Query box: the swept AABB (prev→current, widened to cover fast motion)
        // when sweeping, else the entity's current AABB.
        let aL: number;
        let aR: number;
        let aT: number;
        let aB: number;
        if (swept) {
          aL = Math.min(ea.prevX, ea.x);
          aR = Math.max(ea.prevX, ea.x) + ea.width;
          aT = Math.min(ea.prevY, ea.y);
          aB = Math.max(ea.prevY, ea.y) + ea.height;
          this._sweptAABB.set(aL, aT, aR - aL, aB - aT);
        } else {
          const ab = ea.bounds;
          aL = ab.left;
          aR = ab.right;
          aT = ab.top;
          aB = ab.bottom;
        }
        const cx0 = Math.floor(aL * inv);
        const cy0 = Math.floor(aT * inv);
        const cx1 = Math.floor(aR * inv);
        const cy1 = Math.floor(aB * inv);
        const stamp = ++this._queryId;
        cands.length = 0;
        for (let cx = cx0; cx <= cx1; cx++) {
          for (let cy = cy0; cy <= cy1; cy++) {
            const bucket = grid.get(Scene._cellKey(cx, cy));
            if (!bucket) continue;
            for (let k = 0; k < bucket.length; k++) {
              const j = bucket[k];
              if (self && j <= i) continue; // each unordered pair once
              if (seen[j] === stamp) continue; // de-dupe across cells
              seen[j] = stamp;
              cands.push(j);
            }
          }
        }
        if (cands.length === 0) continue;
        cands.sort(ASC); // ascending index → exhaustive-loop order
        for (let c = 0; c < cands.length; c++) {
          const eb = bs[cands[c]];
          if (ea === eb) continue;
          // Swept: the fixed swept box. Non-swept: re-read ea.bounds (a prior
          // separation this pass may have moved it).
          const aBox = swept ? this._sweptAABB : ea.bounds;
          if (aBox.overlaps(eb.bounds)) {
            hit = true;
            onPair?.(ea, eb);
          }
        }
      }
      return hit;
    } finally {
      if (reuse) this._bpBusy = false;
    }
  }

  /** Return all buckets to the pool and clear the grid for the next call. */
  private _resetGrid(): void {
    for (const bucket of this._grid.values()) this._bucketPool.push(bucket);
    this._grid.clear();
  }

  /** Hash a cell coordinate to a bucket key. Hash collisions only add extra
   *  candidates (filtered by the AABB test), so correctness is preserved. */
  private static _cellKey(cx: number, cy: number): number {
    return ((cx * 73856093) ^ (cy * 19349663)) >>> 0;
  }

  /**
   * Flatten an entity-or-group into the alive, collidable leaf entities under
   * it, appended to `out` (which is returned). Groups are containers, not
   * bodies, so they're recursed into; a plain entity is its own single leaf.
   * Writes into the caller's array — no per-call allocation or array spreads.
   */
  private static _leaves(target: Entity, out: Entity[]): Entity[] {
    if (!target.alive) return out;
    if (target instanceof Group) {
      const children = target.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child instanceof Group) Scene._leaves(child, out);
        else if (child.alive) out.push(child);
      }
    } else {
      out.push(target);
    }
    return out;
  }

  /** Push two overlapping entities apart along the least-penetration axis. */
  private static _separate(a: Entity, b: Entity): void {
    // MTV points from b toward a — i.e. the push needed to move a out of b.
    const mtv = a.bounds.penetration(b.bounds);
    if (mtv.x === 0 && mtv.y === 0) return;

    const halfX = mtv.x * 0.5;
    const halfY = mtv.y * 0.5;
    a.x += halfX;
    a.y += halfY;
    b.x -= halfX;
    b.y -= halfY;

    if (mtv.x !== 0) {
      a.velocity.x = 0;
      b.velocity.x = 0;
    }
    if (mtv.y !== 0) {
      a.velocity.y = 0;
      b.velocity.y = 0;
    }
  }
}
