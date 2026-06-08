import { Signal } from "gamekit";
import { Opcode, encodeFrame, parseFrames, } from "./frame.js";
/** Drop a connection whose outbound kernel buffer exceeds this (slow client). */
const BACKPRESSURE_CAP = 1 << 20; // 1 MB
/**
 * One client connection over a raw TCP socket, speaking RFC 6455. Owns the read
 * accumulator (a single WS message may span multiple `data` events, and one
 * event may carry several frames), reassembles fragmented messages, answers
 * pings, and handles the close handshake. Emits decoded application messages.
 */
export class WebSocketConnection {
    constructor(_socket, head) {
        this._socket = _socket;
        /** Decoded application messages (text → string, binary → ArrayBuffer). */
        this.onMessage = new Signal();
        /** Fires exactly once when the connection closes. */
        this.onClose = new Signal();
        this._buffer = Buffer.alloc(0);
        this._closed = false;
        this._fragmentOpcode = 0; // 0 = not currently reassembling
        this._fragments = [];
        _socket.on("data", (chunk) => this._onData(chunk));
        _socket.on("close", () => this._destroy());
        _socket.on("error", () => this._destroy());
        if (head && head.length)
            this._onData(head);
    }
    send(data) {
        if (this._closed)
            return;
        let payload;
        let opcode;
        if (typeof data === "string") {
            payload = Buffer.from(data, "utf8");
            opcode = Opcode.TEXT;
        }
        else {
            payload = Buffer.from(data);
            opcode = Opcode.BINARY;
        }
        this._socket.write(encodeFrame(opcode, payload));
        if (this._socket.writableLength > BACKPRESSURE_CAP)
            this.close(1009);
    }
    /** Send a close frame and end the socket. Idempotent. */
    close(code = 1000) {
        if (this._closed)
            return;
        this._closed = true;
        const payload = Buffer.allocUnsafe(2);
        payload.writeUInt16BE(code, 0);
        try {
            this._socket.write(encodeFrame(Opcode.CLOSE, payload));
            this._socket.end();
        }
        catch {
            // socket already gone
        }
        this.onClose.emit();
    }
    // ---- Internal ----
    _onData(chunk) {
        if (this._closed)
            return;
        this._buffer = this._buffer.length
            ? Buffer.concat([this._buffer, chunk])
            : chunk;
        let result;
        try {
            result = parseFrames(this._buffer);
        }
        catch {
            this.close(1002); // framing-level protocol error
            return;
        }
        this._buffer = result.rest;
        for (const frame of result.frames) {
            this._handleFrame(frame);
            if (this._closed)
                return;
        }
    }
    _handleFrame(frame) {
        // RFC 6455 §5.1: every client→server frame MUST be masked.
        if (!frame.masked) {
            this.close(1002);
            return;
        }
        switch (frame.opcode) {
            case Opcode.PING:
                this._socket.write(encodeFrame(Opcode.PONG, frame.payload));
                return;
            case Opcode.PONG:
                return; // heartbeat reply; ignore
            case Opcode.CLOSE:
                this.close(1000);
                return;
            case Opcode.TEXT:
            case Opcode.BINARY:
                if (frame.fin) {
                    this._emit(frame.opcode, frame.payload);
                }
                else {
                    this._fragmentOpcode = frame.opcode;
                    this._fragments = [frame.payload];
                }
                return;
            case Opcode.CONTINUATION:
                if (this._fragmentOpcode === 0) {
                    this.close(1002); // continuation without a started message
                    return;
                }
                this._fragments.push(frame.payload);
                if (frame.fin) {
                    const full = Buffer.concat(this._fragments);
                    const opcode = this._fragmentOpcode;
                    this._fragmentOpcode = 0;
                    this._fragments = [];
                    this._emit(opcode, full);
                }
                return;
        }
    }
    _emit(opcode, payload) {
        if (opcode === Opcode.TEXT) {
            this.onMessage.emit(payload.toString("utf8"));
        }
        else {
            const ab = payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
            this.onMessage.emit(ab);
        }
    }
    /** Mark closed and emit once (covers peer-initiated close / socket error). */
    _destroy() {
        if (this._closed)
            return;
        this._closed = true;
        this.onClose.emit();
    }
}
