import { describe, expect, test } from "bun:test";
import { Game, Scene } from "../../packages/gamekit/src/index.js";

/** Scene that counts how often the loop drives it. */
class CountScene extends Scene {
  fixedCount = 0;
  updateCount = 0;
  created = 0;

  override create(): void {
    this.created++;
  }
  override fixedUpdate(dt: number): void {
    this.fixedCount++;
    super.fixedUpdate(dt);
  }
  override update(dt: number): void {
    this.updateCount++;
    super.update(dt);
  }
}

/** Game subclass exposing the protected render alpha. */
class TestGame extends Game {
  alphas: number[] = [];
  protected override render(alpha: number): void {
    this.alphas.push(alpha);
  }
}

// tickRate 8 → fixedStep 0.125 (binary-exact: no float drift in the loop)
function freshGame(): { game: TestGame; scene: CountScene } {
  const game = new TestGame({ width: 320, height: 240, tickRate: 8 });
  const scene = new CountScene();
  game.switchScene(scene);
  return { game, scene };
}

describe("Game config", () => {
  test("derives fixedStep from tickRate (default 20)", () => {
    expect(new Game({ width: 1, height: 1 }).fixedStep).toBeCloseTo(0.05);
    expect(new Game({ width: 1, height: 1, tickRate: 8 }).fixedStep).toBe(0.125);
  });
});

describe("Game.step accumulator", () => {
  test("runs one fixedUpdate per whole fixedStep", () => {
    const { game, scene } = freshGame();
    game.step(0.125);
    expect(scene.fixedCount).toBe(1);
    expect(game.accumulator).toBeCloseTo(0);
  });

  test("runs fixedUpdate multiple times and keeps the remainder", () => {
    const { game, scene } = freshGame();
    game.step(0.1875); // 1.5 steps → 1 fixedUpdate, 0.0625 left over
    expect(scene.fixedCount).toBe(1);
    expect(game.accumulator).toBeCloseTo(0.0625);

    game.step(0.0625); // now 0.125 banked → 1 more
    expect(scene.fixedCount).toBe(2);
    expect(game.accumulator).toBeCloseTo(0);
  });

  test("update runs exactly once per step regardless of fixed steps", () => {
    const { game, scene } = freshGame();
    game.step(0.25); // 2 fixedUpdates (at the clamp ceiling)...
    expect(scene.fixedCount).toBe(2);
    expect(scene.updateCount).toBe(1); // ...but a single update
  });

  test("clamps a long stall to MAX_FRAME_DT (no spiral of death)", () => {
    const { game, scene } = freshGame();
    game.step(10); // clamped to 0.25 → exactly 2 fixed steps, not 80
    expect(scene.fixedCount).toBe(2);
  });
});

describe("Game scene management", () => {
  test("promotes the pending scene on first step and calls create once", () => {
    const { game, scene } = freshGame();
    expect(scene.created).toBe(0); // not created until the loop runs
    game.step(0.125);
    expect(game.currentScene).toBe(scene);
    expect(scene.created).toBe(1);
    expect(game.pendingScene).toBeNull();
  });

  test("step is a no-op with no scene", () => {
    const game = new TestGame({ width: 1, height: 1, tickRate: 8 });
    expect(() => game.step(0.125)).not.toThrow();
    expect(game.currentScene).toBeNull();
  });
});

describe("Game render alpha", () => {
  test("passes accumulator / fixedStep as the interpolation factor", () => {
    const { game } = freshGame();
    game.step(0.1875); // remainder 0.0625 of a 0.125 step → alpha 0.5
    expect(game.alphas).toHaveLength(1);
    expect(game.alphas[0]).toBeCloseTo(0.5);
  });
});
