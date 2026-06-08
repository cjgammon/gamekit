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
export { Entity } from "./core/Entity.js";
export { Group } from "./core/Group.js";
export { Sprite, Animation } from "./core/Sprite.js";
export { Timer, TimerManager } from "./core/Timer.js";
export { Tween, TweenManager } from "./core/Tween.js";
export { Ease } from "./core/Ease.js";
// ---- Scene & loop ----
export { Scene } from "./core/Scene.js";
export { Game } from "./core/Game.js";
export { createMemoryTransportPair } from "./net/MemoryTransport.js";
export { Interpolator } from "./net/Interpolator.js";
export { NetClient } from "./net/NetClient.js";
export { NetScene } from "./net/NetScene.js";
export { simulatePlayer, PLAYER_SPEED, PLAYER_SIZE } from "./net/sim.js";
export * from "./net/protocol.js";
