/**
 * gamekit/renderer — the WebGPU renderer. References WebGPU/DOM globals
 * (`navigator.gpu`, `GPU*`, `fetch`, `createImageBitmap`), so it is exported
 * from this subpath only — never the package root — keeping the headless
 * server's `import "gamekit"` DOM-free (same rule as `gamekit/net` and
 * `gamekit/input`).
 */
export { WebGPURenderer } from "./WebGPURenderer.js";
export type { TextureEntry, RendererOptions } from "./WebGPURenderer.js";
export { RenderGame } from "./RenderGame.js";
export type { RenderGameConfig } from "./RenderGame.js";
export { RenderView } from "./RenderView.js";
export type { SpriteRenderer } from "./RenderView.js";
export { AssetLoader, WHITE_TEXTURE } from "./AssetLoader.js";
export type { AssetSpec, TextureFactory } from "./AssetLoader.js";
export { Texture } from "./Texture.js";
export type { FrameUV } from "./Texture.js";
export {
  SpriteBatcher,
  INSTANCE_FLOATS,
} from "./SpriteBatcher.js";
export type {
  InstanceSink,
  SpriteInstance,
  DrawRun,
} from "./SpriteBatcher.js";
