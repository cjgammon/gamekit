import type { Server, Socket } from 'socket.io';
import type { ServerHooks } from './types.js';
import { RoomManager } from './room-manager.js';
/**
 * Handles all Socket.io events with hook support
 */
export declare class EventHandlers {
    private roomManager;
    private io;
    private hooks;
    constructor(roomManager: RoomManager, io: Server, hooks?: ServerHooks);
    /**
     * Setup all event handlers for a socket connection
     */
    setupHandlers(socket: Socket): void;
    /**
     * Handle createRoom event
     */
    private handleCreateRoom;
    /**
     * Handle joinRoom event
     */
    private handleJoinRoom;
    /**
     * Handle spriteSync event
     */
    private handleSpriteSync;
    /**
     * Handle gameEvent (custom game events)
     */
    private handleGameEvent;
    /**
     * Handle requestLeaderboard event
     */
    private handleRequestLeaderboard;
    /**
     * Handle disconnect event
     */
    private handleDisconnect;
}
