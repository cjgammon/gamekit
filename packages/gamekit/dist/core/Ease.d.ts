/** An easing function: maps normalized time t (0..1) to an eased value. */
export type EaseFn = (t: number) => number;
/**
 * Standard easing functions, all `(t: 0..1) => 0..1`. Use with {@link Tween}:
 * `scene.tween(sprite, { x: 100 }, 0.5, { ease: Ease.quadOut })`.
 */
export declare const Ease: {
    readonly linear: (t: number) => number;
    readonly quadIn: (t: number) => number;
    readonly quadOut: (t: number) => number;
    readonly quadInOut: (t: number) => number;
    readonly cubicIn: (t: number) => number;
    readonly cubicOut: (t: number) => number;
    readonly cubicInOut: (t: number) => number;
    readonly sineIn: (t: number) => number;
    readonly sineOut: (t: number) => number;
    readonly sineInOut: (t: number) => number;
    readonly expoIn: (t: number) => number;
    readonly expoOut: (t: number) => number;
    readonly backOut: (t: number) => number;
    readonly bounceOut: (t: number) => number;
};
