import { describe, expect, test } from "vitest";
import { Entity, Group } from "../../packages/gamekit/src/index.js";

/** Entity that records lifecycle/update calls without integrating motion. */
class Spy extends Entity {
  created = 0;
  destroyed = 0;
  fixed = 0;
  updated = 0;

  override create(): void {
    this.created++;
  }
  override fixedUpdate(_dt: number): void {
    this.fixed++; // intentionally skip super — we're counting, not moving
  }
  override update(_dt: number): void {
    this.updated++;
  }
  override destroy(): void {
    this.destroyed++;
    super.destroy();
  }
}

describe("Group membership", () => {
  test("add sets parent and calls create once", () => {
    const g = new Group();
    const child = new Spy();
    g.add(child);
    expect(g.count).toBe(1);
    expect(child.parent).toBe(g);
    expect(child.created).toBe(1);
  });

  test("remove detaches and destroys immediately", () => {
    const g = new Group();
    const child = new Spy();
    g.add(child);
    expect(g.remove(child)).toBe(true);
    expect(g.count).toBe(0);
    expect(child.parent).toBeNull();
    expect(child.destroyed).toBe(1);
    expect(g.remove(child)).toBe(false); // already gone
  });
});

describe("Group update forwarding", () => {
  test("forwards fixedUpdate/update only to active children", () => {
    const g = new Group();
    const a = g.add(new Spy());
    const b = g.add(new Spy());
    b.active = false;

    g.fixedUpdate(0.1);
    g.update(0.1);

    expect(a.fixed).toBe(1);
    expect(a.updated).toBe(1);
    expect(b.fixed).toBe(0);
    expect(b.updated).toBe(0);
  });
});

describe("Group dead-child sweep", () => {
  test("sweeps dead children at the start of update and destroys them", () => {
    const g = new Group();
    const a = g.add(new Spy());
    const b = g.add(new Spy());
    const c = g.add(new Spy());

    b.kill(); // alive = false
    g.update(0.016);

    expect(g.count).toBe(2);
    expect(b.destroyed).toBe(1);
    expect(b.parent).toBeNull();
    // survivors still got their update this frame
    expect(a.updated).toBe(1);
    expect(c.updated).toBe(1);
  });

  test("back-to-front sweep removes multiple dead children safely", () => {
    const g = new Group();
    const spies = [new Spy(), new Spy(), new Spy(), new Spy()];
    spies.forEach((s) => g.add(s));
    spies[0].kill();
    spies[2].kill();

    g.update(0.016);

    expect(g.count).toBe(2);
    expect(g.children).toContain(spies[1]);
    expect(g.children).toContain(spies[3]);
  });
});

describe("Group nesting", () => {
  test("a Group forwards updates into nested groups", () => {
    const root = new Group();
    const inner = new Group();
    const leaf = new Spy();
    inner.add(leaf);
    root.add(inner);

    root.fixedUpdate(0.1);
    root.update(0.1);

    expect(leaf.fixed).toBe(1);
    expect(leaf.updated).toBe(1);
  });
});
