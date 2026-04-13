import { playerList, lastSpriteState } from './utils.js';
/**
 * Handles all Socket.io events with hook support
 */
export class EventHandlers {
    constructor(roomManager, io, hooks = {}) {
        this.roomManager = roomManager;
        this.io = io;
        this.hooks = hooks;
    }
    /**
     * Setup all event handlers for a socket connection
     */
    setupHandlers(socket) {
        let currentRoomCode = null;
        let playerName = 'Player';
        // Track current room for cleanup
        socket.on('createRoom', async (data) => {
            currentRoomCode = await this.handleCreateRoom(socket, data);
            if (currentRoomCode) {
                playerName = data?.name || `Player_${socket.id.slice(0, 4)}`;
            }
        });
        socket.on('joinRoom', async (data) => {
            const roomCode = await this.handleJoinRoom(socket, data);
            if (roomCode) {
                currentRoomCode = roomCode;
                playerName = data?.name || `Player_${socket.id.slice(0, 4)}`;
            }
        });
        socket.on('spriteSync', (data) => {
            this.handleSpriteSync(socket, data, currentRoomCode);
        });
        socket.on('gameEvent', (data) => {
            this.handleGameEvent(socket, data, currentRoomCode);
        });
        socket.on('requestLeaderboard', () => {
            this.handleRequestLeaderboard(socket, currentRoomCode);
        });
        socket.on('disconnect', () => {
            this.handleDisconnect(socket, currentRoomCode, playerName);
        });
    }
    /**
     * Handle createRoom event
     */
    async handleCreateRoom(socket, data = {}) {
        // Invoke beforeRoomCreate hook
        if (this.hooks.beforeRoomCreate) {
            const result = await this.hooks.beforeRoomCreate(socket, data);
            if (result === false) {
                console.log(`[!] Room creation blocked by hook for ${socket.id}`);
                return null;
            }
        }
        const playerName = data.name || `Player_${socket.id.slice(0, 4)}`;
        const room = this.roomManager.createRoom(socket.id, playerName);
        socket.join(room.code);
        console.log(`[R] Room created: ${room.code} by ${playerName}`);
        socket.emit('roomCreated', {
            code: room.code,
            players: playerList(room),
            sprites: lastSpriteState(room),
        });
        // Invoke afterRoomCreate hook
        if (this.hooks.afterRoomCreate) {
            await this.hooks.afterRoomCreate(room, socket);
        }
        return room.code;
    }
    /**
     * Handle joinRoom event
     */
    async handleJoinRoom(socket, data = {}) {
        // Invoke beforePlayerJoin hook
        if (this.hooks.beforePlayerJoin) {
            const result = await this.hooks.beforePlayerJoin(socket, data);
            if (result === false) {
                console.log(`[!] Player join blocked by hook for ${socket.id}`);
                return null;
            }
        }
        const playerName = data.name || `Player_${socket.id.slice(0, 4)}`;
        const upper = (data.code || '').toUpperCase();
        const room = this.roomManager.joinRoom(upper, socket.id, playerName);
        if (!room) {
            socket.emit('roomError', {
                message: `Room "${upper}" not found. Check the code and try again!`,
            });
            return null;
        }
        socket.join(upper);
        console.log(`[J] ${playerName} joined room ${upper}`);
        socket.emit('roomJoined', {
            code: upper,
            players: playerList(room),
            sprites: lastSpriteState(room),
        });
        socket.to(upper).emit('playerJoined', {
            player: { id: socket.id, name: playerName, score: 0 },
        });
        // Invoke afterPlayerJoin hook
        if (this.hooks.afterPlayerJoin) {
            const player = room.players.get(socket.id);
            if (player) {
                await this.hooks.afterPlayerJoin(room, player, socket);
            }
        }
        return upper;
    }
    /**
     * Handle spriteSync event
     */
    async handleSpriteSync(socket, data = {}, currentRoomCode) {
        const code = data.room || currentRoomCode;
        const room = this.roomManager.getRoom(code || '');
        if (!room || !Array.isArray(data.sprites))
            return;
        // Invoke onSpriteSync hook
        if (this.hooks.onSpriteSync) {
            const result = await this.hooks.onSpriteSync(room, socket.id, data.sprites);
            if (result === false) {
                console.log(`[!] Sprite sync rejected by hook for ${socket.id}`);
                return;
            }
        }
        // Update sprite state
        this.roomManager.updateSpriteState(room.code, socket.id, data.sprites);
        // Log for debugging
        for (const snap of data.sprites) {
            console.log(`[SYNC] Received sprite from ${socket.id}: id=${snap.id} (${snap.x},${snap.y})`);
        }
        // Broadcast to others in the room
        socket.to(room.code).emit('spriteSync', {
            playerId: socket.id,
            sprites: data.sprites,
        });
    }
    /**
     * Handle gameEvent (custom game events)
     */
    async handleGameEvent(socket, data = {}, currentRoomCode) {
        const code = data.room || currentRoomCode;
        const room = this.roomManager.getRoom(code || '');
        if (!room)
            return;
        const eventName = data.event;
        const eventData = data.data;
        // Special handling for scoreUpdate event
        if (eventName === 'scoreUpdate') {
            const player = room.players.get(socket.id);
            if (player && typeof eventData?.score === 'number') {
                const oldScore = player.score;
                this.roomManager.updatePlayerScore(room.code, socket.id, eventData.score);
                // Invoke afterScoreUpdate hook
                if (this.hooks.afterScoreUpdate) {
                    await this.hooks.afterScoreUpdate(room, player, oldScore, player.score);
                }
                this.io.to(room.code).emit('leaderboard', { players: playerList(room) });
            }
            return;
        }
        // Invoke onGameEvent hook for other events
        if (this.hooks.onGameEvent && eventName) {
            const result = await this.hooks.onGameEvent(room, socket, eventName, eventData);
            if (result === false) {
                console.log(`[!] Game event '${eventName}' blocked by hook`);
                return;
            }
        }
        // Broadcast custom event to others
        if (eventName) {
            socket.to(room.code).emit(eventName, { ...eventData, _from: socket.id });
        }
    }
    /**
     * Handle requestLeaderboard event
     */
    handleRequestLeaderboard(socket, currentRoomCode) {
        const room = this.roomManager.getRoom(currentRoomCode || '');
        if (!room)
            return;
        socket.emit('leaderboard', { players: playerList(room) });
    }
    /**
     * Handle disconnect event
     */
    async handleDisconnect(socket, currentRoomCode, playerName) {
        console.log(`[-] Player disconnected: ${socket.id} (${playerName})`);
        const room = this.roomManager.getRoom(currentRoomCode || '');
        if (!room)
            return;
        const player = room.players.get(socket.id);
        // Invoke beforePlayerDisconnect hook
        if (this.hooks.beforePlayerDisconnect) {
            await this.hooks.beforePlayerDisconnect(room, player || null, socket);
        }
        // Remove player and their sprites
        this.roomManager.removePlayer(room.code, socket.id);
        // Notify others
        socket.to(room.code).emit('playerLeft', { playerId: socket.id });
        // Invoke afterPlayerDisconnect hook
        if (this.hooks.afterPlayerDisconnect) {
            await this.hooks.afterPlayerDisconnect(room, socket.id);
        }
        // Delete room if empty after a delay
        if (room.players.size === 0) {
            setTimeout(() => {
                const currentRoom = this.roomManager.getRoom(room.code);
                if (currentRoom && currentRoom.players.size === 0) {
                    this.roomManager.deleteRoom(room.code);
                    console.log(`[X] Room ${room.code} closed (empty)`);
                }
            }, 10000);
        }
        // Transfer host if the host disconnected and there are still players
        if (room.hostId === socket.id && room.players.size > 0) {
            const newHostId = room.players.keys().next().value;
            if (newHostId) {
                this.roomManager.transferHost(room.code, newHostId);
                const newHost = room.players.get(newHostId);
                if (newHost) {
                    this.io.to(room.code).emit('newHost', { playerId: newHostId, name: newHost.name });
                    console.log(`[H] New host for ${room.code}: ${newHost.name}`);
                }
            }
        }
    }
}
