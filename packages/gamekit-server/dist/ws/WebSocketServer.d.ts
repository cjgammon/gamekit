import { Signal } from "@cjgammon/gamekit";
import { WebSocketConnection } from "./WebSocketConnection.js";
/**
 * A from-scratch WebSocket server over `node:http`. Performs the RFC 6455
 * upgrade handshake and surfaces each accepted connection via `onConnection`.
 * It holds no game logic — `NetServer` listens to `onConnection`.
 */
export declare class WebSocketServer {
    readonly onConnection: Signal<WebSocketConnection>;
    private readonly _http;
    constructor();
    listen(port: number, onListening?: () => void): void;
    close(onClosed?: () => void): void;
    private _onUpgrade;
}
