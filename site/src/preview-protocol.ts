// Message protocol between the parent page (Preview.tsx) and the sandboxed
// preview iframe (preview-entry.ts), imported by both sides. Split by
// direction — "run" only ever flows parent→child; the rest only ever flow
// child→parent — so a message can't type-check as something its sender
// could never actually receive.

/** Sent by the parent to hand the sandbox code to run. */
export type ParentToChildMessage = { type: "run"; code: string };

/** Sent by the sandbox to report load, run outcome, or HUD text. */
export type ChildToParentMessage =
  | { type: "ready" }
  | { type: "ok" }
  | { type: "hud"; text: string }
  | { type: "error"; message: string };
