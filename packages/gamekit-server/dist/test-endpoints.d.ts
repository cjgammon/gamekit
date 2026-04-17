import type { Server as HttpServer } from 'http';
import type { RoomManager } from './room-manager.js';
/**
 * Test-only HTTP endpoints for inspecting server state
 * Only enabled when testMode is true in ServerOptions
 */
export declare class TestEndpoints {
    private httpServer;
    private roomManager;
    constructor(httpServer: HttpServer, roomManager: RoomManager);
    /**
     * Set up test-only HTTP endpoints
     * Wraps the existing HTTP server request handler
     */
    setup(): void;
    /**
     * GET /test/rooms
     * Returns list of all active rooms
     */
    private handleGetRooms;
    /**
     * GET /test/rooms/:code/state
     * Returns full room state for a specific room
     */
    private handleGetRoomState;
    /**
     * GET /test/rooms/:code/messages
     * Returns message history for a room
     */
    private handleGetRoomMessages;
}
