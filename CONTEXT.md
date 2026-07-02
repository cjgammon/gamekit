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

## Entity type tag (`NetServer<T>`)

The wire's `SnapshotEntity.t` (`net/protocol.ts`) is deliberately a plain
`string` at the wire level — it's decoded off the network with no compile-time
guarantee. Client-side reconstruction closes that gap at the point a game
*builds* its tag→builder map: `createEntityFactory<T extends string>()`
(`net/NetClient.ts`) makes that map exhaustive, so a game declares one
`NetType` union (e.g. `"player" | "ball"`) and a missing or misspelled tag in
the map is a compile error, not a silent runtime fallback.

`NetServer<T extends string = string>` (`gamekit-server/net/NetServer.ts`)
is the server-side mirror: `spawn(type: T, entity: Entity)` is typed against
the same game-supplied `T`, so a typo'd tag on the server side (the seam the
architecture review flagged — `spawn("plyaer", …)`) is caught at the same
`new NetServer<NetType>(...)` call site instead of surfacing as a runtime
mismatch on the client. The connecting-client entity's tag (previously a
hardcoded `"player"` literal) is supplied via a `playerType?: T` option
(default `"player" as T` for back-compat) so it's a real, checkable member of
`T` rather than an unsound cast.

`ServerGame<T>`/`ServerGameOptions<T>` (`gamekit-server/game/ServerGame.ts`)
carry `T` through from game code to `NetServer`, since games construct
`ServerGame`, not `NetServer`, directly.

Deliberately out of scope: the `netState()`/`applyNetState()` payload is
still `unknown`, joined only by `as Partial<Syncable>` /
`as Partial<NetStateReceiver>` casts on either end — tying a tag to its
payload *shape* (not just its name) is a separate, larger seam left for a
future pass.
