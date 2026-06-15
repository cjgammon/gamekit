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
import type {
  ClientMessage,
  ServerMessage,
  SnapshotEntity,
  SnapshotMessage,
} from "./protocol.js";

const TE = new TextEncoder();
const TD = new TextDecoder();

// Message kind tags (first byte of every binary frame).
const KIND_INPUT = 0;
const KIND_WELCOME = 1;
const KIND_SNAP = 2;

// Self-describing value tags for the game-defined payloads (input / s / state):
// a 1-byte tag, then the data. Lets any JSON-compatible value go fully binary
// with no schema declared up front (MessagePack-style).
const T_UNDEF = 0;
const T_NULL = 1;
const T_FALSE = 2;
const T_TRUE = 3;
const T_INT = 4; // zig-zag varint
const T_FLOAT = 5; // f64
const T_STR = 6; // varint length + UTF-8
const T_ARR = 7; // varint count + values
const T_OBJ = 8; // varint count + (varint-length key + value)…

const INT_MIN = -0x80000000;
const INT_MAX = 0x7fffffff;

/** Map a signed 32-bit int to unsigned so small magnitudes make small varints. */
function zigzag(n: number): number {
  return ((n << 1) ^ (n >> 31)) >>> 0;
}
function unzigzag(u: number): number {
  return (u >>> 1) ^ -(u & 1);
}

/** Encodes/decodes protocol messages for the wire. Client and server must agree. */
export interface Codec {
  encode(msg: ClientMessage | ServerMessage): string | ArrayBuffer;
  decodeServer(data: string | ArrayBuffer): ServerMessage;
  decodeClient(data: string | ArrayBuffer): ClientMessage;
}

// ---- Little-endian buffer writer (auto-growing) ----

/** Sequential writer over an auto-growing `ArrayBuffer`. Little-endian. */
export class BinaryWriter {
  private _buf: ArrayBuffer;
  private _view: DataView;
  private _u8: Uint8Array;
  private _len = 0;

  constructor(initialCapacity = 256) {
    this._buf = new ArrayBuffer(initialCapacity);
    this._view = new DataView(this._buf);
    this._u8 = new Uint8Array(this._buf);
  }

  private _ensure(n: number): void {
    const need = this._len + n;
    if (need <= this._buf.byteLength) return;
    let cap = this._buf.byteLength;
    while (cap < need) cap *= 2;
    const grown = new ArrayBuffer(cap);
    new Uint8Array(grown).set(this._u8.subarray(0, this._len));
    this._buf = grown;
    this._view = new DataView(grown);
    this._u8 = new Uint8Array(grown);
  }

  u8(v: number): void {
    this._ensure(1);
    this._view.setUint8(this._len, v);
    this._len += 1;
  }
  u16(v: number): void {
    this._ensure(2);
    this._view.setUint16(this._len, v, true);
    this._len += 2;
  }
  u32(v: number): void {
    this._ensure(4);
    this._view.setUint32(this._len, v, true);
    this._len += 4;
  }
  f32(v: number): void {
    this._ensure(4);
    this._view.setFloat32(this._len, v, true);
    this._len += 4;
  }
  f64(v: number): void {
    this._ensure(8);
    this._view.setFloat64(this._len, v, true);
    this._len += 8;
  }
  bytes(src: Uint8Array): void {
    this._ensure(src.length);
    this._u8.set(src, this._len);
    this._len += src.length;
  }

  /** Length-prefixed (u8) UTF-8 string — for short tags (≤ 255 bytes). */
  str8(s: string): void {
    const b = TE.encode(s);
    if (b.length > 255) throw new RangeError(`string too long for str8: ${s}`);
    this.u8(b.length);
    this.bytes(b);
  }

  /** Unsigned LEB128 varint — 7 data bits per byte, so small numbers are 1 byte. */
  varint(v: number): void {
    while (v >= 0x80) {
      this.u8((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    this.u8(v);
  }

  /**
   * Write an arbitrary JSON-compatible value as self-describing binary: a 1-byte
   * type tag followed by its data — no JSON punctuation, booleans are one byte,
   * numbers are packed. Handles undefined / null / boolean / number / string /
   * array / plain object. `undefined` is the "absent" marker (1 byte), and
   * undefined-valued object entries are dropped, matching `JSON.stringify`.
   */
  value(v: unknown): void {
    if (v === undefined) {
      this.u8(T_UNDEF);
      return;
    }
    if (v === null) {
      this.u8(T_NULL);
      return;
    }
    const t = typeof v;
    if (t === "boolean") {
      this.u8(v ? T_TRUE : T_FALSE);
      return;
    }
    if (t === "number") {
      const n = v as number;
      if (Number.isInteger(n) && n >= INT_MIN && n <= INT_MAX) {
        this.u8(T_INT);
        this.varint(zigzag(n));
      } else {
        this.u8(T_FLOAT);
        this.f64(n);
      }
      return;
    }
    if (t === "string") {
      const b = TE.encode(v as string);
      this.u8(T_STR);
      this.varint(b.length);
      this.bytes(b);
      return;
    }
    if (Array.isArray(v)) {
      this.u8(T_ARR);
      this.varint(v.length);
      for (const x of v) this.value(x);
      return;
    }
    if (t === "object") {
      const obj = v as Record<string, unknown>;
      const keys = Object.keys(obj).filter((k) => obj[k] !== undefined);
      this.u8(T_OBJ);
      this.varint(keys.length);
      for (const k of keys) {
        const kb = TE.encode(k);
        this.varint(kb.length);
        this.bytes(kb);
        this.value(obj[k]);
      }
      return;
    }
    // functions / symbols / bigint aren't JSON-serializable → treat as absent.
    this.u8(T_UNDEF);
  }

  /** A copy of the bytes written so far. */
  finish(): ArrayBuffer {
    return this._buf.slice(0, this._len);
  }
}

// ---- Little-endian buffer reader ----

/** Sequential reader over an `ArrayBuffer`. Mirrors {@link BinaryWriter}. */
export class BinaryReader {
  private readonly _view: DataView;
  private readonly _u8: Uint8Array;
  private _off = 0;

  constructor(data: ArrayBuffer) {
    this._view = new DataView(data);
    this._u8 = new Uint8Array(data);
  }

  u8(): number {
    const v = this._view.getUint8(this._off);
    this._off += 1;
    return v;
  }
  u16(): number {
    const v = this._view.getUint16(this._off, true);
    this._off += 2;
    return v;
  }
  u32(): number {
    const v = this._view.getUint32(this._off, true);
    this._off += 4;
    return v;
  }
  f32(): number {
    const v = this._view.getFloat32(this._off, true);
    this._off += 4;
    return v;
  }
  f64(): number {
    const v = this._view.getFloat64(this._off, true);
    this._off += 8;
    return v;
  }
  str8(): string {
    const n = this.u8();
    const s = TD.decode(this._u8.subarray(this._off, this._off + n));
    this._off += n;
    return s;
  }
  varint(): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = this.u8();
      result += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);
    return result;
  }

  /** Read a self-describing value written by {@link BinaryWriter.value}. */
  value(): unknown {
    const t = this.u8();
    switch (t) {
      case T_UNDEF:
        return undefined;
      case T_NULL:
        return null;
      case T_FALSE:
        return false;
      case T_TRUE:
        return true;
      case T_INT:
        return unzigzag(this.varint());
      case T_FLOAT:
        return this.f64();
      case T_STR: {
        const n = this.varint();
        const s = TD.decode(this._u8.subarray(this._off, this._off + n));
        this._off += n;
        return s;
      }
      case T_ARR: {
        const n = this.varint();
        const arr = new Array(n);
        for (let i = 0; i < n; i++) arr[i] = this.value();
        return arr;
      }
      case T_OBJ: {
        const n = this.varint();
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < n; i++) {
          const kn = this.varint();
          const key = TD.decode(this._u8.subarray(this._off, this._off + kn));
          this._off += kn;
          obj[key] = this.value();
        }
        return obj;
      }
      default:
        throw new RangeError(`bad value tag ${t}`);
    }
  }
}

// ---- Binary codec ----

function encodeBinary(msg: ClientMessage | ServerMessage): ArrayBuffer {
  const w = new BinaryWriter();
  switch (msg.k) {
    case "input":
      w.u8(KIND_INPUT);
      w.u32(msg.seq);
      w.value(msg.input);
      break;
    case "welcome":
      w.u8(KIND_WELCOME);
      w.u16(msg.tickRate);
      w.u32(msg.you);
      w.f64(msg.serverTime);
      w.f32(msg.world.width);
      w.f32(msg.world.height);
      break;
    case "snap":
      w.u8(KIND_SNAP);
      w.u32(msg.tick);
      w.f64(msg.t);
      w.u32(msg.lastSeq);
      w.u16(msg.ents.length);
      for (const e of msg.ents) {
        w.u32(e.id);
        w.str8(e.t);
        w.f32(e.x);
        w.f32(e.y);
        w.f32(e.r);
        w.value(e.s); // absent → 1-byte undefined tag
      }
      w.value(msg.state); // absent → 1-byte undefined tag
      break;
  }
  return w.finish();
}

function decodeBinaryServer(data: string | ArrayBuffer): ServerMessage {
  if (typeof data === "string") {
    throw new TypeError("binaryCodec received a text frame");
  }
  const r = new BinaryReader(data);
  const kind = r.u8();
  if (kind === KIND_WELCOME) {
    return {
      k: "welcome",
      tickRate: r.u16(),
      you: r.u32(),
      serverTime: r.f64(),
      world: { width: r.f32(), height: r.f32() },
    };
  }
  if (kind === KIND_SNAP) {
    const tick = r.u32();
    const t = r.f64();
    const lastSeq = r.u32();
    const count = r.u16();
    const ents: SnapshotEntity[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const id = r.u32();
      const tag = r.str8();
      const x = r.f32();
      const y = r.f32();
      const rot = r.f32();
      const s = r.value();
      const ent: SnapshotEntity = { id, t: tag, x, y, r: rot };
      if (s !== undefined) ent.s = s;
      ents[i] = ent;
    }
    const state = r.value();
    const msg: SnapshotMessage = { k: "snap", tick, t, lastSeq, ents };
    if (state !== undefined) msg.state = state;
    return msg;
  }
  throw new RangeError(`unknown server message kind ${kind}`);
}

function decodeBinaryClient(data: string | ArrayBuffer): ClientMessage {
  if (typeof data === "string") {
    throw new TypeError("binaryCodec received a text frame");
  }
  const r = new BinaryReader(data);
  const kind = r.u8();
  if (kind === KIND_INPUT) {
    return { k: "input", seq: r.u32(), input: r.value() };
  }
  throw new RangeError(`unknown client message kind ${kind}`);
}

/** Compact binary frames (the default wire format). */
export const binaryCodec: Codec = {
  encode: encodeBinary,
  decodeServer: decodeBinaryServer,
  decodeClient: decodeBinaryClient,
};

// ---- JSON codec ----

function asText(data: string | ArrayBuffer): string {
  return typeof data === "string" ? data : TD.decode(data);
}

/** Human-readable JSON strings. Selectable for debugging. */
export const jsonCodec: Codec = {
  encode: (msg) => JSON.stringify(msg),
  decodeServer: (data) => JSON.parse(asText(data)) as ServerMessage,
  decodeClient: (data) => JSON.parse(asText(data)) as ClientMessage,
};

/** The codec used when none is specified. */
export const defaultCodec: Codec = binaryCodec;
