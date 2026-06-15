import { describe, expect, test } from "vitest";
import { Emitter, Particle, Rng } from "../../packages/gamekit/src/index.js";

/** Run an emitter forward by `steps` fixed ticks of `dt`. */
function tick(e: Emitter, steps: number, dt = 0.05): void {
  for (let i = 0; i < steps; i++) e.fixedUpdate(dt);
}

describe("Particle lifecycle", () => {
  test("ages and kills itself at the end of its lifespan", () => {
    const p = new Particle();
    p.lifespan = 0.1;
    p.fixedUpdate(0.05);
    expect(p.alive).toBe(true);
    p.fixedUpdate(0.05); // age 0.1 ≥ lifespan
    expect(p.alive).toBe(false);
  });

  test("fades alpha and scales over its life", () => {
    const p = new Particle();
    p.lifespan = 1;
    p.alphaStart = 1;
    p.alphaEnd = 0;
    p.scaleStart = 2;
    p.scaleEnd = 0;
    p.fixedUpdate(0.5); // halfway
    expect(p.alpha).toBeCloseTo(0.5, 6);
    expect(p.scaleX).toBeCloseTo(1, 6);
  });

  test("gravity accelerates downward via acceleration.y", () => {
    const p = new Particle();
    p.lifespan = 10;
    p.acceleration.y = 100;
    p.fixedUpdate(0.1);
    expect(p.velocity.y).toBeCloseTo(10, 6); // 100 * 0.1
    expect(p.y).toBeGreaterThan(0);
  });
});

describe("Emitter burst", () => {
  test("explode spawns the requested count at the emitter origin", () => {
    const e = new Emitter(100, 50, undefined, new Rng(1));
    e.explode(8);
    expect(e.count).toBe(8);
    for (const p of e.children) {
      expect(p.alive).toBe(true);
      expect(p.x).toBe(100);
      expect(p.y).toBe(50);
    }
  });

  test("launch velocity respects the speed + angle ranges", () => {
    const e = new Emitter(0, 0, undefined, new Rng(2));
    e.speed = { min: 100, max: 100 }; // fixed magnitude
    e.angle = { min: 0, max: 0 }; // straight right
    e.explode(3);
    for (const p of e.children) {
      expect(p.velocity.x).toBeCloseTo(100, 4);
      expect(p.velocity.y).toBeCloseTo(0, 4);
    }
  });

  test("seeded emitters produce identical particle streams", () => {
    const a = new Emitter(0, 0, undefined, new Rng(42));
    const b = new Emitter(0, 0, undefined, new Rng(42));
    a.explode(5);
    b.explode(5);
    const va = a.children.map((p) => [p.velocity.x, p.velocity.y, p.lifespan]);
    const vb = b.children.map((p) => [p.velocity.x, p.velocity.y, p.lifespan]);
    expect(va).toEqual(vb);
  });
});

describe("Emitter recycling", () => {
  test("dead particles are reused instead of growing the pool", () => {
    const e = new Emitter(0, 0, undefined, new Rng(3));
    e.life = { min: 0.1, max: 0.1 };
    e.explode(10);
    expect(e.count).toBe(10);

    tick(e, 3); // > lifespan → all die, kept (recycling)
    expect(e.count).toBe(10);
    expect(e.children.every((p) => !p.alive)).toBe(true);

    e.explode(10); // should revive the dead ones, not allocate
    expect(e.count).toBe(10);
    expect(e.children.every((p) => p.alive)).toBe(true);
  });

  test("maxParticles caps live particles", () => {
    const e = new Emitter(0, 0, undefined, new Rng(4));
    e.maxParticles = 5;
    e.explode(20);
    expect(e.count).toBe(5);
  });
});

describe("Emitter continuous stream", () => {
  test("start emits quantity every frequency seconds", () => {
    const e = new Emitter(0, 0, undefined, new Rng(5));
    e.life = { min: 100, max: 100 }; // long-lived so they accumulate
    e.start(0.1, 2); // 2 particles every 0.1s
    tick(e, 5, 0.1); // 5 intervals → 10 particles
    expect(e.count).toBe(10);
    e.stop();
    tick(e, 5, 0.1);
    expect(e.count).toBe(10); // no more after stop
  });

  test("zero frequency falls back to a one-shot explode", () => {
    const e = new Emitter(0, 0, undefined, new Rng(6));
    e.start(0, 4);
    expect(e.count).toBe(4);
  });
});
