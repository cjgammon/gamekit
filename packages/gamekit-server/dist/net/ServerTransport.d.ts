import type { Signal, Transport } from "@cjgammon/gamekit";
import type { WebSocketConnection } from "../ws/WebSocketConnection.js";
/** Adapts a {@link WebSocketConnection} to the shared {@link Transport}. */
export declare class ServerTransport implements Transport {
    private readonly _conn;
    constructor(_conn: WebSocketConnection);
    get onMessage(): Signal<string | ArrayBuffer>;
    get onClose(): Signal<void>;
    send(data: string | ArrayBufferLike): void;
    close(): void;
}
