import { createHash } from "node:crypto";

/** The fixed GUID appended to the client key per RFC 6455 §1.3. */
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/**
 * Compute the `Sec-WebSocket-Accept` value:
 * `base64(sha1(Sec-WebSocket-Key + WS_GUID))`.
 */
export function computeAcceptKey(secWebSocketKey: string): string {
  return createHash("sha1")
    .update(secWebSocketKey + WS_GUID)
    .digest("base64");
}

/** Build the raw HTTP/1.1 101 upgrade response (ends with a blank CRLF line). */
export function buildHandshakeResponse(acceptKey: string): string {
  return [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "",
    "",
  ].join("\r\n");
}
