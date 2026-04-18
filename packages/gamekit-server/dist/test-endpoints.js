/**
 * Test-only HTTP endpoints for inspecting server state
 * Only enabled when testMode is true in ServerOptions
 */
export class TestEndpoints {
    constructor(httpServer, roomManager) {
        this.httpServer = httpServer;
        this.roomManager = roomManager;
    }
    /**
     * Set up test-only HTTP endpoints
     * Wraps the existing HTTP server request handler
     */
    setup() {
        const originalListener = this.httpServer.listeners('request')[0];
        this.httpServer.removeAllListeners('request');
        this.httpServer.on('request', (req, res) => {
            // Test endpoints
            if (req.url === '/test/rooms') {
                this.handleGetRooms(res);
                return;
            }
            if (req.url?.startsWith('/test/rooms/')) {
                const stateMatch = req.url.match(/\/test\/rooms\/([^\/]+)\/state$/);
                if (stateMatch) {
                    this.handleGetRoomState(stateMatch[1], res);
                    return;
                }
                const msgMatch = req.url.match(/\/test\/rooms\/([^\/]+)\/messages$/);
                if (msgMatch) {
                    this.handleGetRoomMessages(msgMatch[1], res);
                    return;
                }
            }
            // Fall back to original handler (health endpoint)
            if (originalListener) {
                originalListener.call(this.httpServer, req, res);
            }
            else {
                res.writeHead(404);
                res.end();
            }
        });
        console.log('[TestEndpoints] Enabled at /test/*');
    }
    /**
     * GET /test/rooms
     * Returns list of all active rooms
     */
    handleGetRooms(res) {
        const rooms = Array.from(this.roomManager.getAllRooms()).map(([code, room]) => ({
            code,
            playerCount: room.players.size,
            hostId: room.hostId,
            createdAt: room.createdAt,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ rooms }));
    }
    /**
     * GET /test/rooms/:code/state
     * Returns full room state for a specific room
     */
    handleGetRoomState(code, res) {
        const room = this.roomManager.getRoom(code.toUpperCase());
        if (!room) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Room not found' }));
            return;
        }
        // Convert Map to object for JSON serialization
        const spritesArray = Array.from(room.sprites.values());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            code: room.code,
            hostId: room.hostId,
            players: Array.from(room.players.entries()).map(([id, player]) => ({
                id,
                name: player.name,
                score: player.score,
            })),
            sprites: spritesArray,
            messageHistory: room.messageHistory || [],
        }));
    }
    /**
     * GET /test/rooms/:code/messages
     * Returns message history for a room
     */
    handleGetRoomMessages(code, res) {
        const room = this.roomManager.getRoom(code.toUpperCase());
        if (!room) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Room not found' }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            messages: room.messageHistory || [],
        }));
    }
}
