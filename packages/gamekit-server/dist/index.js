/**
 * gamekit-server — authoritative multiplayer server for gamekit.
 *
 * Runs the headless gamekit core loop at a fixed tick rate, serializes world
 * state each tick, and broadcasts snapshots to clients over a from-scratch
 * (RFC 6455) WebSocket transport. Zero runtime dependencies beyond the gamekit
 * core it shares with the client.
 */
export { ServerGame } from "./game/ServerGame.js";
export { PlayerEntity } from "./game/PlayerEntity.js";
export { NetServer } from "./net/NetServer.js";
export { ServerTransport } from "./net/ServerTransport.js";
export { WebSocketServer } from "./ws/WebSocketServer.js";
export { WebSocketConnection } from "./ws/WebSocketConnection.js";
export { Opcode, WebSocketProtocolError, encodeFrame, parseFrames, } from "./ws/frame.js";
export { computeAcceptKey, buildHandshakeResponse } from "./ws/handshake.js";
