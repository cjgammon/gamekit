/**
 * Wire protocol shared by client and server. Pure data shapes only — no DOM,
 * no Node, no engine imports — so both the browser client and the headless
 * server can import it. JSON-encoded for this milestone; a binary `DataView`
 * codec can replace `encode`/`decode` later without touching the transports
 * ({@link Transport.send} already accepts `ArrayBufferLike`).
 */

/** Stable network identity for a synced entity. Monotonic on the server. */
export type NetId = number;

/** The buttons a client reports each frame. */
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export const EMPTY_INPUT: InputState = {
  up: false,
  down: false,
  left: false,
  right: false,
};

// ---- Client → Server ----

export interface InputMessage {
  k: "input";
  /** Monotonic client input sequence. Unused in milestone 2a; the server echoes
   *  it back as `lastSeq` — the reconciliation seam for 2b (prediction). */
  seq: number;
  input: InputState;
}

export type ClientMessage = InputMessage;

// ---- Server → Client ----

export interface WelcomeMessage {
  k: "welcome";
  /** Server fixed tick rate (Hz). */
  tickRate: number;
  /** The NetId of this client's own player entity. */
  you: NetId;
  /** Server wall-clock ms at welcome — seeds the client interpolation clock. */
  serverTime: number;
  /** World bounds — the client clamps prediction identically to the server. */
  world: { width: number; height: number };
}

/** One entity's transform in a snapshot. Only interpolated fields travel. */
export interface SnapshotEntity {
  id: NetId;
  /** Type tag for client-side factory reconstruction. */
  t: string;
  x: number;
  y: number;
  /** Rotation in radians. */
  r: number;
}

export interface SnapshotMessage {
  k: "snap";
  /** Server tick counter. */
  tick: number;
  /** Server wall-clock ms at tick end — the interpolation timeline. */
  t: number;
  /** Echoed so the client can flag its own entity. */
  you: NetId;
  /** Last input seq processed for this client (seam for 2b). */
  lastSeq: number;
  ents: SnapshotEntity[];
}

export type ServerMessage = WelcomeMessage | SnapshotMessage;

// ---- (De)serialization ----

export function encode(msg: ClientMessage | ServerMessage): string {
  return JSON.stringify(msg);
}

export function decodeClientMessage(data: string): ClientMessage {
  return JSON.parse(data) as ClientMessage;
}

export function decodeServerMessage(data: string): ServerMessage {
  return JSON.parse(data) as ServerMessage;
}
