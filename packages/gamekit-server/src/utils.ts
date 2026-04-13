import type { Room, Player, SpriteSnapshot } from './types.js';

/**
 * Generate a random 4-letter room code (excludes I and O to avoid confusion with 1/0)
 */
export function generateCode(existingRooms: Map<string, Room>): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (look like 1/0)
  let code: string;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (existingRooms.has(code));
  return code;
}

/**
 * Get a room by code (case-insensitive)
 */
export function getRoom(code: string | undefined, rooms: Map<string, Room>): Room | null {
  if (!code) return null;
  return rooms.get(code.toUpperCase()) ?? null;
}

/**
 * Convert players Map to array
 */
export function playerList(room: Room): Player[] {
  return Array.from(room.players.values());
}

/**
 * Convert sprites Map to array
 */
export function lastSpriteState(room: Room): SpriteSnapshot[] {
  return Array.from(room.sprites.values());
}
