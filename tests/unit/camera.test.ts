import { describe, expect, test } from "bun:test";
import { Camera, Entity, Vec2 } from "../../packages/gamekit/src/index.js";

function entity(x: number, y: number, w = 0, h = 0): Entity {
  const e = new Entity(x, y);
  e.width = w;
  e.height = h;
  return e;
}

describe("Camera coordinate conversion", () => {
  test("the camera center maps to the viewport center and clip origin", () => {
    const cam = new Camera(800, 600).centerOn(100, 50);
    const screen = cam.worldToScreen(new Vec2(100, 50));
    expect(screen.x).toBeCloseTo(400, 5);
    expect(screen.y).toBeCloseTo(300, 5);

    const clip = new Camera(800, 600)
      .centerOn(100, 50)
      .viewProjection()
      .transformPoint(new Vec2(100, 50));
    expect(clip.x).toBeCloseTo(0, 5);
    expect(clip.y).toBeCloseTo(0, 5);
  });

  test("worldToScreen offsets by world delta in screen pixels (y-down)", () => {
    const cam = new Camera(800, 600).centerOn(0, 0);
    const s = cam.worldToScreen(new Vec2(10, 20));
    expect(s.x).toBeCloseTo(410, 5); // 400 + 10
    expect(s.y).toBeCloseTo(320, 5); // 300 + 20
  });

  test("zoom scales world distance into screen pixels", () => {
    const cam = new Camera(800, 600).centerOn(0, 0);
    cam.zoom = 2;
    const s = cam.worldToScreen(new Vec2(10, 0));
    expect(s.x).toBeCloseTo(420, 5); // 400 + 10*2
  });

  test("screenToWorld inverts worldToScreen (with zoom + rotation)", () => {
    const cam = new Camera(640, 480).centerOn(123, -45);
    cam.zoom = 1.5;
    cam.rotation = 0.7;
    const world = new Vec2(200, 75);
    const round = cam.screenToWorld(cam.worldToScreen(world));
    expect(round.x).toBeCloseTo(200, 4);
    expect(round.y).toBeCloseTo(75, 4);
  });

  test("clip-space spans [-1, 1] across the viewport corners", () => {
    const vp = new Camera(800, 600).centerOn(0, 0).viewProjection();
    const topLeft = vp.transformPoint(new Vec2(-400, -300));
    const bottomRight = vp.transformPoint(new Vec2(400, 300));
    expect(topLeft.x).toBeCloseTo(-1, 5);
    expect(topLeft.y).toBeCloseTo(1, 5); // y-up in clip space
    expect(bottomRight.x).toBeCloseTo(1, 5);
    expect(bottomRight.y).toBeCloseTo(-1, 5);
  });
});

describe("Camera follow", () => {
  test("snap follow (lerp 1) centers on the target's center", () => {
    const cam = new Camera(800, 600);
    const target = entity(100, 200, 32, 32);
    cam.follow(target, 1);
    cam.update(1 / 60);
    expect(cam.x).toBeCloseTo(116, 5); // 100 + 16
    expect(cam.y).toBeCloseTo(216, 5); // 200 + 16
  });

  test("lerp follow eases a fraction toward the target each frame", () => {
    const cam = new Camera(800, 600).centerOn(0, 0);
    const target = entity(100, 0);
    cam.follow(target, 0.25);
    cam.update(1 / 60);
    expect(cam.x).toBeCloseTo(25, 5); // 0 + (100-0)*0.25
    cam.update(1 / 60);
    expect(cam.x).toBeCloseTo(43.75, 5); // 25 + (100-25)*0.25
  });

  test("deadzone holds the camera until the target leaves it", () => {
    const cam = new Camera(800, 600).centerOn(0, 0);
    const target = entity(0, 0);
    cam.follow(target, 1);
    cam.deadzone = { x: 50, y: 50 };

    target.x = 40; // still inside the 50px half-extent
    cam.update(1 / 60);
    expect(cam.x).toBeCloseTo(0, 5);

    target.x = 80; // now 80 > 50, camera catches up to keep it at the edge
    cam.update(1 / 60);
    expect(cam.x).toBeCloseTo(30, 5); // 80 - 50
  });
});

describe("Camera bounds", () => {
  test("clamps the center so the viewport stays inside the world", () => {
    const cam = new Camera(800, 600).centerOn(0, 0);
    cam.bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 2000 };
    cam.update(0);
    expect(cam.x).toBeCloseTo(400, 5); // minX + halfW (800/2)
    expect(cam.y).toBeCloseTo(300, 5); // minY + halfH (600/2)

    cam.centerOn(5000, 5000);
    cam.update(0);
    expect(cam.x).toBeCloseTo(1600, 5); // maxX - halfW
    expect(cam.y).toBeCloseTo(1700, 5); // maxY - halfH
  });

  test("centers on a world smaller than the viewport", () => {
    const cam = new Camera(800, 600).centerOn(999, 999);
    cam.bounds = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
    cam.update(0);
    expect(cam.x).toBeCloseTo(100, 5); // (0+200)/2
    expect(cam.y).toBeCloseTo(50, 5); // (0+100)/2
  });
});

describe("Camera shake", () => {
  test("offsets within ±intensity, decays, and ends cleanly", () => {
    const cam = new Camera(800, 600).centerOn(0, 0);
    cam.random = () => 1; // max positive offset
    cam.shake(10, 1);
    expect(cam.shaking).toBe(true);

    cam.advanceShake(0.5); // half-way: decay factor ~0.5
    const s = cam.worldToScreen(new Vec2(0, 0));
    // Center shoved +intensity*decay (=+5); a fixed world point therefore
    // shifts the opposite way on screen: 400 + (0 - 5) = 395.
    expect(s.x).toBeCloseTo(400 - 10 * 0.5, 5);

    cam.advanceShake(0.6); // pushes time past duration
    expect(cam.shaking).toBe(false);
    const after = cam.worldToScreen(new Vec2(0, 0));
    expect(after.x).toBeCloseTo(400, 5); // offset cleared
  });

  test("shake offset does not move the logical center", () => {
    const cam = new Camera(800, 600).centerOn(42, 42);
    cam.random = () => 1;
    cam.shake(5, 1);
    cam.advanceShake(0.1);
    expect(cam.x).toBe(42); // x/y are the stable center; shake is view-only
    expect(cam.y).toBe(42);
  });
});

describe("Camera render interpolation", () => {
  test("viewProjection(alpha) interpolates the center between fixed ticks", () => {
    const cam = new Camera(800, 600).centerOn(0, 0);
    cam.syncPrev(); // prev = (0,0)
    cam.x = 100; // current center after a tick's follow

    // alpha 0 → prev center: world (0,0) sits at the viewport center.
    expect(cam.view(0).transformPoint(new Vec2(0, 0)).x).toBeCloseTo(400, 5);
    // alpha 0.5 → center at x=50, so world (0,0) is 50px left of viewport center.
    expect(cam.view(0.5).transformPoint(new Vec2(0, 0)).x).toBeCloseTo(350, 5);
    // alpha 1 → current center at x=100.
    expect(cam.view(1).transformPoint(new Vec2(0, 0)).x).toBeCloseTo(300, 5);
  });

  test("fixed-step follow + interpolation keeps a moving target framed smoothly", () => {
    const cam = new Camera(800, 600).centerOn(0, 0);
    const target = entity(0, 0);
    cam.follow(target, 1); // snap follow

    target.x = 100; // target jumped this tick
    cam.update(0.05); // prev=0, follow → center=100
    expect(cam.prevX).toBe(0);
    expect(cam.x).toBe(100);
    // Mid-frame the camera is halfway, matching how a sampled entity would lerp.
    expect(cam.view(0.5).transformPoint(new Vec2(50, 0)).x).toBeCloseTo(400, 5);
  });
});
