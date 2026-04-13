/**
 * Game - Main game class
 * Orchestrates all subsystems: rendering, physics, input, network
 */

import type { GameOptions } from './types.js';
import type { GKSprite } from './gk-sprite.js';
import { Renderer } from './renderer.js';
import { Physics } from './physics.js';
import { Input } from './input.js';
import { Network } from './network.js';

export class Game {
  // Configuration
  private options: Required<GameOptions>;

  // Subsystems
  private renderer: Renderer;
  private physics: Physics;
  private input: Input;
  private network: Network;

  // Sprite management
  private sprites: GKSprite[] = [];

  // Game loop
  private updateCallbacks: Function[] = [];
  private lastTime: number = performance.now();

  constructor(options: GameOptions = {}) {
    // Set defaults
    this.options = {
      width: options.width ?? 800,
      height: options.height ?? 600,
      gravity: options.gravity ?? 1,
      background: options.background ?? 0x87ceeb,
      server: options.server ?? 'http://localhost:3000',
    };

    console.log('[Game] Created with options:', this.options);

    // Create renderer (Stage 2)
    this.renderer = new Renderer(
      this.options.width,
      this.options.height,
      this.options.background
    );

    // Create physics (Stage 3)
    this.physics = new Physics(this.options.gravity);

    // Create input system (Stage 5)
    this.input = new Input();

    // Create network system (Stage 7)
    this.network = new Network(this.options.server);

    // Start game loop (Stage 3)
    this.startGameLoop();

    console.log('[Game] Ready to add sprites with game.add(sprite)');
  }

  /**
   * Start the main game loop
   * Updates physics and syncs sprites every frame
   */
  private startGameLoop(): void {
    console.log('[Game] Starting game loop');

    this.renderer.start(() => {
      const now = performance.now();
      const delta = (now - this.lastTime) / 1000;
      this.lastTime = now;

      // Cap delta to prevent physics instability
      const deltaMs = Math.min(delta, 0.05) * 1000;

      // Update physics
      this.physics.update(deltaMs);

      // Sync all sprites (physics → rendering)
      for (const sprite of this.sprites) {
        sprite._syncPhysicsToRender();
      }

      // Call user update callbacks
      for (const callback of this.updateCallbacks) {
        callback();
      }
    });
  }

  // ============================================================
  // Sprite Management
  // ============================================================

  /**
   * Add a sprite to the game
   * Hooks sprite into all systems (render, physics, etc.)
   */
  add(sprite: GKSprite): void {
    console.log(`[Game] Adding sprite:`, sprite.constructor.name);

    // Link sprite to game and physics
    sprite._linkToGame(this, this.physics);

    // Create PixiJS object and add to stage (Stage 2)
    sprite._pixi = sprite._createPixiObject();
    if (sprite._pixi) {
      this.renderer.addToStage(sprite._pixi);
      console.log('[Game] Sprite added to render stage');
    }

    // Create Matter.js body and add to world (Stage 3)
    sprite._body = sprite._createPhysicsBody();
    if (sprite._body) {
      this.physics.addBody(sprite._body);
      console.log('[Game] Sprite added to physics world');
    }

    // Track sprite
    this.sprites.push(sprite);

    console.log(`[Game] Total sprites: ${this.sprites.length}`);
  }

  /**
   * Remove a sprite from the game
   */
  remove(sprite: GKSprite): void {
    const index = this.sprites.indexOf(sprite);
    if (index > -1) {
      this.sprites.splice(index, 1);
      sprite.destroy();
      console.log(`[Game] Removed sprite. Total: ${this.sprites.length}`);
    }
  }

  // ============================================================
  // Game Loop
  // ============================================================

  /**
   * Register callback to run every frame
   */
  onUpdate(callback: Function): void {
    console.log('[Game] onUpdate callback registered');
    this.updateCallbacks.push(callback);
  }

  // ============================================================
  // Input (Stage 5)
  // ============================================================

  /**
   * Check if a key is currently pressed
   * @param key - Key name (e.g., 'ArrowUp', 'w', 'Space')
   */
  isKeyDown(key: string): boolean {
    return this.input.isKeyDown(key);
  }

  /**
   * Register callback for key press event
   * @param key - Key name
   * @param callback - Function to call when key is pressed
   */
  onKey(key: string, callback: Function): void {
    this.input.onKey(key, callback);
  }

  /**
   * Register callback for tap/click events
   * @param callback - Function to call with (x, y) coordinates
   */
  onTap(callback: Function): void {
    this.input.onTap(callback);
  }

  // ============================================================
  // Multiplayer (Stage 7)
  // ============================================================

  /**
   * Create a new multiplayer room (become host)
   * @param playerName - Your player name
   * @returns Room code to share with other players
   */
  async createRoom(playerName: string): Promise<{ code: string }> {
    console.log(`[Game] Creating room as '${playerName}'...`);
    return await this.network.createRoom(playerName);
  }

  /**
   * Join an existing multiplayer room
   * @param code - Room code from host
   * @param playerName - Your player name
   */
  async joinRoom(code: string, playerName: string): Promise<void> {
    console.log(`[Game] Joining room '${code}' as '${playerName}'...`);
    await this.network.joinRoom(code, playerName);
  }

  /**
   * Register callback for when a player joins the room
   * @param callback - Called with Player object
   */
  onPlayerJoin(callback: Function): void {
    this.network.onPlayerJoin(callback);
  }

  /**
   * Register callback for when a player leaves the room
   * @param callback - Called with Player object
   */
  onPlayerLeave(callback: Function): void {
    this.network.onPlayerLeave(callback);
  }

  /**
   * Send custom message to all players in room
   * @param event - Message event name
   * @param data - Message payload
   */
  send(event: string, data: any): void {
    this.network.send(event, data);
  }

  /**
   * Register callback for custom messages
   * @param event - Message event name to listen for
   * @param callback - Called with message payload
   */
  onMessage(event: string, callback: Function): void {
    this.network.onMessage(event, callback);
  }

  /**
   * Mark a sprite as owned by this player (will be synced over network)
   * @param sprite - Sprite to sync
   */
  setOwner(sprite: GKSprite): void {
    this.network.addOwnedSprite(sprite);
  }

  /**
   * Get current player info
   */
  getPlayer(): { name: string; isHost: boolean } | null {
    return this.network.getPlayer();
  }

  /**
   * Get current room code
   */
  getRoomCode(): string | null {
    return this.network.getRoomCode();
  }

  /**
   * Register callback for sprite sync updates from other players
   * @param callback - Called with { playerId, sprites: [{ id, x, y, angle, velocityX, velocityY }] }
   */
  onSpriteSync(callback: Function): void {
    this.network.onSpriteSync(callback);
  }
}
