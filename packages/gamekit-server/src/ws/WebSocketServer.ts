import { createServer, type Server, type IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { Signal } from "gamekit";
import { buildHandshakeResponse, computeAcceptKey } from "./handshake.js";
import { WebSocketConnection } from "./WebSocketConnection.js";

/**
 * A from-scratch WebSocket server over `node:http`. Performs the RFC 6455
 * upgrade handshake and surfaces each accepted connection via `onConnection`.
 * It holds no game logic — `NetServer` listens to `onConnection`.
 */
export class WebSocketServer {
  readonly onConnection = new Signal<WebSocketConnection>();
  private readonly _http: Server;

  constructor() {
    this._http = createServer((_req, res) => {
      res.writeHead(426, { "Content-Type": "text/plain" });
      res.end("Upgrade Required");
    });
    this._http.on("upgrade", (req, socket, head) =>
      this._onUpgrade(req, socket as Socket, head),
    );
  }

  listen(port: number, onListening?: () => void): void {
    this._http.listen(port, onListening);
  }

  close(onClosed?: () => void): void {
    this._http.close(onClosed);
  }

  private _onUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
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
