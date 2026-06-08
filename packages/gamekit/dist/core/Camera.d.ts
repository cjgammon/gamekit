import { Mat3 } from "../math/Mat3.js";
import { Vec2 } from "../math/Vec2.js";
import type { Entity } from "./Entity.js";
/** World-space rectangle the camera center is kept inside. */
export interface CameraBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
/** Half-extents (world units) of a centered rectangle the follow target may
 *  roam inside before the camera moves. */
export interface CameraDeadzone {
    x: number;
    y: number;
}
/**
 * A 2D view onto the world. Holds a center (`x`, `y` in world space), `zoom`,
 * and `rotation`, and produces the matrices the renderer uploads each frame:
 * {@link viewProjection} (world → clip space) for the GPU, plus
 * {@link worldToScreen}/{@link screenToWorld} for input picking and HUD layout.
 *
 * Pure math — no DOM, no GPU types — so it stays in the isomorphic core. The
 * server allocates one per Scene but never reads it.
 *
 * Per-frame behavior (follow, bounds clamp, shake) is advanced by {@link update},
 * which the owning Scene calls once per rendered frame.
 */
export declare class Camera {
    /** Camera center in world space (the world point shown at the viewport center). */
    x: number;
    y: number;
    /** Pixels-per-world-unit. >1 zooms in, <1 zooms out. */
    zoom: number;
    /** View rotation in radians (rotates the world about the viewport center). */
    rotation: number;
    /** Visible region in screen pixels. */
    viewportWidth: number;
    viewportHeight: number;
    /** Per-frame follow smoothing in [0, 1]: 1 snaps to the target, smaller
     *  values ease toward it. */
    followLerp: number;
    /** When set, the target may move within these half-extents (world units)
     *  around the camera center before the camera tracks it. */
    deadzone: CameraDeadzone | null;
    /** When set, the camera center is clamped so the viewport stays inside it.
     *  Clamping ignores rotation (matches the Flixel model). */
    bounds: CameraBounds | null;
    /** Random source for shake, injectable so tests are deterministic. */
    random: () => number;
    private _target;
    private _shakeDuration;
    private _shakeTime;
    private _shakeIntensity;
    private _shakeX;
    private _shakeY;
    constructor(viewportWidth?: number, viewportHeight?: number);
    /** Resize the visible region (e.g. on canvas resize). */
    resize(width: number, height: number): this;
    /** Snap the center to a world point immediately. */
    centerOn(x: number, y: number): this;
    /**
     * Track an entity's center. `lerp` is the per-frame smoothing (1 = snap).
     * The camera does not jump on the first frame — call {@link snapToTarget}
     * first if you want it centered immediately.
     */
    follow(target: Entity, lerp?: number): this;
    /** Stop following the current target (the camera holds its position). */
    stopFollow(): this;
    /** Jump the center onto the follow target (then clamp to bounds). */
    snapToTarget(): this;
    /**
     * Shake the view for `duration` seconds. The offset is random within
     * ±`intensity` world units and decays linearly to zero. Calling again
     * restarts the shake.
     */
    shake(intensity: number, duration: number): this;
    /** True while a shake is in progress. */
    get shaking(): boolean;
    /** Advance follow, bounds clamping, and shake. Called once per frame. */
    update(dt: number): void;
    /**
     * World → screen-pixel transform (viewport origin at top-left, y-down).
     * This is the "view" half of the pipeline; the renderer wants
     * {@link viewProjection}.
     */
    view(): Mat3;
    /** World → clip-space [-1, 1] transform, ready for GPU upload. */
    viewProjection(): Mat3;
    /** Map a world point to screen pixels. */
    worldToScreen(p: Vec2): Vec2;
    /** Map a screen-pixel point back to world space (inverse of the view). */
    screenToWorld(p: Vec2): Vec2;
    private _followStep;
    /** Goal center for one axis so `target` sits within `half` of `current`. */
    private _clampGoal;
    private _clampToBounds;
    private _updateShake;
}
