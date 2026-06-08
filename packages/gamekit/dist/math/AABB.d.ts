import { Vec2 } from "./Vec2.js";
/**
 * Axis-Aligned Bounding Box.
 * x, y describe the top-left corner. width and height extend right and down.
 */
export declare class AABB {
    x: number;
    y: number;
    width: number;
    height: number;
    constructor(x?: number, y?: number, width?: number, height?: number);
    static fromCenter(cx: number, cy: number, width: number, height: number): AABB;
    static fromPoints(x1: number, y1: number, x2: number, y2: number): AABB;
    get left(): number;
    get right(): number;
    get top(): number;
    get bottom(): number;
    get centerX(): number;
    get centerY(): number;
    get center(): Vec2;
    overlaps(b: AABB): boolean;
    contains(x: number, y: number): boolean;
    containsVec(v: Vec2): boolean;
    containsAABB(b: AABB): boolean;
    /**
     * Returns the intersection rectangle, or null if no overlap.
     */
    intersection(b: AABB): AABB | null;
    /**
     * Returns the minimum translation vector to push this AABB out of b.
     * The MTV points from b toward this.
     */
    penetration(b: AABB): Vec2;
    set(x: number, y: number, width: number, height: number): this;
    copyFrom(b: AABB): this;
    translate(dx: number, dy: number): this;
    /** Returns a new AABB expanded symmetrically by amount on all sides. */
    expand(amount: number): AABB;
    /** Returns the smallest AABB that contains both this and b. */
    union(b: AABB): AABB;
    clone(): AABB;
    toString(): string;
}
