import { describe, expect, test } from "bun:test";
import type { InputState } from "gamekit";
import { createHarness } from "./harness.js";

const RIGHT: InputState = { up: false, down: false, left: false, right: true };

const DT = 0.05; // client fixed step (matches tickRate 20)

describe("client-side prediction (2b)", () => {
  test("predicted local player tracks authority with no interpolation lag", () => {
    const h = createHarness();
    const a = h.addClient({ predict: true });
    a.client.setLocalInput(RIGHT);

    for (let i = 0; i < 20; i++) {
      h.advance(50);
      a.client.predict(DT); // send input + predict locally
      h.tick(); // server consumes input, moves, broadcasts, client reconciles
    }

    const serverP = h.server.scene.root.children[0];
    const local = a.spawned.get(1)!;
    // Prediction stays locked to authority (no ~100ms interpolation lag).
    expect(Math.abs(local.x - serverP.x)).toBeLessThan(1);
    expect(local.x).toBeGreaterThan(300); // actually moved right
  });

  test("WITHOUT prediction the local player lags authority by the interp delay", () => {
    const h = createHarness();
    const a = h.addClient(); // 2a: interpolate everything, including local

    for (let i = 0; i < 20; i++) {
      h.advance(50);
      a.client.sendInput(RIGHT);
      h.tick();
    }
    a.client.apply();

    const serverP = h.server.scene.root.children[0];
    const local = a.spawned.get(1)!;
    // Local is rendered ~100ms (≈2 ticks ≈ 20px) behind server truth.
    expect(serverP.x - local.x).toBeGreaterThan(10);
  });

  test("reconciliation replays unacknowledged inputs (prediction stays ahead)", () => {
    const h = createHarness();
    const a = h.addClient({ predict: true });

    // One tick to spawn the local entity and sync at the start position.
    h.advance(50);
    a.client.predict(DT);
    h.tick();
    const local = a.spawned.get(1)!;
    const serverP = h.server.scene.root.children[0];

    // Predict three ticks of input WITHOUT the server ticking → 3 inputs queued.
    a.client.setLocalInput(RIGHT);
    h.advance(50);
    a.client.predict(DT);
    h.advance(50);
    a.client.predict(DT);
    h.advance(50);
    a.client.predict(DT);
    const aheadX = local.x;

    // Server processes ONE of the three queued inputs and acks only that seq.
    h.tick();

    // Local is reset to authority, then the 2 still-unacked inputs replay on top:
    // it stays exactly where prediction had it (server agreed with prediction).
    expect(local.x).toBeCloseTo(aheadX, 5);
    // And it is ahead of the authoritative position by the 2 in-flight inputs.
    expect(local.x - serverP.x).toBeCloseTo(20, 0);

    // apply() must NOT drag the predicted local entity back to an interpolated value.
    const beforeApply = local.x;
    a.client.apply();
    expect(local.x).toBe(beforeApply);
  });
});
