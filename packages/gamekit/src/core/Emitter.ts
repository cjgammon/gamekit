import { Group } from "./Group.js";
import { Particle } from "./Particle.js";
import { Rng } from "./Rng.js";

/** An inclusive numeric range the emitter samples per particle. */
export interface NumberRange {
  min: number;
  max: number;
}

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
export class Emitter extends Group<Particle> {
  /** Randomness source — seed it for reproducible effects. */
  rng: Rng;

  /** Launch speed range (px/s). */
  speed: NumberRange = { min: 50, max: 100 };
  /** Launch direction range (radians); defaults to a full circle. */
  angle: NumberRange = { min: 0, max: Math.PI * 2 };
  /** Lifespan range (seconds). */
  life: NumberRange = { min: 0.5, max: 1 };
  /** Spin range (radians/second). */
  spin: NumberRange = { min: 0, max: 0 };
  /** Constant downward acceleration applied to particles (px/s²). */
  gravityY = 0;

  /** Opacity at birth → death. */
  alphaStart = 1;
  alphaEnd = 0;
  /** Scale at birth → death. */
  scaleStart = 1;
  scaleEnd = 1;
  /** Particle quad size (px). */
  particleWidth = 4;
  particleHeight = 4;
  /** Tints to choose from per particle (0xRRGGBB). */
  tints: number[] = [0xffffff];
  /** Hard cap on live particles; emit is skipped when reached and none are free. */
  maxParticles = 200;

  private readonly _factory: () => Particle;
  private _emitting = false;
  private _frequency = 0;
  private _quantity = 1;
  private _timer = 0;

  constructor(
    x = 0,
    y = 0,
    factory: () => Particle = () => new Particle(),
    rng: Rng = new Rng(),
  ) {
    super();
    this.x = x;
    this.y = y;
    this.recycling = true; // keep dead particles for reuse
    this._factory = factory;
    this.rng = rng;
  }

  /** Emit `count` particles at once. */
  explode(count: number): void {
    for (let i = 0; i < count; i++) this.emit();
  }

  /**
   * Begin a continuous stream: emit `quantity` particles every `frequency`
   * seconds. A non-positive frequency falls back to a single {@link explode}.
   */
  start(frequency: number, quantity = 1): void {
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
  stop(): void {
    this._emitting = false;
  }

  /** Launch one particle (recycled if possible), or undefined if at capacity. */
  emit(): Particle | undefined {
    let p = this.getFirstDead();
    if (p) {
      p.revive();
    } else {
      if (this.count >= this.maxParticles) return undefined;
      p = this.add(this._factory());
    }
    this._configure(p);
    return p;
  }

  override fixedUpdate(dt: number): void {
    if (this._emitting && this._frequency > 0) {
      this._timer += dt;
      while (this._timer >= this._frequency) {
        this._timer -= this._frequency;
        for (let i = 0; i < this._quantity; i++) this.emit();
      }
    }
    super.fixedUpdate(dt); // age + move live particles
  }

  // ---- Internal ----

  private _configure(p: Particle): void {
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
