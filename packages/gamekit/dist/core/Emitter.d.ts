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
export declare class Emitter extends Group<Particle> {
    /** Randomness source — seed it for reproducible effects. */
    rng: Rng;
    /** Launch speed range (px/s). */
    speed: NumberRange;
    /** Launch direction range (radians); defaults to a full circle. */
    angle: NumberRange;
    /** Lifespan range (seconds). */
    life: NumberRange;
    /** Spin range (radians/second). */
    spin: NumberRange;
    /** Constant downward acceleration applied to particles (px/s²). */
    gravityY: number;
    /** Opacity at birth → death. */
    alphaStart: number;
    alphaEnd: number;
    /** Scale at birth → death. */
    scaleStart: number;
    scaleEnd: number;
    /** Particle quad size (px). */
    particleWidth: number;
    particleHeight: number;
    /** Tints to choose from per particle (0xRRGGBB). */
    tints: number[];
    /** Hard cap on live particles; emit is skipped when reached and none are free. */
    maxParticles: number;
    private readonly _factory;
    private _emitting;
    private _frequency;
    private _quantity;
    private _timer;
    constructor(x?: number, y?: number, factory?: () => Particle, rng?: Rng);
    /** Emit `count` particles at once. */
    explode(count: number): void;
    /**
     * Begin a continuous stream: emit `quantity` particles every `frequency`
     * seconds. A non-positive frequency falls back to a single {@link explode}.
     */
    start(frequency: number, quantity?: number): void;
    /** Stop a continuous stream (live particles still finish their lives). */
    stop(): void;
    /** Launch one particle (recycled if possible), or undefined if at capacity. */
    emit(): Particle | undefined;
    fixedUpdate(dt: number): void;
    private _configure;
}
