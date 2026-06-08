import { describe, expect, test } from "bun:test";
import { Scene, Timer, TimerManager } from "../../packages/gamekit/src/index.js";

describe("Timer", () => {
  test("fires once after its duration", () => {
    let fired = 0;
    const t = new Timer(1, () => fired++);
    t.update(0.5);
    expect(fired).toBe(0);
    t.update(0.5);
    expect(fired).toBe(1);
    expect(t.finished).toBe(true);
  });

  test("carries remainder across updates and reports progress", () => {
    let fired = 0;
    const t = new Timer(1, () => fired++);
    t.update(0.75);
    expect(t.progress).toBeCloseTo(0.75);
    t.update(0.5); // crosses 1.0, 0.25 carried into next loop (but loops=1 → done)
    expect(fired).toBe(1);
  });

  test("repeats a finite number of loops", () => {
    let fired = 0;
    const t = new Timer(1, () => fired++, 3);
    for (let i = 0; i < 5; i++) t.update(1);
    expect(fired).toBe(3);
    expect(t.finished).toBe(true);
  });

  test("can fire multiple loops within a single large dt", () => {
    let fired = 0;
    const t = new Timer(1, () => fired++, 0); // infinite
    t.update(3.5);
    expect(fired).toBe(3);
    expect(t.finished).toBe(false);
  });

  test("paused timer does not advance", () => {
    let fired = 0;
    const t = new Timer(1, () => fired++);
    t.active = false;
    t.update(2);
    expect(fired).toBe(0);
  });
});

describe("TimerManager", () => {
  test("advances timers and sweeps finished ones", () => {
    const tm = new TimerManager();
    let a = 0;
    let b = 0;
    tm.add(1, () => a++); // fires once → swept
    tm.add(1, () => b++, 0); // infinite → stays
    tm.update(1);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(tm.count).toBe(1); // the one-shot was swept
  });

  test("a timer added inside a callback does not fire the same frame", () => {
    const tm = new TimerManager();
    let inner = 0;
    tm.add(1, () => {
      tm.add(1, () => inner++);
    });
    tm.update(1); // outer fires, schedules inner
    expect(inner).toBe(0);
    tm.update(1); // now inner fires
    expect(inner).toBe(1);
  });
});

describe("Scene timer integration", () => {
  test("scene.addTimer fires via scene.update", () => {
    const scene = new Scene();
    let fired = 0;
    scene.addTimer(0.5, () => fired++);
    scene.update(0.5);
    expect(fired).toBe(1);
  });
});
