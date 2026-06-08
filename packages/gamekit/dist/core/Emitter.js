import { Group } from "./Group.js";
import { Particle } from "./Particle.js";
import { Rng } from "./Rng.js";
/**
 * Spawns and recycles {@link Particle}s — explosions, debris, trails. It's a
 * recycling {@link Group}, so dead particles are reused instead of reallocated
 * (zero GC churn), and it draws its particles as part of the scene tree.
 *
 * Per particle it samples speed, direction, lifespan, and spin from configurable
 * ranges using a seedable {@link Rng}, so an effect is reproducible when seeded.
 * Use {@link explode} for a one-shot burst or {@link start} for a continuous
 * stream. Position the emitter via its `x`/`y`.
 */
export class Emitter extends Group {
    constructor(x = 0, y = 0, factory = () => new Particle(), rng = new Rng()) {
        super();
        /** Launch speed range (px/s). */
        this.speed = { min: 50, max: 100 };
        /** Launch direction range (radians); defaults to a full circle. */
        this.angle = { min: 0, max: Math.PI * 2 };
        /** Lifespan range (seconds). */
        this.life = { min: 0.5, max: 1 };
        /** Spin range (radians/second). */
        this.spin = { min: 0, max: 0 };
        /** Constant downward acceleration applied to particles (px/s²). */
        this.gravityY = 0;
        /** Opacity at birth → death. */
        this.alphaStart = 1;
        this.alphaEnd = 0;
        /** Scale at birth → death. */
        this.scaleStart = 1;
        this.scaleEnd = 1;
        /** Particle quad size (px). */
        this.particleWidth = 4;
        this.particleHeight = 4;
        /** Tints to choose from per particle (0xRRGGBB). */
        this.tints = [0xffffff];
        /** Hard cap on live particles; emit is skipped when reached and none are free. */
        this.maxParticles = 200;
        this._emitting = false;
        this._frequency = 0;
        this._quantity = 1;
        this._timer = 0;
        this.x = x;
        this.y = y;
        this.recycling = true; // keep dead particles for reuse
        this._factory = factory;
        this.rng = rng;
    }
    /** Emit `count` particles at once. */
    explode(count) {
        for (let i = 0; i < count; i++)
            this.emit();
    }
    /**
     * Begin a continuous stream: emit `quantity` particles every `frequency`
     * seconds. A non-positive frequency falls back to a single {@link explode}.
     */
    start(frequency, quantity = 1) {
        if (frequency <= 0) {
            this.explode(quantity);
            return;
        }
        this._emitting = true;
        this._frequency = frequency;
        this._quantity = quantity;
        this._timer = 0;
    }
    /** Stop a continuous stream (live particles still finish their lives). */
    stop() {
        this._emitting = false;
    }
    /** Launch one particle (recycled if possible), or undefined if at capacity. */
    emit() {
        let p = this.getFirstDead();
        if (p) {
            p.revive();
        }
        else {
            if (this.count >= this.maxParticles)
                return undefined;
            p = this.add(this._factory());
        }
        this._configure(p);
        return p;
    }
    fixedUpdate(dt) {
        if (this._emitting && this._frequency > 0) {
            this._timer += dt;
            while (this._timer >= this._frequency) {
                this._timer -= this._frequency;
                for (let i = 0; i < this._quantity; i++)
                    this.emit();
            }
        }
        super.fixedUpdate(dt); // age + move live particles
    }
    // ---- Internal ----
    _configure(p) {
        const r = this.rng;
        const speed = r.range(this.speed.min, this.speed.max);
        const angle = r.range(this.angle.min, this.angle.max);
        p.width = this.particleWidth;
        p.height = this.particleHeight;
        p.velocity.x = Math.cos(angle) * speed;
        p.velocity.y = Math.sin(angle) * speed;
        p.acceleration.x = 0;
        p.acceleration.y = this.gravityY;
        p.lifespan = r.range(this.life.min, this.life.max);
        p.age = 0;
        p.angularVelocity = r.range(this.spin.min, this.spin.max);
        p.rotation = 0;
        p.alphaStart = this.alphaStart;
        p.alphaEnd = this.alphaEnd;
        p.alpha = this.alphaStart;
        p.scaleStart = this.scaleStart;
        p.scaleEnd = this.scaleEnd;
        p.scaleX = this.scaleStart;
        p.scaleY = this.scaleStart;
        p.tint =
            this.tints.length === 1 ? this.tints[0] : r.pick(this.tints) ?? 0xffffff;
        // Snap to the emitter origin so a recycled particle doesn't streak.
        p.setPosition(this.x, this.y, true);
    }
}
