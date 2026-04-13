/**
 * Input - Keyboard and mouse event handling
 * Provides simple API for game input controls
 */
export class Input {
    constructor() {
        this.keysDown = new Set();
        this.keyCallbacks = new Map();
        this.tapCallbacks = [];
        console.log('[Input] Setting up keyboard and mouse handlers');
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            this.keysDown.add(e.key);
            // Fire key-specific callbacks
            const callbacks = this.keyCallbacks.get(e.key);
            if (callbacks) {
                callbacks.forEach(cb => cb());
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keysDown.delete(e.key);
        });
        // Mouse/touch events
        window.addEventListener('click', (e) => {
            const x = e.clientX;
            const y = e.clientY;
            this.tapCallbacks.forEach(cb => cb(x, y));
        });
        window.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                const x = touch.clientX;
                const y = touch.clientY;
                this.tapCallbacks.forEach(cb => cb(x, y));
            }
        });
        console.log('[Input] Input handlers ready');
    }
    /**
     * Check if a key is currently pressed
     * @param key - Key name (e.g., 'ArrowUp', 'w', 'Space')
     */
    isKeyDown(key) {
        return this.keysDown.has(key);
    }
    /**
     * Register callback for key press event
     * @param key - Key name
     * @param callback - Function to call when key is pressed
     */
    onKey(key, callback) {
        if (!this.keyCallbacks.has(key)) {
            this.keyCallbacks.set(key, []);
        }
        this.keyCallbacks.get(key).push(callback);
        console.log(`[Input] Registered callback for key: ${key}`);
    }
    /**
     * Register callback for tap/click events
     * @param callback - Function to call with (x, y) coordinates
     */
    onTap(callback) {
        this.tapCallbacks.push(callback);
        console.log('[Input] Registered tap callback');
    }
    /**
     * Clean up event listeners
     */
    destroy() {
        // Remove event listeners
        // Note: In practice, we'd store references to handlers for removal
        console.log('[Input] Destroyed');
    }
}
