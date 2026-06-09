/**
 * RFC 6455 WebSocket frame codec — pure, no I/O, so it can be unit-tested
 * without sockets. Server→client frames are written unmasked (§5.1: a server
 * MUST NOT mask); client→server frames arrive masked and are unmasked here.
 */
export declare const Opcode: {
    readonly CONTINUATION: 0;
    readonly TEXT: 1;
    readonly BINARY: 2;
    readonly CLOSE: 8;
    readonly PING: 9;
    readonly PONG: 10;
};
export interface ParsedFrame {
    fin: boolean;
    opcode: number;
    masked: boolean;
    payload: Buffer;
}
/** Thrown on a framing-level protocol violation; the connection should close 1002. */
export declare class WebSocketProtocolError extends Error {
}
/** Encode a single (unmasked) frame for sending from the server. */
export declare function encodeFrame(opcode: number, payload?: Buffer, fin?: boolean): Buffer;
/**
 * Parse as many complete frames as `buffer` contains. Returns the parsed frames
 * and any trailing bytes of an incomplete frame (`rest`), which the caller
 * prepends to the next TCP chunk. A single frame may span multiple chunks and a
 * single chunk may hold multiple frames — this handles both.
 */
export declare function parseFrames(buffer: Buffer): {
    frames: ParsedFrame[];
    rest: Buffer;
};
