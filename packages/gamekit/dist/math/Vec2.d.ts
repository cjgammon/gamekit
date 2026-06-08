export declare class Vec2 {
    x: number;
    y: number;
    constructor(x?: number, y?: number);
    static zero(): Vec2;
    static one(): Vec2;
    static up(): Vec2;
    static down(): Vec2;
    static left(): Vec2;
    static right(): Vec2;
    static fromAngle(radians: number): Vec2;
    static lerp(a: Vec2, b: Vec2, t: number): Vec2;
    add(v: Vec2): Vec2;
    sub(v: Vec2): Vec2;
    scale(s: number): Vec2;
    negate(): Vec2;
    perp(): Vec2;
    clone(): Vec2;
    normalized(): Vec2;
    lerp(v: Vec2, t: number): Vec2;
    set(x: number, y: number): this;
    copyFrom(v: Vec2): this;
    addSelf(v: Vec2): this;
    subSelf(v: Vec2): this;
    scaleSelf(s: number): this;
    negateSelf(): this;
    normalizeSelf(): this;
    lerpSelf(v: Vec2, t: number): this;
    dot(v: Vec2): number;
    /** Z-component of the 3D cross product — useful for winding order and signed area. */
    cross(v: Vec2): number;
    length(): number;
    lengthSq(): number;
    distanceTo(v: Vec2): number;
    distanceToSq(v: Vec2): number;
    /** Angle of this vector in radians, measured from positive X axis. */
    angle(): number;
    /** Angle from this point toward another point. */
    angleTo(v: Vec2): number;
    equals(v: Vec2, epsilon?: number): boolean;
    toArray(): [number, number];
    toString(): string;
}
