import type { Mat3 } from "../math/Mat3.js";
import { Vec2 } from "../math/Vec2.js";
import { Entity, type RenderTransform } from "../core/Entity.js";
import { Group } from "../core/Group.js";
import { Sprite } from "../core/Sprite.js";
import { Tilemap } from "../core/Tilemap.js";
import { Text } from "../core/Text.js";
import type { Scene } from "../core/Scene.js";
import { Texture } from "./Texture.js";
import type { AssetLoader, TextureFactory } from "./AssetLoader.js";

/**
 * A texture handle for the Canvas2D backend: the frame metadata plus a drawable
 * source (a `<canvas>` so it survives `ImageBitmap.close()` and can be tinted).
 */
export interface Canvas2DTexture {
  meta: Texture;
  source: CanvasImageSource;
  /** Lazily-filled cache of tinted copies, keyed by 0xRRGGBB. */
  tintCache?: Map<number, CanvasImageSource>;
}

export interface Canvas2DRendererOptions {
  /** `"nearest"` (default) keeps pixel art crisp; `"linear"` smooths. */
  filter?: "nearest" | "linear";
  /** Background clear color (any CSS color). Default black. */
  clearColor?: string;
}

function hexColor(tint: number): string {
  return `#${(tint & 0xffffff).toString(16).padStart(6, "0")}`;
}

/**
 * A from-scratch **Canvas2D** renderer — the fallback for browsers/devices
 * without WebGPU. It walks the scene like the WebGPU `RenderView` (world pass
 * under the camera transform, then a screen-space HUD pass) but draws each
 * sprite immediately with `drawImage` instead of instancing.
 *
 * Browser-only (`CanvasRenderingContext2D`); exported from `gamekit/renderer`.
 * Implements {@link TextureFactory} so an {@link AssetLoader} can load into it.
 *
 * Parity notes vs. WebGPU: alpha, rotation, origin, sprite-sheet frames, and
 * multiplicative tint (via a cached tinted copy) match. Flips assume a centered
 * origin (the `Sprite` default). Per-sprite `drawImage` is slower than the
 * instanced GPU path — fine for typical 2D scenes, not for tens of thousands.
 */
export class Canvas2DRenderer implements TextureFactory<Canvas2DTexture> {
  readonly ctx: CanvasRenderingContext2D;
  clearColor: string;

  private readonly _canvas: HTMLCanvasElement;
  private readonly _smoothing: boolean;
  private readonly _t: RenderTransform = {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
  // Visible world rect (for tilemap culling), recomputed each frame.
  private _viewMinX = 0;
  private _viewMinY = 0;
  private _viewMaxX = 0;
  private _viewMaxY = 0;
  private readonly _corner = new Vec2();

  constructor(canvas: HTMLCanvasElement, options: Canvas2DRendererOptions = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get a 2D canvas context.");
    this._canvas = canvas;
    this.ctx = ctx;
    this._smoothing = (options.filter ?? "nearest") === "linear";
    this.clearColor = options.clearColor ?? "#000";
  }

  /** Resize the drawing buffer. */
  resize(width: number, height: number): void {
    this._canvas.width = width;
    this._canvas.height = height;
  }

  // ---- Frame ----

  /** Draw `scene` for this frame. `alpha` is `Game.render`'s 0..1 factor. */
  draw(scene: Scene, alpha: number, loader: AssetLoader<Canvas2DTexture>): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = this._smoothing;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.clearColor;
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);

    const cam = scene.camera;
    this._computeViewRect(scene);

    // World pass — camera transform maps world → screen pixels.
    this._setMatrix(cam.view(alpha));
    this._drawGroup(scene.root, alpha, loader);

    // HUD pass — screen-space (identity transform), drawn on top.
    if (scene.hud.count > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      this._drawGroup(scene.hud, alpha, loader);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- TextureFactory (used by AssetLoader) ----

  createTextureFromImage(
    image: ImageBitmap,
    frameWidth = 0,
    frameHeight = 0,
  ): Canvas2DTexture {
    // Copy into a <canvas> so the source outlives the (closed) ImageBitmap and
    // can be a tint base.
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    c.getContext("2d")!.drawImage(image, 0, 0);
    return {
      meta: new Texture(image.width, image.height, frameWidth, frameHeight),
      source: c,
    };
  }

  createSolidTexture(
    rgba: Uint8Array = new Uint8Array([255, 255, 255, 255]),
    width = 1,
    height = 1,
  ): Canvas2DTexture {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const cx = c.getContext("2d")!;
    const img = cx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      img.data[i * 4] = rgba[0];
      img.data[i * 4 + 1] = rgba[1];
      img.data[i * 4 + 2] = rgba[2];
      img.data[i * 4 + 3] = rgba[3];
    }
    cx.putImageData(img, 0, 0);
    return { meta: new Texture(width, height), source: c };
  }

  // ---- Internal ----

  /** Set the 2D transform from a column-major {@link Mat3} (world → screen). */
  private _setMatrix(m: Mat3): void {
    const v = m.values;
    this.ctx.setTransform(v[0], v[1], v[3], v[4], v[6], v[7]);
  }

  private _computeViewRect(scene: Scene): void {
    const cam = scene.camera;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const corners: ReadonlyArray<readonly [number, number]> = [
      [0, 0],
      [cam.viewportWidth, 0],
      [0, cam.viewportHeight],
      [cam.viewportWidth, cam.viewportHeight],
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

  private _drawGroup(
    group: Group,
    alpha: number,
    loader: AssetLoader<Canvas2DTexture>,
  ): void {
    for (const child of group.children) {
      if (!child.visible || !child.alive) continue;
      if (child instanceof Group) this._drawGroup(child, alpha, loader);
      else this._drawEntity(child, alpha, loader);
    }
  }

  private _drawEntity(
    e: Entity,
    alpha: number,
    loader: AssetLoader<Canvas2DTexture>,
  ): void {
    if (e instanceof Tilemap) return this._drawTilemap(e, loader);
    if (e instanceof Text) return this._drawText(e, loader);
    if (e.width === 0 || e.height === 0) return;

    const t = e.sampleRender(alpha, this._t);
    const w = e.width * t.scaleX;
    const h = e.height * t.scaleY;
    const ctx = this.ctx;

    if (e instanceof Sprite) {
      const entry = loader.resolve(e.textureId);
      const meta = entry.meta;
      const frame =
        ((e.frame % meta.frameCount) + meta.frameCount) % meta.frameCount;
      const col = frame % meta.framesPerRow;
      const row = Math.floor(frame / meta.framesPerRow);
      const sx = col * meta.frameWidth;
      const sy = row * meta.frameHeight;
      const src =
        e.tint === 0xffffff ? entry.source : this._tinted(entry, e.tint);

      ctx.save();
      ctx.globalAlpha = e.alpha;
      ctx.translate(t.x + e.originX * w, t.y + e.originY * h);
      if (t.rotation) ctx.rotate(t.rotation);
      if (e.flipX || e.flipY) ctx.scale(e.flipX ? -1 : 1, e.flipY ? -1 : 1);
      ctx.drawImage(
        src,
        sx,
        sy,
        meta.frameWidth,
        meta.frameHeight,
        -e.originX * w,
        -e.originY * h,
        w,
        h,
      );
      ctx.restore();
    } else {
      // Plain entity → solid white box, top-left anchored.
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.translate(t.x, t.y);
      if (t.rotation) ctx.rotate(t.rotation);
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  private _drawTilemap(
    map: Tilemap,
    loader: AssetLoader<Canvas2DTexture>,
  ): void {
    const entry = loader.resolve(map.tilesetId);
    const meta = entry.meta;
    const src =
      map.tint === 0xffffff ? entry.source : this._tinted(entry, map.tint);
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    map.forEachTileIn(
      this._viewMinX,
      this._viewMinY,
      this._viewMaxX,
      this._viewMaxY,
      (_col, _row, index, worldX, worldY) => {
        const frame = index - 1; // value N → frame N-1
        const fc = frame % meta.framesPerRow;
        const fr = Math.floor(frame / meta.framesPerRow);
        ctx.drawImage(
          src,
          fc * meta.frameWidth,
          fr * meta.frameHeight,
          meta.frameWidth,
          meta.frameHeight,
          worldX,
          worldY,
          map.tileWidth,
          map.tileHeight,
        );
      },
    );
  }

  private _drawText(text: Text, loader: AssetLoader<Canvas2DTexture>): void {
    const entry = loader.resolve(text.font.fontId);
    const meta = entry.meta;
    const src =
      text.tint === 0xffffff ? entry.source : this._tinted(entry, text.tint);
    const ctx = this.ctx;
    ctx.globalAlpha = text.alpha;
    text.forEachGlyph((frame, worldX, worldY, w, h) => {
      const fc = frame % meta.framesPerRow;
      const fr = Math.floor(frame / meta.framesPerRow);
      ctx.drawImage(
        src,
        fc * meta.frameWidth,
        fr * meta.frameHeight,
        meta.frameWidth,
        meta.frameHeight,
        worldX,
        worldY,
        w,
        h,
      );
    });
    ctx.globalAlpha = 1;
  }

  /** A multiplicatively-tinted copy of a texture, cached per tint. */
  private _tinted(entry: Canvas2DTexture, tint: number): CanvasImageSource {
    let cache = entry.tintCache;
    if (!cache) {
      cache = new Map();
      entry.tintCache = cache;
    }
    const hit = cache.get(tint);
    if (hit) return hit;

    const meta = entry.meta;
    const c = document.createElement("canvas");
    c.width = meta.width;
    c.height = meta.height;
    const cx = c.getContext("2d")!;
    cx.drawImage(entry.source, 0, 0);
    cx.globalCompositeOperation = "multiply";
    cx.fillStyle = hexColor(tint);
    cx.fillRect(0, 0, meta.width, meta.height);
    cx.globalCompositeOperation = "destination-in"; // re-apply the alpha mask
    cx.drawImage(entry.source, 0, 0);
    cache.set(tint, c);
    return c;
  }
}
