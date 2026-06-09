import { Ease } from "./Ease.js";
/**
 * Interpolates numeric properties of a target object toward goal values over a
 * duration, using an easing function. Advanced on the variable-step `update` by
 * a Scene's {@link TweenManager}.
 *
 * `from` values are sampled when the tween actually starts (after any delay),
 * so chained tweens pick up the latest target state.
 */
export class Tween {
    constructor(target, to, duration, options = {}) {
        this.elapsed = 0;
        this.finished = false;
        this._props = null; // captured lazily on start
        this.target = target;
        this._to = to;
        this.duration = duration;
        this.ease = options.ease ?? Ease.linear;
        this._delay = options.delay ?? 0;
        this._onComplete = options.onComplete;
    }
    /** Stop immediately without reaching the target or firing onComplete. */
    stop() {
        this.finished = true;
    }
    update(dt) {
        if (this.finished)
            return;
        // Burn the delay first; any leftover spills into the first step of motion.
        if (this._delay > 0) {
            this._delay -= dt;
            if (this._delay > 0)
                return;
            dt = -this._delay;
            this._delay = 0;
        }
        if (this._props === null)
            this._capture();
        this.elapsed += dt;
        let t = this.duration > 0 ? this.elapsed / this.duration : 1;
        if (t >= 1) {
            t = 1;
            this.finished = true;
        }
        const eased = this.ease(t);
        const target = this.target;
        for (const p of this._props) {
            target[p.key] = p.from + p.delta * eased;
        }
        if (this.finished)
            this._onComplete?.();
    }
    /** Sample current values as the `from` baseline. */
    _capture() {
        const target = this.target;
        const props = [];
        for (const key in this._to) {
            const to = this._to[key];
            const from = target[key];
            props.push({ key, from, delta: to - from });
        }
        this._props = props;
    }
}
/**
 * Owns a Scene's active tweens, advancing them each frame and sweeping the
 * finished ones.
 */
export class TweenManager {
    constructor() {
        this._tweens = [];
    }
    get count() {
        return this._tweens.length;
    }
    /** Create, register, and return a tween. */
    add(target, to, duration, options) {
        const tween = new Tween(target, to, duration, options);
        this._tweens.push(tween);
        return tween;
    }
    /** Stop and forget every tween. */
    clear() {
        this._tweens.length = 0;
    }
    update(dt) {
        const tweens = this._tweens;
        for (let i = tweens.length - 1; i >= 0; i--) {
            const tween = tweens[i];
            tween.update(dt);
            if (tween.finished)
                tweens.splice(i, 1);
        }
    }
}
