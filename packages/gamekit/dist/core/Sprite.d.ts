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
export declare class Animation {
    readonly name: string;
    readonly frames: number[];
    readonly fps: number;
    readonly loop: boolean;
    readonly onComplete: Signal<Animation>;
    private _elapsed;
    private _index;
    finished: boolean;
    constructor(name: string, config: AnimationConfig);
    reset(): void;
    update(dt: number): void;
    /** The current sprite-sheet frame index. */
    get currentFrame(): number;
}
/**
 * An Entity with a visual representation: a texture, optional sprite-sheet
 * frames, and named animations. Rendering reads these fields; the renderer
 * owns the actual texture atlas and resolves `textureId` + `frame` to UVs.
 */
export declare class Sprite extends Entity {
    /** Texture atlas key, resolved by the renderer. */
    textureId: string;
    /** Frame size within the sheet. Defaults to the full texture if unset. */
    frameWidth: number;
    frameHeight: number;
    /** Current frame index within the sheet. */
    frame: number;
    flipX: boolean;
    flipY: boolean;
    /** 0..1 opacity. */
    alpha: number;
    /** Multiplicative tint as 0xRRGGBB. */
    tint: number;
    /** Rotation / scale pivot, normalized 0..1 (0.5 = center). */
    originX: number;
    originY: number;
    private readonly _anims;
    private _current;
    setTexture(textureId: string, frameWidth?: number, frameHeight?: number): this;
    addAnim(name: string, config: AnimationConfig): this;
    /** Start an animation. No-op if already playing it (unless forceRestart). */
    play(name: string, forceRestart?: boolean): this;
    stop(): this;
    get currentAnim(): Animation | null;
    update(dt: number): void;
}
