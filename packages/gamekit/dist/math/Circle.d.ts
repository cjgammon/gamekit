import { Vec2 } from "./Vec2.js";
import { AABB } from "./AABB.js";
export declare class Circle {
    x: number;
    y: number;
    radius: number;
    constructor(x?: number, y?: number, radius?: number);
    get center(): Vec2;
    get radiusSq(): number;
    overlapsCircle(b: Circle): boolean;
    overlapsAABB(b: AABB): boolean;
    contains(x: number, y: number): boolean;
    containsVec(v: Vec2): boolean;
    /**
     * Returns the minimum translation vector to push this circle out of b.
     * Returns null if no overlap.
     */
    penetrationCircle(b: Circle): Vec2 | null;
    /**
     * Returns the minimum translation vector to push this circle out of an AABB.
     * Returns null if no overlap.
     */
    penetrationAABB(b: AABB): Vec2 | null;
    /** Returns the AABB that tightly bounds this circle. */
    toAABB(): AABB;
    set(x: number, y: number, radius: number): this;
    copyFrom(c: Circle): this;
    clone(): Circle;
    toString(): string;
}
