import { describe, expect, test } from "vitest";
import {
  Ease,
  Entity,
  Scene,
  Tween,
  TweenManager,
} from "../../packages/gamekit/src/index.js";

describe("Ease functions", () => {
  test("all map the endpoints 0→0 and 1→1", () => {
    for (const [name, fn] of Object.entries(Ease)) {
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    }
  });

  test("linear is the identity at the midpoint; quadOut is ahead of it", () => {
    expect(Ease.linear(0.5)).toBeCloseTo(0.5);
    expect(Ease.quadOut(0.5)).toBeGreaterThan(0.5); // ease-out leads early
  });
});

describe("Tween", () => {
  test("interpolates linearly toward the target and finishes", () => {
    const obj = { x: 0 };
    const tw = new Tween(obj, { x: 100 }, 1);
    tw.update(0.5);
    expect(obj.x).toBeCloseTo(50);
    tw.update(0.5);
    expect(obj.x).toBeCloseTo(100);
    expect(tw.finished).toBe(true);
  });

  test("clamps to the exact target on overshoot", () => {
    const obj = { x: 0 };
    const tw = new Tween(obj, { x: 100 }, 1);
    tw.update(5); // way past duration
    expect(obj.x).toBe(100);
    expect(tw.finished).toBe(true);
  });

  test("tweens multiple properties at once", () => {
    const obj = { x: 0, y: 10 };
    const tw = new Tween(obj, { x: 100, y: 20 }, 1);
    tw.update(0.5);
    expect(obj.x).toBeCloseTo(50);
    expect(obj.y).toBeCloseTo(15);
  });

  test("applies the easing function", () => {
    const obj = { x: 0 };
    const tw = new Tween(obj, { x: 100 }, 1, { ease: Ease.quadIn });
    tw.update(0.5); // quadIn(0.5) = 0.25 → 25
    expect(obj.x).toBeCloseTo(25);
  });

  test("delay holds the value, then spills leftover into motion", () => {
    const obj = { x: 0 };
    const tw = new Tween(obj, { x: 100 }, 1, { delay: 0.5 });
    tw.update(0.25);
    expect(obj.x).toBe(0); // still delayed (0.25 of 0.5 delay left)
    tw.update(0.75); // burns 0.25 delay, spills 0.5 into motion → t=0.5
    expect(obj.x).toBeCloseTo(50);
  });

  test("captures `from` at start, not construction", () => {
    const obj = { x: 0 };
    const tw = new Tween(obj, { x: 100 }, 1);
    obj.x = 20; // moved before the tween's first update
    tw.update(0.5); // from should be 20 → 20 + (100-20)*0.5 = 60
    expect(obj.x).toBeCloseTo(60);
  });

  test("fires onComplete once on finish", () => {
    const obj = { x: 0 };
    let done = 0;
    const tw = new Tween(obj, { x: 1 }, 1, { onComplete: () => done++ });
    tw.update(1);
    tw.update(1);
    expect(done).toBe(1);
  });
});

describe("TweenManager", () => {
  test("advances tweens and sweeps finished ones", () => {
    const tm = new TweenManager();
    const obj = { x: 0 };
    tm.add(obj, { x: 10 }, 1);
    expect(tm.count).toBe(1);
    tm.update(1);
    expect(obj.x).toBeCloseTo(10);
    expect(tm.count).toBe(0); // swept after finishing
  });
});

describe("Scene tween integration", () => {
  test("scene.tween drives an Entity property via scene.update", () => {
    const scene = new Scene();
    const e = scene.add(new Entity(0, 0));
    scene.tween(e, { x: 200 }, 1, { ease: Ease.linear });
    scene.update(0.5);
    expect(e.x).toBeCloseTo(100);
  });
});
