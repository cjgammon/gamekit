// ============================================================
//  input.js — keyboard, mouse, and touch input
//
//  Handles key presses, key holds, mouse clicks, and touch
//  taps so the game works on both desktop and mobile.
// ============================================================

export class Input {

  constructor(canvas) {
    // set of currently held keys
    this._held    = new Set();

    // key → [callbacks] for press events
    this._keyMap  = {};

    // tap/click callbacks
    this._tapCallbacks = [];

    // --- keyboard ---
    window.addEventListener('keydown', (e) => {
      if (!this._held.has(e.key)) {
        // first press — fire onKey callbacks
        (this._keyMap[e.key] || []).forEach(cb => cb());
      }
      this._held.add(e.key);
    });

    window.addEventListener('keyup', (e) => {
      this._held.delete(e.key);
    });

    // --- mouse click ---
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top)  * scaleY;
      this._tapCallbacks.forEach(cb => cb(x, y));
    });

    // --- touch tap (mobile) ---
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      const rect  = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top)  * scaleY;
      this._tapCallbacks.forEach(cb => cb(x, y));
    }, { passive: false });
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
    if (!this._keyMap[key]) this._keyMap[key] = [];
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

  // ------------------------------------------------------------------
  //  onTap(callback)
  //
  //  Fires when the player clicks or taps the screen.
  //  callback receives (x, y) in game coordinates.
  // ------------------------------------------------------------------
  onTap(callback) {
    this._tapCallbacks.push(callback);
  }

  // ------------------------------------------------------------------
  //  Virtual joystick helper — useful for mobile games
  //  Returns { x, y } direction from -1 to 1
  //  (hooked up automatically if you call game.addJoystick())
  // ------------------------------------------------------------------
  getJoystick() {
    // arrow key fallback so desktop still works
    return {
      x: (this._held.has('ArrowRight') ? 1 : 0) - (this._held.has('ArrowLeft') ? 1 : 0),
      y: (this._held.has('ArrowDown')  ? 1 : 0) - (this._held.has('ArrowUp')   ? 1 : 0),
    };
  }
}
