import { describe, expect, test } from "vitest";
import {
  Texture,
  type FrameUV,
} from "../../packages/gamekit/src/render/Texture.js";

function uv(): FrameUV {
  return { u: 0, v: 0, uScale: 0, vScale: 0 };
}

describe("Texture grid derivation", () => {
  test("no frame size → one frame spanning the whole texture", () => {
    const t = new Texture(64, 32);
    expect(t.frameWidth).toBe(64);
    expect(t.frameHeight).toBe(32);
    expect(t.framesPerRow).toBe(1);
    expect(t.rows).toBe(1);
    expect(t.frameCount).toBe(1);
    expect(t.frameUV(0, false, false, uv())).toEqual({
      u: 0,
      v: 0,
      uScale: 1,
      vScale: 1,
    });
  });

  test("horizontal strip: 4 frames across", () => {
    const t = new Texture(128, 32, 32, 32);
    expect(t.framesPerRow).toBe(4);
    expect(t.frameCount).toBe(4);
    expect(t.frameUV(0, false, false, uv())).toMatchObject({ u: 0, uScale: 0.25 });
    expect(t.frameUV(1, false, false, uv())).toMatchObject({ u: 0.25 });
    expect(t.frameUV(3, false, false, uv())).toMatchObject({ u: 0.75 });
  });

  test("grid: row-major frame indexing", () => {
    const t = new Texture(64, 64, 32, 32); // 2x2
    expect(t.frameCount).toBe(4);
    // frame 2 → col 0, row 1
    expect(t.frameUV(2, false, false, uv())).toMatchObject({
      u: 0,
      v: 0.5,
      uScale: 0.5,
      vScale: 0.5,
    });
    // frame 3 → col 1, row 1
    expect(t.frameUV(3, false, false, uv())).toMatchObject({ u: 0.5, v: 0.5 });
  });

  test("frame index wraps into range", () => {
    const t = new Texture(128, 32, 32, 32); // 4 frames
    expect(t.frameUV(4, false, false, uv())).toMatchObject({ u: 0 }); // == frame 0
    expect(t.frameUV(5, false, false, uv())).toMatchObject({ u: 0.25 }); // == frame 1
    expect(t.frameUV(-1, false, false, uv())).toMatchObject({ u: 0.75 }); // == frame 3
  });
});

describe("Texture flips", () => {
  test("flipX negates uScale and moves the offset to the right edge", () => {
    const t = new Texture(128, 32, 32, 32);
    const r = t.frameUV(1, true, false, uv());
    expect(r.u).toBeCloseTo(0.5, 6); // 0.25 + 0.25
    expect(r.uScale).toBeCloseTo(-0.25, 6);
    // sampling corner 0→1 walks 0.5 down to 0.25 (mirrored frame span)
    expect(r.u + 1 * r.uScale).toBeCloseTo(0.25, 6);
  });

  test("flipY negates vScale and moves the offset to the bottom edge", () => {
    const t = new Texture(64, 64, 32, 32);
    const r = t.frameUV(0, false, true, uv());
    expect(r.v).toBeCloseTo(0.5, 6);
    expect(r.vScale).toBeCloseTo(-0.5, 6);
  });

  test("frameUV reuses the provided out object", () => {
    const t = new Texture(32, 32);
    const target = uv();
    expect(t.frameUV(0, false, false, target)).toBe(target);
  });
});
