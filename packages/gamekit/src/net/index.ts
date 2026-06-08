/**
 * gamekit/net — networking entry point, including the browser-only
 * WebSocketTransport. Import from here in browser/client code; the package root
 * (`gamekit`) deliberately omits WebSocketTransport so the headless server can
 * import the core without pulling a DOM global.
 */

export type { Transport } from "./Transport.js";
export { createMemoryTransportPair } from "./MemoryTransport.js";
export { Interpolator } from "./Interpolator.js";
export type { InterpolatedState } from "./Interpolator.js";
export { NetClient } from "./NetClient.js";
export type {
  EntityFactory,
  NetClientOptions,
  SimulateFn,
  PredictContext,
} from "./NetClient.js";
export { NetScene } from "./NetScene.js";
export type { NetSceneOptions } from "./NetScene.js";
export { simulatePlayer, PLAYER_SPEED, PLAYER_SIZE } from "./sim.js";
export type { PlayerSimOptions } from "./sim.js";
export { WebSocketTransport } from "./WebSocketTransport.js";
export * from "./protocol.js";
