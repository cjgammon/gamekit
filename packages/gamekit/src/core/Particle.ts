import { Sprite } from "./Sprite.js";

/**
 * A short-lived visual {@link Sprite} for particle effects. Integrates motion
 * like any entity (so gravity = `acceleration.y`, and it interpolates), ages
 * each fixed tick, fades/scales over its lifespan, and `kill()`s itself when
 * spent — at which point an {@link Emitter}'s recycling group keeps it for reuse.
 *
 * Untextured by default, so it draws as a tinted quad (no image needed); set a
 * texture for image particles.
 */
export class Particle extends Sprite {
  /** Seconds the particle lives before it kills itself. */
  lifespan = 1;
  /** Seconds elapsed since launch. */
  age = 0;
  /** Spin in radians/second. */
  angularVelocity = 0;
  /** Opacity at birth → death (lerped by age). */
  alphaStart = 1;
  alphaEnd = 0;
  /** Uniform scale at birth → death (lerped by age). */
  scaleStart = 1;
  scaleEnd = 1;

  override fixedUpdate(dt: number): void {
    super.fixedUpdate(dt); // integrate velocity / acceleration (e.g. gravity)
    if (this.angularVelocity !== 0) this.rotation += this.angularVelocity * dt;

    this.age += dt;
    const t = this.lifespan > 0 ? Math.min(this.age / this.lifespan, 1) : 1;
    // Drive alpha + scale in the fixed step so scale interpolates correctly.
    this.alpha = this.alphaStart + (this.alphaEnd - this.alphaStart) * t;
    const s = this.scaleStart + (this.scaleEnd - this.scaleStart) * t;
    this.scaleX = s;
    this.scaleY = s;

    if (this.age >= this.lifespan) this.kill();
  }
}
