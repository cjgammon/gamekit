/**
 * A lightweight typed event emitter.
 *
 * @example
 * const onScore = new Signal<number>();
 * onScore.add((points) => console.log(`+${points}`));
 * onScore.emit(10);
 *
 * @example
 * // Void signal — no payload
 * const onJump = new Signal();
 * onJump.add(() => playSound('jump'));
 * onJump.emit();
 */
export class Signal {
    constructor() {
        this._listeners = [];
        this._onceListeners = new Set();
    }
    /** Register a listener. Returns the listener so it can be removed later. */
    add(listener) {
        this._listeners.push(listener);
        return listener;
    }
    /** Register a listener that removes itself after firing once. */
    once(listener) {
        this._listeners.push(listener);
        this._onceListeners.add(listener);
        return listener;
    }
    remove(listener) {
        const idx = this._listeners.indexOf(listener);
        if (idx !== -1)
            this._listeners.splice(idx, 1);
        this._onceListeners.delete(listener);
    }
    /**
     * Fire the signal. Listeners are invoked over a snapshot of the list, so it's
     * safe for a listener to add or remove listeners during emit.
     */
    // `[T] extends [void]` (not `T extends void`) so the conditional is
    // non-distributive — a union payload like `Signal<string | ArrayBuffer>`
    // stays a single `[string | ArrayBuffer]` arg rather than `[string] | [ArrayBuffer]`.
    emit(...args) {
        const data = args[0];
        const snapshot = this._listeners.slice();
        for (const listener of snapshot) {
            listener(data);
            if (this._onceListeners.has(listener)) {
                this.remove(listener);
            }
        }
    }
    clear() {
        this._listeners.length = 0;
        this._onceListeners.clear();
    }
    get count() {
        return this._listeners.length;
    }
}
