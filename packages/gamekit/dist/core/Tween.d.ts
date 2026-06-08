import { type EaseFn } from "./Ease.js";
/** Keys of T whose values are numbers — the only properties a Tween can drive. */
export type NumericKeys<T> = {
    [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];
/** Target values for a tween: a subset of the target's numeric properties. */
export type TweenProps<T> = Partial<Pick<T, NumericKeys<T>>>;
export interface TweenOptions {
    /** Easing function. Default {@link Ease.linear}. */
    ease?: EaseFn;
    /** Seconds to wait before the tween begins. Default 0. */
    delay?: number;
    /** Called once when the tween reaches its target. */
    onComplete?: () => void;
}
/**
 * Interpolates numeric properties of a target object toward goal values over a
 * duration, using an easing function. Advanced on the variable-step `update` by
 * a Scene's {@link TweenManager}.
 *
 * `from` values are sampled when the tween actually starts (after any delay),
 * so chained tweens pick up the latest target state.
 */
export declare class Tween<T extends object = object> {
    readonly target: T;
    readonly duration: number;
    readonly ease: EaseFn;
    elapsed: number;
    finished: boolean;
    private _delay;
    private _to;
    private _props;
    private _onComplete?;
    constructor(target: T, to: TweenProps<T>, duration: number, options?: TweenOptions);
    /** Stop immediately without reaching the target or firing onComplete. */
    stop(): void;
    update(dt: number): void;
    /** Sample current values as the `from` baseline. */
    private _capture;
}
/**
 * Owns a Scene's active tweens, advancing them each frame and sweeping the
 * finished ones.
 */
export declare class TweenManager {
    private readonly _tweens;
    get count(): number;
    /** Create, register, and return a tween. */
    add<T extends object>(target: T, to: TweenProps<T>, duration: number, options?: TweenOptions): Tween<T>;
    /** Stop and forget every tween. */
    clear(): void;
    update(dt: number): void;
}
