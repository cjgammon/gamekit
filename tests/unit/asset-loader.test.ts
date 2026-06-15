import { describe, expect, test } from "vitest";
import {
  AssetLoader,
  WHITE_TEXTURE,
  type TextureFactory,
} from "../../packages/gamekit/src/render/AssetLoader.js";
import { Texture } from "../../packages/gamekit/src/render/Texture.js";
import type { TextureEntry } from "../../packages/gamekit/src/render/WebGPURenderer.js";

/** Builds a fake TextureEntry — gpu/bindGroup are unused by the registry. */
function fakeEntry(w = 1, h = 1, fw = 0, fh = 0): TextureEntry {
  return {
    meta: new Texture(w, h, fw, fh),
    gpu: {} as never,
    bindGroup: {} as never,
  };
}

/** A factory that records calls and hands back fakes — no GPU. */
function fakeFactory() {
  let solidCalls = 0;
  const factory: TextureFactory = {
    createSolidTexture() {
      solidCalls++;
      return fakeEntry();
    },
    createTextureFromImage(_image, fw, fh) {
      return fakeEntry(64, 64, fw, fh);
    },
  };
  return {
    factory,
    get solidCalls() {
      return solidCalls;
    },
  };
}

describe("AssetLoader registry", () => {
  test("creates and registers the white texture on construction", () => {
    const f = fakeFactory();
    const loader = new AssetLoader(f.factory);
    expect(f.solidCalls).toBe(1);
    expect(loader.has(WHITE_TEXTURE)).toBe(true);
    expect(loader.get(WHITE_TEXTURE)).toBe(loader.white);
  });

  test("register + get round-trip", () => {
    const loader = new AssetLoader(fakeFactory().factory);
    const entry = fakeEntry(32, 32);
    loader.register("player", entry);
    expect(loader.get("player")).toBe(entry);
    expect(loader.has("player")).toBe(true);
    expect(loader.has("missing")).toBe(false);
  });

  test("resolve falls back to white for missing or empty names", () => {
    const loader = new AssetLoader(fakeFactory().factory);
    const entry = fakeEntry();
    loader.register("ship", entry);
    expect(loader.resolve("ship")).toBe(entry);
    expect(loader.resolve("nope")).toBe(loader.white);
    expect(loader.resolve("")).toBe(loader.white);
  });
});
