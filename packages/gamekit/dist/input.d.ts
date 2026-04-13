/**
 * Input - Keyboard and mouse event handling
 * Provides simple API for game input controls
 */
export declare class Input {
    private keysDown;
    private keyCallbacks;
    private tapCallbacks;
    constructor();
    /**
     * Check if a key is currently pressed
     * @param key - Key name (e.g., 'ArrowUp', 'w', 'Space')
     */
    isKeyDown(key: string): boolean;
    /**
     * Register callback for key press event
     * @param key - Key name
     * @param callback - Function to call when key is pressed
     */
    onKey(key: string, callback: Function): void;
    /**
     * Register callback for tap/click events
     * @param callback - Function to call with (x, y) coordinates
     */
    onTap(callback: Function): void;
    /**
     * Clean up event listeners
     */
    destroy(): void;
}
