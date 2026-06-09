import { Entity } from "./Entity.js";
/**
 * A typed collection of entities. Itself an Entity, so Groups can nest.
 *
 * Children use absolute world coordinates — a Group does not transform them.
 * Dead children (alive === false) are swept out at the start of each update.
 */
export declare class Group<T extends Entity = Entity> extends Entity {
    /**
     * When true, dead children (`alive === false`) are kept instead of swept, so
     * {@link recycle} can revive and reuse them (Flixel-style pooling). Default
     * false — the normal sweep-and-destroy behavior.
     */
    recycling: boolean;
    private readonly _children;
    get children(): ReadonlyArray<T>;
    get count(): number;
    add(entity: T): T;
    /** Immediate removal. Safe to call outside the update loop. */
    remove(entity: T): boolean;
    fixedUpdate(dt: number): void;
    /** Snapshot every child's transform (and the group's own) for interpolation.
     *  Not gated on `active`: stationary/inactive children must keep
     *  `prev == current` so they don't flicker. */
    syncPrev(): void;
    update(dt: number): void;
    destroy(): void;
    forEach(fn: (entity: T) => void): void;
    find(predicate: (e: T) => boolean): T | undefined;
    filter(predicate: (e: T) => boolean): T[];
    /** First dead child (`alive === false`) available for reuse, or undefined.
     *  Only meaningful while {@link recycling} (otherwise dead children are swept). */
    getFirstDead(): T | undefined;
    /**
     * Reuse a dead child if one exists (revived in place), else build a new one
     * via `factory` and add it. Requires {@link recycling}; without a free slot
     * and without a factory, returns undefined. The returned entity is alive —
     * position and configure it before it renders.
     */
    recycle(factory?: () => T): T | undefined;
    /** Destroy and remove all children, keeping the Group itself alive. */
    clear(): void;
    /** Remove and destroy children whose `alive` flag is false. Back-to-front for
     *  splice safety. Skipped while {@link recycling} — dead children are kept for
     *  reuse by {@link recycle}. */
    private _sweep;
}
