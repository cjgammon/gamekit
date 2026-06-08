export type SignalListener<T> = (data: T) => void;
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
export declare class Signal<T = void> {
    private readonly _listeners;
    private readonly _onceListeners;
    /** Register a listener. Returns the listener so it can be removed later. */
    add(listener: SignalListener<T>): SignalListener<T>;
    /** Register a listener that removes itself after firing once. */
    once(listener: SignalListener<T>): SignalListener<T>;
    remove(listener: SignalListener<T>): void;
    /**
     * Fire the signal. Listeners are invoked over a snapshot of the list, so it's
     * safe for a listener to add or remove listeners during emit.
     */
    emit(...args: [T] extends [void] ? [] : [T]): void;
    clear(): void;
    get count(): number;
}
