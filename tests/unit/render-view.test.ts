import { describe, expect, test } from "vitest";
import { Entity, Scene, Sprite } from "../../packages/gamekit/src/index.js";
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
import { Mat3 } from "../../packages/gamekit/src/math/Mat3.js";
import { Texture } from "../../packages/gamekit/src/render/Texture.js";
import type { TextureEntry } from "../../packages/gamekit/src/render/WebGPURenderer.js";

/**
 * These tests cover only what's specific to RenderView as a DrawSink adapter:
 * translating a walker pass into `beginFrame`/`endFrame` with the right
 * projection, and translating `emit()` into `batcher.add()` so the batcher's
 * run-splitting behavior is exercised end-to-end. Traversal, culling, and
 * entity-kind dispatch are tested once, backend-agnostically, in
 * scene-walker.test.ts.
 */

function entry(w = 1, h = 1, fw = 0, fh = 0): TextureEntry {
  return { meta: new Texture(w, h, fw, fh), gpu: {} as never, bindGroup: {} as never };
}

function loaderWith(names: Record<string, TextureEntry>): AssetLoader {
  const factory: TextureFactory = {
    createSolidTexture: () => entry(),
    createTextureFromImage: () => entry(64, 64),
  };
  const loader = new AssetLoader(factory);
  for (const [name, e] of Object.entries(names)) loader.register(name, e);
  return loader;
}

/** A fake renderer capturing frame boundaries + the packed instance buffer. */
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
  const projections: Array<{ vp: Mat3; clear: boolean }> = [];
  let ended = 0;
  return {
    renderer: {
      batcher: new SpriteBatcher<TextureEntry>(sink),
      beginFrame: (vp: Mat3, clear = true) => projections.push({ vp, clear }),
      endFrame: () => ended++,
    },
    draws,
    projections,
    get instanceData() {
      return data;
    },
    get ended() {
      return ended;
    },
  };
}

function instX(data: Float32Array, i: number): number {
  return data[i * INSTANCE_FLOATS]; // pos.x is field 0
}

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

describe("RenderView as a DrawSink", () => {
  test("opens and closes exactly one frame for a scene with no hud", () => {
    const f = fakeRenderer();
    const view = new RenderView(f.renderer, loaderWith({}));
    const scene = new Scene();
    scene.add(boxEntity(0, 0));
    view.draw(scene, 0);
    expect(f.projections.length).toBe(1);
    expect(f.ended).toBe(1);
  });

  test("world pass projects with the camera's viewProjection; hud pass uses an ortho projection", () => {
    const f = fakeRenderer();
    const view = new RenderView(f.renderer, loaderWith({}));
    const scene = new Scene();
    scene.camera.resize(200, 100).centerOn(0, 0);
    scene.add(boxEntity(0, 0));
    scene.addHud(boxEntity(5, 5));

    view.draw(scene, 0);

    expect(f.projections.length).toBe(2);
    expect(Array.from(f.projections[0].vp.values)).toEqual(
      Array.from(scene.camera.viewProjection(0).values),
    );
    expect(f.projections[0].clear).toBe(true);
    expect(Array.from(f.projections[1].vp.values)).toEqual(
      Array.from(Mat3.ortho(200, 100).values),
    );
    expect(f.projections[1].clear).toBe(false);
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
    expect([0, 1, 2, 3].map((i) => instX(f.instanceData, i))).toEqual([0, 1, 2, 3]);
  });
});
