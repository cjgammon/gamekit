/**
 * Wire codecs for the net protocol. A {@link Codec} turns messages into bytes
 * (or text) and back; both the client and server pick the same one.
 *
 * - {@link jsonCodec} — human-readable JSON strings. Great for debugging.
 * - {@link binaryCodec} — compact `ArrayBuffer` frames (the default). The fixed
 *   transform fields (id, x, y, rotation, tick, seq, …) are packed as raw
 *   numbers; the game-defined `input` / per-entity `s` / global `state` payloads
 *   are typed `unknown`, so they're written by a small self-describing value
 *   codec ({@link BinaryWriter.value}) — any JSON-compatible shape goes fully
 *   binary with no schema declared up front (MessagePack-style).
 *
 * Pure data — no DOM, no Node — so the headless server imports it unchanged. The
 * transports already route `string` as a TEXT frame and `ArrayBuffer` as a
 * BINARY frame, so swapping codecs needs no transport changes.
 */
import type { ClientMessage, ServerMessage } from "./protocol.js";
/** Encodes/decodes protocol messages for the wire. Client and server must agree. */
export interface Codec {
    encode(msg: ClientMessage | ServerMessage): string | ArrayBuffer;
    decodeServer(data: string | ArrayBuffer): ServerMessage;
    decodeClient(data: string | ArrayBuffer): ClientMessage;
}
/** Sequential writer over an auto-growing `ArrayBuffer`. Little-endian. */
export declare class BinaryWriter {
    private _buf;
    private _view;
    private _u8;
    private _len;
    constructor(initialCapacity?: number);
    private _ensure;
    u8(v: number): void;
    u16(v: number): void;
    u32(v: number): void;
    f32(v: number): void;
    f64(v: number): void;
    bytes(src: Uint8Array): void;
    /** Length-prefixed (u8) UTF-8 string — for short tags (≤ 255 bytes). */
    str8(s: string): void;
    /** Unsigned LEB128 varint — 7 data bits per byte, so small numbers are 1 byte. */
    varint(v: number): void;
    /**
     * Write an arbitrary JSON-compatible value as self-describing binary: a 1-byte
     * type tag followed by its data — no JSON punctuation, booleans are one byte,
     * numbers are packed. Handles undefined / null / boolean / number / string /
     * array / plain object. `undefined` is the "absent" marker (1 byte), and
     * undefined-valued object entries are dropped, matching `JSON.stringify`.
     */
    value(v: unknown): void;
    /** A copy of the bytes written so far. */
    finish(): ArrayBuffer;
}
/** Sequential reader over an `ArrayBuffer`. Mirrors {@link BinaryWriter}. */
export declare class BinaryReader {
    private readonly _view;
    private readonly _u8;
    private _off;
    constructor(data: ArrayBuffer);
    u8(): number;
    u16(): number;
    u32(): number;
    f32(): number;
    f64(): number;
    str8(): string;
    varint(): number;
    /** Read a self-describing value written by {@link BinaryWriter.value}. */
    value(): unknown;
}
/** Compact binary frames (the default wire format). */
export declare const binaryCodec: Codec;
/** Human-readable JSON strings. Selectable for debugging. */
export declare const jsonCodec: Codec;
/** The codec used when none is specified. */
export declare const defaultCodec: Codec;
