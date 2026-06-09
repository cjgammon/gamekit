import { Vec2 } from "./Vec2.js";
import { AABB } from "./AABB.js";

export class Circle {
  x: number;
  y: number;
  radius: number;

  constructor(x = 0, y = 0, radius = 0) {
    this.x = x;
    this.y = y;
    this.radius = radius;
  }

  // ---- Accessors ----

  get center(): Vec2 {
    return new Vec2(this.x, this.y);
  }
  get radiusSq(): number {
    return this.radius * this.radius;
  }

  // ---- Tests ----

  overlapsCircle(b: Circle): boolean {
    const dx = this.x - b.x;
    const dy = this.y - b.y;
    const r = this.radius + b.radius;
    return dx * dx + dy * dy < r * r;
  }

  overlapsAABB(b: AABB): boolean {
    // Find the closest point on the AABB to the circle center.
    const cx = Math.max(b.x, Math.min(this.x, b.right));
    const cy = Math.max(b.y, Math.min(this.y, b.bottom));
    const dx = this.x - cx;
    const dy = this.y - cy;
    return dx * dx + dy * dy < this.radius * this.radius;
  }

  contains(x: number, y: number): boolean {
    const dx = this.x - x;
    const dy = this.y - y;
    return dx * dx + dy * dy < this.radius * this.radius;
  }

  containsVec(v: Vec2): boolean {
    return this.contains(v.x, v.y);
  }

  // ---- Collision ----

  /**
   * Returns the minimum translation vector to push this circle out of b.
   * Returns null if no overlap.
   */
  penetrationCircle(b: Circle): Vec2 | null {
    const dx = this.x - b.x;
    const dy = this.y - b.y;
    const distSq = dx * dx + dy * dy;
    const r = this.radius + b.radius;
    if (distSq >= r * r) return null;
    const dist = Math.sqrt(distSq);
    const depth = r - dist;
    // Coincident circles — push arbitrarily rightward
    if (dist === 0) return new Vec2(depth, 0);
    return new Vec2((dx / dist) * depth, (dy / dist) * depth);
  }

  /**
   * Returns the minimum translation vector to push this circle out of an AABB.
   * Returns null if no overlap.
   */
  penetrationAABB(b: AABB): Vec2 | null {
    if (!this.overlapsAABB(b)) return null;
    const cx = Math.max(b.x, Math.min(this.x, b.right));
    const cy = Math.max(b.y, Math.min(this.y, b.bottom));
    const dx = this.x - cx;
    const dy = this.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const depth = this.radius - dist;
    if (dist === 0) return new Vec2(0, -depth); // center inside AABB
    return new Vec2((dx / dist) * depth, (dy / dist) * depth);
  }

  // ---- Conversions ----

  /** Returns the AABB that tightly bounds this circle. */
  toAABB(): AABB {
    return new AABB(
      this.x - this.radius,
      this.y - this.radius,
      this.radius * 2,
      this.radius * 2,
    );
  }

  // ---- Mutation ----

  set(x: number, y: number, radius: number): this {
    this.x = x;
    this.y = y;
    this.radius = radius;
    return this;
  }

  copyFrom(c: Circle): this {
    this.x = c.x;
    this.y = c.y;
    this.radius = c.radius;
    return this;
  }

  clone(): Circle {
    return new Circle(this.x, this.y, this.radius);
  }

  toString(): string {
    return `Circle(${this.x}, ${this.y}, r=${this.radius})`;
  }
}
