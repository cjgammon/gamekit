import type { Socket } from 'socket.io';

/**
 * Player data in a room
 */
export interface Player {
  id: string;
  name: string;
  score: number;
}

/**
 * Sprite snapshot for position sync
 */
export interface SpriteSnapshot {
  id: string;
  x: number;
  y: number;
  rotation: number;
  _owner?: string;
}

/**
 * Room state
 */
export interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  sprites: Map<string, SpriteSnapshot>;
  createdAt: Date;
}

/**
 * CORS configuration
 */
export interface CorsOptions {
  origin?: string | string[];
  methods?: string[];
}

/**
 * Hook functions for customizing server behavior
 */
export interface ServerHooks {
  /**
   * Called before a room is created
   * @returns false to prevent room creation
   */
  beforeRoomCreate?: (socket: Socket, data: { name?: string }) => Promise<boolean | void> | boolean | void;

  /**
   * Called after a room is created
   */
  afterRoomCreate?: (room: Room, socket: Socket) => Promise<void> | void;

  /**
   * Called before a player joins a room
   * @returns false to prevent joining
   */
  beforePlayerJoin?: (socket: Socket, data: { code?: string; name?: string }) => Promise<boolean | void> | boolean | void;

  /**
   * Called after a player joins a room
   */
  afterPlayerJoin?: (room: Room, player: Player, socket: Socket) => Promise<void> | void;

  /**
   * Called when sprite positions are synced
   * @returns false to reject the sync
   */
  onSpriteSync?: (room: Room, playerId: string, sprites: SpriteSnapshot[]) => Promise<boolean | void> | boolean | void;

  /**
   * Called after a player's score is updated
   */
  afterScoreUpdate?: (room: Room, player: Player, oldScore: number, newScore: number) => Promise<void> | void;

  /**
   * Called when a custom game event is received
   * @returns false to prevent broadcasting the event
   */
  onGameEvent?: (room: Room, socket: Socket, event: string, data: any) => Promise<boolean | void> | boolean | void;

  /**
   * Called before a player disconnects
   */
  beforePlayerDisconnect?: (room: Room | null, player: Player | null, socket: Socket) => Promise<void> | void;

  /**
   * Called after a player disconnects
   */
  afterPlayerDisconnect?: (room: Room | null, playerId: string) => Promise<void> | void;
}

/**
 * Server configuration options
 */
export interface ServerOptions {
  /**
   * Port to listen on (default: 3000)
   */
  port?: number;

  /**
   * CORS configuration (default: allow all origins)
   */
  cors?: CorsOptions;

  /**
   * Hook functions for customizing behavior
   */
  hooks?: ServerHooks;
}

/**
 * GameKit server instance
 */
export interface GameKitServer {
  /**
   * Start the server
   */
  start(): void;

  /**
   * Stop the server
   */
  stop(): Promise<void>;
}
