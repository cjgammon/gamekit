import { Vec2 } from "./Vec2.js";

/**
 * Column-major 3x3 matrix for 2D transforms.
 * Stored as a Float32Array so it can be uploaded to the GPU without copying.
 *
 * Layout (indices):
 *   [0]  [3]  [6]
 *   [1]  [4]  [7]
 *   [2]  [5]  [8]
 *
 * Which represents:
 *   [sx*cos  -sy*sin   tx]
 *   [sx*sin   sy*cos   ty]
 *   [0        0         1]
 */
export class Mat3 {
  readonly values: Float32Array;

  constructor() {
    this.values = new Float32Array(9);
    this.identity();
  }

  // ---- Factories ----

  static identity(): Mat3 {
    return new Mat3(); // constructor sets identity
  }

  static translation(x: number, y: number): Mat3 {
    const m = new Mat3();
    m.values[6] = x;
    m.values[7] = y;
    return m;
  }

  static rotation(radians: number): Mat3 {
    const m = new Mat3();
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    m.values[0] = c;
    m.values[3] = -s;
    m.values[1] = s;
    m.values[4] = c;
    return m;
  }

  static scaling(x: number, y: number): Mat3 {
    const m = new Mat3();
    m.values[0] = x;
    m.values[4] = y;
    return m;
  }

  /** Compose a translation + rotation + scale matrix in one shot (avoids intermediate allocations). */
  static trs(
    tx: number,
    ty: number,
    radians: number,
    sx: number,
    sy: number,
  ): Mat3 {
    const m = new Mat3();
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const v = m.values;
    v[0] = c * sx;
    v[3] = -s * sy;
    v[6] = tx;
    v[1] = s * sx;
    v[4] = c * sy;
    v[7] = ty;
    v[2] = 0;
    v[5] = 0;
    v[8] = 1;
    return m;
  }

  /** Orthographic projection matrix — maps world coords into clip space [-1, 1]. */
  static ortho(width: number, height: number): Mat3 {
    const m = new Mat3();
    const v = m.values;
    v[0] = 2 / width;
    v[3] = 0;
    v[6] = -1;
    v[1] = 0;
    v[4] = -2 / height;
    v[7] = 1;
    v[2] = 0;
    v[5] = 0;
    v[8] = 1;
    return m;
  }

  // ---- Ops ----

  identity(): this {
    const v = this.values;
    v[0] = 1;
    v[3] = 0;
    v[6] = 0;
    v[1] = 0;
    v[4] = 1;
    v[7] = 0;
    v[2] = 0;
    v[5] = 0;
    v[8] = 1;
    return this;
  }

  multiply(b: Mat3): Mat3 {
    const result = new Mat3();
    const a = this.values;
    const bv = b.values;
    const rv = result.values;
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        rv[col * 3 + row] =
          a[0 * 3 + row] * bv[col * 3 + 0] +
          a[1 * 3 + row] * bv[col * 3 + 1] +
          a[2 * 3 + row] * bv[col * 3 + 2];
      }
    }
    return result;
  }

  multiplySelf(b: Mat3): this {
    const a = this.values.slice(); // temp copy of self
    const bv = b.values;
    const rv = this.values;
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        rv[col * 3 + row] =
          a[0 * 3 + row] * bv[col * 3 + 0] +
          a[1 * 3 + row] * bv[col * 3 + 1] +
          a[2 * 3 + row] * bv[col * 3 + 2];
      }
    }
    return this;
  }

  /** Transform a point (applies translation). */
  transformPoint(v: Vec2): Vec2 {
    const m = this.values;
    return new Vec2(
      m[0] * v.x + m[3] * v.y + m[6],
      m[1] * v.x + m[4] * v.y + m[7],
    );
  }

  /** Transform a direction vector (ignores translation). */
  transformDirection(v: Vec2): Vec2 {
    const m = this.values;
    return new Vec2(m[0] * v.x + m[3] * v.y, m[1] * v.x + m[4] * v.y);
  }

  clone(): Mat3 {
    const m = new Mat3();
    m.values.set(this.values);
    return m;
  }

  copyFrom(other: Mat3): this {
    this.values.set(other.values);
    return this;
  }

  toString(): string {
    const v = this.values;
    return [
      `[${v[0].toFixed(3)}, ${v[3].toFixed(3)}, ${v[6].toFixed(3)}]`,
      `[${v[1].toFixed(3)}, ${v[4].toFixed(3)}, ${v[7].toFixed(3)}]`,
      `[${v[2].toFixed(3)}, ${v[5].toFixed(3)}, ${v[8].toFixed(3)}]`,
    ].join("\n");
  }
}
