export class Input {
    constructor() {
        // set of currently held keys
        this._held = new Set();
        // key → [callbacks] for press events
        this._keyMap = {};
        // --- keyboard ---
        window.addEventListener("keydown", (e) => {
            if (!this._held.has(e.key)) {
                // first press — fire onKey callbacks
                (this._keyMap[e.key] || []).forEach((cb) => cb());
            }
            this._held.add(e.key);
        });
        window.addEventListener("keyup", (e) => {
            this._held.delete(e.key);
        });
    }
    // ------------------------------------------------------------------
    //  onKey(key, callback)
    //
    //  Fires once when a key is first pressed down.
    //  Key names match browser KeyboardEvent.key values:
    //    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'
    //    ' ' (spacebar), 'Enter', 'a', 'b', etc.
    // ------------------------------------------------------------------
    onKey(key, callback) {
        if (!this._keyMap[key])
            this._keyMap[key] = [];
        this._keyMap[key].push(callback);
    }
    // ------------------------------------------------------------------
    //  isKeyDown(key) → boolean
    //
    //  True while a key is held. Use inside game.onUpdate() for
    //  smooth continuous movement.
    // ------------------------------------------------------------------
    isKeyDown(key) {
        return this._held.has(key);
    }
}
