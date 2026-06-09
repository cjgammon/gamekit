export class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    // ---- Factories ----
    static zero() {
        return new Vec2(0, 0);
    }
    static one() {
        return new Vec2(1, 1);
    }
    static up() {
        return new Vec2(0, -1);
    }
    static down() {
        return new Vec2(0, 1);
    }
    static left() {
        return new Vec2(-1, 0);
    }
    static right() {
        return new Vec2(1, 0);
    }
    static fromAngle(radians) {
        return new Vec2(Math.cos(radians), Math.sin(radians));
    }
    static lerp(a, b, t) {
        return new Vec2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
    }
    // ---- Immutable ops (return new Vec2) ----
    add(v) {
        return new Vec2(this.x + v.x, this.y + v.y);
    }
    sub(v) {
        return new Vec2(this.x - v.x, this.y - v.y);
    }
    scale(s) {
        return new Vec2(this.x * s, this.y * s);
    }
    negate() {
        return new Vec2(-this.x, -this.y);
    }
    perp() {
        return new Vec2(-this.y, this.x);
    }
    clone() {
        return new Vec2(this.x, this.y);
    }
    normalized() {
        const l = this.length();
        return l > 0 ? new Vec2(this.x / l, this.y / l) : Vec2.zero();
    }
    lerp(v, t) {
        return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t);
    }
    // ---- Mutating ops (modify in place, return this for chaining) ----
    // Use these in hot paths to avoid GC pressure.
    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
    copyFrom(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }
    addSelf(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
    subSelf(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }
    scaleSelf(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }
    negateSelf() {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }
    normalizeSelf() {
        const l = this.length();
        if (l > 0) {
            this.x /= l;
            this.y /= l;
        }
        return this;
    }
    lerpSelf(v, t) {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        return this;
    }
    // ---- Pure computations ----
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }
    /** Z-component of the 3D cross product — useful for winding order and signed area. */
    cross(v) {
        return this.x * v.y - this.y * v.x;
    }
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    lengthSq() {
        return this.x * this.x + this.y * this.y;
    }
    distanceTo(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    distanceToSq(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return dx * dx + dy * dy;
    }
    /** Angle of this vector in radians, measured from positive X axis. */
    angle() {
        return Math.atan2(this.y, this.x);
    }
    /** Angle from this point toward another point. */
    angleTo(v) {
        return Math.atan2(v.y - this.y, v.x - this.x);
    }
    equals(v, epsilon = 1e-6) {
        return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon;
    }
    toArray() {
        return [this.x, this.y];
    }
    toString() {
        return `Vec2(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`;
    }
}
