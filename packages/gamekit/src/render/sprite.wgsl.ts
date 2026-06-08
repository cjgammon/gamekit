/**
 * WGSL for the instanced sprite pipeline, as a string (no bundler/file loader).
 *
 * One static unit-quad (vertex buffer 0) is drawn once per instance; the
 * per-instance data (vertex buffer 1) positions, rotates, and UV-maps it. The
 * camera's world→clip `mat3x3<f32>` is the only uniform. Colors are
 * premultiplied (done CPU-side in the batcher); the texture is sampled and
 * multiplied, with src-over blending configured on the pipeline.
 *
 * Instance attribute layout must match `SpriteBatcher` (INSTANCE_FLOATS = 15):
 *   pos[2] size[2] origin[2] rotation[1] uvOffset[2] uvScale[2] color[4]
 */
export const SPRITE_WGSL = /* wgsl */ `
struct Camera {
  viewProjection: mat3x3<f32>,
};
@group(0) @binding(0) var<uniform> camera: Camera;

@group(1) @binding(0) var spriteTex: texture_2d<f32>;
@group(1) @binding(1) var spriteSampler: sampler;

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) color: vec4<f32>,
};

@vertex
fn vs_main(
  @location(0) corner: vec2<f32>,      // unit quad corner, 0..1
  @location(1) pos: vec2<f32>,         // entity top-left, world space
  @location(2) size: vec2<f32>,
  @location(3) origin: vec2<f32>,      // normalized pivot 0..1
  @location(4) rotation: f32,
  @location(5) uvOffset: vec2<f32>,
  @location(6) uvScale: vec2<f32>,
  @location(7) color: vec4<f32>,
) -> VertexOut {
  // Corner relative to the pivot, in pixels.
  let local = (corner - origin) * size;
  let c = cos(rotation);
  let s = sin(rotation);
  let rotated = vec2<f32>(local.x * c - local.y * s, local.x * s + local.y * c);
  // Pivot in world space + rotated offset.
  let world = pos + origin * size + rotated;

  let clip = camera.viewProjection * vec3<f32>(world, 1.0);

  var out: VertexOut;
  out.position = vec4<f32>(clip.xy, 0.0, 1.0);
  out.uv = uvOffset + corner * uvScale;
  out.color = color;
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4<f32> {
  let texColor = textureSample(spriteTex, spriteSampler, in.uv);
  let outColor = texColor * in.color; // both premultiplied
  if (outColor.a <= 0.0) {
    discard;
  }
  return outColor;
}
`;
