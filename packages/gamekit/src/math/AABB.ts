import { Vec2 } from "./Vec2.js";

/**
 * Axis-Aligned Bounding Box.
 * x, y describe the top-left corner. width and height extend right and down.
 */
export class AABB {
  x: number;
  y: number;
  width: number;
  height: number;

  constructor(x = 0, y = 0, width = 0, height = 0) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  // ---- Factories ----

  static fromCenter(
    cx: number,
    cy: number,
    width: number,
    height: number,
  ): AABB {
    return new AABB(cx - width * 0.5, cy - height * 0.5, width, height);
  }

  static fromPoints(x1: number, y1: number, x2: number, y2: number): AABB {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    return new AABB(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
  }

  // ---- Accessors ----

  get left(): number {
    return this.x;
  }
  get right(): number {
    return this.x + this.width;
  }
  get top(): number {
    return this.y;
  }
  get bottom(): number {
    return this.y + this.height;
  }
  get centerX(): number {
    return this.x + this.width * 0.5;
  }
  get centerY(): number {
    return this.y + this.height * 0.5;
  }
  get center(): Vec2 {
    return new Vec2(this.centerX, this.centerY);
  }

  // ---- Tests ----

  overlaps(b: AABB): boolean {
    return (
      this.x < b.x + b.width &&
      this.x + this.width > b.x &&
      this.y < b.y + b.height &&
      this.y + this.height > b.y
    );
  }

  contains(x: number, y: number): boolean {
    return (
      x >= this.x &&
      x < this.x + this.width &&
      y >= this.y &&
      y < this.y + this.height
    );
  }

  containsVec(v: Vec2): boolean {
    return this.contains(v.x, v.y);
  }

  containsAABB(b: AABB): boolean {
    return (
      b.x >= this.x &&
      b.right <= this.right &&
      b.y >= this.y &&
      b.bottom <= this.bottom
    );
  }

  // ---- Collision ----

  /**
   * Returns the intersection rectangle, or null if no overlap.
   */
  intersection(b: AABB): AABB | null {
    if (!this.overlaps(b)) return null;
    const x = Math.max(this.x, b.x);
    const y = Math.max(this.y, b.y);
    return new AABB(
      x,
      y,
      Math.min(this.right, b.right) - x,
      Math.min(this.bottom, b.bottom) - y,
    );
  }

  /**
   * Returns the minimum translation vector to push this AABB out of b.
   * The MTV points from b toward this.
   */
  penetration(b: AABB): Vec2 {
    const dx = this.centerX - b.centerX;
    const dy = this.centerY - b.centerY;
    const overlapX = (this.width + b.width) * 0.5 - Math.abs(dx);
    const overlapY = (this.height + b.height) * 0.5 - Math.abs(dy);
    if (overlapX < overlapY) {
      return new Vec2(dx < 0 ? -overlapX : overlapX, 0);
    } else {
      return new Vec2(0, dy < 0 ? -overlapY : overlapY);
    }
  }

  // ---- Mutation ----

  set(x: number, y: number, width: number, height: number): this {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    return this;
  }

  copyFrom(b: AABB): this {
    this.x = b.x;
    this.y = b.y;
    this.width = b.width;
    this.height = b.height;
    return this;
  }

  translate(dx: number, dy: number): this {
    this.x += dx;
    this.y += dy;
    return this;
  }

  // ---- Immutable ops ----

  /** Returns a new AABB expanded symmetrically by amount on all sides. */
  expand(amount: number): AABB {
    return new AABB(
      this.x - amount,
      this.y - amount,
      this.width + amount * 2,
      this.height + amount * 2,
    );
  }

  /** Returns the smallest AABB that contains both this and b. */
  union(b: AABB): AABB {
    const x = Math.min(this.x, b.x);
    const y = Math.min(this.y, b.y);
    return new AABB(
      x,
      y,
      Math.max(this.right, b.right) - x,
      Math.max(this.bottom, b.bottom) - y,
    );
  }

  clone(): AABB {
    return new AABB(this.x, this.y, this.width, this.height);
  }

  toString(): string {
    return `AABB(${this.x}, ${this.y}, ${this.width}x${this.height})`;
  }
}
