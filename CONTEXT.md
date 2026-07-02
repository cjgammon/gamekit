# CONTEXT.md

Domain glossary for gamekit. Terms here name concepts precisely enough that
"the X module" always means the same thing in conversation and in code.

## SceneWalker

Walks a `Scene`'s entity tree once per frame (world pass, then HUD pass if
non-empty) and turns every visible, non-zero-size leaf — `Sprite`, `Tilemap`
tile, `Text` glyph, or plain `Entity` — into a `SpriteInstance<T>`, applying
frustum culling and the zero-size warning uniformly. It is the deepened,
backend-agnostic replacement for what used to be two independent scene-walks
(`RenderView` for WebGPU, `Canvas2DRenderer` for Canvas2D).

`SceneWalker<T>` is generic over a texture-entry type `T` (mirroring
`AssetLoader<T>`) and drives a `DrawSink<T>`:

```
interface DrawSink<T> {
  beginPass(camera: Camera, alpha: number, pass: "world" | "hud", clear: boolean): void;
  emit(inst: SpriteInstance<T>): void;
  endPass(): void;
}
```

The walker hands each sink *which* pass this is and *which* camera/alpha —
never a precomputed matrix — because "world" and "hud" mean different
projection math per backend (WebGPU needs an NDC clip-space projection;
Canvas2D needs a plain screen-space affine transform, or identity for HUD).
Computing that matrix is the sink's job, not the walker's; the walker stays
ignorant of GPU/Canvas2D transform conventions entirely.

`RenderView` (WebGPU) and `Canvas2DRenderer` (Canvas2D) are `DrawSink`
implementations — thin adapters over `WebGPURenderer`'s batcher and a
`CanvasRenderingContext2D` respectively. Exported publicly (`gamekit/renderer`)
so a third backend can reuse the walk by implementing one interface instead
of duplicating the scene traversal.
