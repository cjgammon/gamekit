/** A padded `mat3x3<f32>` is three columns, each a 16-byte (vec4) slot. */
export const MAT3_STD140_FLOATS = 12;
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
export function packMat3Std140(mat, out = new Float32Array(MAT3_STD140_FLOATS)) {
    const v = mat.values;
    out[0] = v[0];
    out[1] = v[1];
    out[2] = v[2];
    out[3] = 0;
    out[4] = v[3];
    out[5] = v[4];
    out[6] = v[5];
    out[7] = 0;
    out[8] = v[6];
    out[9] = v[7];
    out[10] = v[8];
    out[11] = 0;
    return out;
}
