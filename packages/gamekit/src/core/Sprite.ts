import { Entity } from "./Entity.js";
import { Signal } from "./Signal.js";

export interface AnimationConfig {
  /** Frame indices into the sprite sheet, in play order. */
  frames: number[];
  /** Playback speed in frames per second. */
  fps: number;
  /** Loop when reaching the end. Default true. */
  loop?: boolean;
}

/**
 * A named frame sequence. Advances through `frames` at a fixed fps.
 */
export class Animation {
  readonly name: string;
  readonly frames: number[];
  readonly fps: number;
  readonly loop: boolean;
  readonly onComplete: Signal<Animation>;

  private _elapsed = 0;
  private _index = 0;
  finished = false;

  constructor(name: string, config: AnimationConfig) {
    this.name = name;
    this.frames = config.frames;
    this.fps = config.fps;
    this.loop = config.loop ?? true;
    this.onComplete = new Signal<Animation>();
  }

  reset(): void {
    this._elapsed = 0;
    this._index = 0;
    this.finished = false;
  }

  update(dt: number): void {
    if (this.finished || this.frames.length <= 1) return;
    const frameDuration = 1 / this.fps;
    this._elapsed += dt;
    while (this._elapsed >= frameDuration) {
      this._elapsed -= frameDuration;
      this._index++;
      if (this._index >= this.frames.length) {
        if (this.loop) {
          this._index = 0;
        } else {
          this._index = this.frames.length - 1;
          this.finished = true;
          this.onComplete.emit(this);
          break;
        }
      }
    }
  }

  /** The current sprite-sheet frame index. */
  get currentFrame(): number {
    return this.frames[this._index];
  }
}

/**
 * An Entity with a visual representation: a texture, optional sprite-sheet
 * frames, and named animations. Rendering reads these fields; the renderer
 * owns the actual texture atlas and resolves `textureId` + `frame` to UVs.
 */
export class Sprite extends Entity {
  /** Texture atlas key, resolved by the renderer. */
  textureId = "";
  /** Frame size within the sheet. Defaults to the full texture if unset. */
  frameWidth = 0;
  frameHeight = 0;
  /** Current frame index within the sheet. */
  frame = 0;

  flipX = false;
  flipY = false;
  /** 0..1 opacity. */
  alpha = 1;
  /** Multiplicative tint as 0xRRGGBB. */
  tint = 0xffffff;
  /** Rotation / scale pivot, normalized 0..1 (0.5 = center). */
  originX = 0.5;
  originY = 0.5;

  private readonly _anims = new Map<string, Animation>();
  private _current: Animation | null = null;

  setTexture(
    textureId: string,
    frameWidth?: number,
    frameHeight?: number,
  ): this {
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

  addAnim(name: string, config: AnimationConfig): this {
    this._anims.set(name, new Animation(name, config));
    return this;
  }

  /** Start an animation. No-op if already playing it (unless forceRestart). */
  play(name: string, forceRestart = false): this {
    const anim = this._anims.get(name);
    if (!anim) return this;
    if (this._current === anim && !forceRestart) return this;
    this._current = anim;
    anim.reset();
    this.frame = anim.currentFrame;
    return this;
  }

  stop(): this {
    this._current = null;
    return this;
  }

  get currentAnim(): Animation | null {
    return this._current;
  }

  // Animation is a visual concern → advance it on the variable-step update.
  override update(dt: number): void {
    if (this._current) {
      this._current.update(dt);
      this.frame = this._current.currentFrame;
    }
  }
}
