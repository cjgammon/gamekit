import { describe, expect, test } from "vitest";
import { Mat3 } from "../../packages/gamekit/src/index.js";
import {
  MAT3_STD140_FLOATS,
  packMat3Std140,
} from "../../packages/gamekit/src/render/std140.js";

describe("packMat3Std140", () => {
  test("pads each column to a vec4 slot, preserving column-major order", () => {
    const m = new Mat3();
    // Distinct values per slot to catch any transpose/offset mistake.
    m.values.set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const out = packMat3Std140(m);
    expect(out.length).toBe(MAT3_STD140_FLOATS);
    expect(Array.from(out)).toEqual([1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0]);
  });

  test("identity round-trips with zeroed padding", () => {
    const out = packMat3Std140(Mat3.identity());
    expect(Array.from(out)).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  });

  test("writes into a provided out array and returns it", () => {
    const out = new Float32Array(MAT3_STD140_FLOATS);
    const ret = packMat3Std140(Mat3.translation(10, 20), out);
    expect(ret).toBe(out);
    // Translation lives in the third column (indices 6,7 of the 9-float matrix
    // → out slots 8,9).
    expect(out[8]).toBe(10);
    expect(out[9]).toBe(20);
    expect(out[10]).toBe(1);
  });
});
