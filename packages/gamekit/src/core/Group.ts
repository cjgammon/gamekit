import { Entity } from "./Entity.js";

/**
 * A typed collection of entities. Itself an Entity, so Groups can nest.
 *
 * Children use absolute world coordinates — a Group does not transform them.
 * Dead children (alive === false) are swept out at the start of each update.
 */
export class Group<T extends Entity = Entity> extends Entity {
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
      if (child.active) child.fixedUpdate(dt);
    }
  }

  override update(dt: number): void {
    this._sweep();
    const children = this._children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.active) child.update(dt);
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

  /** Destroy and remove all children, keeping the Group itself alive. */
  clear(): void {
    for (const child of this._children) child.destroy();
    this._children.length = 0;
  }

  // ---- Internal ----

  /** Remove and destroy children whose `alive` flag is false. Back-to-front for splice safety. */
  private _sweep(): void {
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
