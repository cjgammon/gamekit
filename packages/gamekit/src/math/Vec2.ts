export class Vec2 {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  // ---- Factories ----

  static zero(): Vec2 {
    return new Vec2(0, 0);
  }
  static one(): Vec2 {
    return new Vec2(1, 1);
  }
  static up(): Vec2 {
    return new Vec2(0, -1);
  }
  static down(): Vec2 {
    return new Vec2(0, 1);
  }
  static left(): Vec2 {
    return new Vec2(-1, 0);
  }
  static right(): Vec2 {
    return new Vec2(1, 0);
  }

  static fromAngle(radians: number): Vec2 {
    return new Vec2(Math.cos(radians), Math.sin(radians));
  }

  static lerp(a: Vec2, b: Vec2, t: number): Vec2 {
    return new Vec2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  }

  // ---- Immutable ops (return new Vec2) ----

  add(v: Vec2): Vec2 {
    return new Vec2(this.x + v.x, this.y + v.y);
  }
  sub(v: Vec2): Vec2 {
    return new Vec2(this.x - v.x, this.y - v.y);
  }
  scale(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s);
  }
  negate(): Vec2 {
    return new Vec2(-this.x, -this.y);
  }
  perp(): Vec2 {
    return new Vec2(-this.y, this.x);
  }
  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  normalized(): Vec2 {
    const l = this.length();
    return l > 0 ? new Vec2(this.x / l, this.y / l) : Vec2.zero();
  }

  lerp(v: Vec2, t: number): Vec2 {
    return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t);
  }

  // ---- Mutating ops (modify in place, return this for chaining) ----
  // Use these in hot paths to avoid GC pressure.

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  copyFrom(v: Vec2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  addSelf(v: Vec2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  subSelf(v: Vec2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  scaleSelf(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }
  negateSelf(): this {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }

  normalizeSelf(): this {
    const l = this.length();
    if (l > 0) {
      this.x /= l;
      this.y /= l;
    }
    return this;
  }

  lerpSelf(v: Vec2, t: number): this {
    this.x += (v.x - this.x) * t;
    this.y += (v.y - this.y) * t;
    return this;
  }

  // ---- Pure computations ----

  dot(v: Vec2): number {
    return this.x * v.x + this.y * v.y;
  }

  /** Z-component of the 3D cross product — useful for winding order and signed area. */
  cross(v: Vec2): number {
    return this.x * v.y - this.y * v.x;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  distanceTo(v: Vec2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distanceToSq(v: Vec2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  /** Angle of this vector in radians, measured from positive X axis. */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /** Angle from this point toward another point. */
  angleTo(v: Vec2): number {
    return Math.atan2(v.y - this.y, v.x - this.x);
  }

  equals(v: Vec2, epsilon = 1e-6): boolean {
    return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon;
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }
  toString(): string {
    return `Vec2(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`;
  }
}
