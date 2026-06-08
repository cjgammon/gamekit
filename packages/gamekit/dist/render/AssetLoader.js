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
    constructor(factory) {
        this._textures = new Map();
        this._factory = factory;
        this.white = factory.createSolidTexture();
        this._textures.set(WHITE_TEXTURE, this.white);
    }
    /** Register a pre-built texture under a name (used by {@link load}). */
    register(name, entry) {
        this._textures.set(name, entry);
    }
    /** The texture registered under `name`, or undefined. */
    get(name) {
        return this._textures.get(name);
    }
    /** True if `name` has a texture registered. */
    has(name) {
        return this._textures.has(name);
    }
    /** The texture for `name`, falling back to the white texture when missing or
     *  when `name` is empty — so the renderer always has something to bind. */
    resolve(name) {
        return (name && this._textures.get(name)) || this.white;
    }
    /** Fetch + decode an image, upload it, and register it under `name`. */
    async load(name, url, frameWidth = 0, frameHeight = 0) {
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Failed to load asset "${name}": ${res.status}`);
        const bitmap = await createImageBitmap(await res.blob());
        const entry = this._factory.createTextureFromImage(bitmap, frameWidth, frameHeight);
        bitmap.close();
        this.register(name, entry);
        return entry;
    }
    /** Load many assets in parallel. */
    async loadAll(specs) {
        await Promise.all(specs.map((s) => this.load(s.name, s.url, s.frameWidth, s.frameHeight)));
    }
}
