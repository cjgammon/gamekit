/**
 * Network - Socket.io multiplayer client
 * Handles room management, sprite sync, and custom messaging
 */

import { io, Socket } from 'socket.io-client';
import type { Player, RoomData } from './types.js';
import type { GKSprite } from './gk-sprite.js';

export class Network {
  private socket: Socket | null = null;
  private serverUrl: string;
  private roomCode: string | null = null;
  private playerName: string | null = null;
  private isHost: boolean = false;

  // Callbacks
  private playerJoinCallbacks: Function[] = [];
  private playerLeaveCallbacks: Function[] = [];
  private messageCallbacks: Map<string, Function[]> = new Map();
  private spriteSyncCallbacks: Function[] = [];

  // Sprite tracking for sync
  private ownedSprites: Set<GKSprite> = new Set();
  private syncInterval: number | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    console.log(`[Network] Initialized with server: ${serverUrl}`);
  }

  /**
   * Create a new room (become host)
   */
  async createRoom(playerName: string): Promise<{ code: string }> {
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
      this.socket!.once('roomCreated', (data: any) => {
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
      this.socket!.once('roomError', (error: any) => {
        console.error('❌ [Network] Failed to create room:', error.message);
        reject(new Error(error.message));
      });

      // Send createRoom request (server expects { name })
      this.socket!.emit('createRoom', { name: playerName });
    });
  }

  /**
   * Join an existing room
   */
  async joinRoom(code: string, playerName: string): Promise<void> {
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
      this.socket!.once('roomJoined', (data: any) => {
        console.log(`\n✅ [Network] ═══════════════════════════════`);
        console.log(`✅ [Network] JOINED ROOM SUCCESSFULLY!`);
        console.log(`✅ [Network] Room Code: ${code}`);
        console.log(`✅ [Network] You are: ${playerName} (GUEST)`);
        console.log(`✅ [Network] Players in room:`, data.players.map((p: any) => p.name).join(', '));
        console.log(`✅ [Network] ═══════════════════════════════\n`);
        this.setupEventHandlers();
        this.startSpriteSync();
        resolve();
      });

      // Listen for errors
      this.socket!.once('roomError', (error: any) => {
        console.error('❌ [Network] Failed to join room:', error.message);
        reject(new Error(error.message));
      });

      // Send joinRoom request (server expects { code, name })
      this.socket!.emit('joinRoom', { code, name: playerName });
    });
  }

  /**
   * Set up Socket.io event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Player joined (server sends { player: ... })
    this.socket.on('playerJoined', (data: { player: Player }) => {
      console.log(`👋 [Network] Player joined: ${data.player.name}`);
      this.playerJoinCallbacks.forEach(cb => cb(data.player));
    });

    // Player left (server sends { playerId: ... })
    this.socket.on('playerLeft', (data: { playerId: string }) => {
      console.log(`👋 [Network] Player left: ${data.playerId}`);
      this.playerLeaveCallbacks.forEach(cb => cb({ id: data.playerId }));
    });

    // Sprite position sync
    let syncReceiveCount = 0;
    this.socket.on('spriteSync', (data: { playerId: string; sprites: any[] }) => {
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
  private startSpriteSync(): void {
    if (this.syncInterval) return;

    let syncCount = 0;
    this.syncInterval = window.setInterval(() => {
      if (!this.socket || this.ownedSprites.size === 0) return;

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
  addOwnedSprite(sprite: GKSprite): void {
    this.ownedSprites.add(sprite);
    sprite.setOwner(true);
    console.log(`[Network] Sprite ${sprite.syncId} marked as owned (will sync)`);
  }

  /**
   * Remove sprite from sync
   */
  removeOwnedSprite(sprite: GKSprite): void {
    this.ownedSprites.delete(sprite);
    sprite.setOwner(false);
    console.log(`[Network] Sprite ${sprite.syncId} removed from sync`);
  }

  /**
   * Register callback for player join events
   */
  onPlayerJoin(callback: Function): void {
    this.playerJoinCallbacks.push(callback);
    console.log('[Network] Player join callback registered');
  }

  /**
   * Register callback for player leave events
   */
  onPlayerLeave(callback: Function): void {
    this.playerLeaveCallbacks.push(callback);
    console.log('[Network] Player leave callback registered');
  }

  /**
   * Send custom message to all players
   */
  send(event: string, data: any): void {
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
  onMessage(event: string, callback: Function): void {
    if (!this.socket) {
      console.warn('[Network] Cannot register message handler: not connected');
      return;
    }

    // Add callback to list
    if (!this.messageCallbacks.has(event)) {
      this.messageCallbacks.set(event, []);

      // Set up socket listener (only once per event type)
      this.socket.on(event, (data: any) => {
        console.log(`📨 [Network] Received message '${event}':`, data);
        const callbacks = this.messageCallbacks.get(event);
        if (callbacks) {
          callbacks.forEach(cb => cb(data));
        }
      });
    }

    this.messageCallbacks.get(event)!.push(callback);
    console.log(`📡 [Network] Message callback registered for '${event}'`);
  }

  /**
   * Get current player info
   */
  getPlayer(): { name: string; isHost: boolean } | null {
    if (!this.playerName) return null;
    return {
      name: this.playerName,
      isHost: this.isHost,
    };
  }

  /**
   * Get room code
   */
  getRoomCode(): string | null {
    return this.roomCode;
  }

  /**
   * Register callback for sprite sync updates from other players
   * Callback receives: { playerId: string, sprites: Array<{ id, x, y, angle, velocityX, velocityY }> }
   */
  onSpriteSync(callback: Function): void {
    this.spriteSyncCallbacks.push(callback);
    console.log('📡 [Network] Sprite sync callback registered');
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
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
}
