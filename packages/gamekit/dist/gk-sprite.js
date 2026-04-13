/**
 * GKSprite - Abstract base class for all sprites
 * Handles both rendering (PixiJS) and physics (Matter.js) automatically
 */
import Matter from 'matter-js';
export class GKSprite {
    constructor(options = {}) {
        // Will be set when added to game (public for Game class access)
        this._pixi = null; // PixiJS display object
        this._body = null; // Matter.js physics body
        this._game = null; // Parent game instance
        this._physics = null; // Physics engine reference
        // Collision tracking
        this._collisionCallbacks = new Map();
        this._overlapCallbacks = new Map();
        // Multiplayer ownership
        this._isOwned = false;
        this._x = options.x ?? 0;
        this._y = options.y ?? 0;
        this._color = options.color ?? 0x888888;
        this._isStatic = options.isStatic ?? false;
        this._bounce = options.bounce ?? 0.2;
        this._friction = options.friction ?? 0.8;
        this._density = options.density ?? 0.001;
        this._noRotation = options.noRotation ?? true;
        this._syncId = Math.random().toString(36).substr(2, 9);
        console.log(`[${this.constructor.name}] Created at (${this._x}, ${this._y})`);
    }
    // ============================================================
    // Position & Transform
    // ============================================================
    get x() { return this._x; }
    set x(v) {
        this._x = v;
        if (this._pixi)
            this._pixi.x = v;
        if (this._body)
            this._body.position.x = v;
    }
    get y() { return this._y; }
    set y(v) {
        this._y = v;
        if (this._pixi)
            this._pixi.y = v;
        if (this._body)
            this._body.position.y = v;
    }
    get angle() {
        return this._body ? this._body.angle * (180 / Math.PI) : 0;
    }
    set angle(degrees) {
        if (this._body) {
            const radians = degrees * (Math.PI / 180);
            this._body.angle = radians;
            if (this._pixi)
                this._pixi.rotation = radians;
        }
    }
    // ============================================================
    // Physics Properties
    // ============================================================
    get velocityX() {
        return this._body ? this._body.velocity.x : 0;
    }
    get velocityY() {
        return this._body ? this._body.velocity.y : 0;
    }
    setVelocity(x, y) {
        if (this._body) {
            Matter.Sleeping.set(this._body, false); // Wake body if sleeping
            Matter.Body.setVelocity(this._body, { x, y });
        }
    }
    applyForce(forceX, forceY) {
        if (this._body) {
            Matter.Body.applyForce(this._body, this._body.position, { x: forceX, y: forceY });
        }
    }
    // ============================================================
    // Movement Helpers
    // ============================================================
    moveLeft(speed = 5) {
        this.x -= speed;
    }
    moveRight(speed = 5) {
        this.x += speed;
    }
    moveUp(speed = 5) {
        this.y -= speed;
    }
    moveDown(speed = 5) {
        this.y += speed;
    }
    // ============================================================
    // Collision Callbacks
    // ============================================================
    onCollide(other, callback) {
        this._collisionCallbacks.set(other, callback);
        // Register with physics engine if both sprites have bodies
        if (this._body && other._body && this._physics) {
            this._physics.registerCollision(this._body, other._body, callback);
            console.log(`[${this.constructor.name}] onCollide registered with ${other.constructor.name}`);
        }
    }
    onOverlap(other, callback) {
        this._overlapCallbacks.set(other, callback);
        // Note: onOverlap uses the same collision detection
        // but typically used for trigger zones (future feature)
        if (this._body && other._body && this._physics) {
            this._physics.registerCollision(this._body, other._body, callback);
            console.log(`[${this.constructor.name}] onOverlap registered with ${other.constructor.name}`);
        }
    }
    _handleCollision(other) {
        const callback = this._collisionCallbacks.get(other);
        if (callback)
            callback();
    }
    _handleOverlap(other) {
        const callback = this._overlapCallbacks.get(other);
        if (callback)
            callback();
    }
    // ============================================================
    // Multiplayer
    // ============================================================
    setOwner(owned) {
        this._isOwned = owned;
        console.log(`[${this.constructor.name}] Ownership set to ${owned}`);
    }
    get isOwned() {
        return this._isOwned;
    }
    get syncId() {
        return this._syncId;
    }
    // ============================================================
    // Lifecycle
    // ============================================================
    /**
     * Internal: Link to game systems
     * Called by Game.add()
     */
    _linkToGame(game, physics) {
        this._game = game;
        this._physics = physics;
    }
    /**
     * Internal: Sync physics to rendering
     * Called every frame by Game loop
     */
    _syncPhysicsToRender() {
        if (this._body && this._pixi) {
            this._pixi.x = this._body.position.x;
            this._pixi.y = this._body.position.y;
            this._pixi.rotation = this._body.angle;
        }
    }
    /**
     * Clean up and remove sprite
     */
    destroy() {
        console.log(`[${this.constructor.name}] Destroyed`);
        // Game will handle actual removal
        if (this._pixi)
            this._pixi.destroy();
    }
}
