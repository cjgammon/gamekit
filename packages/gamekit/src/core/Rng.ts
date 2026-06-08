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
export class Rng {
  /** Current 32-bit generator state (stored as a signed int32 internally). */
  private _state: number;

  constructor(seed: number = (Date.now() ^ (Math.random() * 0x100000000)) | 0) {
    this._state = seed | 0;
  }

  /** Reseed the stream, restarting it deterministically from `seed`. */
  seed(seed: number): this {
    this._state = seed | 0;
    return this;
  }

  /** Raw generator state — capture to later {@link setState} the same stream. */
  getState(): number {
    return this._state;
  }

  /** Restore a state previously read from {@link getState}. */
  setState(state: number): this {
    this._state = state | 0;
    return this;
  }

  /** An independent copy positioned at the same point in the stream. */
  clone(): Rng {
    return new Rng().setState(this._state);
  }

  // ---- Core ----

  /** Next float in [0, 1). */
  next(): number {
    this._state = (this._state + 0x6d2b79f5) | 0;
    let t = this._state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---- Derived helpers ----

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** Integer in [min, max] (both inclusive). */
  intRange(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability `p` (default 0.5). */
  bool(p = 0.5): boolean {
    return this.next() < p;
  }

  /** -1 or +1, each with probability 0.5. */
  sign(): -1 | 1 {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** A uniformly chosen element of `items` (undefined if empty). */
  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.int(items.length)];
  }

  /** Shuffle `items` in place (Fisher–Yates) and return it. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }
}
