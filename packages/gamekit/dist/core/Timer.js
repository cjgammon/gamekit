/**
 * A countdown that fires a callback when it elapses, optionally repeating.
 *
 * Advanced on the variable-step `update` by a Scene's {@link TimerManager}.
 * (Game-logic timing that must stay deterministic across client/server should
 * be driven from `fixedUpdate` instead — a fixed-step timer is a future addition.)
 */
export class Timer {
    constructor(duration, callback, loops = 1) {
        /** Pause without removing — a paused timer holds its elapsed time. */
        this.active = true;
        /** True once it has fired its final loop. The manager sweeps finished timers. */
        this.finished = false;
        /** Time accumulated into the current loop. */
        this.elapsed = 0;
        /** Number of loops fired so far. */
        this.loopsDone = 0;
        this.duration = duration;
        this._callback = callback;
        this.loops = loops;
    }
    /** 0..1 progress into the current loop. */
    get progress() {
        if (this.duration <= 0)
            return 1;
        const p = this.elapsed / this.duration;
        return p > 1 ? 1 : p;
    }
    /** Stop firing. The manager will sweep it out on its next update. */
    stop() {
        this.finished = true;
    }
    /** Restart from zero, keeping duration/loops/callback. */
    reset() {
        this.elapsed = 0;
        this.loopsDone = 0;
        this.finished = false;
        this.active = true;
    }
    update(dt) {
        if (this.finished || !this.active)
            return;
        this.elapsed += dt;
        // Non-positive duration: fire once per update rather than spin forever.
        if (this.duration <= 0) {
            this._fire();
            return;
        }
        while (!this.finished && this.elapsed >= this.duration) {
            this.elapsed -= this.duration;
            this._fire();
        }
    }
    _fire() {
        this.loopsDone++;
        this._callback(this);
        if (this.loops !== 0 && this.loopsDone >= this.loops) {
            this.finished = true;
        }
    }
}
/**
 * Owns a Scene's active timers, advancing them each frame and sweeping the
 * finished ones. New timers added from within a callback do not fire the same
 * frame (they're appended past the current cursor).
 */
export class TimerManager {
    constructor() {
        this._timers = [];
    }
    get count() {
        return this._timers.length;
    }
    /** Create, register, and return a timer. */
    add(duration, callback, loops = 1) {
        const timer = new Timer(duration, callback, loops);
        this._timers.push(timer);
        return timer;
    }
    /** Stop and forget every timer. */
    clear() {
        this._timers.length = 0;
    }
    update(dt) {
        const timers = this._timers;
        // Back-to-front so splicing finished timers is splice-safe, and so timers
        // appended during a callback (higher indices) are skipped until next frame.
        for (let i = timers.length - 1; i >= 0; i--) {
            const timer = timers[i];
            timer.update(dt);
            if (timer.finished)
                timers.splice(i, 1);
        }
    }
}
