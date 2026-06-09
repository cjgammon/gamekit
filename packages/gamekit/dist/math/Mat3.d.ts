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
export declare class Mat3 {
    readonly values: Float32Array;
    constructor();
    static identity(): Mat3;
    static translation(x: number, y: number): Mat3;
    static rotation(radians: number): Mat3;
    static scaling(x: number, y: number): Mat3;
    /** Compose a translation + rotation + scale matrix in one shot (avoids intermediate allocations). */
    static trs(tx: number, ty: number, radians: number, sx: number, sy: number): Mat3;
    /** Orthographic projection matrix — maps world coords into clip space [-1, 1]. */
    static ortho(width: number, height: number): Mat3;
    identity(): this;
    multiply(b: Mat3): Mat3;
    multiplySelf(b: Mat3): this;
    /** Transform a point (applies translation). */
    transformPoint(v: Vec2): Vec2;
    /** Transform a direction vector (ignores translation). */
    transformDirection(v: Vec2): Vec2;
    clone(): Mat3;
    copyFrom(other: Mat3): this;
    toString(): string;
}
