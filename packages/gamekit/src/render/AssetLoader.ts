import type { TextureEntry } from "./WebGPURenderer.js";

/** The texture-creation surface the loader needs — satisfied by
 *  {@link WebGPURenderer}, and fakeable for headless tests. */
export interface TextureFactory {
  createTextureFromImage(
    image: ImageBitmap,
    frameWidth?: number,
    frameHeight?: number,
  ): TextureEntry;
  createSolidTexture(
    rgba?: Uint8Array,
    width?: number,
    height?: number,
  ): TextureEntry;
}

/** One image to load, keyed by the name sprites reference via `textureId`. */
export interface AssetSpec {
  name: string;
  url: string;
  /** Sprite-sheet frame size; omit for a single-frame texture. */
  frameWidth?: number;
  frameHeight?: number;
}

/** Registry key of the built-in 1×1 white texture (untextured/solid quads). */
export const WHITE_TEXTURE = "__white__";

/**
 * Loads images into GPU textures and keeps a name → {@link TextureEntry}
 * registry the renderer resolves `Sprite.textureId` against. Always provides a
 * 1×1 white texture (under {@link WHITE_TEXTURE}) so solid-colored or
 * untextured entities can render with no image.
 *
 * Browser-only: {@link load} uses `fetch` + `createImageBitmap`. The registry
 * itself is pure, so it's unit-tested with a fake factory.
 */
export class AssetLoader {
  /** The built-in 1×1 white texture (premultiplied). */
  readonly white: TextureEntry;

  private readonly _factory: TextureFactory;
  private readonly _textures = new Map<string, TextureEntry>();

  constructor(factory: TextureFactory) {
    this._factory = factory;
    this.white = factory.createSolidTexture();
    this._textures.set(WHITE_TEXTURE, this.white);
  }

  /** Register a pre-built texture under a name (used by {@link load}). */
  register(name: string, entry: TextureEntry): void {
    this._textures.set(name, entry);
  }

  /** The texture registered under `name`, or undefined. */
  get(name: string): TextureEntry | undefined {
    return this._textures.get(name);
  }

  /** True if `name` has a texture registered. */
  has(name: string): boolean {
    return this._textures.has(name);
  }

  /** The texture for `name`, falling back to the white texture when missing or
   *  when `name` is empty — so the renderer always has something to bind. */
  resolve(name: string): TextureEntry {
    return (name && this._textures.get(name)) || this.white;
  }

  /** Fetch + decode an image, upload it, and register it under `name`. */
  async load(
    name: string,
    url: string,
    frameWidth = 0,
    frameHeight = 0,
  ): Promise<TextureEntry> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load asset "${name}": ${res.status}`);
    const bitmap = await createImageBitmap(await res.blob());
    const entry = this._factory.createTextureFromImage(
      bitmap,
      frameWidth,
      frameHeight,
    );
    bitmap.close();
    this.register(name, entry);
    return entry;
  }

  /** Load many assets in parallel. */
  async loadAll(specs: AssetSpec[]): Promise<void> {
    await Promise.all(
      specs.map((s) => this.load(s.name, s.url, s.frameWidth, s.frameHeight)),
    );
  }
}
