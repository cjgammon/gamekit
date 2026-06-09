/**
 * Wire protocol shared by client and server. Pure data shapes only — no DOM,
 * no Node, no engine imports — so both the browser client and the headless
 * server can import it. JSON-encoded for this milestone; a binary `DataView`
 * codec can replace `encode`/`decode` later without touching the transports
 * ({@link Transport.send} already accepts `ArrayBufferLike`).
 */
export const EMPTY_INPUT = {
    up: false,
    down: false,
    left: false,
    right: false,
};
// ---- (De)serialization ----
export function encode(msg) {
    return JSON.stringify(msg);
}
export function decodeClientMessage(data) {
    return JSON.parse(data);
}
export function decodeServerMessage(data) {
    return JSON.parse(data);
}
