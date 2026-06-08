import { describe, expect, test } from "bun:test";
import {
  Opcode,
  WebSocketProtocolError,
  encodeFrame,
  parseFrames,
} from "../../packages/gamekit-server/src/ws/frame.js";

/** Build a masked client→server frame the way a browser would. */
function maskedFrame(
  opcode: number,
  payload: Buffer,
  key = Buffer.from([0x01, 0x02, 0x03, 0x04]),
  fin = true,
): Buffer {
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([(fin ? 0x80 : 0) | opcode, 0x80 | len]);
  } else if (len <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = (fin ? 0x80 : 0) | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = (fin ? 0x80 : 0) | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  const masked = Buffer.allocUnsafe(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ key[i & 3];
  return Buffer.concat([header, key, masked]);
}

describe("encodeFrame / parseFrames round-trip across length tiers", () => {
  for (const len of [0, 5, 125, 126, 200, 65535, 65536, 70000]) {
    test(`text payload of ${len} bytes`, () => {
      const payload = Buffer.alloc(len, 0x61); // 'a'
      const encoded = encodeFrame(Opcode.TEXT, payload);
      const { frames, rest } = parseFrames(encoded);
      expect(rest.length).toBe(0);
      expect(frames).toHaveLength(1);
      expect(frames[0].opcode).toBe(Opcode.TEXT);
      expect(frames[0].fin).toBe(true);
      expect(frames[0].payload.equals(payload)).toBe(true);
    });
  }
});

describe("masking", () => {
  test("unmasks a client frame correctly (i & 3 key cycling)", () => {
    const payload = Buffer.from("hello world from a client", "utf8");
    const frame = maskedFrame(Opcode.TEXT, payload);
    const { frames } = parseFrames(frame);
    expect(frames[0].masked).toBe(true);
    expect(frames[0].payload.toString("utf8")).toBe(payload.toString("utf8"));
  });
});

describe("multiple frames in one buffer", () => {
  test("parses two concatenated frames", () => {
    const a = encodeFrame(Opcode.TEXT, Buffer.from("one"));
    const b = encodeFrame(Opcode.TEXT, Buffer.from("two"));
    const { frames, rest } = parseFrames(Buffer.concat([a, b]));
    expect(frames).toHaveLength(2);
    expect(frames[0].payload.toString()).toBe("one");
    expect(frames[1].payload.toString()).toBe("two");
    expect(rest.length).toBe(0);
  });
});

describe("partial reads", () => {
  test("returns the incomplete tail as rest, completes on next chunk", () => {
    const full = encodeFrame(Opcode.TEXT, Buffer.from("split me"));
    const cut = 4;
    const first = parseFrames(full.subarray(0, cut));
    expect(first.frames).toHaveLength(0);
    expect(first.rest.length).toBe(cut);

    const combined = Buffer.concat([first.rest, full.subarray(cut)]);
    const second = parseFrames(combined);
    expect(second.frames).toHaveLength(1);
    expect(second.frames[0].payload.toString()).toBe("split me");
    expect(second.rest.length).toBe(0);
  });

  test("header split across chunks (only 1 byte available)", () => {
    const full = encodeFrame(Opcode.TEXT, Buffer.from("x"));
    const first = parseFrames(full.subarray(0, 1));
    expect(first.frames).toHaveLength(0);
    expect(first.rest.length).toBe(1);
    const { frames } = parseFrames(Buffer.concat([first.rest, full.subarray(1)]));
    expect(frames[0].payload.toString()).toBe("x");
  });
});

describe("fragmentation", () => {
  test("reports fin=false on non-final data frames", () => {
    const f1 = maskedFrame(Opcode.TEXT, Buffer.from("Hel"), undefined, false);
    const f2 = maskedFrame(Opcode.CONTINUATION, Buffer.from("lo"), undefined, true);
    const { frames } = parseFrames(Buffer.concat([f1, f2]));
    expect(frames).toHaveLength(2);
    expect(frames[0].opcode).toBe(Opcode.TEXT);
    expect(frames[0].fin).toBe(false);
    expect(frames[1].opcode).toBe(Opcode.CONTINUATION);
    expect(frames[1].fin).toBe(true);
    expect(
      Buffer.concat([frames[0].payload, frames[1].payload]).toString(),
    ).toBe("Hello");
  });
});

describe("control frames", () => {
  test("ping/pong/close parse with their payloads", () => {
    const ping = maskedFrame(Opcode.PING, Buffer.from("hi"));
    const { frames } = parseFrames(ping);
    expect(frames[0].opcode).toBe(Opcode.PING);
    expect(frames[0].payload.toString()).toBe("hi");
  });

  test("rejects a control frame larger than 125 bytes", () => {
    const big = maskedFrame(Opcode.PING, Buffer.alloc(126, 1));
    expect(() => parseFrames(big)).toThrow(WebSocketProtocolError);
  });

  test("rejects a fragmented control frame (fin=false)", () => {
    const bad = maskedFrame(Opcode.PING, Buffer.from("x"), undefined, false);
    expect(() => parseFrames(bad)).toThrow(WebSocketProtocolError);
  });

  test("rejects an unsupported opcode", () => {
    const bad = maskedFrame(0x3, Buffer.from("x"));
    expect(() => parseFrames(bad)).toThrow(WebSocketProtocolError);
  });
});
