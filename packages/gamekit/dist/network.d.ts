/**
 * Network - Socket.io multiplayer client
 * Handles room management, sprite sync, and custom messaging
 */
import type { GKSprite } from './gk-sprite.js';
export declare class Network {
    private socket;
    private serverUrl;
    private roomCode;
    private playerName;
    private isHost;
    private playerJoinCallbacks;
    private playerLeaveCallbacks;
    private messageCallbacks;
    private spriteSyncCallbacks;
    private ownedSprites;
    private syncInterval;
    constructor(serverUrl: string);
    /**
     * Create a new room (become host)
     */
    createRoom(playerName: string): Promise<{
        code: string;
    }>;
    /**
     * Join an existing room
     */
    joinRoom(code: string, playerName: string): Promise<void>;
    /**
     * Set up Socket.io event handlers
     */
    private setupEventHandlers;
    /**
     * Start automatic sprite synchronization
     */
    private startSpriteSync;
    /**
     * Mark a sprite as owned by this player (will be synced)
     */
    addOwnedSprite(sprite: GKSprite): void;
    /**
     * Remove sprite from sync
     */
    removeOwnedSprite(sprite: GKSprite): void;
    /**
     * Register callback for player join events
     */
    onPlayerJoin(callback: Function): void;
    /**
     * Register callback for player leave events
     */
    onPlayerLeave(callback: Function): void;
    /**
     * Send custom message to all players
     */
    send(event: string, data: any): void;
    /**
     * Register callback for custom messages
     */
    onMessage(event: string, callback: Function): void;
    /**
     * Get current player info
     */
    getPlayer(): {
        name: string;
        isHost: boolean;
    } | null;
    /**
     * Get room code
     */
    getRoomCode(): string | null;
    /**
     * Register callback for sprite sync updates from other players
     * Callback receives: { playerId: string, sprites: Array<{ id, x, y, angle, velocityX, velocityY }> }
     */
    onSpriteSync(callback: Function): void;
    /**
     * Disconnect and clean up
     */
    disconnect(): void;
}
