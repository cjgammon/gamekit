import { RenderGame } from "./RenderGame.js";
import { Canvas2DGame } from "./Canvas2DGame.js";
import { isWebGPUAvailable } from "./unsupported.js";
/**
 * Create a game on the best available backend: WebGPU ({@link RenderGame}) when
 * the browser supports it, otherwise the Canvas2D fallback ({@link Canvas2DGame})
 * so a shared link still runs on Firefox, older iPads, Safari < 18, etc.
 *
 * Your scenes and entities don't change — only the backend differs. To force a
 * backend, construct `RenderGame`/`Canvas2DGame` directly. Clear color isn't in
 * the shared options (the two backends type it differently); set it after via
 * `game.renderer.clearColor`.
 *
 * ```ts
 * const game = await createGame(canvas, { fov: 480, autoResize: true });
 * game.switchScene(new PlayScene());
 * game.start();
 * ```
 */
export async function createGame(canvas, config) {
    if (isWebGPUAvailable()) {
        try {
            return await RenderGame.create(canvas, config);
        }
        catch {
            // Device acquisition failed despite navigator.gpu — fall back.
        }
    }
    return Canvas2DGame.create(canvas, config);
}
