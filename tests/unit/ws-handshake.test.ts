import { describe, expect, test } from "bun:test";
import {
  buildHandshakeResponse,
  computeAcceptKey,
} from "../../packages/gamekit-server/src/ws/handshake.js";

describe("WebSocket handshake", () => {
  test("computeAcceptKey matches the canonical RFC 6455 vector", () => {
    // RFC 6455 §1.3 example.
    expect(computeAcceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe(
      "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
    );
  });

  test("response is a well-formed 101 ending in a blank CRLF line", () => {
    const res = buildHandshakeResponse("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
    expect(res.startsWith("HTTP/1.1 101 Switching Protocols\r\n")).toBe(true);
    expect(res).toContain("Upgrade: websocket\r\n");
    expect(res).toContain("Connection: Upgrade\r\n");
    expect(res).toContain(
      "Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n",
    );
    expect(res.endsWith("\r\n\r\n")).toBe(true);
  });
});
