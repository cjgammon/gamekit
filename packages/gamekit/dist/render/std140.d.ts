import type { Mat3 } from "../math/Mat3.js";
/** A padded `mat3x3<f32>` is three columns, each a 16-byte (vec4) slot. */
export declare const MAT3_STD140_FLOATS = 12;
/**
 * Pack a column-major `Mat3` (9 tightly-packed floats) into the 12-float layout
 * a WGSL `mat3x3<f32>` uniform expects: each 3-float column is padded to a
 * 16-byte vec4 slot. Pure and allocation-aware (writes into `out`) so it's
 * unit-testable without a GPU — the std140 alignment is easy to get subtly
 * wrong, so it's covered by tests.
 *
 *   column-major in:  [c0x c0y c0z | c1x c1y c1z | c2x c2y c2z]
 *   padded out:       [c0x c0y c0z _ | c1x c1y c1z _ | c2x c2y c2z _]
 */
export declare function packMat3Std140(mat: Mat3, out?: Float32Array): Float32Array;
