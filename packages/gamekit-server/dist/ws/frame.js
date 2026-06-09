/**
 * RFC 6455 WebSocket frame codec — pure, no I/O, so it can be unit-tested
 * without sockets. Server→client frames are written unmasked (§5.1: a server
 * MUST NOT mask); client→server frames arrive masked and are unmasked here.
 */
export const Opcode = {
    CONTINUATION: 0x0,
    TEXT: 0x1,
    BINARY: 0x2,
    CLOSE: 0x8,
    PING: 0x9,
    PONG: 0xa,
};
/** Thrown on a framing-level protocol violation; the connection should close 1002. */
export class WebSocketProtocolError extends Error {
}
/** Guard against absurd declared payload lengths (memory-abuse / 64-bit reads). */
const MAX_PAYLOAD = 100 * 1024 * 1024;
const KNOWN_OPCODES = new Set([0x0, 0x1, 0x2, 0x8, 0x9, 0xa]);
/** Encode a single (unmasked) frame for sending from the server. */
export function encodeFrame(opcode, payload = Buffer.alloc(0), fin = true) {
    const len = payload.length;
    let header;
    if (len < 126) {
        header = Buffer.allocUnsafe(2);
        header[1] = len;
    }
    else if (len <= 0xffff) {
        header = Buffer.allocUnsafe(4);
        header[1] = 126;
        header.writeUInt16BE(len, 2);
    }
    else {
        header = Buffer.allocUnsafe(10);
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(len), 2);
    }
    header[0] = (fin ? 0x80 : 0) | (opcode & 0x0f);
    return Buffer.concat([header, payload]);
}
/**
 * Parse as many complete frames as `buffer` contains. Returns the parsed frames
 * and any trailing bytes of an incomplete frame (`rest`), which the caller
 * prepends to the next TCP chunk. A single frame may span multiple chunks and a
 * single chunk may hold multiple frames — this handles both.
 */
export function parseFrames(buffer) {
    const frames = [];
    let offset = 0;
    while (offset + 2 <= buffer.length) {
        const b0 = buffer[offset];
        const b1 = buffer[offset + 1];
        const fin = (b0 & 0x80) !== 0;
        const opcode = b0 & 0x0f;
        const masked = (b1 & 0x80) !== 0;
        let len = b1 & 0x7f;
        let headerLen = 2;
        if (len === 126) {
            if (offset + 4 > buffer.length)
                break; // need extended length bytes
            len = buffer.readUInt16BE(offset + 2);
            headerLen = 4;
        }
        else if (len === 127) {
            if (offset + 10 > buffer.length)
                break;
            const big = buffer.readBigUInt64BE(offset + 2);
            if (big > BigInt(MAX_PAYLOAD)) {
                throw new WebSocketProtocolError("frame payload too large");
            }
            len = Number(big);
            headerLen = 10;
        }
        const maskLen = masked ? 4 : 0;
        const payloadStart = offset + headerLen + maskLen;
        if (payloadStart + len > buffer.length)
            break; // incomplete payload
        if (!KNOWN_OPCODES.has(opcode)) {
            throw new WebSocketProtocolError(`unsupported opcode 0x${opcode.toString(16)}`);
        }
        // Control frames (>= 0x8) must not be fragmented and are limited to 125 bytes.
        if (opcode >= 0x8) {
            if (!fin) {
                throw new WebSocketProtocolError("control frame must not be fragmented");
            }
            if (len > 125) {
                throw new WebSocketProtocolError("control frame payload too large");
            }
        }
        let payload;
        if (masked) {
            const k0 = buffer[offset + headerLen];
            const k1 = buffer[offset + headerLen + 1];
            const k2 = buffer[offset + headerLen + 2];
            const k3 = buffer[offset + headerLen + 3];
            const key = [k0, k1, k2, k3];
            payload = Buffer.allocUnsafe(len);
            for (let i = 0; i < len; i++) {
                payload[i] = buffer[payloadStart + i] ^ key[i & 3];
            }
        }
        else {
            // Copy so the frame outlives the (reused) input buffer.
            payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + len));
        }
        frames.push({ fin, opcode, masked, payload });
        offset = payloadStart + len;
    }
    return { frames, rest: Buffer.from(buffer.subarray(offset)) };
}
