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
export declare const SPRITE_WGSL = "\nstruct Camera {\n  viewProjection: mat3x3<f32>,\n};\n@group(0) @binding(0) var<uniform> camera: Camera;\n\n@group(1) @binding(0) var spriteTex: texture_2d<f32>;\n@group(1) @binding(1) var spriteSampler: sampler;\n\nstruct VertexOut {\n  @builtin(position) position: vec4<f32>,\n  @location(0) uv: vec2<f32>,\n  @location(1) color: vec4<f32>,\n};\n\n@vertex\nfn vs_main(\n  @location(0) corner: vec2<f32>,      // unit quad corner, 0..1\n  @location(1) pos: vec2<f32>,         // entity top-left, world space\n  @location(2) size: vec2<f32>,\n  @location(3) origin: vec2<f32>,      // normalized pivot 0..1\n  @location(4) rotation: f32,\n  @location(5) uvOffset: vec2<f32>,\n  @location(6) uvScale: vec2<f32>,\n  @location(7) color: vec4<f32>,\n) -> VertexOut {\n  // Corner relative to the pivot, in pixels.\n  let local = (corner - origin) * size;\n  let c = cos(rotation);\n  let s = sin(rotation);\n  let rotated = vec2<f32>(local.x * c - local.y * s, local.x * s + local.y * c);\n  // Pivot in world space + rotated offset.\n  let world = pos + origin * size + rotated;\n\n  let clip = camera.viewProjection * vec3<f32>(world, 1.0);\n\n  var out: VertexOut;\n  out.position = vec4<f32>(clip.xy, 0.0, 1.0);\n  out.uv = uvOffset + corner * uvScale;\n  out.color = color;\n  return out;\n}\n\n@fragment\nfn fs_main(in: VertexOut) -> @location(0) vec4<f32> {\n  let texColor = textureSample(spriteTex, spriteSampler, in.uv);\n  let outColor = texColor * in.color; // both premultiplied\n  if (outColor.a <= 0.0) {\n    discard;\n  }\n  return outColor;\n}\n";
