import type { Room, SpriteSnapshot } from './types.js';
/**
 * Manages room state and operations
 */
export declare class RoomManager {
    private rooms;
    /**
     * Create a new room with a unique code
     */
    createRoom(hostId: string, playerName: string): Room;
    /**
     * Add a player to an existing room
     */
    joinRoom(code: string, playerId: string, playerName: string): Room | null;
    /**
     * Get a room by code
     */
    getRoom(code: string): Room | null;
    /**
     * Remove a player and their sprites from a room
     */
    removePlayer(code: string, playerId: string): void;
    /**
     * Update sprite positions for a player
     */
    updateSpriteState(code: string, playerId: string, sprites: SpriteSnapshot[]): void;
    /**
     * Update a player's score (server-side validation to prevent cheating)
     */
    updatePlayerScore(code: string, playerId: string, score: number): boolean;
    /**
     * Delete a room
     */
    deleteRoom(code: string): void;
    /**
     * Get all rooms (for debugging/health check)
     */
    getRoomCount(): number;
    /**
     * Transfer host role to another player
     */
    transferHost(code: string, newHostId: string): boolean;
    /**
     * Get all rooms (for testing)
     */
    getAllRooms(): Map<string, Room>;
}
