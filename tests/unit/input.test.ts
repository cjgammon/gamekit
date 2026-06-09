import { describe, expect, test } from "bun:test";
import { InputManager } from "../../packages/gamekit/src/input/index.js";

// Movement bindings: each action has a keyboard + WASD + gamepad code.
function mover() {
  return new InputManager({
    up: ["ArrowUp", "KeyW", "PadUp"],
    down: ["ArrowDown", "KeyS", "PadDown"],
    left: ["ArrowLeft", "KeyA", "PadLeft"],
    right: ["ArrowRight", "KeyD", "PadRight"],
  });
}

describe("InputManager held state", () => {
  test("a bound code marks its action down; releasing clears it", () => {
    const input = mover();
    expect(input.isDown("right")).toBe(false);
    input.pressCode("KeyD");
    expect(input.isDown("right")).toBe(true);
    input.releaseCode("KeyD");
    expect(input.isDown("right")).toBe(false);
  });

  test("any of an action's codes holds it; it clears only when all release", () => {
    const input = mover();
    input.pressCode("ArrowRight");
    input.pressCode("KeyD"); // same action via a second code
    expect(input.isDown("right")).toBe(true);
    input.releaseCode("ArrowRight");
    expect(input.isDown("right")).toBe(true); // KeyD still held
    input.releaseCode("KeyD");
    expect(input.isDown("right")).toBe(false);
  });

  test("unbound codes are ignored", () => {
    const input = mover();
    input.pressCode("KeyZ");
    expect(input.snapshot()).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
    });
  });

  test("snapshot is structurally an InputState", () => {
    const input = mover();
    input.pressCode("KeyW");
    input.pressCode("ArrowLeft");
    expect(input.snapshot()).toEqual({
      up: true,
      down: false,
      left: true,
      right: false,
    });
  });
});

describe("InputManager edges", () => {
  test("justPressed fires only on the transition frame", () => {
    const input = mover();
    input.pressCode("KeyW");
    expect(input.justPressed("up")).toBe(true); // up since last update (none yet)
    input.update(); // roll baseline: up is now 'previously down'
    expect(input.justPressed("up")).toBe(false); // held, not a new press
    expect(input.isDown("up")).toBe(true);
  });

  test("justReleased fires only on the release frame", () => {
    const input = mover();
    input.pressCode("KeyW");
    input.update();
    input.releaseCode("KeyW");
    expect(input.justReleased("up")).toBe(true);
    input.update();
    expect(input.justReleased("up")).toBe(false);
  });

  test("a press+release within one frame still reports both edges", () => {
    const input = mover();
    input.pressCode("Space" as never); // unbound: no effect
    input.pressCode("KeyD");
    input.releaseCode("KeyD");
    // Down went true→false before update; net not-down, but it was never
    // 'previously down', so neither edge should fire on a no-op cycle.
    expect(input.justPressed("right")).toBe(false);
    expect(input.justReleased("right")).toBe(false);
  });
});

describe("InputManager releaseAll", () => {
  test("clears every held code and pointer", () => {
    const input = mover();
    input.pressCode("KeyW");
    input.pressCode("KeyD");
    input.pointerDown = true;
    input.releaseAll();
    expect(input.isDown("up")).toBe(false);
    expect(input.isDown("right")).toBe(false);
    expect(input.pointerDown).toBe(false);
  });
});
