import { Entity } from "./Entity.js";
/**
 * A typed collection of entities. Itself an Entity, so Groups can nest.
 *
 * Children use absolute world coordinates — a Group does not transform them.
 * Dead children (alive === false) are swept out at the start of each update.
 */
export declare class Group<T extends Entity = Entity> extends Entity {
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
    /** Destroy and remove all children, keeping the Group itself alive. */
    clear(): void;
    /** Remove and destroy children whose `alive` flag is false. Back-to-front for splice safety. */
    private _sweep;
}
