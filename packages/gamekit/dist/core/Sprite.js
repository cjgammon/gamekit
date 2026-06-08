import { Entity } from "./Entity.js";
import { Signal } from "./Signal.js";
/**
 * A named frame sequence. Advances through `frames` at a fixed fps.
 */
export class Animation {
    constructor(name, config) {
        this._elapsed = 0;
        this._index = 0;
        this.finished = false;
        this.name = name;
        this.frames = config.frames;
        this.fps = config.fps;
        this.loop = config.loop ?? true;
        this.onComplete = new Signal();
    }
    reset() {
        this._elapsed = 0;
        this._index = 0;
        this.finished = false;
    }
    update(dt) {
        if (this.finished || this.frames.length <= 1)
            return;
        const frameDuration = 1 / this.fps;
        this._elapsed += dt;
        while (this._elapsed >= frameDuration) {
            this._elapsed -= frameDuration;
            this._index++;
            if (this._index >= this.frames.length) {
                if (this.loop) {
                    this._index = 0;
                }
                else {
                    this._index = this.frames.length - 1;
                    this.finished = true;
                    this.onComplete.emit(this);
                    break;
                }
            }
        }
    }
    /** The current sprite-sheet frame index. */
    get currentFrame() {
        return this.frames[this._index];
    }
}
/**
 * An Entity with a visual representation: a texture, optional sprite-sheet
 * frames, and named animations. Rendering reads these fields; the renderer
 * owns the actual texture atlas and resolves `textureId` + `frame` to UVs.
 */
export class Sprite extends Entity {
    constructor() {
        super(...arguments);
        /** Texture atlas key, resolved by the renderer. */
        this.textureId = "";
        /** Frame size within the sheet. Defaults to the full texture if unset. */
        this.frameWidth = 0;
        this.frameHeight = 0;
        /** Current frame index within the sheet. */
        this.frame = 0;
        this.flipX = false;
        this.flipY = false;
        /** 0..1 opacity. */
        this.alpha = 1;
        /** Multiplicative tint as 0xRRGGBB. */
        this.tint = 0xffffff;
        /** Rotation / scale pivot, normalized 0..1 (0.5 = center). */
        this.originX = 0.5;
        this.originY = 0.5;
        this._anims = new Map();
        this._current = null;
    }
    setTexture(textureId, frameWidth, frameHeight) {
        this.textureId = textureId;
        if (frameWidth !== undefined) {
            this.frameWidth = frameWidth;
            this.width = frameWidth;
        }
        if (frameHeight !== undefined) {
            this.frameHeight = frameHeight;
            this.height = frameHeight;
        }
        return this;
    }
    addAnim(name, config) {
        this._anims.set(name, new Animation(name, config));
        return this;
    }
    /** Start an animation. No-op if already playing it (unless forceRestart). */
    play(name, forceRestart = false) {
        const anim = this._anims.get(name);
        if (!anim)
            return this;
        if (this._current === anim && !forceRestart)
            return this;
        this._current = anim;
        anim.reset();
        this.frame = anim.currentFrame;
        return this;
    }
    stop() {
        this._current = null;
        return this;
    }
    get currentAnim() {
        return this._current;
    }
    // Animation is a visual concern → advance it on the variable-step update.
    update(dt) {
        if (this._current) {
            this._current.update(dt);
            this.frame = this._current.currentFrame;
        }
    }
}
