import type { NetId, SnapshotMessage } from "./protocol.js";
/** Interpolated transform for one entity at a render time. */
export interface InterpolatedState {
    x: number;
    y: number;
    r: number;
}
/**
 * Buffers recent server snapshots and reconstructs entity transforms at a past
 * render time by interpolating between the two snapshots that straddle it. This
 * is what turns 20Hz server state into smooth motion at full client framerate.
 */
export declare class Interpolator {
    private readonly _buffer;
    push(snap: SnapshotMessage): void;
    /** Server time of the newest buffered snapshot, or null if empty. */
    get latestTime(): number | null;
    /**
     * Sample entity `id` at `renderTime` (server clock). Returns null if the id is
     * unknown. Lerps x/y and shortest-arc rotation between the straddling
     * snapshots; clamps to the nearest snapshot when render time is outside the
     * buffer (starvation) or the id is only present on one side.
     */
    sample(id: NetId, renderTime: number): InterpolatedState | null;
}
