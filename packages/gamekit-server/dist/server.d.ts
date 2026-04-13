import type { ServerOptions, GameKitServer as IGameKitServer } from './types.js';
/**
 * GameKit multiplayer server
 */
export declare class GameKitServer implements IGameKitServer {
    private port;
    private httpServer;
    private io;
    private roomManager;
    private eventHandlers;
    constructor(options?: ServerOptions);
    /**
     * Start the server
     */
    start(): void;
    /**
     * Stop the server
     */
    stop(): Promise<void>;
}
/**
 * Create a new GameKit server instance
 */
export declare function createServer(options?: ServerOptions): IGameKitServer;
