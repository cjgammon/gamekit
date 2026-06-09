/**
 * A generic free-list for recycling objects instead of allocating them every
 * frame — the zero-GC primitive behind bullets, particles, and other churn.
 *
 * {@link acquire} hands back a previously released instance when one is
 * available, otherwise builds a fresh one via the factory. {@link release}
 * returns an instance to the pool, optionally scrubbing it with `reset` so it's
 * clean for reuse. The pool never tracks which instances are live — the caller
 * owns that — it only stores the free ones.
 *
 * For pooling scene-graph entities, prefer {@link Group}'s `recycle()` (it keeps
 * recycled objects in place); use `Pool` for plain objects or custom flows.
 */
export declare class Pool<T> {
    private readonly _free;
    private readonly _factory;
    private readonly _reset?;
    /**
     * @param factory builds a new instance when the pool is empty.
     * @param reset   optional scrub applied on {@link release} (and to
     *                pre-allocated instances).
     * @param prealloc number of instances to build up front.
     */
    constructor(factory: () => T, reset?: (item: T) => void, prealloc?: number);
    /** How many instances are currently free for reuse. */
    get available(): number;
    /** A recycled instance if one is free, otherwise a freshly built one. */
    acquire(): T;
    /** Return an instance to the pool (scrubbed via `reset` if provided). */
    release(item: T): void;
    /** Drop all free instances (does not touch live ones). */
    clear(): void;
}
