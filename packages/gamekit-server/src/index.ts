/**
 * GameKit Server - Multiplayer server for games built with GameKit
 *
 * @example
 * ```typescript
 * import { createServer } from 'gamekit-server';
 *
 * const server = createServer({
 *   port: 3000,
 *   hooks: {
 *     onSpriteSync: async (room, playerId, sprites) => {
 *       // Custom validation
 *       return true;
 *     }
 *   }
 * });
 *
 * server.start();
 * ```
 */

export { createServer, GameKitServer } from './server.js';
export type {
  ServerOptions,
  ServerHooks,
  Room,
  Player,
  SpriteSnapshot,
  CorsOptions,
  GameKitServer as IGameKitServer,
} from './types.js';
