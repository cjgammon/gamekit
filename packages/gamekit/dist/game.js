/**
 * Game - Main game class
 * Orchestrates all subsystems: rendering, physics, input, network
 */
import { Renderer } from './renderer.js';
import { Physics } from './physics.js';
import { Input } from './input.js';
import { Network } from './network.js';
export class Game {
    constructor(options = {}) {
        // Sprite management
        this.sprites = [];
        // Game loop
        this.updateCallbacks = [];
        this.lastTime = performance.now();
        this.frameCount = 0;
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
        this.renderer = new Renderer(this.options.width, this.options.height, this.options.background);
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
    startGameLoop() {
        console.log('[Game] Starting game loop');
        this.renderer.start(() => {
            const now = performance.now();
            const delta = (now - this.lastTime) / 1000;
            this.lastTime = now;
            this.frameCount++;
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
    add(sprite) {
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
    remove(sprite) {
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
    onUpdate(callback) {
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
    isKeyDown(key) {
        return this.input.isKeyDown(key);
    }
    /**
     * Register callback for key press event
     * @param key - Key name
     * @param callback - Function to call when key is pressed
     */
    onKey(key, callback) {
        this.input.onKey(key, callback);
    }
    /**
     * Register callback for tap/click events
     * @param callback - Function to call with (x, y) coordinates
     */
    onTap(callback) {
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
    async createRoom(playerName) {
        console.log(`[Game] Creating room as '${playerName}'...`);
        return await this.network.createRoom(playerName);
    }
    /**
     * Join an existing multiplayer room
     * @param code - Room code from host
     * @param playerName - Your player name
     */
    async joinRoom(code, playerName) {
        console.log(`[Game] Joining room '${code}' as '${playerName}'...`);
        await this.network.joinRoom(code, playerName);
    }
    /**
     * Register callback for when a player joins the room
     * @param callback - Called with Player object
     */
    onPlayerJoin(callback) {
        this.network.onPlayerJoin(callback);
    }
    /**
     * Register callback for when a player leaves the room
     * @param callback - Called with Player object
     */
    onPlayerLeave(callback) {
        this.network.onPlayerLeave(callback);
    }
    /**
     * Send custom message to all players in room
     * @param event - Message event name
     * @param data - Message payload
     */
    send(event, data) {
        this.network.send(event, data);
    }
    /**
     * Register callback for custom messages
     * @param event - Message event name to listen for
     * @param callback - Called with message payload
     */
    onMessage(event, callback) {
        this.network.onMessage(event, callback);
    }
    /**
     * Mark a sprite as owned by this player (will be synced over network)
     * @param sprite - Sprite to sync
     */
    setOwner(sprite) {
        this.network.addOwnedSprite(sprite);
    }
    /**
     * Get current player info
     */
    getPlayer() {
        return this.network.getPlayer();
    }
    /**
     * Get current room code
     */
    getRoomCode() {
        return this.network.getRoomCode();
    }
    /**
     * Register callback for sprite sync updates from other players
     * @param callback - Called with { playerId, sprites: [{ id, x, y, angle, velocityX, velocityY }] }
     */
    onSpriteSync(callback) {
        this.network.onSpriteSync(callback);
    }
    // ============================================================
    // Test API (test mode only)
    // ============================================================
    /**
     * Get test API for E2E testing
     * Returns game state for assertions
     */
    getTestAPI() {
        return {
            // Sprite state
            getSprites: () => this.sprites.map(s => ({
                syncId: s.syncId,
                x: s.x,
                y: s.y,
                angle: s.angle,
                velocityX: s.velocityX,
                velocityY: s.velocityY,
                isOwned: s.isOwned,
            })),
            // Network state
            getNetworkState: () => ({
                isConnected: this.network.isConnected(),
                roomCode: this.network.getRoomCode(),
                player: this.network.getPlayer(),
            }),
            // Message history
            getMessageHistory: () => this.network.getMessageHistory(),
            // Frame count for timing verification
            getFrameCount: () => this.frameCount,
        };
    }
}
