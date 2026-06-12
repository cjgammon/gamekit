import { describe, expect, test } from "bun:test";
import { Entity, Group, Rng, Scene } from "../../packages/gamekit/src/index.js";

function box(x: number, y: number, w = 10, h = 10): Entity {
  const e = new Entity(x, y);
  e.width = w;
  e.height = h;
  return e;
}

function aabbOverlap(a: Entity, b: Entity): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
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

describe("Scene.hud overlay", () => {
  test("addHud targets the screen-space overlay, not the world root", () => {
    const scene = new Scene();
    scene.add(new Entity());
    scene.addHud(new Entity());
    expect(scene.root.count).toBe(1);
    expect(scene.hud.count).toBe(1);
  });

  test("update sweeps dead hud entities", () => {
    const scene = new Scene();
    const e = scene.addHud(new Entity());
    e.kill();
    scene.update(0.016);
    expect(scene.hud.count).toBe(0);
  });
});

describe("Scene broad-phase (spatial hash) parity", () => {
  test("self-overlap matches the exhaustive O(n²) pairs at any cell size", () => {
    const rng = new Rng(12345);
    const scene = new Scene();
    const g = new Group();
    const boxes: Entity[] = [];
    for (let i = 0; i < 250; i++) {
      const e = box(
        rng.range(0, 500),
        rng.range(0, 500),
        rng.range(4, 24),
        rng.range(4, 24),
      );
      boxes.push(e);
      g.add(e);
    }
    const index = new Map(boxes.map((e, i) => [e, i] as const));

    // Exhaustive reference set of overlapping unordered pairs.
    const expected = new Set<string>();
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (aabbOverlap(boxes[i], boxes[j])) expected.add(`${i},${j}`);
      }
    }
    expect(expected.size).toBeGreaterThan(0); // the scene actually has overlaps

    for (const cell of [16, 64, 128, 1000]) {
      scene.collisionCellSize = cell;
      const got = new Set<string>();
      scene.overlap(g, g, (a, b) => {
        const i = index.get(a)!;
        const j = index.get(b)!;
        got.add(i < j ? `${i},${j}` : `${j},${i}`);
      });
      expect([...got].sort()).toEqual([...expected].sort());
    }
  });

  test("cross-group overlap matches the exhaustive pairs", () => {
    const rng = new Rng(999);
    const scene = new Scene();
    const ga = new Group();
    const gb = new Group();
    const A: Entity[] = [];
    const B: Entity[] = [];
    for (let i = 0; i < 150; i++) {
      const e = box(rng.range(0, 400), rng.range(0, 400), 12, 12);
      A.push(e);
      ga.add(e);
    }
    for (let i = 0; i < 150; i++) {
      const e = box(rng.range(0, 400), rng.range(0, 400), 12, 12);
      B.push(e);
      gb.add(e);
    }
    const ia = new Map(A.map((e, i) => [e, i] as const));
    const ib = new Map(B.map((e, i) => [e, i] as const));

    const expected = new Set<string>();
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < B.length; j++) {
        if (aabbOverlap(A[i], B[j])) expected.add(`${i},${j}`);
      }
    }
    expect(expected.size).toBeGreaterThan(0);

    const got = new Set<string>();
    scene.overlap(ga, gb, (a, b) => got.add(`${ia.get(a)!},${ib.get(b)!}`));
    expect([...got].sort()).toEqual([...expected].sort());
  });
});
