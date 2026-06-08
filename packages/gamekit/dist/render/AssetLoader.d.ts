import type { TextureEntry } from "./WebGPURenderer.js";
/** The texture-creation surface the loader needs — satisfied by
 *  {@link WebGPURenderer}, and fakeable for headless tests. */
export interface TextureFactory {
    createTextureFromImage(image: ImageBitmap, frameWidth?: number, frameHeight?: number): TextureEntry;
    createSolidTexture(rgba?: Uint8Array, width?: number, height?: number): TextureEntry;
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
export declare const WHITE_TEXTURE = "__white__";
/**
 * Loads images into GPU textures and keeps a name → {@link TextureEntry}
 * registry the renderer resolves `Sprite.textureId` against. Always provides a
 * 1×1 white texture (under {@link WHITE_TEXTURE}) so solid-colored or
 * untextured entities can render with no image.
 *
 * Browser-only: {@link load} uses `fetch` + `createImageBitmap`. The registry
 * itself is pure, so it's unit-tested with a fake factory.
 */
export declare class AssetLoader {
    /** The built-in 1×1 white texture (premultiplied). */
    readonly white: TextureEntry;
    private readonly _factory;
    private readonly _textures;
    constructor(factory: TextureFactory);
    /** Register a pre-built texture under a name (used by {@link load}). */
    register(name: string, entry: TextureEntry): void;
    /** The texture registered under `name`, or undefined. */
    get(name: string): TextureEntry | undefined;
    /** True if `name` has a texture registered. */
    has(name: string): boolean;
    /** The texture for `name`, falling back to the white texture when missing or
     *  when `name` is empty — so the renderer always has something to bind. */
    resolve(name: string): TextureEntry;
    /** Fetch + decode an image, upload it, and register it under `name`. */
    load(name: string, url: string, frameWidth?: number, frameHeight?: number): Promise<TextureEntry>;
    /** Load many assets in parallel. */
    loadAll(specs: AssetSpec[]): Promise<void>;
}
