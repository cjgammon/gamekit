import { describe, expect, test } from "bun:test";
import { Entity, Group, Scene } from "../../packages/gamekit/src/index.js";

function box(x: number, y: number, w = 10, h = 10): Entity {
  const e = new Entity(x, y);
  e.width = w;
  e.height = h;
  return e;
}

describe("Scene.overlap", () => {
  test("detects an overlapping pair and invokes the callback", () => {
    const scene = new Scene();
    const a = box(0, 0);
    const b = box(5, 5);
    let pairs = 0;
    expect(scene.overlap(a, b, () => pairs++)).toBe(true);
    expect(pairs).toBe(1);
  });

  test("returns false for disjoint boxes", () => {
    const scene = new Scene();
    expect(scene.overlap(box(0, 0), box(100, 100))).toBe(false);
  });

  test("self-overlap of a group counts each unordered pair once", () => {
    const scene = new Scene();
    const g = new Group();
    g.add(box(0, 0));
    g.add(box(1, 1));
    g.add(box(2, 2)); // all three mutually overlap
    let pairs = 0;
    scene.overlap(g, g, () => pairs++);
    expect(pairs).toBe(3); // (0,1) (0,2) (1,2)
  });

  test("ignores dead entities", () => {
    const scene = new Scene();
    const a = box(0, 0);
    const b = box(5, 5);
    b.kill();
    expect(scene.overlap(a, b)).toBe(false);
  });
});

describe("Scene.collide", () => {
  test("separates along the least-penetration axis and zeroes that velocity", () => {
    const scene = new Scene();
    const a = box(0, 0); // overlaps b by 2px on x
    const b = box(8, 0);
    a.velocity.set(5, 0);
    b.velocity.set(-5, 0);

    expect(scene.collide(a, b)).toBe(true);

    // MTV is (-2, 0); split 50/50 → a left 1px, b right 1px
    expect(a.x).toBeCloseTo(-1);
    expect(b.x).toBeCloseTo(9);
    // no longer overlapping after separation
    expect(scene.overlap(a, b)).toBe(false);
    // contact-normal velocity cleared on both
    expect(a.velocity.x).toBe(0);
    expect(b.velocity.x).toBe(0);
  });

  test("works across two groups (containers flattened to leaves)", () => {
    const scene = new Scene();
    const ga = new Group();
    const gb = new Group();
    ga.add(box(0, 0));
    gb.add(box(8, 0));
    let hits = 0;
    expect(scene.collide(ga, gb, () => hits++)).toBe(true);
    expect(hits).toBe(1);
  });
});
