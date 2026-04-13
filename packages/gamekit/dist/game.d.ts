/**
 * Game - Main game class
 * Orchestrates all subsystems: rendering, physics, input, network
 */
import type { GameOptions } from './types.js';
import type { GKSprite } from './gk-sprite.js';
export declare class Game {
    private options;
    private renderer;
    private physics;
    private input;
    private network;
    private sprites;
    private updateCallbacks;
    private lastTime;
    constructor(options?: GameOptions);
    /**
     * Start the main game loop
     * Updates physics and syncs sprites every frame
     */
    private startGameLoop;
    /**
     * Add a sprite to the game
     * Hooks sprite into all systems (render, physics, etc.)
     */
    add(sprite: GKSprite): void;
    /**
     * Remove a sprite from the game
     */
    remove(sprite: GKSprite): void;
    /**
     * Register callback to run every frame
     */
    onUpdate(callback: Function): void;
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
     * Create a new multiplayer room (become host)
     * @param playerName - Your player name
     * @returns Room code to share with other players
     */
    createRoom(playerName: string): Promise<{
        code: string;
    }>;
    /**
     * Join an existing multiplayer room
     * @param code - Room code from host
     * @param playerName - Your player name
     */
    joinRoom(code: string, playerName: string): Promise<void>;
    /**
     * Register callback for when a player joins the room
     * @param callback - Called with Player object
     */
    onPlayerJoin(callback: Function): void;
    /**
     * Register callback for when a player leaves the room
     * @param callback - Called with Player object
     */
    onPlayerLeave(callback: Function): void;
    /**
     * Send custom message to all players in room
     * @param event - Message event name
     * @param data - Message payload
     */
    send(event: string, data: any): void;
    /**
     * Register callback for custom messages
     * @param event - Message event name to listen for
     * @param callback - Called with message payload
     */
    onMessage(event: string, callback: Function): void;
    /**
     * Mark a sprite as owned by this player (will be synced over network)
     * @param sprite - Sprite to sync
     */
    setOwner(sprite: GKSprite): void;
    /**
     * Get current player info
     */
    getPlayer(): {
        name: string;
        isHost: boolean;
    } | null;
    /**
     * Get current room code
     */
    getRoomCode(): string | null;
    /**
     * Register callback for sprite sync updates from other players
     * @param callback - Called with { playerId, sprites: [{ id, x, y, angle, velocityX, velocityY }] }
     */
    onSpriteSync(callback: Function): void;
}
