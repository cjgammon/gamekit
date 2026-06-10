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
export declare const EMPTY_INPUT: InputState;
export interface InputMessage {
    k: "input";
    /** Monotonic client input sequence. The server echoes the last seq it
     *  processed back as `snap.lastSeq`, which the client uses to discard acked
     *  inputs and replay the rest during prediction reconciliation. */
    seq: number;
    input: InputState;
}
export type ClientMessage = InputMessage;
export interface WelcomeMessage {
    k: "welcome";
    /** Server fixed tick rate (Hz). */
    tickRate: number;
    /** The NetId of this client's own player entity. */
    you: NetId;
    /** Server wall-clock ms at welcome — seeds the client interpolation clock. */
    serverTime: number;
    /** World bounds — the client clamps prediction identically to the server. */
    world: {
        width: number;
        height: number;
    };
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
    /** Last input seq processed for this client. Drives prediction
     *  reconciliation — the client replays inputs newer than this. */
    lastSeq: number;
    ents: SnapshotEntity[];
    /** Optional authoritative game state (score, round, etc.) the server wants
     *  every client to see. Transforms travel in `ents`; this is for everything
     *  else. Omitted when the server never sets it. */
    state?: unknown;
}
export type ServerMessage = WelcomeMessage | SnapshotMessage;
export declare function encode(msg: ClientMessage | ServerMessage): string;
export declare function decodeClientMessage(data: string): ClientMessage;
export declare function decodeServerMessage(data: string): ServerMessage;
