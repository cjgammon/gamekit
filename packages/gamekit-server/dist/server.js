import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './room-manager.js';
import { EventHandlers } from './event-handlers.js';
/**
 * GameKit multiplayer server
 */
export class GameKitServer {
    constructor(options = {}) {
        this.port = options.port || 3000;
        // Create HTTP server with health endpoint
        this.httpServer = createHttpServer((req, res) => {
            if (req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    rooms: this.roomManager.getRoomCount(),
                    uptime: Math.floor(process.uptime()),
                }));
                return;
            }
            res.writeHead(404);
            res.end();
        });
        // Create Socket.IO server
        this.io = new SocketIOServer(this.httpServer, {
            cors: options.cors || {
                origin: '*',
                methods: ['GET', 'POST'],
            },
        });
        // Create room manager and event handlers
        this.roomManager = new RoomManager();
        this.eventHandlers = new EventHandlers(this.roomManager, this.io, options.hooks);
    }
    /**
     * Start the server
     */
    start() {
        // Setup connection handler
        this.io.on('connection', (socket) => {
            console.log(`[+] Player connected:   ${socket.id}`);
            this.eventHandlers.setupHandlers(socket);
        });
        // Start listening
        this.httpServer.listen(this.port, () => {
            console.log(`
  ╔════════════════════════════════════════╗
  ║   GameKit Server running!              ║
  ║   http://localhost:${this.port.toString().padEnd(4)}               ║
  ║   Health: http://localhost:${this.port.toString().padEnd(4)}/health  ║
  ╚════════════════════════════════════════╝
      `);
        });
    }
    /**
     * Stop the server
     */
    async stop() {
        return new Promise((resolve, reject) => {
            this.io.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.httpServer.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    console.log('[X] Server stopped');
                    resolve();
                });
            });
        });
    }
}
/**
 * Create a new GameKit server instance
 */
export function createServer(options = {}) {
    return new GameKitServer(options);
}
