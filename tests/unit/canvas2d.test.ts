import { describe, expect, test } from "bun:test";
import { Entity, Scene, Sprite } from "../../packages/gamekit/src/index.js";
import {
  Canvas2DRenderer,
  type Canvas2DTexture,
} from "../../packages/gamekit/src/render/Canvas2DRenderer.js";
import {
  AssetLoader,
  type TextureFactory,
} from "../../packages/gamekit/src/render/AssetLoader.js";
import { Texture } from "../../packages/gamekit/src/render/Texture.js";

type Op = [string, ...unknown[]];

/** A fake 2D context that records its operations (no DOM needed). */
function fakeCtx() {
  const ops: Op[] = [];
  const rec =
    (name: string) =>
    (...args: unknown[]) =>
      ops.push([name, ...args]);
  const ctx = {
    globalAlpha: 1,
    fillStyle: "",
    imageSmoothingEnabled: false,
    globalCompositeOperation: "source-over",
    setTransform: rec("setTransform"),
    fillRect: rec("fillRect"),
    drawImage: rec("drawImage"),
    save: rec("save"),
    restore: rec("restore"),
    translate: rec("translate"),
    rotate: rec("rotate"),
    scale: rec("scale"),
  };
  return { ctx, ops };
}

function fakeCanvas(ctx: unknown, width = 100, height = 100) {
  return { width, height, getContext: () => ctx } as unknown as HTMLCanvasElement;
}

/** A loader backed by fake textures (no document / canvas creation). */
function fakeLoader() {
  const factory: TextureFactory<Canvas2DTexture> = {
    createSolidTexture: () => ({ meta: new Texture(1, 1), source: {} as never }),
    createTextureFromImage: (_img, fw, fh) => ({
      meta: new Texture(64, 64, fw, fh),
      source: {} as never,
    }),
  };
  return new AssetLoader<Canvas2DTexture>(factory);
}

describe("Canvas2DRenderer scene walk", () => {
  test("clears, draws a plain box as fillRect, and a sprite as drawImage", () => {
    const { ctx, ops } = fakeCtx();
    const renderer = new Canvas2DRenderer(fakeCanvas(ctx));
    const loader = fakeLoader();
    const shipSource = {} as never;
    loader.register("ship", { meta: new Texture(64, 64, 32, 32), source: shipSource });

    const scene = new Scene();
    scene.camera.resize(100, 100).centerOn(50, 50);
    const box = new Entity(10, 10);
    box.width = 20;
    box.height = 20;
    scene.add(box);
    const sprite = new Sprite(40, 40);
    sprite.setTexture("ship", 32, 32);
    sprite.frame = 1; // second frame → source x = 32
    scene.add(sprite);

    renderer.draw(scene, 1, loader);

    // Background clear fills the whole canvas.
    expect(ops.some((o) => o[0] === "fillRect" && o[3] === 100 && o[4] === 100)).toBe(true);
    // The plain box draws as a 20×20 fillRect (at the translated origin).
    expect(ops.some((o) => o[0] === "fillRect" && o[3] === 20 && o[4] === 20)).toBe(true);
    // The sprite draws frame 1 → source rect (32, 0, 32, 32).
    const di = ops.find((o) => o[0] === "drawImage");
    expect(di).toBeDefined();
    expect(di![1]).toBe(shipSource); // source image
    expect(di![2]).toBe(32); // sx (frame 1, framesPerRow 2)
    expect(di![3]).toBe(0); // sy
    expect(di![4]).toBe(32); // sw
    expect(di![5]).toBe(32); // sh
  });

  test("draws the hud in a screen-space (identity) pass", () => {
    const { ctx, ops } = fakeCtx();
    const renderer = new Canvas2DRenderer(fakeCanvas(ctx));
    const loader = fakeLoader();

    const scene = new Scene();
    scene.camera.resize(100, 100).centerOn(50, 50);
    const hudBox = new Entity(5, 5);
    hudBox.width = 10;
    hudBox.height = 10;
    scene.addHud(hudBox);

    renderer.draw(scene, 1, loader);

    // Identity setTransform appears (clear + hud pass), and the hud box is drawn.
    const identity = ops.filter(
      (o) =>
        o[0] === "setTransform" &&
        o[1] === 1 && o[2] === 0 && o[3] === 0 && o[4] === 1 && o[5] === 0 && o[6] === 0,
    );
    expect(identity.length).toBeGreaterThanOrEqual(2);
    expect(ops.some((o) => o[0] === "fillRect" && o[3] === 10 && o[4] === 10)).toBe(true);
  });
});
