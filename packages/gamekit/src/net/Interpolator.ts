import type { NetId, SnapshotEntity, SnapshotMessage } from "./protocol.js";

/** Interpolated transform for one entity at a render time. */
export interface InterpolatedState {
  x: number;
  y: number;
  r: number;
}

/** ~1.5s of history at 20Hz — plenty to interpolate behind network jitter. */
const MAX_BUFFER = 30;

interface BufferedSnapshot {
  t: number;
  byId: Map<NetId, SnapshotEntity>;
}

/** Shortest signed angular delta from `a` to `b`, in (-π, π]. */
function shortestAngle(a: number, b: number): number {
  const tau = Math.PI * 2;
  let d = (b - a) % tau;
  if (d > Math.PI) d -= tau;
  else if (d < -Math.PI) d += tau;
  return d;
}

/**
 * Buffers recent server snapshots and reconstructs entity transforms at a past
 * render time by interpolating between the two snapshots that straddle it. This
 * is what turns 20Hz server state into smooth motion at full client framerate.
 */
export class Interpolator {
  private readonly _buffer: BufferedSnapshot[] = [];

  push(snap: SnapshotMessage): void {
    const byId = new Map<NetId, SnapshotEntity>();
    for (const e of snap.ents) byId.set(e.id, e);
    this._buffer.push({ t: snap.t, byId });

    // Snapshots normally arrive in order; re-sort defensively if not.
    const n = this._buffer.length;
    if (n > 1 && this._buffer[n - 1].t < this._buffer[n - 2].t) {
      this._buffer.sort((x, y) => x.t - y.t);
    }
    while (this._buffer.length > MAX_BUFFER) this._buffer.shift();
  }

  /** Server time of the newest buffered snapshot, or null if empty. */
  get latestTime(): number | null {
    return this._buffer.length
      ? this._buffer[this._buffer.length - 1].t
      : null;
  }

  /**
   * Sample entity `id` at `renderTime` (server clock). Returns null if the id is
   * unknown. Lerps x/y and shortest-arc rotation between the straddling
   * snapshots; clamps to the nearest snapshot when render time is outside the
   * buffer (starvation) or the id is only present on one side.
   */
  sample(id: NetId, renderTime: number): InterpolatedState | null {
    const buf = this._buffer;
    if (buf.length === 0) return null;

    let lo: BufferedSnapshot | null = null;
    let hi: BufferedSnapshot | null = null;
    for (const s of buf) {
      if (s.t <= renderTime) lo = s;
      else {
        hi = s;
        break;
      }
    }

    const loE = lo?.byId.get(id) ?? null;
    const hiE = hi?.byId.get(id) ?? null;

    if (lo && hi && loE && hiE) {
      const span = hi.t - lo.t;
      const f = span > 0 ? (renderTime - lo.t) / span : 0;
      return {
        x: loE.x + (hiE.x - loE.x) * f,
        y: loE.y + (hiE.y - loE.y) * f,
        r: loE.r + shortestAngle(loE.r, hiE.r) * f,
      };
    }

    // Clamp: hold the last known (lo), else the oldest available (hi).
    const e = loE ?? hiE;
    return e ? { x: e.x, y: e.y, r: e.r } : null;
  }
}
