import { describe, expect, test } from "vitest";
import { Interpolator, type SnapshotMessage } from "../../packages/gamekit/src/index.js";

function snap(
  t: number,
  ents: Array<{ id: number; x: number; y: number; r: number }>,
): SnapshotMessage {
  return {
    k: "snap",
    tick: 0,
    t,
    you: 0,
    lastSeq: 0,
    ents: ents.map((e) => ({ ...e, t: "p" })),
  };
}

describe("Interpolator", () => {
  test("lerps x/y at the midpoint between two snapshots", () => {
    const it = new Interpolator();
    it.push(snap(0, [{ id: 1, x: 0, y: 0, r: 0 }]));
    it.push(snap(100, [{ id: 1, x: 100, y: 200, r: 0 }]));
    const s = it.sample(1, 50)!;
    expect(s.x).toBeCloseTo(50);
    expect(s.y).toBeCloseTo(100);
  });

  test("clamps to newest when render time is past the buffer (starvation)", () => {
    const it = new Interpolator();
    it.push(snap(0, [{ id: 1, x: 0, y: 0, r: 0 }]));
    it.push(snap(100, [{ id: 1, x: 100, y: 0, r: 0 }]));
    const s = it.sample(1, 500)!;
    expect(s.x).toBeCloseTo(100);
  });

  test("clamps to oldest when render time predates the buffer", () => {
    const it = new Interpolator();
    it.push(snap(100, [{ id: 1, x: 10, y: 0, r: 0 }]));
    it.push(snap(200, [{ id: 1, x: 20, y: 0, r: 0 }]));
    const s = it.sample(1, -50)!;
    expect(s.x).toBeCloseTo(10);
  });

  test("takes the shortest arc across the ±π wrap", () => {
    const it = new Interpolator();
    it.push(snap(0, [{ id: 1, x: 0, y: 0, r: 3.0 }]));
    it.push(snap(100, [{ id: 1, x: 0, y: 0, r: -3.0 }]));
    const s = it.sample(1, 50)!;
    // 3.0 → -3.0 the short way passes through ±π, NOT back through 0.
    expect(Math.abs(s.r)).toBeGreaterThan(3.1);
  });

  test("returns null for an unknown id", () => {
    const it = new Interpolator();
    it.push(snap(0, [{ id: 1, x: 0, y: 0, r: 0 }]));
    expect(it.sample(999, 0)).toBeNull();
  });
});
