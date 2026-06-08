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

  // ---- Lifecycle (Game drives these; subclasses override `create`) ----

  /** Override to build the scene. Called once when the scene becomes active. */
  create(): void {}

  /** Fixed-step update — physics & game logic. Forwards to the root group.
   *  Snapshots transforms first so the renderer can interpolate this tick. */
  fixedUpdate(dt: number): void {
    this.root.syncPrev();
    this.root.fixedUpdate(dt);
  }

  /** Variable-step update — animation, tweens, sweep. Forwards to the root. */
  update(dt: number): void {
    this.root.update(dt);
    this.timers.update(dt);
    this.tweens.update(dt);
    this.camera.update(dt);
  }

  /** Tear down the scene and everything in it. */
  destroy(): void {
    this.timers.clear();
    this.tweens.clear();
    this.root.destroy();
  }

  // ---- Convenience ----

  /** Add an entity to the root group. */
  add<T extends Entity>(entity: T): T {
    this.root.add(entity);
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
   * @returns true if any pair overlapped.
   */
  overlap(
    a: Entity,
    b: Entity = a,
    onOverlap?: CollisionCallback,
  ): boolean {
    const as = Scene._leaves(a);
    const self = b === a;
    const bs = self ? as : Scene._leaves(b);
    let hit = false;

    for (let i = 0; i < as.length; i++) {
      const ea = as[i];
      for (let j = self ? i + 1 : 0; j < bs.length; j++) {
        const eb = bs[j];
        if (ea === eb) continue;
        if (ea.bounds.overlaps(eb.bounds)) {
          hit = true;
          onOverlap?.(ea, eb);
        }
      }
    }
    return hit;
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
  collide(
    a: Entity,
    b: Entity = a,
    onCollide?: CollisionCallback,
  ): boolean {
    const as = Scene._leaves(a);
    const self = b === a;
    const bs = self ? as : Scene._leaves(b);
    let hit = false;

    for (let i = 0; i < as.length; i++) {
      const ea = as[i];
      for (let j = self ? i + 1 : 0; j < bs.length; j++) {
        const eb = bs[j];
        if (ea === eb) continue;
        if (!ea.bounds.overlaps(eb.bounds)) continue;
        Scene._separate(ea, eb);
        hit = true;
        onCollide?.(ea, eb);
      }
    }
    return hit;
  }

  // ---- Internal ----

  /**
   * Flatten an entity-or-group into the alive, collidable leaf entities under
   * it. Groups are containers, not bodies, so they're recursed into rather than
   * tested directly; a plain entity is its own single leaf.
   */
  private static _leaves(target: Entity): Entity[] {
    if (!target.alive) return [];
    if (target instanceof Group) {
      const out: Entity[] = [];
      for (const child of target.children) {
        if (child instanceof Group) out.push(...Scene._leaves(child));
        else if (child.alive) out.push(child);
      }
      return out;
    }
    return [target];
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
