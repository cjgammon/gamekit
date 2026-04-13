import type { Room, Player, SpriteSnapshot } from './types.js';
/**
 * Generate a random 4-letter room code (excludes I and O to avoid confusion with 1/0)
 */
export declare function generateCode(existingRooms: Map<string, Room>): string;
/**
 * Get a room by code (case-insensitive)
 */
export declare function getRoom(code: string | undefined, rooms: Map<string, Room>): Room | null;
/**
 * Convert players Map to array
 */
export declare function playerList(room: Room): Player[];
/**
 * Convert sprites Map to array
 */
export declare function lastSpriteState(room: Room): SpriteSnapshot[];
