import { Vec2 } from "./Vec2.js";
/**
 * Axis-Aligned Bounding Box.
 * x, y describe the top-left corner. width and height extend right and down.
 */
export class AABB {
    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    // ---- Factories ----
    static fromCenter(cx, cy, width, height) {
        return new AABB(cx - width * 0.5, cy - height * 0.5, width, height);
    }
    static fromPoints(x1, y1, x2, y2) {
        const x = Math.min(x1, x2);
        const y = Math.min(y1, y2);
        return new AABB(x, y, Math.abs(x2 - x1), Math.abs(y2 - y1));
    }
    // ---- Accessors ----
    get left() {
        return this.x;
    }
    get right() {
        return this.x + this.width;
    }
    get top() {
        return this.y;
    }
    get bottom() {
        return this.y + this.height;
    }
    get centerX() {
        return this.x + this.width * 0.5;
    }
    get centerY() {
        return this.y + this.height * 0.5;
    }
    get center() {
        return new Vec2(this.centerX, this.centerY);
    }
    // ---- Tests ----
    overlaps(b) {
        return (this.x < b.x + b.width &&
            this.x + this.width > b.x &&
            this.y < b.y + b.height &&
            this.y + this.height > b.y);
    }
    contains(x, y) {
        return (x >= this.x &&
            x < this.x + this.width &&
            y >= this.y &&
            y < this.y + this.height);
    }
    containsVec(v) {
        return this.contains(v.x, v.y);
    }
    containsAABB(b) {
        return (b.x >= this.x &&
            b.right <= this.right &&
            b.y >= this.y &&
            b.bottom <= this.bottom);
    }
    // ---- Collision ----
    /**
     * Returns the intersection rectangle, or null if no overlap.
     */
    intersection(b) {
        if (!this.overlaps(b))
            return null;
        const x = Math.max(this.x, b.x);
        const y = Math.max(this.y, b.y);
        return new AABB(x, y, Math.min(this.right, b.right) - x, Math.min(this.bottom, b.bottom) - y);
    }
    /**
     * Returns the minimum translation vector to push this AABB out of b.
     * The MTV points from b toward this.
     */
    penetration(b) {
        const dx = this.centerX - b.centerX;
        const dy = this.centerY - b.centerY;
        const overlapX = (this.width + b.width) * 0.5 - Math.abs(dx);
        const overlapY = (this.height + b.height) * 0.5 - Math.abs(dy);
        if (overlapX < overlapY) {
            return new Vec2(dx < 0 ? -overlapX : overlapX, 0);
        }
        else {
            return new Vec2(0, dy < 0 ? -overlapY : overlapY);
        }
    }
    // ---- Mutation ----
    set(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        return this;
    }
    copyFrom(b) {
        this.x = b.x;
        this.y = b.y;
        this.width = b.width;
        this.height = b.height;
        return this;
    }
    translate(dx, dy) {
        this.x += dx;
        this.y += dy;
        return this;
    }
    // ---- Immutable ops ----
    /** Returns a new AABB expanded symmetrically by amount on all sides. */
    expand(amount) {
        return new AABB(this.x - amount, this.y - amount, this.width + amount * 2, this.height + amount * 2);
    }
    /** Returns the smallest AABB that contains both this and b. */
    union(b) {
        const x = Math.min(this.x, b.x);
        const y = Math.min(this.y, b.y);
        return new AABB(x, y, Math.max(this.right, b.right) - x, Math.max(this.bottom, b.bottom) - y);
    }
    clone() {
        return new AABB(this.x, this.y, this.width, this.height);
    }
    toString() {
        return `AABB(${this.x}, ${this.y}, ${this.width}x${this.height})`;
    }
}
