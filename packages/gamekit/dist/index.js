/**
 * GameKit - A friendly game engine for kids learning to code
 *
 * @example
 * ```typescript
 * import { Game, GKBox, GKCircle } from 'gamekit';
 *
 * const game = new Game({
 *   width: 800,
 *   height: 600,
 *   gravity: 0
 * });
 *
 * const paddle = new GKBox({
 *   x: 50, y: 250,
 *   width: 20, height: 80,
 *   color: 0xffffff
 * });
 *
 * game.add(paddle);
 *
 * game.onUpdate(() => {
 *   if (game.isKeyDown('ArrowUp')) paddle.moveUp(6);
 * });
 * ```
 */
// Main classes
export { Game } from './game.js';
export { GKBox } from './gk-box.js';
export { GKCircle } from './gk-circle.js';
