import type { Signal, Transport } from "gamekit";
import type { WebSocketConnection } from "../ws/WebSocketConnection.js";

/** Adapts a {@link WebSocketConnection} to the shared {@link Transport}. */
export class ServerTransport implements Transport {
  constructor(private readonly _conn: WebSocketConnection) {}

  get onMessage(): Signal<string | ArrayBuffer> {
    return this._conn.onMessage;
  }

  get onClose(): Signal<void> {
    return this._conn.onClose;
  }

  send(data: string | ArrayBufferLike): void {
    this._conn.send(data);
  }

  close(): void {
    this._conn.close();
  }
}
