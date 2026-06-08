import type { Mat3 } from "../math/Mat3.js";
import { Vec2 } from "../math/Vec2.js";
import { Entity, type RenderTransform } from "../core/Entity.js";
import { Group } from "../core/Group.js";
import { Sprite } from "../core/Sprite.js";
import { Tilemap } from "../core/Tilemap.js";
import { Text } from "../core/Text.js";
import type { Scene } from "../core/Scene.js";
import type { AssetLoader } from "./AssetLoader.js";
import type { SpriteBatcher, SpriteInstance } from "./SpriteBatcher.js";
import type { FrameUV } from "./Texture.js";
import type { TextureEntry } from "./WebGPURenderer.js";

/** The slice of {@link WebGPURenderer} a view drives — fakeable in tests. */
export interface SpriteRenderer {
  readonly batcher: SpriteBatcher<TextureEntry>;
  beginFrame(viewProjection: Mat3): void;
  endFrame(): void;
}

/**
 * Bridges a {@link Scene} to the renderer each frame: walks the scene's entity
 * tree in draw order, computes each drawable's interpolated transform + frame
 * UVs, and feeds the batcher.
 *
 * Draw order is depth-first child order (Flixel z-model). A drawable is any
 * visible, non-zero-size leaf: `Sprite`s resolve `textureId`/`frame`/flips/tint;
 * plain `Entity`s draw as solid white quads (so boxes/blocks need no image).
 *
 * Scene-agnostic — pass whichever scene is active. All scratch objects are
 * reused, so a frame allocates nothing.
 */
export class RenderView {
  private readonly _renderer: SpriteRenderer;
  private readonly _loader: AssetLoader;

  // Reused per drawable (batcher.add copies immediately).
  private readonly _t: RenderTransform = {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
  private readonly _uv: FrameUV = { u: 0, v: 0, uScale: 0, vScale: 0 };
  private readonly _inst: SpriteInstance<TextureEntry>;

  // Visible world rect (for tilemap culling), recomputed each frame.
  private _viewMinX = 0;
  private _viewMinY = 0;
  private _viewMaxX = 0;
  private _viewMaxY = 0;
  private readonly _corner = new Vec2();

  constructor(renderer: SpriteRenderer, loader: AssetLoader) {
    this._renderer = renderer;
    this._loader = loader;
    this._inst = {
      texture: loader.white,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      originX: 0,
      originY: 0,
      rotation: 0,
      u: 0,
      v: 0,
      uScale: 1,
      vScale: 1,
      tint: 0xffffff,
      alpha: 1,
    };
  }

  /** Draw `scene` for this frame. `alpha` is `Game.render`'s 0..1 factor. */
  draw(scene: Scene, alpha: number): void {
    this._computeViewRect(scene);
    this._renderer.beginFrame(scene.camera.viewProjection(alpha));
    this._renderer.batcher.begin();
    this._drawGroup(scene.root, alpha);
    this._renderer.batcher.end();
    this._renderer.endFrame();
  }

  // ---- Internal ----

  /** World-space AABB of the viewport (the 4 corners unprojected), for culling. */
  private _computeViewRect(scene: Scene): void {
    const cam = scene.camera;
    const w = cam.viewportWidth;
    const h = cam.viewportHeight;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const corners: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ];
    for (const [sx, sy] of corners) {
      const p = cam.screenToWorld(this._corner.set(sx, sy));
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    this._viewMinX = minX;
    this._viewMinY = minY;
    this._viewMaxX = maxX;
    this._viewMaxY = maxY;
  }

  private _drawGroup(group: Group, alpha: number): void {
    for (const child of group.children) {
      if (!child.visible || !child.alive) continue;
      if (child instanceof Group) this._drawGroup(child, alpha);
      else this._drawEntity(child, alpha);
    }
  }

  private _drawEntity(e: Entity, alpha: number): void {
    if (e instanceof Tilemap) {
      this._drawTilemap(e);
      return;
    }
    if (e instanceof Text) {
      this._drawText(e);
      return;
    }
    if (e.width === 0 || e.height === 0) return; // nothing to rasterize

    const t = e.sampleRender(alpha, this._t);
    const inst = this._inst;
    inst.x = t.x;
    inst.y = t.y;
    inst.width = e.width * t.scaleX;
    inst.height = e.height * t.scaleY;
    inst.rotation = t.rotation;

    if (e instanceof Sprite) {
      const entry = this._loader.resolve(e.textureId);
      entry.meta.frameUV(e.frame, e.flipX, e.flipY, this._uv);
      inst.texture = entry;
      inst.originX = e.originX;
      inst.originY = e.originY;
      inst.tint = e.tint;
      inst.alpha = e.alpha;
    } else {
      // Plain entity → solid white quad, top-left anchored.
      this._loader.white.meta.frameUV(0, false, false, this._uv);
      inst.texture = this._loader.white;
      inst.originX = 0;
      inst.originY = 0;
      inst.tint = 0xffffff;
      inst.alpha = 1;
    }

    inst.u = this._uv.u;
    inst.v = this._uv.v;
    inst.uScale = this._uv.uScale;
    inst.vScale = this._uv.vScale;
    this._renderer.batcher.add(inst);
  }

  /** Emit one instance per non-empty tile in view, resolving tile→frame UVs. */
  private _drawTilemap(map: Tilemap): void {
    const entry = this._loader.resolve(map.tilesetId);
    const inst = this._inst;
    const uv = this._uv;
    const batcher = this._renderer.batcher;
    inst.texture = entry;
    inst.width = map.tileWidth;
    inst.height = map.tileHeight;
    inst.originX = 0;
    inst.originY = 0;
    inst.rotation = 0;
    inst.tint = map.tint;
    inst.alpha = 1;

    map.forEachTileIn(
      this._viewMinX,
      this._viewMinY,
      this._viewMaxX,
      this._viewMaxY,
      (_col, _row, index, worldX, worldY) => {
        entry.meta.frameUV(index - 1, false, false, uv); // value N → frame N-1
        inst.x = worldX;
        inst.y = worldY;
        inst.u = uv.u;
        inst.v = uv.v;
        inst.uScale = uv.uScale;
        inst.vScale = uv.vScale;
        batcher.add(inst);
      },
    );
  }

  /** Emit one instance per glyph of a Text, resolving glyph→frame UVs. */
  private _drawText(text: Text): void {
    const entry = this._loader.resolve(text.font.fontId);
    const inst = this._inst;
    const uv = this._uv;
    const batcher = this._renderer.batcher;
    inst.texture = entry;
    inst.originX = 0;
    inst.originY = 0;
    inst.rotation = 0;
    inst.tint = text.tint;
    inst.alpha = text.alpha;

    text.forEachGlyph((frame, worldX, worldY, w, h) => {
      entry.meta.frameUV(frame, false, false, uv);
      inst.x = worldX;
      inst.y = worldY;
      inst.width = w;
      inst.height = h;
      inst.u = uv.u;
      inst.v = uv.v;
      inst.uScale = uv.uScale;
      inst.vScale = uv.vScale;
      batcher.add(inst);
    });
  }
}
