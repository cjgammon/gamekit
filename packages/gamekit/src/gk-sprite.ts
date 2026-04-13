/**
 * GKSprite - Abstract base class for all sprites
 * Handles both rendering (PixiJS) and physics (Matter.js) automatically
 */

import Matter from 'matter-js';
import type { BaseSpriteOptions } from './types.js';
import type { Physics } from './physics.js';

export abstract class GKSprite {
  // Protected properties (available to subclasses)
  protected _x: number;
  protected _y: number;
  protected _color: number;
  protected _isStatic: boolean;
  protected _bounce: number;
  protected _friction: number;
  protected _density: number;
  protected _noRotation: boolean;

  // Will be set when added to game (public for Game class access)
  _pixi: any = null;       // PixiJS display object
  _body: any = null;       // Matter.js physics body
  _game: any = null;       // Parent game instance
  _physics: Physics | null = null;  // Physics engine reference

  // Collision tracking
  protected _collisionCallbacks: Map<GKSprite, Function> = new Map();
  protected _overlapCallbacks: Map<GKSprite, Function> = new Map();

  // Multiplayer ownership
  protected _isOwned: boolean = false;
  protected _syncId: string;

  constructor(options: BaseSpriteOptions = {}) {
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

  /**
   * Subclasses must implement: create PixiJS display object
   * Called when sprite is added to game
   */
  abstract _createPixiObject(): any;

  /**
   * Subclasses must implement: create Matter.js physics body
   * Called when sprite is added to game
   */
  abstract _createPhysicsBody(): any;

  // ============================================================
  // Position & Transform
  // ============================================================

  get x(): number { return this._x; }
  set x(v: number) {
    this._x = v;
    if (this._pixi) this._pixi.x = v;
    if (this._body) this._body.position.x = v;
  }

  get y(): number { return this._y; }
  set y(v: number) {
    this._y = v;
    if (this._pixi) this._pixi.y = v;
    if (this._body) this._body.position.y = v;
  }

  get angle(): number {
    return this._body ? this._body.angle * (180 / Math.PI) : 0;
  }
  set angle(degrees: number) {
    if (this._body) {
      const radians = degrees * (Math.PI / 180);
      this._body.angle = radians;
      if (this._pixi) this._pixi.rotation = radians;
    }
  }

  // ============================================================
  // Physics Properties
  // ============================================================

  get velocityX(): number {
    return this._body ? this._body.velocity.x : 0;
  }

  get velocityY(): number {
    return this._body ? this._body.velocity.y : 0;
  }

  setVelocity(x: number, y: number): void {
    if (this._body) {
      Matter.Sleeping.set(this._body, false);  // Wake body if sleeping
      Matter.Body.setVelocity(this._body, { x, y });
    }
  }

  applyForce(forceX: number, forceY: number): void {
    if (this._body) {
      Matter.Body.applyForce(this._body, this._body.position, { x: forceX, y: forceY });
    }
  }

  // ============================================================
  // Movement Helpers
  // ============================================================

  moveLeft(speed: number = 5): void {
    this.x -= speed;
  }

  moveRight(speed: number = 5): void {
    this.x += speed;
  }

  moveUp(speed: number = 5): void {
    this.y -= speed;
  }

  moveDown(speed: number = 5): void {
    this.y += speed;
  }

  // ============================================================
  // Collision Callbacks
  // ============================================================

  onCollide(other: GKSprite, callback: Function): void {
    this._collisionCallbacks.set(other, callback);

    // Register with physics engine if both sprites have bodies
    if (this._body && other._body && this._physics) {
      this._physics.registerCollision(this._body, other._body, callback);
      console.log(`[${this.constructor.name}] onCollide registered with ${other.constructor.name}`);
    }
  }

  onOverlap(other: GKSprite, callback: Function): void {
    this._overlapCallbacks.set(other, callback);
    // Note: onOverlap uses the same collision detection
    // but typically used for trigger zones (future feature)
    if (this._body && other._body && this._physics) {
      this._physics.registerCollision(this._body, other._body, callback);
      console.log(`[${this.constructor.name}] onOverlap registered with ${other.constructor.name}`);
    }
  }

  _handleCollision(other: GKSprite): void {
    const callback = this._collisionCallbacks.get(other);
    if (callback) callback();
  }

  _handleOverlap(other: GKSprite): void {
    const callback = this._overlapCallbacks.get(other);
    if (callback) callback();
  }

  // ============================================================
  // Multiplayer
  // ============================================================

  setOwner(owned: boolean): void {
    this._isOwned = owned;
    console.log(`[${this.constructor.name}] Ownership set to ${owned}`);
  }

  get isOwned(): boolean {
    return this._isOwned;
  }

  get syncId(): string {
    return this._syncId;
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  /**
   * Internal: Link to game systems
   * Called by Game.add()
   */
  _linkToGame(game: any, physics: Physics): void {
    this._game = game;
    this._physics = physics;
  }

  /**
   * Internal: Sync physics to rendering
   * Called every frame by Game loop
   */
  _syncPhysicsToRender(): void {
    if (this._body && this._pixi) {
      this._pixi.x = this._body.position.x;
      this._pixi.y = this._body.position.y;
      this._pixi.rotation = this._body.angle;
    }
  }

  /**
   * Clean up and remove sprite
   */
  destroy(): void {
    console.log(`[${this.constructor.name}] Destroyed`);
    // Game will handle actual removal
    if (this._pixi) this._pixi.destroy();
  }
}
