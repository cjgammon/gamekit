import { describe, expect, test } from "vitest";
import {
  binaryCodec,
  jsonCodec,
  BinaryWriter,
  BinaryReader,
  type ClientMessage,
  type ServerMessage,
} from "../../packages/gamekit/src/index.js";

// Floats are stored as f32 on the wire, so the test transforms use values that
// are exactly representable in 32 bits (so strict deep-equality holds).
const welcome: ServerMessage = {
  k: "welcome",
  tickRate: 60,
  you: 7,
  serverTime: 1719000000123,
  world: { width: 480, height: 320 },
};
const snap: ServerMessage = {
  k: "snap",
  tick: 1234,
  t: 1719000000456,
  lastSeq: 42,
  ents: [
    { id: 1, t: "player", x: 128.5, y: 64.25, r: 0.5 },
    { id: 2, t: "ball", x: 240, y: 160, r: 0, s: { hp: 3 } },
  ],
  state: { scores: [2, 5] },
};
const input: ClientMessage = { k: "input", seq: 99, input: { up: true, down: false } };

for (const [name, codec] of [
  ["binary", binaryCodec],
  ["json", jsonCodec],
] as const) {
  describe(`${name} codec round-trip`, () => {
    test("welcome", () => {
      expect(codec.decodeServer(codec.encode(welcome))).toEqual(welcome);
    });

    test("snapshot with per-entity + global state", () => {
      expect(codec.decodeServer(codec.encode(snap))).toEqual(snap);
    });

    test("input message", () => {
      expect(codec.decodeClient(codec.encode(input))).toEqual(input);
    });

    test("snapshot without optional payloads", () => {
      const bare: ServerMessage = {
        k: "snap",
        tick: 0,
        t: 0,
        lastSeq: 0,
        ents: [{ id: 5, t: "x", x: 0, y: 0, r: 0 }],
      };
      expect(codec.decodeServer(codec.encode(bare))).toEqual(bare);
    });

    test("undefined input round-trips", () => {
      const m: ClientMessage = { k: "input", seq: 1, input: undefined };
      expect(codec.decodeClient(codec.encode(m))).toEqual(m);
    });
  });
}

describe("binary codec is more compact than JSON", () => {
  test("a transform-heavy snapshot is smaller", () => {
    const ents = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      t: "player",
      x: i * 4,
      y: i * 2,
      r: 0,
    }));
    const big: ServerMessage = { k: "snap", tick: 1, t: 1, lastSeq: 0, ents };
    const bin = binaryCodec.encode(big) as ArrayBuffer;
    const jsonBytes = new TextEncoder().encode(jsonCodec.encode(big) as string).length;
    expect(bin.byteLength).toBeLessThan(jsonBytes);
  });
});

describe("BinaryWriter / BinaryReader primitives", () => {
  test("round-trips fixed-width fields in order", () => {
    const w = new BinaryWriter();
    w.u8(255);
    w.u16(65535);
    w.u32(4000000000);
    w.f32(0.5);
    w.f64(Math.PI);
    w.str8("hi");

    const r = new BinaryReader(w.finish());
    expect(r.u8()).toBe(255);
    expect(r.u16()).toBe(65535);
    expect(r.u32()).toBe(4000000000);
    expect(r.f32()).toBeCloseTo(0.5);
    expect(r.f64()).toBe(Math.PI);
    expect(r.str8()).toBe("hi");
  });

  test("value() round-trips any JSON-compatible value as self-describing binary", () => {
    const samples: unknown[] = [
      undefined,
      null,
      true,
      false,
      0,
      1,
      -1,
      127,
      128,
      -2147483648,
      2147483647,
      3.5,
      -0.25,
      1e15, // integer beyond int32 → f64
      "",
      "héllo",
      [1, "two", false, null],
      { a: 1, b: [2, 3], c: { d: true } },
    ];
    const w = new BinaryWriter();
    for (const s of samples) w.value(s);
    w.value({ skip: undefined, keep: 5 }); // undefined-valued keys dropped (like JSON)

    const r = new BinaryReader(w.finish());
    for (const s of samples) expect(r.value()).toEqual(s);
    expect(r.value()).toEqual({ keep: 5 });
  });

  test("varint round-trips small and large values", () => {
    const w = new BinaryWriter();
    const nums = [0, 1, 127, 128, 16384, 1 << 20, 4000000000];
    for (const n of nums) w.varint(n);
    const r = new BinaryReader(w.finish());
    for (const n of nums) expect(r.varint()).toBe(n);
  });

  test("grows past the initial capacity", () => {
    const w = new BinaryWriter(4);
    for (let i = 0; i < 1000; i++) w.u32(i);
    const r = new BinaryReader(w.finish());
    for (let i = 0; i < 1000; i++) expect(r.u32()).toBe(i);
  });
});
