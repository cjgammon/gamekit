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
    /** View rotation in **degrees** — a convenience view over the radian
     *  {@link rotation}. */
    get rotationDegrees() {
        return (this.rotation * 180) / Math.PI;
    }
    set rotationDegrees(deg) {
        this.rotation = (deg * Math.PI) / 180;
    }
    constructor(viewportWidth = 0, viewportHeight = 0) {
        /** Camera center in world space (the world point shown at the viewport center). */
        this.x = 0;
        this.y = 0;
        /** Center at the start of the current fixed tick — the render-interpolation
         *  origin, mirroring `Entity.prevX/prevY`. */
        this.prevX = 0;
        this.prevY = 0;
        /** Pixels-per-world-unit. >1 zooms in, <1 zooms out. */
        this.zoom = 1;
        /** View rotation in radians (rotates the world about the viewport center). */
        this.rotation = 0;
        /** Per-fixed-tick follow smoothing in [0, 1]: 1 snaps to the target, smaller
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
    /** Snap the center to a world point immediately (no interpolation smear). */
    centerOn(x, y) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
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
            this.syncPrev(); // snap interpolation origin so there's no first-frame smear
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
    // ---- Per-tick / per-frame ----
    /**
     * Snapshot the center as the interpolation origin for the coming tick.
     * Called by the framework before {@link update}, matching `Entity.syncPrev`.
     */
    syncPrev() {
        this.prevX = this.x;
        this.prevY = this.y;
    }
    /**
     * Advance follow + bounds clamp by one fixed tick. Driven from the same fixed
     * step as entity motion (via `Scene.fixedUpdate`) and snapshots `prev` first,
     * so the rendered view interpolates in lockstep with the entities it frames —
     * no per-tick jitter between sprites and the camera.
     */
    update(_dt) {
        this.syncPrev();
        this._followStep();
        this._clampToBounds();
    }
    /**
     * Advance the shake decay by real elapsed time. Shake is a purely visual
     * offset, so it runs per rendered frame (not per fixed tick) to stay smooth.
     */
    advanceShake(realDt) {
        this._updateShake(realDt);
    }
    // ---- Matrices & coordinate conversion ----
    /**
     * World → screen-pixel transform at interpolation factor `alpha` (0..1, from
     * `Game.render`). The center is `lerp(prev, current, alpha)` plus shake;
     * `alpha = 1` (the default) yields the current center.
     */
    view(alpha = 1) {
        const cx = this._centerX(alpha);
        const cy = this._centerY(alpha);
        return Mat3.translation(this.viewportWidth / 2, this.viewportHeight / 2)
            .multiplySelf(Mat3.rotation(this.rotation))
            .multiplySelf(Mat3.scaling(this.zoom, this.zoom))
            .multiplySelf(Mat3.translation(-cx, -cy));
    }
    /** World → clip-space [-1, 1] transform at `alpha`, ready for GPU upload. */
    viewProjection(alpha = 1) {
        return Mat3.ortho(this.viewportWidth, this.viewportHeight).multiplySelf(this.view(alpha));
    }
    /** Map a world point to screen pixels (using the current center). */
    worldToScreen(p) {
        return this.view(1).transformPoint(p);
    }
    /** Map a screen-pixel point back to world space (inverse of the current view). */
    screenToWorld(p) {
        const cx = this._centerX(1);
        const cy = this._centerY(1);
        const inv = Mat3.translation(cx, cy)
            .multiplySelf(Mat3.scaling(1 / this.zoom, 1 / this.zoom))
            .multiplySelf(Mat3.rotation(-this.rotation))
            .multiplySelf(Mat3.translation(-this.viewportWidth / 2, -this.viewportHeight / 2));
        return inv.transformPoint(p);
    }
    _centerX(alpha) {
        return this.prevX + (this.x - this.prevX) * alpha + this._shakeX;
    }
    _centerY(alpha) {
        return this.prevY + (this.y - this.prevY) * alpha + this._shakeY;
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
