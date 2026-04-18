/**
 * Network - Socket.io multiplayer client
 * Handles room management, sprite sync, and custom messaging
 */
import { io } from 'socket.io-client';
export class Network {
    // Test mode flag - only track messages in test environment
    // Set by test harness via window.__GAMEKIT_TEST_MODE__ = true
    get testMode() {
        return typeof window !== 'undefined' && window.__GAMEKIT_TEST_MODE__ === true;
    }
    constructor(serverUrl) {
        this.socket = null;
        this.roomCode = null;
        this.playerName = null;
        this.isHost = false;
        // Callbacks
        this.playerJoinCallbacks = [];
        this.playerLeaveCallbacks = [];
        this.messageCallbacks = new Map();
        this.spriteSyncCallbacks = [];
        // Sprite tracking for sync
        this.ownedSprites = new Set();
        this.syncInterval = null;
        // Message history for test debugging (test mode only)
        this.messageHistory = [];
        this.MAX_HISTORY_SIZE = 100; // Limit history to prevent memory growth
        this.serverUrl = serverUrl;
        console.log(`[Network] Initialized with server: ${serverUrl}`);
    }
    /**
     * Create a new room (become host)
     */
    async createRoom(playerName) {
        console.log(`\n🌐 [Network] Connecting to server: ${this.serverUrl}`);
        console.log(`🌐 [Network] Creating room as '${playerName}'...`);
        // Connect to server
        this.socket = io(this.serverUrl);
        this.playerName = playerName;
        this.isHost = true;
        // Add connection error handling
        this.socket.on('connect_error', (err) => {
            console.error('❌ [Network] Connection error:', err.message);
            console.error('❌ [Network] Is the server running on', this.serverUrl, '?');
        });
        this.socket.on('connect', () => {
            console.log('✅ [Network] Connected to server!');
        });
        return new Promise((resolve, reject) => {
            // Listen for roomCreated event
            this.socket.once('roomCreated', (data) => {
                this.roomCode = data.code;
                console.log(`\n✅ [Network] ═══════════════════════════════`);
                console.log(`✅ [Network] ROOM CREATED SUCCESSFULLY!`);
                console.log(`✅ [Network] Room Code: ${data.code}`);
                console.log(`✅ [Network] You are: ${playerName} (HOST)`);
                console.log(`✅ [Network] ═══════════════════════════════\n`);
                this.setupEventHandlers();
                this.startSpriteSync();
                resolve({ code: data.code });
            });
            // Listen for errors
            this.socket.once('roomError', (error) => {
                console.error('❌ [Network] Failed to create room:', error.message);
                reject(new Error(error.message));
            });
            // Send createRoom request (server expects { name })
            this.socket.emit('createRoom', { name: playerName });
        });
    }
    /**
     * Join an existing room
     */
    async joinRoom(code, playerName) {
        console.log(`\n🌐 [Network] Connecting to server: ${this.serverUrl}`);
        console.log(`🌐 [Network] Joining room '${code}' as '${playerName}'...`);
        // Connect to server
        this.socket = io(this.serverUrl);
        this.playerName = playerName;
        this.roomCode = code;
        this.isHost = false;
        // Add connection error handling
        this.socket.on('connect_error', (err) => {
            console.error('❌ [Network] Connection error:', err.message);
            console.error('❌ [Network] Is the server running on', this.serverUrl, '?');
        });
        this.socket.on('connect', () => {
            console.log('✅ [Network] Connected to server!');
        });
        return new Promise((resolve, reject) => {
            // Listen for roomJoined event
            this.socket.once('roomJoined', (data) => {
                console.log(`\n✅ [Network] ═══════════════════════════════`);
                console.log(`✅ [Network] JOINED ROOM SUCCESSFULLY!`);
                console.log(`✅ [Network] Room Code: ${code}`);
                console.log(`✅ [Network] You are: ${playerName} (GUEST)`);
                console.log(`✅ [Network] Players in room:`, data.players.map((p) => p.name).join(', '));
                console.log(`✅ [Network] ═══════════════════════════════\n`);
                this.setupEventHandlers();
                this.startSpriteSync();
                resolve();
            });
            // Listen for errors
            this.socket.once('roomError', (error) => {
                console.error('❌ [Network] Failed to join room:', error.message);
                reject(new Error(error.message));
            });
            // Send joinRoom request (server expects { code, name })
            this.socket.emit('joinRoom', { code, name: playerName });
        });
    }
    /**
     * Set up Socket.io event handlers
     */
    setupEventHandlers() {
        if (!this.socket)
            return;
        // Player joined (server sends { player: ... })
        this.socket.on('playerJoined', (data) => {
            // Track for tests (test mode only)
            if (this.testMode) {
                this.messageHistory.push({
                    timestamp: Date.now(),
                    event: 'playerJoined',
                    data: data,
                });
                // Circular buffer: keep only last MAX_HISTORY_SIZE entries
                if (this.messageHistory.length > this.MAX_HISTORY_SIZE) {
                    this.messageHistory.shift();
                }
            }
            console.log(`👋 [Network] Player joined: ${data.player.name}`);
            this.playerJoinCallbacks.forEach(cb => cb(data.player));
        });
        // Player left (server sends { playerId: ... })
        this.socket.on('playerLeft', (data) => {
            // Track for tests (test mode only)
            if (this.testMode) {
                this.messageHistory.push({
                    timestamp: Date.now(),
                    event: 'playerLeft',
                    data: data,
                });
                // Circular buffer: keep only last MAX_HISTORY_SIZE entries
                if (this.messageHistory.length > this.MAX_HISTORY_SIZE) {
                    this.messageHistory.shift();
                }
            }
            console.log(`👋 [Network] Player left: ${data.playerId}`);
            this.playerLeaveCallbacks.forEach(cb => cb({ id: data.playerId }));
        });
        // Sprite position sync
        let syncReceiveCount = 0;
        this.socket.on('spriteSync', (data) => {
            // Track for tests (test mode only)
            if (this.testMode) {
                this.messageHistory.push({
                    timestamp: Date.now(),
                    event: 'spriteSync',
                    data: data,
                });
                // Circular buffer: keep only last MAX_HISTORY_SIZE entries
                if (this.messageHistory.length > this.MAX_HISTORY_SIZE) {
                    this.messageHistory.shift();
                }
            }
            syncReceiveCount++;
            if (syncReceiveCount === 1) {
                console.log(`📡 [Network] Receiving sprite updates from other players`);
            }
            // Call all sprite sync callbacks with the data
            this.spriteSyncCallbacks.forEach(cb => cb(data));
        });
        // Custom messages are registered dynamically per event name
        // (handled in onMessage() method)
        console.log('📡 [Network] Event handlers registered');
    }
    /**
     * Start automatic sprite synchronization
     */
    startSpriteSync() {
        if (this.syncInterval)
            return;
        let syncCount = 0;
        this.syncInterval = window.setInterval(() => {
            if (!this.socket || this.ownedSprites.size === 0)
                return;
            // Sync all owned sprites
            const syncData = Array.from(this.ownedSprites).map(sprite => ({
                id: sprite.syncId,
                x: sprite.x,
                y: sprite.y,
                angle: sprite.angle,
                velocityX: sprite.velocityX,
                velocityY: sprite.velocityY,
            }));
            this.socket.emit('spriteSync', {
                room: this.roomCode,
                sprites: syncData,
            });
            // Log first sync to confirm it's working
            syncCount++;
            if (syncCount === 1) {
                console.log(`📡 [Network] Sprite sync started (20Hz) - syncing ${this.ownedSprites.size} sprite(s)`);
            }
        }, 50); // Sync 20 times per second
        console.log('📡 [Network] Sprite sync initialized');
    }
    /**
     * Mark a sprite as owned by this player (will be synced)
     */
    addOwnedSprite(sprite) {
        this.ownedSprites.add(sprite);
        sprite.setOwner(true);
        console.log(`[Network] Sprite ${sprite.syncId} marked as owned (will sync)`);
    }
    /**
     * Remove sprite from sync
     */
    removeOwnedSprite(sprite) {
        this.ownedSprites.delete(sprite);
        sprite.setOwner(false);
        console.log(`[Network] Sprite ${sprite.syncId} removed from sync`);
    }
    /**
     * Register callback for player join events
     */
    onPlayerJoin(callback) {
        this.playerJoinCallbacks.push(callback);
        console.log('[Network] Player join callback registered');
    }
    /**
     * Register callback for player leave events
     */
    onPlayerLeave(callback) {
        this.playerLeaveCallbacks.push(callback);
        console.log('[Network] Player leave callback registered');
    }
    /**
     * Send custom message to all players
     */
    send(event, data) {
        if (!this.socket || !this.roomCode) {
            console.warn('[Network] Cannot send message: not connected to room');
            return;
        }
        this.socket.emit('gameEvent', {
            room: this.roomCode,
            event,
            data,
        });
        console.log(`📤 [Network] Sent message '${event}':`, data);
    }
    /**
     * Register callback for custom messages
     */
    onMessage(event, callback) {
        if (!this.socket) {
            console.warn('[Network] Cannot register message handler: not connected');
            return;
        }
        // Add callback to list
        if (!this.messageCallbacks.has(event)) {
            this.messageCallbacks.set(event, []);
            // Set up socket listener (only once per event type)
            this.socket.on(event, (data) => {
                console.log(`📨 [Network] Received message '${event}':`, data);
                const callbacks = this.messageCallbacks.get(event);
                if (callbacks) {
                    callbacks.forEach(cb => cb(data));
                }
            });
        }
        this.messageCallbacks.get(event).push(callback);
        console.log(`📡 [Network] Message callback registered for '${event}'`);
    }
    /**
     * Get current player info
     */
    getPlayer() {
        if (!this.playerName)
            return null;
        return {
            name: this.playerName,
            isHost: this.isHost,
        };
    }
    /**
     * Get room code
     */
    getRoomCode() {
        return this.roomCode;
    }
    /**
     * Check if connected to server
     * @returns true if socket is connected, false otherwise
     */
    isConnected() {
        return this.socket !== null;
    }
    /**
     * Register callback for sprite sync updates from other players
     * Callback receives: { playerId: string, sprites: Array<{ id, x, y, angle, velocityX, velocityY }> }
     */
    onSpriteSync(callback) {
        this.spriteSyncCallbacks.push(callback);
        console.log('📡 [Network] Sprite sync callback registered');
    }
    /**
     * Disconnect and clean up
     */
    disconnect() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        console.log('[Network] Disconnected');
    }
    /**
     * Get message history (for testing)
     */
    getMessageHistory() {
        return this.messageHistory.slice(); // Return copy
    }
}
