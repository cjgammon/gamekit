export type TimerCallback = (timer: Timer) => void;
/**
 * A countdown that fires a callback when it elapses, optionally repeating.
 *
 * Advanced on the variable-step `update` by a Scene's {@link TimerManager}.
 * (Game-logic timing that must stay deterministic across client/server should
 * be driven from `fixedUpdate` instead — a fixed-step timer is a future addition.)
 */
export declare class Timer {
    duration: number;
    /** Total number of times to fire; 0 means repeat forever. */
    loops: number;
    /** Pause without removing — a paused timer holds its elapsed time. */
    active: boolean;
    /** True once it has fired its final loop. The manager sweeps finished timers. */
    finished: boolean;
    /** Time accumulated into the current loop. */
    elapsed: number;
    /** Number of loops fired so far. */
    loopsDone: number;
    private _callback;
    constructor(duration: number, callback: TimerCallback, loops?: number);
    /** 0..1 progress into the current loop. */
    get progress(): number;
    /** Stop firing. The manager will sweep it out on its next update. */
    stop(): void;
    /** Restart from zero, keeping duration/loops/callback. */
    reset(): void;
    update(dt: number): void;
    private _fire;
}
/**
 * Owns a Scene's active timers, advancing them each frame and sweeping the
 * finished ones. New timers added from within a callback do not fire the same
 * frame (they're appended past the current cursor).
 */
export declare class TimerManager {
    private readonly _timers;
    get count(): number;
    /** Create, register, and return a timer. */
    add(duration: number, callback: TimerCallback, loops?: number): Timer;
    /** Stop and forget every timer. */
    clear(): void;
    update(dt: number): void;
}
