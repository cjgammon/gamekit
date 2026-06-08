const HALF_PI = Math.PI / 2;
/**
 * Standard easing functions, all `(t: 0..1) => 0..1`. Use with {@link Tween}:
 * `scene.tween(sprite, { x: 100 }, 0.5, { ease: Ease.quadOut })`.
 */
export const Ease = {
    linear: (t) => t,
    quadIn: (t) => t * t,
    quadOut: (t) => t * (2 - t),
    quadInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    cubicIn: (t) => t * t * t,
    cubicOut: (t) => {
        const f = t - 1;
        return f * f * f + 1;
    },
    cubicInOut: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
    sineIn: (t) => 1 - Math.cos(t * HALF_PI),
    sineOut: (t) => Math.sin(t * HALF_PI),
    sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    expoIn: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
    expoOut: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    backOut: (t) => {
        const s = 1.70158;
        const f = t - 1;
        return f * f * ((s + 1) * f + s) + 1;
    },
    bounceOut: (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1)
            return n1 * t * t;
        if (t < 2 / d1) {
            t -= 1.5 / d1;
            return n1 * t * t + 0.75;
        }
        if (t < 2.5 / d1) {
            t -= 2.25 / d1;
            return n1 * t * t + 0.9375;
        }
        t -= 2.625 / d1;
        return n1 * t * t + 0.984375;
    },
};
