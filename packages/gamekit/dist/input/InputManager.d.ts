/**
 * Action-based input. Maps named **actions** ("up", "jump", "fire") to one or
 * more physical input **codes**, tracks which are held, and exposes edge
 * queries (just-pressed / just-released) plus a boolean {@link snapshot} — the
 * shape `NetClient.setLocalInput` consumes.
 *
 * The state machine is pure (codes in, booleans out) and isomorphic: feed it
 * with {@link pressCode}/{@link releaseCode} and it needs no DOM. The DOM event
 * sources ({@link attach}) and gamepad polling ({@link poll}) touch browser
 * globals, so this lives behind the `gamekit/input` subpath, never the package
 * root — keeping the headless server import DOM-free.
 *
 * ## Code tokens
 * - Keyboard: `KeyboardEvent.code` — `"ArrowUp"`, `"KeyW"`, `"Space"`.
 * - Mouse buttons: `"Mouse0"` (left), `"Mouse1"` (middle), `"Mouse2"` (right).
 * - Gamepad buttons: `"Pad0".."PadN"` (standard-mapping indices).
 * - Gamepad left stick (past deadzone): `"PadUp"`, `"PadDown"`, `"PadLeft"`, `"PadRight"`.
 *
 * ## Per-frame usage
 * ```
 * input.poll();                       // refresh gamepad state (frame start)
 * client.setLocalInput(input.snapshot());
 * if (input.justPressed("jump")) ...  // edge queries
 * input.update();                     // roll edge state (frame end)
 * ```
 */
export declare class InputManager<A extends string = string> {
    /** Pointer position in target-local pixels (use `camera.screenToWorld`). */
    pointerX: number;
    pointerY: number;
    /** True while any pointer button is held. */
    pointerDown: boolean;
    /** Left-stick magnitude past which a direction counts as pressed. */
    stickDeadzone: number;
    private readonly _actions;
    /** code → actions it triggers (for routing DOM/gamepad events). */
    private readonly _codeToActions;
    /** action → its bound codes (for held/edge queries). */
    private readonly _actionToCodes;
    /** Codes currently held. */
    private readonly _down;
    /** Actions that were down at the last `update()` — the edge baseline. */
    private _downPrev;
    private _target;
    private _listeners;
    /**
     * @param bindings action → the codes that trigger it. The same code may map
     *   to several actions; an action may have several codes.
     */
    constructor(bindings: Record<A, readonly string[]>);
    /** Mark a code held. Ignores unbound codes and repeats. */
    pressCode(code: string): void;
    /** Mark a code released. */
    releaseCode(code: string): void;
    /** Release everything (e.g. on window blur, to avoid stuck keys). */
    releaseAll(): void;
    /** True if any code bound to `action` is held. */
    isDown(action: A): boolean;
    /** True only on the frame `action` went from up to down. */
    justPressed(action: A): boolean;
    /** True only on the frame `action` went from down to up. */
    justReleased(action: A): boolean;
    /** A `{ action: held }` map — structurally an `InputState` when the actions
     *  are `up`/`down`/`left`/`right`. */
    snapshot(): Record<A, boolean>;
    /** Roll the edge baseline. Call once per frame, after reading edges. */
    update(): void;
    /**
     * Attach keyboard + pointer listeners. `target` defaults to `window`; pass a
     * canvas to scope pointer coordinates to it. Browser-only — calling this
     * without a DOM throws.
     */
    attach(target?: (Window & typeof globalThis) | HTMLElement): void;
    /** Remove all listeners attached by {@link attach}. */
    detach(): void;
    /**
     * Poll connected gamepads and fold their state into the held set. Call once
     * per frame (frame start). No-op without the Gamepad API.
     */
    poll(): void;
    private _setCode;
    private _setPointer;
    private _add;
}
