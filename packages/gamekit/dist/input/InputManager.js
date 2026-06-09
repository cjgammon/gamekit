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
export class InputManager {
    /**
     * @param bindings action → the codes that trigger it. The same code may map
     *   to several actions; an action may have several codes.
     */
    constructor(bindings) {
        /** Pointer position in target-local pixels (use `camera.screenToWorld`). */
        this.pointerX = 0;
        this.pointerY = 0;
        /** True while any pointer button is held. */
        this.pointerDown = false;
        /** Left-stick magnitude past which a direction counts as pressed. */
        this.stickDeadzone = 0.5;
        /** code → actions it triggers (for routing DOM/gamepad events). */
        this._codeToActions = new Map();
        /** action → its bound codes (for held/edge queries). */
        this._actionToCodes = new Map();
        /** Codes currently held. */
        this._down = new Set();
        /** Actions that were down at the last `update()` — the edge baseline. */
        this._downPrev = new Set();
        // DOM binding state (set by attach, cleared by detach).
        this._target = null;
        this._listeners = [];
        this._actions = Object.keys(bindings);
        for (const action of this._actions) {
            const codes = [...bindings[action]];
            this._actionToCodes.set(action, codes);
            for (const code of codes) {
                const list = this._codeToActions.get(code);
                if (list)
                    list.push(action);
                else
                    this._codeToActions.set(code, [action]);
            }
        }
    }
    // ---- Pure state machine (no DOM) ----
    /** Mark a code held. Ignores unbound codes and repeats. */
    pressCode(code) {
        if (this._codeToActions.has(code))
            this._down.add(code);
    }
    /** Mark a code released. */
    releaseCode(code) {
        this._down.delete(code);
    }
    /** Release everything (e.g. on window blur, to avoid stuck keys). */
    releaseAll() {
        this._down.clear();
        this.pointerDown = false;
    }
    /** True if any code bound to `action` is held. */
    isDown(action) {
        const codes = this._actionToCodes.get(action);
        if (codes)
            for (const code of codes)
                if (this._down.has(code))
                    return true;
        return false;
    }
    /** True only on the frame `action` went from up to down. */
    justPressed(action) {
        return this.isDown(action) && !this._downPrev.has(action);
    }
    /** True only on the frame `action` went from down to up. */
    justReleased(action) {
        return !this.isDown(action) && this._downPrev.has(action);
    }
    /** A `{ action: held }` map — structurally an `InputState` when the actions
     *  are `up`/`down`/`left`/`right`. */
    snapshot() {
        const out = {};
        for (const action of this._actions)
            out[action] = this.isDown(action);
        return out;
    }
    /** Roll the edge baseline. Call once per frame, after reading edges. */
    update() {
        const next = new Set();
        for (const action of this._actions)
            if (this.isDown(action))
                next.add(action);
        this._downPrev = next;
    }
    // ---- Browser sources (DOM) ----
    /**
     * Attach keyboard + pointer listeners. `target` defaults to `window`; pass a
     * canvas to scope pointer coordinates to it. Browser-only — calling this
     * without a DOM throws.
     */
    attach(target = window) {
        this.detach();
        this._target = target;
        const onKeyDown = (e) => {
            if (this._codeToActions.has(e.code)) {
                this.pressCode(e.code);
                e.preventDefault();
            }
        };
        const onKeyUp = (e) => this.releaseCode(e.code);
        const onPointerDown = (e) => {
            this.pointerDown = true;
            this._setPointer(e);
            this.pressCode(`Mouse${e.button}`);
        };
        const onPointerUp = (e) => {
            this.pointerDown = false;
            this._setPointer(e);
            this.releaseCode(`Mouse${e.button}`);
        };
        const onPointerMove = (e) => this._setPointer(e);
        const onBlur = () => this.releaseAll();
        this._add("keydown", onKeyDown);
        this._add("keyup", onKeyUp);
        this._add("pointerdown", onPointerDown);
        this._add("pointerup", onPointerUp);
        this._add("pointermove", onPointerMove);
        this._add("blur", onBlur);
    }
    /** Remove all listeners attached by {@link attach}. */
    detach() {
        if (!this._target)
            return;
        for (const [type, fn] of this._listeners) {
            this._target.removeEventListener(type, fn);
        }
        this._listeners = [];
        this._target = null;
    }
    /**
     * Poll connected gamepads and fold their state into the held set. Call once
     * per frame (frame start). No-op without the Gamepad API.
     */
    poll() {
        const nav = typeof navigator !== "undefined" ? navigator : undefined;
        if (!nav?.getGamepads)
            return;
        let buttons = 0;
        let axisX = 0;
        let axisY = 0;
        for (const pad of nav.getGamepads()) {
            if (!pad)
                continue;
            buttons = Math.max(buttons, pad.buttons.length);
            for (let i = 0; i < pad.buttons.length; i++) {
                this._setCode(`Pad${i}`, pad.buttons[i].pressed);
            }
            // Left stick (axes 0/1), accumulated across pads.
            axisX = Math.abs(pad.axes[0] ?? 0) > Math.abs(axisX) ? pad.axes[0] : axisX;
            axisY = Math.abs(pad.axes[1] ?? 0) > Math.abs(axisY) ? pad.axes[1] : axisY;
        }
        const dz = this.stickDeadzone;
        this._setCode("PadLeft", axisX < -dz);
        this._setCode("PadRight", axisX > dz);
        this._setCode("PadUp", axisY < -dz);
        this._setCode("PadDown", axisY > dz);
    }
    // ---- Internal ----
    _setCode(code, down) {
        if (down)
            this.pressCode(code);
        else
            this.releaseCode(code);
    }
    _setPointer(e) {
        const t = this._target;
        if (t && "getBoundingClientRect" in t) {
            const rect = t.getBoundingClientRect();
            this.pointerX = e.clientX - rect.left;
            this.pointerY = e.clientY - rect.top;
        }
        else {
            this.pointerX = e.clientX;
            this.pointerY = e.clientY;
        }
    }
    _add(type, fn) {
        this._target.addEventListener(type, fn);
        this._listeners.push([type, fn]);
    }
}
