import { describe, expect, test } from "bun:test";
import { Entity, Group, Scene, Sprite } from "../../packages/gamekit/src/index.js";
import { RenderView } from "../../packages/gamekit/src/render/RenderView.js";
import {
  AssetLoader,
  type TextureFactory,
} from "../../packages/gamekit/src/render/AssetLoader.js";
import {
  INSTANCE_FLOATS,
  SpriteBatcher,
  type InstanceSink,
} from "../../packages/gamekit/src/render/SpriteBatcher.js";
import { Texture } from "../../packages/gamekit/src/render/Texture.js";
import type { TextureEntry } from "../../packages/gamekit/src/render/WebGPURenderer.js";

function entry(w = 1, h = 1, fw = 0, fh = 0): TextureEntry {
  return { meta: new Texture(w, h, fw, fh), gpu: {} as never, bindGroup: {} as never };
}

/** Loader whose named textures are fakes; resolve() still falls back to white. */
function loaderWith(names: Record<string, TextureEntry>): AssetLoader {
  const factory: TextureFactory = {
    createSolidTexture: () => entry(),
    createTextureFromImage: () => entry(64, 64),
  };
  const loader = new AssetLoader(factory);
  for (const [name, e] of Object.entries(names)) loader.register(name, e);
  return loader;
}

/** A fake renderer capturing draw calls + the packed instance buffer. */
function fakeRenderer() {
  const draws: Array<{ texture: TextureEntry; first: number; count: number }> = [];
  let data = new Float32Array(0);
  const sink: InstanceSink<TextureEntry> = {
    writeInstances(d, count) {
      data = d.slice(0, count * INSTANCE_FLOATS);
    },
    draw(texture, first, count) {
      draws.push({ texture, first, count });
    },
  };
  let began = 0;
  let ended = 0;
  return {
    renderer: {
      batcher: new SpriteBatcher<TextureEntry>(sink),
      beginFrame: () => began++,
      endFrame: () => ended++,
    },
    draws,
    get instanceData() {
      return data;
    },
    get began() {
      return began;
    },
    get ended() {
      return ended;
    },
  };
}

function instX(data: Float32Array, i: number): number {
  return data[i * INSTANCE_FLOATS]; // pos.x is field 0
}

describe("RenderView traversal", () => {
  test("opens and closes exactly one frame", () => {
    const f = fakeRenderer();
    const view = new RenderView(f.renderer, loaderWith({}));
    const scene = new Scene();
    scene.add(boxEntity(0, 0));
    view.draw(scene, 0);
    expect(f.began).toBe(1);
    expect(f.ended).toBe(1);
  });

  test("draws visible leaves in depth-first child order", () => {
    const f = fakeRenderer();
    const view = new RenderView(f.renderer, loaderWith({}));
    const scene = new Scene();
    scene.add(boxEntity(10, 0));
    const nested = new Group();
    nested.add(boxEntity(20, 0));
    nested.add(boxEntity(30, 0));
    scene.add(nested);
    scene.add(boxEntity(40, 0));

    view.draw(scene, 0);
    // 4 leaves, all white → one merged run, but order preserved in the buffer.
    expect(f.instanceData.length / INSTANCE_FLOATS).toBe(4);
    expect([0, 1, 2, 3].map((i) => instX(f.instanceData, i))).toEqual([
      10, 20, 30, 40,
    ]);
  });

  test("skips invisible and zero-size entities", () => {
    const f = fakeRenderer();
    const view = new RenderView(f.renderer, loaderWith({}));
    const scene = new Scene();
    const hidden = boxEntity(99, 0);
    hidden.visible = false;
    scene.add(hidden);
    scene.add(new Entity(5, 5)); // zero width/height → not rasterized
    scene.add(boxEntity(7, 0));

    view.draw(scene, 0);
    expect(f.instanceData.length / INSTANCE_FLOATS).toBe(1);
    expect(instX(f.instanceData, 0)).toBe(7);
  });

  test("batches by texture: sprite runs split, plain entities use white", () => {
    const ship = entry(32, 32);
    const f = fakeRenderer();
    const view = new RenderView(f.renderer, loaderWith({ ship }));
    const scene = new Scene();
    scene.add(boxEntity(0, 0)); // white
    scene.add(sprite("ship", 1, 0)); // ship
    scene.add(sprite("ship", 2, 0)); // ship (merges with previous)
    scene.add(boxEntity(3, 0)); // white again → new run

    view.draw(scene, 0);
    expect(f.draws.map((d) => [d.texture === ship ? "ship" : "white", d.count])).toEqual([
      ["white", 1],
      ["ship", 2],
      ["white", 1],
    ]);
  });

  test("interpolates sprite position by alpha", () => {
    const f = fakeRenderer();
    const view = new RenderView(f.renderer, loaderWith({}));
    const scene = new Scene();
    const e = boxEntity(0, 0);
    scene.add(e);
    e.syncPrev(); // prev = 0
    e.x = 100;

    view.draw(scene, 0.5);
    expect(instX(f.instanceData, 0)).toBe(50); // lerp(0, 100, 0.5)
  });
});

// ---- helpers ----

function boxEntity(x: number, y: number): Entity {
  const e = new Entity(x, y);
  e.width = 10;
  e.height = 10;
  return e;
}

function sprite(textureId: string, x: number, y: number): Sprite {
  const s = new Sprite(x, y);
  s.setTexture(textureId, 32, 32);
  return s;
}
