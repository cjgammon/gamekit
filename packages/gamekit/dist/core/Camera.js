import { Mat3 } from "../math/Mat3.js";
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
export class Camera {
    constructor(viewportWidth = 0, viewportHeight = 0) {
        /** Camera center in world space (the world point shown at the viewport center). */
        this.x = 0;
        this.y = 0;
        /** Pixels-per-world-unit. >1 zooms in, <1 zooms out. */
        this.zoom = 1;
        /** View rotation in radians (rotates the world about the viewport center). */
        this.rotation = 0;
        /** Per-frame follow smoothing in [0, 1]: 1 snaps to the target, smaller
         *  values ease toward it. */
        this.followLerp = 1;
        /** When set, the target may move within these half-extents (world units)
         *  around the camera center before the camera tracks it. */
        this.deadzone = null;
        /** When set, the camera center is clamped so the viewport stays inside it.
         *  Clamping ignores rotation (matches the Flixel model). */
        this.bounds = null;
        /** Random source for shake, injectable so tests are deterministic. */
        this.random = Math.random;
        this._target = null;
        this._shakeDuration = 0;
        this._shakeTime = 0;
        this._shakeIntensity = 0;
        this._shakeX = 0;
        this._shakeY = 0;
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
    }
    // ---- Configuration ----
    /** Resize the visible region (e.g. on canvas resize). */
    resize(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
        return this;
    }
    /** Snap the center to a world point immediately. */
    centerOn(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
    /**
     * Track an entity's center. `lerp` is the per-frame smoothing (1 = snap).
     * The camera does not jump on the first frame — call {@link snapToTarget}
     * first if you want it centered immediately.
     */
    follow(target, lerp = 1) {
        this._target = target;
        this.followLerp = lerp;
        return this;
    }
    /** Stop following the current target (the camera holds its position). */
    stopFollow() {
        this._target = null;
        return this;
    }
    /** Jump the center onto the follow target (then clamp to bounds). */
    snapToTarget() {
        if (this._target) {
            this.x = this._target.x + this._target.width / 2;
            this.y = this._target.y + this._target.height / 2;
            this._clampToBounds();
        }
        return this;
    }
    /**
     * Shake the view for `duration` seconds. The offset is random within
     * ±`intensity` world units and decays linearly to zero. Calling again
     * restarts the shake.
     */
    shake(intensity, duration) {
        this._shakeIntensity = intensity;
        this._shakeDuration = duration;
        this._shakeTime = duration;
        return this;
    }
    /** True while a shake is in progress. */
    get shaking() {
        return this._shakeTime > 0;
    }
    // ---- Per-frame ----
    /** Advance follow, bounds clamping, and shake. Called once per frame. */
    update(dt) {
        this._followStep();
        this._clampToBounds();
        this._updateShake(dt);
    }
    // ---- Matrices & coordinate conversion ----
    /**
     * World → screen-pixel transform (viewport origin at top-left, y-down).
     * This is the "view" half of the pipeline; the renderer wants
     * {@link viewProjection}.
     */
    view() {
        const cx = this.x + this._shakeX;
        const cy = this.y + this._shakeY;
        return Mat3.translation(this.viewportWidth / 2, this.viewportHeight / 2)
            .multiplySelf(Mat3.rotation(this.rotation))
            .multiplySelf(Mat3.scaling(this.zoom, this.zoom))
            .multiplySelf(Mat3.translation(-cx, -cy));
    }
    /** World → clip-space [-1, 1] transform, ready for GPU upload. */
    viewProjection() {
        return Mat3.ortho(this.viewportWidth, this.viewportHeight).multiplySelf(this.view());
    }
    /** Map a world point to screen pixels. */
    worldToScreen(p) {
        return this.view().transformPoint(p);
    }
    /** Map a screen-pixel point back to world space (inverse of the view). */
    screenToWorld(p) {
        const cx = this.x + this._shakeX;
        const cy = this.y + this._shakeY;
        const inv = Mat3.translation(cx, cy)
            .multiplySelf(Mat3.scaling(1 / this.zoom, 1 / this.zoom))
            .multiplySelf(Mat3.rotation(-this.rotation))
            .multiplySelf(Mat3.translation(-this.viewportWidth / 2, -this.viewportHeight / 2));
        return inv.transformPoint(p);
    }
    // ---- Internal ----
    _followStep() {
        const t = this._target;
        if (!t)
            return;
        const tx = t.x + t.width / 2;
        const ty = t.y + t.height / 2;
        let goalX = tx;
        let goalY = ty;
        if (this.deadzone) {
            // Only move enough to keep the target within the deadzone half-extents.
            goalX = this._clampGoal(this.x, tx, this.deadzone.x);
            goalY = this._clampGoal(this.y, ty, this.deadzone.y);
        }
        this.x += (goalX - this.x) * this.followLerp;
        this.y += (goalY - this.y) * this.followLerp;
    }
    /** Goal center for one axis so `target` sits within `half` of `current`. */
    _clampGoal(current, target, half) {
        if (target - current > half)
            return target - half;
        if (current - target > half)
            return target + half;
        return current; // inside the deadzone — don't move
    }
    _clampToBounds() {
        const b = this.bounds;
        if (!b)
            return;
        const halfW = this.viewportWidth / (2 * this.zoom);
        const halfH = this.viewportHeight / (2 * this.zoom);
        // If the world is narrower than the viewport, center on it; else clamp.
        if (b.maxX - b.minX <= 2 * halfW)
            this.x = (b.minX + b.maxX) / 2;
        else
            this.x = Math.min(Math.max(this.x, b.minX + halfW), b.maxX - halfW);
        if (b.maxY - b.minY <= 2 * halfH)
            this.y = (b.minY + b.maxY) / 2;
        else
            this.y = Math.min(Math.max(this.y, b.minY + halfH), b.maxY - halfH);
    }
    _updateShake(dt) {
        if (this._shakeTime <= 0)
            return;
        this._shakeTime -= dt;
        if (this._shakeTime <= 0) {
            this._shakeTime = 0;
            this._shakeX = 0;
            this._shakeY = 0;
            return;
        }
        const decay = this._shakeTime / this._shakeDuration; // 1 → 0
        this._shakeX = (this.random() * 2 - 1) * this._shakeIntensity * decay;
        this._shakeY = (this.random() * 2 - 1) * this._shakeIntensity * decay;
    }
}
