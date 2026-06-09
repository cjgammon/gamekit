import type { Socket } from "node:net";
import { Signal } from "@cjgammon/gamekit";
/**
 * One client connection over a raw TCP socket, speaking RFC 6455. Owns the read
 * accumulator (a single WS message may span multiple `data` events, and one
 * event may carry several frames), reassembles fragmented messages, answers
 * pings, and handles the close handshake. Emits decoded application messages.
 */
export declare class WebSocketConnection {
    private readonly _socket;
    /** Decoded application messages (text → string, binary → ArrayBuffer). */
    readonly onMessage: Signal<string | ArrayBuffer>;
    /** Fires exactly once when the connection closes. */
    readonly onClose: Signal<void>;
    private _buffer;
    private _closed;
    private _fragmentOpcode;
    private _fragments;
    constructor(_socket: Socket, head?: Buffer);
    send(data: string | ArrayBufferLike): void;
    /** Send a close frame and end the socket. Idempotent. */
    close(code?: number): void;
    private _onData;
    private _handleFrame;
    private _emit;
    /** Mark closed and emit once (covers peer-initiated close / socket error). */
    private _destroy;
}
