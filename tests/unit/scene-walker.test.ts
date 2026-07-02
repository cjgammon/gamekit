import { describe, expect, test } from "vitest";
import {
  BitmapFont,
  Entity,
  Group,
  Scene,
  Sprite,
  Text,
  Tilemap,
} from "../../packages/gamekit/src/index.js";
import { SceneWalker, type DrawSink, type RenderPass } from "../../packages/gamekit/src/render/SceneWalker.js";
import {
  AssetLoader,
  type TextureFactory,
} from "../../packages/gamekit/src/render/AssetLoader.js";
import type { SpriteInstance } from "../../packages/gamekit/src/render/SpriteBatcher.js";
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

/** A fake sink recording every pass boundary and emitted drawable — enough to
 *  test the walker's traversal, culling, and dispatch without a real backend. */
function fakeSink() {
  const emitted: SpriteInstance<TextureEntry>[] = [];
  const passes: Array<{ pass: RenderPass; clear: boolean }> = [];
  let ended = 0;
  const sink: DrawSink<TextureEntry> = {
    beginPass(_camera, _alpha, pass, clear) {
      passes.push({ pass, clear });
    },
    emit(inst) {
      emitted.push({ ...inst }); // copy immediately — the walker reuses `inst`
    },
    endPass() {
      ended++;
    },
  };
  return {
    sink,
    emitted,
    passes,
    get ended() {
      return ended;
    },
  };
}

describe("SceneWalker traversal", () => {
  test("opens and closes exactly one pass for a scene with no hud", () => {
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    scene.add(boxEntity(0, 0));
    walker.walk(scene, 0, f.sink);
    expect(f.passes).toEqual([{ pass: "world", clear: true }]);
    expect(f.ended).toBe(1);
  });

  test("draws visible leaves in depth-first child order", () => {
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    scene.add(boxEntity(10, 0));
    const nested = new Group();
    nested.add(boxEntity(20, 0));
    nested.add(boxEntity(30, 0));
    scene.add(nested);
    scene.add(boxEntity(40, 0));

    walker.walk(scene, 0, f.sink);
    expect(f.emitted.map((i) => i.x)).toEqual([10, 20, 30, 40]);
  });

  test("skips invisible and zero-size entities", () => {
    SceneWalker.warnOnZeroSize = false; // exercised separately below
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    const hidden = boxEntity(99, 0);
    hidden.visible = false;
    scene.add(hidden);
    scene.add(new Entity(5, 5)); // zero width/height → not rasterized
    scene.add(boxEntity(7, 0));

    walker.walk(scene, 0, f.sink);
    expect(f.emitted.map((i) => i.x)).toEqual([7]);
    SceneWalker.warnOnZeroSize = true;
  });

  test("warns once for a visible zero-size entity", () => {
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    scene.add(new Entity(5, 5)); // visible, zero size

    const original = console.warn;
    let warnings = 0;
    console.warn = () => {
      warnings++;
    };
    try {
      walker.walk(scene, 0, f.sink);
      walker.walk(scene, 0, f.sink); // second frame must not re-warn
    } finally {
      console.warn = original;
    }
    expect(warnings).toBe(1);
  });

  test("interpolates sprite position by alpha", () => {
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    const e = boxEntity(0, 0);
    scene.add(e);
    e.syncPrev(); // prev = 0
    e.x = 100;

    walker.walk(scene, 0.5, f.sink);
    expect(f.emitted[0].x).toBe(50); // lerp(0, 100, 0.5)
  });

  test("plain entities resolve to the white texture, sprites resolve their own", () => {
    const ship = entry(32, 32);
    const walker = new SceneWalker(loaderWith({ ship }));
    const f = fakeSink();
    const scene = new Scene();
    scene.add(boxEntity(0, 0));
    scene.add(sprite("ship", 1, 0));

    walker.walk(scene, 0, f.sink);
    expect(f.emitted[0].texture).not.toBe(ship); // white
    expect(f.emitted[1].texture).toBe(ship);
  });
});

describe("SceneWalker tilemap drawing", () => {
  // 4×3 grid of 16px tiles; 5 non-empty cells (one wall + a 4-wide floor).
  function floorMap(): Tilemap {
    // prettier-ignore
    const data = [
      0, 0, 0, 0,
      0, 0, 2, 0,
      1, 1, 1, 1,
    ];
    const m = new Tilemap(4, 3, 16, 16, data);
    m.tilesetId = "tiles";
    return m;
  }

  /** A scene whose camera frames the whole 64×48 map. */
  function fullViewScene(map: Tilemap): Scene {
    const scene = new Scene();
    scene.camera.resize(64, 48).centerOn(32, 24);
    scene.add(map);
    return scene;
  }

  test("emits one instance per non-empty visible tile, bound to the tileset", () => {
    const tiles = entry(64, 16, 16, 16); // 4-frame strip
    const walker = new SceneWalker(loaderWith({ tiles }));
    const f = fakeSink();
    walker.walk(fullViewScene(floorMap()), 0, f.sink);

    expect(f.emitted.length).toBe(5); // 5 non-empty tiles
    expect(f.emitted.every((i) => i.texture === tiles)).toBe(true);
  });

  test("culls tiles outside the camera view", () => {
    const tiles = entry(64, 16, 16, 16);
    const walker = new SceneWalker(loaderWith({ tiles }));
    const f = fakeSink();
    const scene = new Scene();
    // Viewport over the top-left 16×16 cell only — which is empty.
    scene.camera.resize(16, 16).centerOn(8, 8);
    scene.add(floorMap());
    walker.walk(scene, 0, f.sink);
    expect(f.emitted.length).toBe(0);
  });

  test("tile value N resolves to tileset frame N-1", () => {
    const tiles = entry(64, 16, 16, 16); // du = 16/64 = 0.25 per frame
    const walker = new SceneWalker(loaderWith({ tiles }));
    const f = fakeSink();
    // Single tile of value 3 at (0,0) → frame 2 → u = 2*0.25 = 0.5.
    const m = new Tilemap(1, 1, 16, 16, [3]);
    m.tilesetId = "tiles";
    const scene = new Scene();
    scene.camera.resize(16, 16).centerOn(8, 8);
    scene.add(m);
    walker.walk(scene, 0, f.sink);
    expect(f.emitted[0].u).toBeCloseTo(0.5, 6);
  });
});

describe("SceneWalker text drawing", () => {
  test("emits one instance per non-space glyph, bound to the font texture", () => {
    const fontTex = entry(256, 8, 8, 8); // 32-frame glyph strip
    const walker = new SceneWalker(loaderWith({ font: fontTex }));
    const f = fakeSink();
    const scene = new Scene();
    scene.camera.resize(256, 64).centerOn(0, 0);
    const font = new BitmapFont("font", { charWidth: 8, charHeight: 8 });
    scene.add(new Text(font, "HI YOU", 0, 0)); // 5 letters + 1 space

    walker.walk(scene, 0, f.sink);
    expect(f.emitted.length).toBe(5); // space skipped
    expect(f.emitted.every((i) => i.texture === fontTex)).toBe(true);
  });
});

describe("SceneWalker sprite culling", () => {
  test("skips entities outside the view, keeps those inside", () => {
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    scene.camera.resize(200, 200).centerOn(0, 0); // view ≈ [-100, 100]²
    scene.add(boxEntity(0, 0)); // in view
    scene.add(boxEntity(5000, 0)); // far off-screen → culled
    walker.walk(scene, 0, f.sink);
    expect(f.emitted.map((i) => i.x)).toEqual([0]);
  });

  test("draws everything when cullSprites is disabled", () => {
    SceneWalker.cullSprites = false;
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    scene.camera.resize(200, 200).centerOn(0, 0);
    scene.add(boxEntity(0, 0));
    scene.add(boxEntity(5000, 0));
    walker.walk(scene, 0, f.sink);
    expect(f.emitted.length).toBe(2);
    SceneWalker.cullSprites = true;
  });

  test("does not cull without a viewport (headless)", () => {
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene(); // 0×0 camera → culling inactive
    scene.add(boxEntity(5000, 0));
    walker.walk(scene, 0, f.sink);
    expect(f.emitted.length).toBe(1);
  });
});

describe("SceneWalker HUD overlay", () => {
  test("draws the screen-space hud in a second pass on top of the world", () => {
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    scene.camera.resize(200, 200).centerOn(0, 0);
    scene.add(boxEntity(0, 0)); // world
    scene.addHud(boxEntity(5, 5)); // screen-space overlay

    walker.walk(scene, 0, f.sink);

    expect(f.passes).toEqual([
      { pass: "world", clear: true },
      { pass: "hud", clear: false },
    ]);
    expect(f.ended).toBe(2);
    expect(f.emitted.map((i) => i.x)).toEqual([0, 5]);
  });

  test("no hud pass when the overlay is empty", () => {
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    scene.camera.resize(200, 200).centerOn(0, 0);
    scene.add(boxEntity(0, 0));

    walker.walk(scene, 0, f.sink);
    expect(f.passes.length).toBe(1);
  });

  test("hud entities are never frustum-culled", () => {
    const walker = new SceneWalker(loaderWith({}));
    const f = fakeSink();
    const scene = new Scene();
    scene.camera.resize(50, 50).centerOn(0, 0); // tiny world view
    scene.addHud(boxEntity(900, 900)); // way outside the world view, but it's a HUD

    walker.walk(scene, 0, f.sink);

    expect(f.passes.length).toBe(2); // empty world pass (clears) + hud pass
    expect(f.emitted.length).toBe(1); // hud box not culled
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
