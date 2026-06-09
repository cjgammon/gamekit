import { describe, expect, test } from "bun:test";
import {
  INSTANCE_FLOATS,
  SpriteBatcher,
  type InstanceSink,
  type SpriteInstance,
} from "../../packages/gamekit/src/render/SpriteBatcher.js";

/** Records sink calls so tests can assert uploads + draws without a GPU. */
function fakeSink() {
  const draws: Array<{ texture: string; first: number; count: number }> = [];
  let uploaded: Float32Array | null = null;
  let uploadedCount = 0;
  const sink: InstanceSink<string> = {
    writeInstances(data, count) {
      uploaded = data.slice(0, count * INSTANCE_FLOATS);
      uploadedCount = count;
    },
    draw(texture, first, count) {
      draws.push({ texture, first, count });
    },
  };
  return {
    sink,
    draws,
    get uploaded() {
      return uploaded;
    },
    get uploadedCount() {
      return uploadedCount;
    },
  };
}

function sprite(
  texture: string,
  over: Partial<SpriteInstance<string>> = {},
): SpriteInstance<string> {
  return {
    texture,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    originX: 0.5,
    originY: 0.5,
    rotation: 0,
    u: 0,
    v: 0,
    uScale: 1,
    vScale: 1,
    tint: 0xffffff,
    alpha: 1,
    ...over,
  };
}

describe("SpriteBatcher run batching", () => {
  test("consecutive same-texture sprites collapse into one draw", () => {
    const f = fakeSink();
    const b = new SpriteBatcher(f.sink);
    b.begin();
    b.add(sprite("a"));
    b.add(sprite("a"));
    b.add(sprite("a"));
    b.end();
    expect(f.draws).toEqual([{ texture: "a", first: 0, count: 3 }]);
    expect(f.uploadedCount).toBe(3);
  });

  test("a texture change splits runs but preserves order", () => {
    const f = fakeSink();
    const b = new SpriteBatcher(f.sink);
    b.begin();
    b.add(sprite("a"));
    b.add(sprite("b"));
    b.add(sprite("b"));
    b.add(sprite("a")); // back to 'a' — a NEW run, not merged with the first
    b.end();
    expect(f.draws).toEqual([
      { texture: "a", first: 0, count: 1 },
      { texture: "b", first: 1, count: 2 },
      { texture: "a", first: 3, count: 1 },
    ]);
  });

  test("an empty frame uploads and draws nothing", () => {
    const f = fakeSink();
    const b = new SpriteBatcher(f.sink);
    b.begin();
    b.end();
    expect(f.draws).toEqual([]);
    expect(f.uploaded).toBeNull();
  });

  test("begin() resets state between frames", () => {
    const f = fakeSink();
    const b = new SpriteBatcher(f.sink);
    b.begin();
    b.add(sprite("a"));
    b.end();
    b.begin();
    b.add(sprite("b"));
    b.end();
    expect(b.instanceCount).toBe(1);
    expect(f.draws.at(-1)).toEqual({ texture: "b", first: 0, count: 1 });
  });
});

describe("SpriteBatcher instance packing", () => {
  test("writes fields in layout order", () => {
    const f = fakeSink();
    const b = new SpriteBatcher(f.sink);
    b.begin();
    b.add(
      sprite("a", {
        x: 1,
        y: 2,
        width: 3,
        height: 4,
        originX: 0.25,
        originY: 0.75,
        rotation: 1.5,
        // Exact binary fractions so the f32 round-trip is lossless.
        u: 0.25,
        v: 0.5,
        uScale: 0.75,
        vScale: 0.125,
        tint: 0xffffff,
        alpha: 1,
      }),
    );
    b.end();
    const d = f.uploaded!;
    expect(Array.from(d.subarray(0, 11))).toEqual([
      1, 2, 3, 4, 0.25, 0.75, 1.5, 0.25, 0.5, 0.75, 0.125,
    ]);
  });

  test("color is premultiplied by alpha", () => {
    const f = fakeSink();
    const b = new SpriteBatcher(f.sink);
    b.begin();
    b.add(sprite("a", { tint: 0xff0000, alpha: 0.5 }));
    b.end();
    const d = f.uploaded!;
    const [r, g, bl, al] = d.subarray(11, 15);
    expect(r).toBeCloseTo(0.5, 6); // 1.0 * 0.5
    expect(g).toBe(0);
    expect(bl).toBe(0);
    expect(al).toBe(0.5);
  });

  test("grows the backing buffer past the initial capacity", () => {
    const f = fakeSink();
    const b = new SpriteBatcher(f.sink, 2); // capacity 2 instances
    b.begin();
    for (let i = 0; i < 5; i++) b.add(sprite("a"));
    b.end();
    expect(b.instanceCount).toBe(5);
    expect(b.data.length).toBeGreaterThanOrEqual(5 * INSTANCE_FLOATS);
    expect(f.uploadedCount).toBe(5);
  });
});
