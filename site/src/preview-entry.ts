/// <reference types="@webgpu/types" />
// Runs INSIDE the sandbox iframe. Imports the real gamekit, exposes a friendly
// set of names to the tutorial code (so editor snippets need no imports), then
// runs whatever code the parent posts. Each run gets a fresh iframe (the parent
// reloads it), so there's nothing to tear down here.
import { Scene, Entity, Sprite, Group, Camera, Vec2, Ease, Rng } from "@cjgammon/gamekit";
import {
  createGame,
  RenderGame,
  Canvas2DGame,
  isWebGPUAvailable,
  mountUnsupportedNotice,
} from "@cjgammon/gamekit/renderer";
import { InputManager } from "@cjgammon/gamekit/input";

const canvas = document.getElementById("view") as HTMLCanvasElement;
const hudEl = document.getElementById("hud") as HTMLDivElement;

/** Tutorial helper: write a line of text over the canvas — a stand-in for a real
 *  BitmapFont HUD so the steps stay asset-free. */
function hud(text: unknown): void {
  const s = text == null ? "" : String(text);
  hudEl.textContent = s;
  // Report it so the tutorial can tell when a mission is complete.
  parent.postMessage({ type: "hud", text: s }, "*");
}

// The names the tutorial code runs against (no imports needed in the editor).
const scope: Record<string, unknown> = {
  createGame,
  RenderGame,
  Canvas2DGame,
  isWebGPUAvailable,
  mountUnsupportedNotice,
  Scene,
  Entity,
  Sprite,
  Group,
  Camera,
  Vec2,
  Ease,
  Rng,
  InputManager,
  hud,
  canvas,
};

let ran = false;

window.addEventListener("message", async (e: MessageEvent) => {
  const data = e.data as { type?: string; code?: string } | null;
  if (!data || data.type !== "run" || ran) return;
  ran = true; // one run per load; the parent reloads the iframe for the next run
  hud("");

  try {
    const names = Object.keys(scope);
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      ...names,
      `"use strict"; return (async () => {\n${data.code ?? ""}\n})();`,
    );
    await fn(...names.map((n) => scope[n]));
    parent.postMessage({ type: "ok" }, "*");
  } catch (err) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    hud("⚠ " + (err instanceof Error ? err.message : String(err)));
    parent.postMessage({ type: "error", message }, "*");
  }
});

// Tell the parent we're loaded and ready to receive code.
parent.postMessage({ type: "ready" }, "*");
