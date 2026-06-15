import { describe, expect, test } from "vitest";
import {
  Entity,
  Group,
  Scene,
  type RenderTransform,
} from "../../packages/gamekit/src/index.js";

function out(): RenderTransform {
  return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
}

describe("Entity render interpolation", () => {
  test("seeds prev = current on construction (no lerp from origin)", () => {
    const e = new Entity(100, 50);
    const t = e.sampleRender(0.5, out());
    expect(t.x).toBe(100);
    expect(t.y).toBe(50);
  });

  test("samples lerp(prev, current, alpha) after a move", () => {
    const e = new Entity(0, 0);
    e.syncPrev(); // prev = (0,0)
    e.x = 10;
    e.y = 20;
    e.rotation = Math.PI;
    expect(e.sampleRender(0, out()).x).toBe(0); // alpha 0 → prev
    const mid = e.sampleRender(0.5, out());
    expect(mid.x).toBe(5);
    expect(mid.y).toBe(10);
    expect(mid.rotation).toBeCloseTo(Math.PI / 2, 6);
    expect(e.sampleRender(1, out()).x).toBe(10); // alpha 1 → current
  });

  test("interpolates scale too", () => {
    const e = new Entity();
    e.scaleX = 1;
    e.scaleY = 1;
    e.syncPrev();
    e.scaleX = 3;
    e.scaleY = 5;
    const t = e.sampleRender(0.5, out());
    expect(t.scaleX).toBe(2);
    expect(t.scaleY).toBe(3);
  });

  test("interpolate=false draws at the current transform, ignoring prev", () => {
    const e = new Entity(0, 0);
    e.interpolate = false;
    e.syncPrev();
    e.x = 10;
    const t = e.sampleRender(0.5, out());
    expect(t.x).toBe(10); // current, not 5
  });

  test("setPosition snaps prev by default (teleport without smear)", () => {
    const e = new Entity(0, 0);
    e.syncPrev();
    e.setPosition(500, 500); // snap = true
    expect(e.sampleRender(0.5, out()).x).toBe(500);
  });

  test("setPosition(snap=false) lets the move interpolate", () => {
    const e = new Entity(0, 0);
    e.syncPrev();
    e.setPosition(100, 0, false);
    expect(e.sampleRender(0.5, out()).x).toBe(50);
  });

  test("sampleRender reuses the provided out object (no allocation)", () => {
    const e = new Entity(1, 2);
    const target = out();
    const returned = e.sampleRender(1, target);
    expect(returned).toBe(target);
  });
});

describe("Group.syncPrev recursion", () => {
  test("snapshots all descendants, including inactive ones", () => {
    const root = new Group();
    const a = new Entity(0, 0);
    const nested = new Group();
    const b = new Entity(0, 0);
    b.active = false; // inactive must still be synced
    nested.add(b);
    root.add(a);
    root.add(nested);

    root.syncPrev();
    a.x = 10;
    b.x = 30;

    expect(a.sampleRender(0.5, out()).x).toBe(5);
    expect(b.sampleRender(0.5, out()).x).toBe(15);
  });
});

describe("Scene fixed step drives interpolation", () => {
  test("a velocity-driven entity interpolates between fixed ticks", () => {
    const scene = new Scene();
    const e = new Entity(0, 0);
    e.velocity.x = 100; // 100 px/s
    scene.add(e);

    scene.fixedUpdate(0.1); // syncPrev (prev=0) then integrate → x=10
    expect(e.x).toBe(10);
    expect(e.prevX).toBe(0);

    // Halfway to the next tick, the renderer would draw at x=5.
    expect(e.sampleRender(0.5, out()).x).toBe(5);

    scene.fixedUpdate(0.1); // prev=10, integrate → x=20
    expect(e.prevX).toBe(10);
    expect(e.sampleRender(0.5, out()).x).toBe(15);
  });

  test("a stationary entity keeps prev == current (no flicker)", () => {
    const scene = new Scene();
    const e = new Entity(42, 42);
    scene.add(e);
    scene.fixedUpdate(0.1);
    scene.fixedUpdate(0.1);
    const t = e.sampleRender(0.3, out());
    expect(t.x).toBe(42);
    expect(t.y).toBe(42);
  });
});
