import { describe, expect, test } from "bun:test";
import { Entity, Tilemap } from "../../packages/gamekit/src/index.js";

// 4×3 grid of 16px tiles. Row 2 is a solid floor; one wall at (2,1).
//   . . . .
//   . . # .
//   # # # #
function floorMap(): Tilemap {
  // prettier-ignore
  const data = [
    0, 0, 0, 0,
    0, 0, 1, 0,
    1, 1, 1, 1,
  ];
  return new Tilemap(4, 3, 16, 16, data);
}

function box(x: number, y: number, w = 16, h = 16): Entity {
  const e = new Entity(x, y);
  e.width = w;
  e.height = h;
  return e;
}

describe("Tilemap grid", () => {
  test("sizes itself and reads back tiles", () => {
    const m = floorMap();
    expect(m.width).toBe(64);
    expect(m.height).toBe(48);
    expect(m.getTile(0, 0)).toBe(0);
    expect(m.getTile(2, 1)).toBe(1);
    expect(m.getTile(3, 2)).toBe(1);
  });

  test("out-of-bounds reads return 0; writes are ignored", () => {
    const m = floorMap();
    expect(m.getTile(-1, 0)).toBe(0);
    expect(m.getTile(4, 0)).toBe(0);
    m.setTile(99, 99, 5); // no-op
    expect(m.getTile(99, 99)).toBe(0);
  });

  test("world↔tile uses the map offset", () => {
    const m = floorMap();
    m.x = 100;
    m.y = 200;
    expect(m.worldToCol(100)).toBe(0);
    expect(m.worldToCol(133)).toBe(2); // (133-100)/16 = 2.06 → 2
    expect(m.getTileAtWorld(100 + 2 * 16, 200 + 1 * 16)).toBe(1); // the wall
  });
});

describe("Tilemap solidity", () => {
  test("non-zero tiles are solid by default; overrides apply", () => {
    const m = floorMap();
    expect(m.isSolid(0)).toBe(false);
    expect(m.isSolid(1)).toBe(true);
    m.setTileCollision(1, false); // make tile 1 pass-through
    expect(m.isSolid(1)).toBe(false);
    m.setTileCollision(0, true); // and tile 0 solid
    expect(m.isSolid(0)).toBe(true);
  });
});

describe("Tilemap collision", () => {
  test("pushes an entity up out of the floor and zeroes downward velocity", () => {
    const m = floorMap();
    // Floor row 2 top is y=32. A 16px box falling from above overlaps it from
    // the top (y=24 → bottom 40, 8px into the floor); least-penetration lifts it.
    const e = box(0, 24);
    e.velocity.y = 50;
    const hit = m.collide(e);
    expect(hit).toBe(true);
    expect(e.y).toBe(16); // lifted so its bottom rests on the floor top (32)
    expect(e.velocity.y).toBe(0);
  });

  test("stops an entity at a wall and zeroes horizontal velocity", () => {
    const m = floorMap();
    // Wall at col 2 → x [32,48). Box moving right, overlapping its left edge.
    const e = box(20, 16); // row 1, overlapping the wall column
    e.velocity.x = 100;
    const hit = m.collide(e);
    expect(hit).toBe(true);
    expect(e.x).toBe(16); // pushed left to sit against the wall (32 - 16)
    expect(e.velocity.x).toBe(0);
  });

  test("no collision in open space", () => {
    const m = floorMap();
    const e = box(0, 0); // top-left empty cell
    expect(m.collide(e)).toBe(false);
  });

  test("only tiles under the entity are considered (returns false far away)", () => {
    const m = floorMap();
    const e = box(0, 0, 8, 8);
    expect(m.collide(e)).toBe(false);
  });
});

describe("Tilemap.forEachTileIn", () => {
  test("visits only non-empty tiles intersecting the rect", () => {
    const m = floorMap();
    const seen: Array<[number, number, number]> = [];
    // Rect covering the bottom two rows only.
    m.forEachTileIn(0, 16, 63, 47, (col, row, index) => {
      seen.push([col, row, index]);
    });
    // Expect the wall (2,1) + the four floor tiles (0..3, 2); no empties.
    expect(seen).toContainEqual([2, 1, 1]);
    expect(seen).toContainEqual([0, 2, 1]);
    expect(seen).toContainEqual([3, 2, 1]);
    expect(seen.length).toBe(5);
    expect(seen.every(([, , index]) => index !== 0)).toBe(true);
  });

  test("culls tiles outside the rect", () => {
    const m = floorMap();
    let count = 0;
    // Rect over the top-left empty cell only.
    m.forEachTileIn(0, 0, 15, 15, () => count++);
    expect(count).toBe(0);
  });
});
