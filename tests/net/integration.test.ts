import { describe, expect, test } from "bun:test";
import type { InputState } from "@cjgammon/gamekit";
import { createHarness } from "./harness.js";

const RIGHT: InputState = { up: false, down: false, left: false, right: true };
const IDLE: InputState = { up: false, down: false, left: false, right: false };

/** Run `ticks` server ticks at 50ms each, sending `input` from `clientId` each tick. */
function drive(
  h: ReturnType<typeof createHarness>,
  ticks: number,
  send?: { client: { client: { sendInput(i: InputState): void } }; input: InputState },
): void {
  for (let i = 0; i < ticks; i++) {
    h.advance(50);
    if (send) send.client.client.sendInput(send.input);
    h.tick();
  }
}

describe("welcome + identity", () => {
  test("each client is assigned a distinct NetId and flags its own entity", () => {
    const h = createHarness();
    const a = h.addClient();
    const b = h.addClient();
    expect(a.client.you).toBe(1);
    expect(b.client.you).toBe(2);
    expect(a.client.isLocal(1)).toBe(true);
    expect(a.client.isLocal(2)).toBe(false);
    expect(b.client.isLocal(2)).toBe(true);
  });
});

describe("visibility", () => {
  test("both clients see both player entities after a tick", () => {
    const h = createHarness();
    const a = h.addClient();
    const b = h.addClient();
    drive(h, 1);
    a.client.apply();
    b.client.apply();
    expect(a.spawned.has(1)).toBe(true);
    expect(a.spawned.has(2)).toBe(true);
    expect(b.spawned.has(1)).toBe(true);
    expect(b.spawned.has(2)).toBe(true);
  });
});

describe("convergence", () => {
  test("clients converge to the server's authoritative position", () => {
    const h = createHarness();
    const a = h.addClient();
    const b = h.addClient();

    drive(h, 30, { client: a, input: RIGHT });
    a.client.apply();
    b.client.apply();

    const serverPlayer1 = h.server.scene.root.children[0]; // A's player
    const ea = a.spawned.get(1)!;
    const eb = b.spawned.get(1)!;

    // Both clients interpolate the same snapshots → identical view.
    expect(ea.x).toBeCloseTo(eb.x, 5);
    // Within interpolation lag (~2 ticks ≈ 20px) of server truth.
    expect(Math.abs(ea.x - serverPlayer1.x)).toBeLessThanOrEqual(30);
    // The player actually moved right from its 110 spawn x.
    expect(ea.x).toBeGreaterThan(300);
  });
});

describe("input routing", () => {
  test("a client's input moves only its own server entity", () => {
    const h = createHarness();
    const a = h.addClient();
    h.addClient(); // B, idle

    drive(h, 20, { client: a, input: RIGHT });

    const p1 = h.server.scene.root.children[0]; // A
    const p2 = h.server.scene.root.children[1]; // B
    expect(p1.x).toBeGreaterThan(110); // moved
    expect(p2.x).toBeCloseTo(170); // untouched at spawn x
  });
});

describe("lifecycle (presence-based despawn)", () => {
  test("a disconnecting client's entity is removed from peers", () => {
    const h = createHarness();
    const a = h.addClient();
    const b = h.addClient();
    drive(h, 1);
    expect(a.spawned.has(2)).toBe(true);

    b.transport.close(); // B leaves
    drive(h, 1); // server despawns id2, next snapshot omits it
    a.client.apply();

    expect(a.spawned.has(2)).toBe(false);
  });
});

describe("interpolation smoothness", () => {
  test("rendered position advances monotonically while the server moves", () => {
    const h = createHarness();
    const a = h.addClient();

    // Build a steady stream of motion.
    drive(h, 20, { client: a, input: RIGHT });

    // Sample the rendered x at three increasing render times within the buffer.
    const e = a.spawned.get(1)!;
    a.client.apply();
    const x0 = e.x;
    h.advance(50);
    h.tick();
    a.client.sendInput(RIGHT);
    a.client.apply();
    const x1 = e.x;
    h.advance(50);
    h.tick();
    a.client.apply();
    const x2 = e.x;

    expect(x1).toBeGreaterThanOrEqual(x0);
    expect(x2).toBeGreaterThanOrEqual(x1);
    // No wild teleport between frames (one tick of motion ≈ 10px).
    expect(x2 - x0).toBeLessThan(60);
  });
});
