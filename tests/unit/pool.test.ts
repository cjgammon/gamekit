import { describe, expect, test } from "bun:test";
import { Entity, Group, Pool } from "../../packages/gamekit/src/index.js";

describe("Pool", () => {
  test("acquire builds a new instance when empty", () => {
    let built = 0;
    const pool = new Pool(() => ({ id: built++ }));
    const a = pool.acquire();
    const b = pool.acquire();
    expect(built).toBe(2);
    expect(a).not.toBe(b);
  });

  test("release then acquire reuses the same instance (no allocation)", () => {
    let built = 0;
    const pool = new Pool(() => ({ id: built++ }));
    const a = pool.acquire();
    pool.release(a);
    const b = pool.acquire();
    expect(b).toBe(a);
    expect(built).toBe(1); // no new allocation
  });

  test("reset scrubs an instance on release", () => {
    const pool = new Pool(
      () => ({ hp: 0 }),
      (item) => (item.hp = 0),
    );
    const a = pool.acquire();
    a.hp = 99;
    pool.release(a);
    expect(a.hp).toBe(0);
    expect(pool.acquire().hp).toBe(0);
  });

  test("prealloc fills the free list up front", () => {
    let built = 0;
    const pool = new Pool(() => ({ id: built++ }), undefined, 3);
    expect(pool.available).toBe(3);
    expect(built).toBe(3);
    pool.acquire();
    expect(pool.available).toBe(2);
  });

  test("clear drops free instances", () => {
    const pool = new Pool(() => ({}), undefined, 2);
    pool.clear();
    expect(pool.available).toBe(0);
  });
});

describe("Group recycling", () => {
  test("a recycling group keeps dead children instead of sweeping them", () => {
    const g = new Group();
    g.recycling = true;
    const e = g.add(new Entity());
    e.kill();
    g.update(0.1); // would normally sweep+destroy
    expect(g.count).toBe(1);
    expect(g.children[0]).toBe(e);
  });

  test("a normal group still sweeps dead children", () => {
    const g = new Group();
    const e = g.add(new Entity());
    e.kill();
    g.update(0.1);
    expect(g.count).toBe(0);
  });

  test("recycle revives a dead child in place rather than allocating", () => {
    const g = new Group();
    g.recycling = true;
    let built = 0;
    const factory = () => {
      built++;
      return new Entity();
    };
    const a = g.recycle(factory); // none dead → builds
    expect(built).toBe(1);
    a!.kill();
    const b = g.recycle(factory); // one dead → reuses, no build
    expect(b).toBe(a);
    expect(b!.alive).toBe(true);
    expect(built).toBe(1);
    expect(g.count).toBe(1);
  });

  test("recycle grows via the factory when no dead slot is free", () => {
    const g = new Group();
    g.recycling = true;
    const a = g.recycle(() => new Entity());
    const b = g.recycle(() => new Entity()); // a still alive → must build
    expect(a).not.toBe(b);
    expect(g.count).toBe(2);
  });

  test("dead children are skipped by update/fixedUpdate while kept", () => {
    const g = new Group();
    g.recycling = true;
    let ticks = 0;
    class Ticker extends Entity {
      override update() {
        ticks++;
      }
    }
    const e = g.add(new Ticker());
    g.update(0.1);
    expect(ticks).toBe(1);
    e.kill();
    g.update(0.1); // kept, but dead → not updated
    expect(ticks).toBe(1);
  });
});
