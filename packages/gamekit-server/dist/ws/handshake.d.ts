/**
 * Compute the `Sec-WebSocket-Accept` value:
 * `base64(sha1(Sec-WebSocket-Key + WS_GUID))`.
 */
export declare function computeAcceptKey(secWebSocketKey: string): string;
/** Build the raw HTTP/1.1 101 upgrade response (ends with a blank CRLF line). */
export declare function buildHandshakeResponse(acceptKey: string): string;
