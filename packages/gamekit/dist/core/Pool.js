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
export class Pool {
    /**
     * @param factory builds a new instance when the pool is empty.
     * @param reset   optional scrub applied on {@link release} (and to
     *                pre-allocated instances).
     * @param prealloc number of instances to build up front.
     */
    constructor(factory, reset, prealloc = 0) {
        this._free = [];
        this._factory = factory;
        this._reset = reset;
        for (let i = 0; i < prealloc; i++) {
            const item = factory();
            reset?.(item);
            this._free.push(item);
        }
    }
    /** How many instances are currently free for reuse. */
    get available() {
        return this._free.length;
    }
    /** A recycled instance if one is free, otherwise a freshly built one. */
    acquire() {
        return this._free.pop() ?? this._factory();
    }
    /** Return an instance to the pool (scrubbed via `reset` if provided). */
    release(item) {
        this._reset?.(item);
        this._free.push(item);
    }
    /** Drop all free instances (does not touch live ones). */
    clear() {
        this._free.length = 0;
    }
}
