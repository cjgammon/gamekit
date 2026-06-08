/**
 * Deterministic, seedable pseudo-random generator — the single source of
 * randomness for game logic that must be reproducible and server-compatible
 * (level/spawn generation, drops, spread). Zero-dependency and isomorphic.
 *
 * Backed by **Mulberry32**: a tiny, fast 32-bit-state generator with good
 * statistical quality for games. Two `Rng`s with the same seed produce the same
 * sequence on any platform, and {@link getState}/{@link setState} let you
 * snapshot and restore the stream (e.g. to re-derive a level or sync a replay).
 *
 * For deterministic gameplay give an explicit seed; the default seed is derived
 * from the clock, so an unseeded `Rng` varies run to run.
 */
export declare class Rng {
    /** Current 32-bit generator state (stored as a signed int32 internally). */
    private _state;
    constructor(seed?: number);
    /** Reseed the stream, restarting it deterministically from `seed`. */
    seed(seed: number): this;
    /** Raw generator state — capture to later {@link setState} the same stream. */
    getState(): number;
    /** Restore a state previously read from {@link getState}. */
    setState(state: number): this;
    /** An independent copy positioned at the same point in the stream. */
    clone(): Rng;
    /** Next float in [0, 1). */
    next(): number;
    /** Float in [min, max). */
    range(min: number, max: number): number;
    /** Integer in [0, maxExclusive). */
    int(maxExclusive: number): number;
    /** Integer in [min, max] (both inclusive). */
    intRange(min: number, max: number): number;
    /** True with probability `p` (default 0.5). */
    bool(p?: number): boolean;
    /** -1 or +1, each with probability 0.5. */
    sign(): -1 | 1;
    /** A uniformly chosen element of `items` (undefined if empty). */
    pick<T>(items: readonly T[]): T | undefined;
    /** Shuffle `items` in place (Fisher–Yates) and return it. */
    shuffle<T>(items: T[]): T[];
}
