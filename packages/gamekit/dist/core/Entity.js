import { Vec2 } from "../math/Vec2.js";
import { AABB } from "../math/AABB.js";
import { Signal } from "./Signal.js";
/**
 * Base class for all game objects.
 *
 * Coordinate model: positions are absolute world coordinates. Groups are
 * logical containers, not transform nodes — a Group does not offset its
 * children. (Nested transforms can come later if needed.)
 *
 * Lifecycle hooks, called by the owning Group / Scene:
 *  - create()           once, when added
 *  - fixedUpdate(dt)    fixed step — physics & game logic (deterministic)
 *  - update(dt)         variable step, every frame — animation, tweens, visuals
 *  - destroy()          once, when removed
 */
export class Entity {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.width = 0;
        this.height = 0;
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.active = true;
        this.visible = true;
        this.alive = true;
        this.interpolate = true;
        // Seed prev = current so a freshly-spawned entity never lerps from origin.
        this.prevX = x;
        this.prevY = y;
        this.prevRotation = 0;
        this.prevScaleX = 1;
        this.prevScaleY = 1;
        this.velocity = new Vec2();
        this.acceleration = new Vec2();
        this.drag = new Vec2();
        this.maxVelocity = new Vec2();
        this.parent = null;
        this.onDestroy = new Signal();
        this._bounds = new AABB();
    }
    /**
     * World-space AABB (axis-aligned, ignores rotation — fine for broad-phase).
     * Reuses an internal instance; copy it if you need to retain the value.
     */
    get bounds() {
        return this._bounds.set(this.x, this.y, this.width, this.height);
    }
    get centerX() {
        return this.x + this.width * 0.5;
    }
    get centerY() {
        return this.y + this.height * 0.5;
    }
    /** Mark for removal. The owning Group will destroy it on its next update
     *  (or, in a recycling Group, keep it for reuse via `recycle()`). */
    kill() {
        this.alive = false;
    }
    /**
     * Bring a killed entity back to life for reuse (the recycle counterpart of
     * {@link kill}). Re-enables update/render; the caller positions it afterward,
     * preferably via {@link setPosition} so it doesn't smear from its old spot.
     */
    revive() {
        this.alive = true;
        this.active = true;
        this.visible = true;
    }
    // ---- Render interpolation ----
    /**
     * Snapshot the current transform as the lerp origin for the coming fixed
     * tick. The framework calls this on the whole tree once per fixed step,
     * before `fixedUpdate`, so after the tick `prev` holds the pre-tick pose and
     * the live fields hold the post-tick pose. Synced for every entity (not just
     * active ones) so stationary bodies keep `prev == current` and never flicker.
     */
    syncPrev() {
        this.prevX = this.x;
        this.prevY = this.y;
        this.prevRotation = this.rotation;
        this.prevScaleX = this.scaleX;
        this.prevScaleY = this.scaleY;
    }
    /**
     * Fill `out` with the transform to draw this frame: the interpolated pose
     * `lerp(prev, current, alpha)` when {@link interpolate} is set, otherwise the
     * current transform. `alpha` is `Game.render`'s 0..1 factor. Allocation-free
     * — the caller reuses one `out`.
     */
    sampleRender(alpha, out) {
        if (this.interpolate) {
            out.x = this.prevX + (this.x - this.prevX) * alpha;
            out.y = this.prevY + (this.y - this.prevY) * alpha;
            out.rotation =
                this.prevRotation + (this.rotation - this.prevRotation) * alpha;
            out.scaleX = this.prevScaleX + (this.scaleX - this.prevScaleX) * alpha;
            out.scaleY = this.prevScaleY + (this.scaleY - this.prevScaleY) * alpha;
        }
        else {
            out.x = this.x;
            out.y = this.y;
            out.rotation = this.rotation;
            out.scaleX = this.scaleX;
            out.scaleY = this.scaleY;
        }
        return out;
    }
    /**
     * Move to `(x, y)`. By default this also snaps `prev` so the entity does not
     * smear across the gap (use for teleports/spawns); pass `snap = false` to let
     * the move interpolate like ordinary motion.
     */
    setPosition(x, y, snap = true) {
        this.x = x;
        this.y = y;
        if (snap) {
            this.prevX = x;
            this.prevY = y;
        }
    }
    // ---- Lifecycle (override in subclasses) ----
    create() { }
    /** Fixed-step update — physics, game logic. dt is constant. */
    fixedUpdate(dt) {
        this._integrateMotion(dt);
    }
    /** Variable-step update — animation, visuals. Runs once per rendered frame. */
    update(_dt) { }
    destroy() {
        this.onDestroy.emit(this);
        this.onDestroy.clear();
    }
    // ---- Motion integration (Flixel-style) ----
    _integrateMotion(dt) {
        this.velocity.x = Entity._computeVelocity(this.velocity.x, this.acceleration.x, this.drag.x, this.maxVelocity.x, dt);
        this.velocity.y = Entity._computeVelocity(this.velocity.y, this.acceleration.y, this.drag.y, this.maxVelocity.y, dt);
        this.x += this.velocity.x * dt;
        this.y += this.velocity.y * dt;
    }
    static _computeVelocity(v, accel, drag, max, dt) {
        if (accel !== 0) {
            v += accel * dt;
        }
        else if (drag !== 0) {
            const d = drag * dt;
            if (v - d > 0)
                v -= d;
            else if (v + d < 0)
                v += d;
            else
                v = 0;
        }
        if (max !== 0 && v < -max)
            v = -max;
        else if (max !== 0 && v > max)
            v = max;
        return v;
    }
}
