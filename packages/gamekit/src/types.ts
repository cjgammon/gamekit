/**
 * GameKit Types
 * Core TypeScript interfaces for the GameKit library
 */

/**
 * Game configuration options
 */
export interface GameOptions {
  /** Canvas width in pixels (default: 800) */
  width?: number;
  /** Canvas height in pixels (default: 600) */
  height?: number;
  /** Gravity strength (0 for top-down games, 1 for platformers) (default: 1) */
  gravity?: number;
  /** Background color as hex (default: 0x87ceeb) */
  background?: number;
  /** Server URL for multiplayer (default: http://localhost:3000) */
  server?: string;
}

/**
 * Base sprite options (shared by all sprite types)
 */
export interface BaseSpriteOptions {
  /** X position */
  x?: number;
  /** Y position */
  y?: number;
  /** Color as hex number */
  color?: number;
  /** Is sprite static (doesn't move with physics) */
  isStatic?: boolean;
  /** Bounciness (0 = no bounce, 1 = perfect bounce) */
  bounce?: number;
  /** Friction (0 = no friction, 1 = high friction) */
  friction?: number;
  /** Mass density */
  density?: number;
  /** Prevent rotation from physics */
  noRotation?: boolean;
  /** Air resistance (0 = no air resistance, higher = more resistance, default: 0.01) */
  frictionAir?: number;
  /** Sync ID for multiplayer (auto-generated if not provided) */
  syncId?: string;
}

/**
 * Box (rectangle) sprite options
 */
export interface GKBoxOptions extends BaseSpriteOptions {
  /** Width of rectangle */
  width?: number;
  /** Height of rectangle */
  height?: number;
}

/**
 * Circle sprite options
 */
export interface GKCircleOptions extends BaseSpriteOptions {
  /** Radius of circle */
  radius?: number;
}

/**
 * Player data in multiplayer
 */
export interface Player {
  id: string;
  name: string;
  score: number;
}

/**
 * Room data for multiplayer
 */
export interface RoomData {
  code: string;
  players: Player[];
  sprites: any[];
}
