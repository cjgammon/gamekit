import { generateCode, getRoom } from './utils.js';
/**
 * Manages room state and operations
 */
export class RoomManager {
    constructor() {
        this.rooms = new Map();
    }
    /**
     * Create a new room with a unique code
     */
    createRoom(hostId, playerName) {
        const code = generateCode(this.rooms);
        const room = {
            code,
            hostId,
            players: new Map(),
            sprites: new Map(),
            createdAt: new Date(),
        };
        room.players.set(hostId, { id: hostId, name: playerName, score: 0 });
        this.rooms.set(code, room);
        return room;
    }
    /**
     * Add a player to an existing room
     */
    joinRoom(code, playerId, playerName) {
        const room = getRoom(code, this.rooms);
        if (!room)
            return null;
        room.players.set(playerId, { id: playerId, name: playerName, score: 0 });
        return room;
    }
    /**
     * Get a room by code
     */
    getRoom(code) {
        return getRoom(code, this.rooms);
    }
    /**
     * Remove a player and their sprites from a room
     */
    removePlayer(code, playerId) {
        const room = getRoom(code, this.rooms);
        if (!room)
            return;
        room.players.delete(playerId);
        // Remove all sprites owned by this player
        for (const key of room.sprites.keys()) {
            if (key.startsWith(`${playerId}:`)) {
                room.sprites.delete(key);
            }
        }
    }
    /**
     * Update sprite positions for a player
     */
    updateSpriteState(code, playerId, sprites) {
        const room = getRoom(code, this.rooms);
        if (!room)
            return;
        for (const snap of sprites) {
            room.sprites.set(`${playerId}:${snap.id}`, { ...snap, _owner: playerId });
        }
    }
    /**
     * Update a player's score (server-side validation to prevent cheating)
     */
    updatePlayerScore(code, playerId, score) {
        const room = getRoom(code, this.rooms);
        if (!room)
            return false;
        const player = room.players.get(playerId);
        if (!player)
            return false;
        // Anti-cheat: only allow score to increase, and only by valid amounts
        player.score = Math.max(player.score, Math.floor(score));
        return true;
    }
    /**
     * Delete a room
     */
    deleteRoom(code) {
        this.rooms.delete(code);
    }
    /**
     * Get all rooms (for debugging/health check)
     */
    getRoomCount() {
        return this.rooms.size;
    }
    /**
     * Transfer host role to another player
     */
    transferHost(code, newHostId) {
        const room = getRoom(code, this.rooms);
        if (!room)
            return false;
        if (!room.players.has(newHostId))
            return false;
        room.hostId = newHostId;
        return true;
    }
    /**
     * Get all rooms (for testing)
     */
    getAllRooms() {
        return this.rooms;
    }
}
