import { Vec2 } from "../math/Vec2.js";
import { Camera } from "../core/Camera.js";
import { Entity, type RenderTransform } from "../core/Entity.js";
import { Group } from "../core/Group.js";
import { Sprite } from "../core/Sprite.js";
import { Tilemap } from "../core/Tilemap.js";
import { Text } from "../core/Text.js";
import type { Scene } from "../core/Scene.js";
import type { AssetLoader } from "./AssetLoader.js";
import type { SpriteInstance } from "./SpriteBatcher.js";
import type { FrameUV } from "./Texture.js";
import { Texture } from "./Texture.js";

/** Which render pass a {@link DrawSink} is being driven for. `"world"` is
 *  camera-projected and frustum-culled; `"hud"` is screen-space and never
 *  culled (see {@link Scene.hud}). */
export type RenderPass = "world" | "hud";

/**
 * The per-backend leaf a {@link SceneWalker} drives. A sink derives its own
 * transform from `camera`/`alpha`/`pass` rather than receiving a precomputed
 * matrix, because "world" and "hud" mean different projection math per
 * backend — a GPU sink needs an NDC clip-space projection
 * (`camera.viewProjection`), a Canvas2D sink needs a plain screen-space affine
 * transform (`camera.view`), or identity for its HUD pass. The walker stays
 * ignorant of either convention.
 */
export interface DrawSink<T> {
  /** Open a pass. `clear` (true only for the first/world pass) clears the
   *  target; a later pass draws on top without clearing. */
  beginPass(camera: Camera, alpha: number, pass: RenderPass, clear: boolean): void;
  /** Consume one drawable — a resolved sprite frame, tilemap tile, text
   *  glyph, or plain-entity white quad, all reduced to the same shape. */
  emit(inst: SpriteInstance<T>): void;
  endPass(): void;
}

/** The sprite-sheet metadata a texture handle must expose so the walker can
 *  resolve frame → UV without knowing the rest of the backend's handle shape. */
export interface HasMeta {
  meta: Texture;
}

/** Entities already warned about (zero size) — warn once each, not per frame. */
const _zeroSizeWarned = new WeakSet<Entity>();

/**
 * Walks a {@link Scene}'s entity tree once per frame (world pass, then HUD
 * pass if non-empty) and turns every visible, non-zero-size leaf — a
 * `Sprite`, `Tilemap` tile, `Text` glyph, or plain `Entity` — into a
 * {@link SpriteInstance}, applying frustum culling and the zero-size warning
 * uniformly. Backend-agnostic: it never touches the DOM, a GPU, or a canvas
 * context — it only computes drawables and hands them to a {@link DrawSink}.
 *
 * Draw order is depth-first child order (Flixel z-model). Scene-agnostic —
 * pass whichever scene is active. All scratch objects are reused, so a walk
 * allocates nothing.
 */
export class SceneWalker<T extends HasMeta> {
  /** Warn (once per entity) when a visible entity has zero width or height,
   *  so the classic "I added it but nothing shows" is self-explaining. Set
   *  false to silence (e.g. if you intentionally keep sized-later
   *  placeholders visible). */
  static warnOnZeroSize = true;

  /** Skip entities whose (generously-padded) box falls outside the camera
   *  view — a large world then costs only what's on screen. Disabled
   *  automatically when the camera has no viewport (e.g. headless tests). Set
   *  false to draw all. */
  static cullSprites = true;

  private readonly _loader: AssetLoader<T>;

  // Reused per drawable (a sink's emit() must copy what it needs immediately).
  private readonly _t: RenderTransform = {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
  private readonly _uv: FrameUV = { u: 0, v: 0, uScale: 0, vScale: 0 };
  private readonly _inst: SpriteInstance<T>;

  // Visible world rect (for culling), recomputed each frame.
  private _viewMinX = 0;
  private _viewMinY = 0;
  private _viewMaxX = 0;
  private _viewMaxY = 0;
  // True when the camera has a real viewport, so the view rect is meaningful.
  private _viewValid = false;
  private readonly _corner = new Vec2();

  constructor(loader: AssetLoader<T>) {
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

  /** Walk `scene` for this frame, driving `sink`. `alpha` is `Game.render`'s
   *  0..1 interpolation factor. */
  walk(scene: Scene, alpha: number, sink: DrawSink<T>): void {
    const cam = scene.camera;

    // World pass — camera-projected; clears the target.
    this._computeViewRect(scene);
    sink.beginPass(cam, alpha, "world", true);
    this._drawGroup(scene.root, alpha, sink);
    sink.endPass();

    // HUD pass — screen-space, drawn on top; never frustum-culled.
    if (scene.hud.count > 0) {
      this._viewValid = false;
      sink.beginPass(cam, alpha, "hud", false);
      this._drawGroup(scene.hud, alpha, sink);
      sink.endPass();
    }
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
    // Only cull against a real viewport; a 0×0 camera (headless tests) collapses
    // the rect to a point and would wrongly cull everything.
    this._viewValid = w > 0 && h > 0;
  }

  private _drawGroup(group: Group, alpha: number, sink: DrawSink<T>): void {
    for (const child of group.children) {
      if (!child.visible || !child.alive) continue;
      if (child instanceof Group) this._drawGroup(child, alpha, sink);
      else this._drawEntity(child, alpha, sink);
    }
  }

  private _drawEntity(e: Entity, alpha: number, sink: DrawSink<T>): void {
    if (e instanceof Tilemap) {
      this._drawTilemap(e, sink);
      return;
    }
    if (e instanceof Text) {
      this._drawText(e, sink);
      return;
    }
    if (e.width === 0 || e.height === 0) {
      // Visible but unrasterizable — almost always a forgotten size. Warn once.
      if (SceneWalker.warnOnZeroSize && !_zeroSizeWarned.has(e)) {
        _zeroSizeWarned.add(e);
        const kind = e instanceof Sprite ? "Sprite" : "Entity";
        console.warn(
          `gamekit: a visible ${kind} has zero size (width=${e.width}, ` +
            `height=${e.height}), so it won't render. Set its width/height ` +
            `(or call setTexture with a frame size). Silence with ` +
            `SceneWalker.warnOnZeroSize = false.`,
        );
      }
      return; // nothing to rasterize
    }

    const t = e.sampleRender(alpha, this._t);
    const inst = this._inst;
    inst.x = t.x;
    inst.y = t.y;
    inst.width = e.width * t.scaleX;
    inst.height = e.height * t.scaleY;
    inst.rotation = t.rotation;

    // Frustum cull: skip if the entity is well outside the view. The radius is
    // generous (|w| + |h|) so it never clips a visible sprite regardless of the
    // origin pivot or rotation.
    if (SceneWalker.cullSprites && this._viewValid) {
      const r = Math.abs(inst.width) + Math.abs(inst.height);
      if (
        t.x + r < this._viewMinX ||
        t.x - r > this._viewMaxX ||
        t.y + r < this._viewMinY ||
        t.y - r > this._viewMaxY
      ) {
        return; // off-screen
      }
    }

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
    sink.emit(inst);
  }

  /** Emit one instance per non-empty tile in view, resolving tile→frame UVs. */
  private _drawTilemap(map: Tilemap, sink: DrawSink<T>): void {
    const entry = this._loader.resolve(map.tilesetId);
    const inst = this._inst;
    const uv = this._uv;
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
        sink.emit(inst);
      },
    );
  }

  /** Emit one instance per glyph of a Text, resolving glyph→frame UVs. */
  private _drawText(text: Text, sink: DrawSink<T>): void {
    const entry = this._loader.resolve(text.font.fontId);
    const inst = this._inst;
    const uv = this._uv;
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
      sink.emit(inst);
    });
  }
}
