/**
 * gamekit — a 2D multiplayer game engine for the web, written from scratch
 * with zero runtime dependencies.
 *
 * @example
 * ```typescript
 * import { Entity, Sprite, Group, Vec2 } from 'gamekit';
 *
 * class Player extends Sprite {
 *   create() {
 *     this.setTexture('player', 32, 32);
 *     this.addAnim('run', { frames: [1, 2, 3, 4], fps: 10 });
 *     this.play('run');
 *   }
 * }
 * ```
 */

// ---- Math ----
export { Vec2 } from "./math/Vec2.js";
export { Mat3 } from "./math/Mat3.js";
export { AABB } from "./math/AABB.js";
export { Circle } from "./math/Circle.js";

// ---- Core ----
export { Signal } from "./core/Signal.js";
export type { SignalListener } from "./core/Signal.js";
export { Entity } from "./core/Entity.js";
export type { RenderTransform } from "./core/Entity.js";
export { Rng } from "./core/Rng.js";
export { Group } from "./core/Group.js";
export { Pool } from "./core/Pool.js";
export { Sprite, Animation } from "./core/Sprite.js";
export type { AnimationConfig } from "./core/Sprite.js";
export { Particle } from "./core/Particle.js";
export { Emitter } from "./core/Emitter.js";
export type { NumberRange } from "./core/Emitter.js";
export { Tilemap } from "./core/Tilemap.js";
export type { TileVisitor } from "./core/Tilemap.js";
export { BitmapFont } from "./core/BitmapFont.js";
export type { BitmapFontOptions } from "./core/BitmapFont.js";
export { Text } from "./core/Text.js";
export type { TextAlign, GlyphVisitor } from "./core/Text.js";
export { Timer, TimerManager } from "./core/Timer.js";
export type { TimerCallback } from "./core/Timer.js";
export { Tween, TweenManager } from "./core/Tween.js";
export type { TweenOptions, TweenProps, NumericKeys } from "./core/Tween.js";
export { Ease } from "./core/Ease.js";
export type { EaseFn } from "./core/Ease.js";

// ---- Scene & loop ----
export { Scene } from "./core/Scene.js";
export type { CollisionCallback } from "./core/Scene.js";
export { Camera } from "./core/Camera.js";
export type { CameraBounds, CameraDeadzone } from "./core/Camera.js";
export { Game } from "./core/Game.js";
export type { GameConfig } from "./core/Game.js";

// ---- Net (isomorphic pieces only; WebSocketTransport is browser-only and is
//      exported from "gamekit/net" so the server never pulls a DOM global) ----
export type { Transport } from "./net/Transport.js";
export { createMemoryTransportPair } from "./net/MemoryTransport.js";
export { Interpolator } from "./net/Interpolator.js";
export type { InterpolatedState } from "./net/Interpolator.js";
export { NetClient } from "./net/NetClient.js";
export type {
  EntityFactory,
  NetClientOptions,
  SimulateFn,
  PredictContext,
  NetStateReceiver,
} from "./net/NetClient.js";
export { NetScene } from "./net/NetScene.js";
export type { NetSceneOptions } from "./net/NetScene.js";
export { simulatePlayer, PLAYER_SPEED, PLAYER_SIZE } from "./net/sim.js";
export type { PlayerSimOptions } from "./net/sim.js";
export * from "./net/protocol.js";
export {
  binaryCodec,
  jsonCodec,
  defaultCodec,
  BinaryWriter,
  BinaryReader,
} from "./net/codec.js";
export type { Codec } from "./net/codec.js";
