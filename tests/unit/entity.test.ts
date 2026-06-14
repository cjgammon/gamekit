import { describe, expect, test } from "vitest";
import { Entity } from "../../packages/gamekit/src/index.js";

describe("Entity rotationDegrees", () => {
  test("reads and writes the radian rotation", () => {
    const e = new Entity();
    e.rotationDegrees = 90;
    expect(e.rotation).toBeCloseTo(Math.PI / 2);
    e.rotation = Math.PI;
    expect(e.rotationDegrees).toBeCloseTo(180);
  });
});

describe("Entity motion integration", () => {
  test("velocity advances position by velocity * dt", () => {
    const e = new Entity(0, 0);
    e.velocity.set(100, -40);
    e.fixedUpdate(0.5);
    expect(e.x).toBeCloseTo(50);
    expect(e.y).toBeCloseTo(-20);
  });

  test("acceleration increases velocity", () => {
    const e = new Entity();
    e.acceleration.set(100, 0);
    e.fixedUpdate(0.05);
    expect(e.velocity.x).toBeCloseTo(5);
  });

  test("drag decelerates toward zero and clamps without overshoot", () => {
    const e = new Entity();
    e.velocity.set(10, 0);
    e.drag.set(1000, 0); // drag * dt = 50 > 10 → snaps to 0, not -40
    e.fixedUpdate(0.05);
    expect(e.velocity.x).toBe(0);
  });

  test("drag applies partially when it does not exceed velocity", () => {
    const e = new Entity();
    e.velocity.set(100, 0);
    e.drag.set(1000, 0); // drag * dt = 50
    e.fixedUpdate(0.05);
    expect(e.velocity.x).toBeCloseTo(50);
  });

  test("acceleration suppresses drag on the same axis", () => {
    const e = new Entity();
    e.velocity.set(0, 0);
    e.acceleration.set(100, 0);
    e.drag.set(1000, 0); // ignored because acceleration is non-zero
    e.fixedUpdate(0.05);
    expect(e.velocity.x).toBeCloseTo(5);
  });

  test("maxVelocity clamps per axis (0 means unclamped)", () => {
    const e = new Entity();
    e.acceleration.set(100000, 100000);
    e.maxVelocity.set(200, 0); // y unclamped
    e.fixedUpdate(0.05);
    expect(e.velocity.x).toBe(200);
    expect(e.velocity.y).toBeCloseTo(5000);
  });
});

describe("Entity state & bounds", () => {
  test("kill() flips alive to false", () => {
    const e = new Entity();
    expect(e.alive).toBe(true);
    e.kill();
    expect(e.alive).toBe(false);
  });

  test("bounds reflect transform; center accessors are top-left + half", () => {
    const e = new Entity(10, 20);
    e.width = 30;
    e.height = 40;
    const b = e.bounds;
    expect(b.x).toBe(10);
    expect(b.y).toBe(20);
    expect(b.width).toBe(30);
    expect(b.height).toBe(40);
    expect(e.centerX).toBe(25);
    expect(e.centerY).toBe(40);
  });

  test("destroy() emits onDestroy once", () => {
    const e = new Entity();
    let fired = 0;
    e.onDestroy.add(() => fired++);
    e.destroy();
    expect(fired).toBe(1);
  });
});
