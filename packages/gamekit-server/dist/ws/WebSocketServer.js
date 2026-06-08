import { createServer } from "node:http";
import { Signal } from "gamekit";
import { buildHandshakeResponse, computeAcceptKey } from "./handshake.js";
import { WebSocketConnection } from "./WebSocketConnection.js";
/**
 * A from-scratch WebSocket server over `node:http`. Performs the RFC 6455
 * upgrade handshake and surfaces each accepted connection via `onConnection`.
 * It holds no game logic — `NetServer` listens to `onConnection`.
 */
export class WebSocketServer {
    constructor() {
        this.onConnection = new Signal();
        this._http = createServer((_req, res) => {
            res.writeHead(426, { "Content-Type": "text/plain" });
            res.end("Upgrade Required");
        });
        this._http.on("upgrade", (req, socket, head) => this._onUpgrade(req, socket, head));
    }
    listen(port, onListening) {
        this._http.listen(port, onListening);
    }
    close(onClosed) {
        this._http.close(onClosed);
    }
    _onUpgrade(req, socket, head) {
        const key = req.headers["sec-websocket-key"];
        const upgrade = (req.headers["upgrade"] ?? "").toLowerCase();
        const version = req.headers["sec-websocket-version"];
        if (upgrade !== "websocket" || typeof key !== "string" || version !== "13") {
            socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
            socket.destroy();
            return;
        }
        socket.write(buildHandshakeResponse(computeAcceptKey(key)));
        this.onConnection.emit(new WebSocketConnection(socket, head));
    }
}
