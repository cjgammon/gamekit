import { Entity } from "./Entity.js";

/**
 * A typed collection of entities. Itself an Entity, so Groups can nest.
 *
 * Children use absolute world coordinates — a Group does not transform them.
 * Dead children (alive === false) are swept out at the start of each update.
 */
export class Group<T extends Entity = Entity> extends Entity {
  /**
   * When true, dead children (`alive === false`) are kept instead of swept, so
   * {@link recycle} can revive and reuse them (Flixel-style pooling). Default
   * false — the normal sweep-and-destroy behavior.
   */
  recycling = false;

  private readonly _children: T[] = [];

  get children(): ReadonlyArray<T> {
    return this._children;
  }
  get count(): number {
    return this._children.length;
  }

  add(entity: T): T {
    this._children.push(entity);
    entity.parent = this;
    entity.create();
    return entity;
  }

  /** Immediate removal. Safe to call outside the update loop. */
  remove(entity: T): boolean {
    const idx = this._children.indexOf(entity);
    if (idx === -1) return false;
    this._children.splice(idx, 1);
    entity.parent = null;
    entity.destroy();
    return true;
  }

  override fixedUpdate(dt: number): void {
    // Note: a Group does not integrate its own motion — it's a container.
    const children = this._children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.active && child.alive) child.fixedUpdate(dt);
    }
  }

  /** Snapshot every child's transform (and the group's own) for interpolation.
   *  Not gated on `active`: stationary/inactive children must keep
   *  `prev == current` so they don't flicker. */
  override syncPrev(): void {
    super.syncPrev();
    const children = this._children;
    for (let i = 0; i < children.length; i++) children[i].syncPrev();
  }

  override update(dt: number): void {
    this._sweep();
    const children = this._children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.active && child.alive) child.update(dt);
    }
  }

  override destroy(): void {
    for (const child of this._children) child.destroy();
    this._children.length = 0;
    super.destroy();
  }

  // ---- Queries ----

  forEach(fn: (entity: T) => void): void {
    for (const child of this._children) fn(child);
  }

  find(predicate: (e: T) => boolean): T | undefined {
    return this._children.find(predicate);
  }

  filter(predicate: (e: T) => boolean): T[] {
    return this._children.filter(predicate);
  }

  /** First dead child (`alive === false`) available for reuse, or undefined.
   *  Only meaningful while {@link recycling} (otherwise dead children are swept). */
  getFirstDead(): T | undefined {
    return this._children.find((c) => !c.alive);
  }

  /**
   * Reuse a dead child if one exists (revived in place), else build a new one
   * via `factory` and add it. Requires {@link recycling}; without a free slot
   * and without a factory, returns undefined. The returned entity is alive —
   * position and configure it before it renders.
   */
  recycle(factory?: () => T): T | undefined {
    const dead = this.getFirstDead();
    if (dead) {
      dead.revive();
      return dead;
    }
    if (factory) return this.add(factory());
    return undefined;
  }

  /** Destroy and remove all children, keeping the Group itself alive. */
  clear(): void {
    for (const child of this._children) child.destroy();
    this._children.length = 0;
  }

  // ---- Internal ----

  /** Remove and destroy children whose `alive` flag is false. Back-to-front for
   *  splice safety. Skipped while {@link recycling} — dead children are kept for
   *  reuse by {@link recycle}. */
  private _sweep(): void {
    if (this.recycling) return;
    const children = this._children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (!child.alive) {
        children.splice(i, 1);
        child.parent = null;
        child.destroy();
      }
    }
  }
}
