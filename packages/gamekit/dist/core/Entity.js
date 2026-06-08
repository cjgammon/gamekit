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
    /** Mark for removal. The owning Group will destroy it on its next update. */
    kill() {
        this.alive = false;
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
