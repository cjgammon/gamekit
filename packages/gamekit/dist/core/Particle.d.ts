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
export declare class Particle extends Sprite {
    /** Seconds the particle lives before it kills itself. */
    lifespan: number;
    /** Seconds elapsed since launch. */
    age: number;
    /** Spin in radians/second. */
    angularVelocity: number;
    /** Opacity at birth → death (lerped by age). */
    alphaStart: number;
    alphaEnd: number;
    /** Uniform scale at birth → death (lerped by age). */
    scaleStart: number;
    scaleEnd: number;
    fixedUpdate(dt: number): void;
}
