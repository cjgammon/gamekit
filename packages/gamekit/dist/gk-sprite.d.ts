/**
 * GKSprite - Abstract base class for all sprites
 * Handles both rendering (PixiJS) and physics (Matter.js) automatically
 */
import type { BaseSpriteOptions } from './types.js';
import type { Physics } from './physics.js';
export declare abstract class GKSprite {
    protected _x: number;
    protected _y: number;
    protected _color: number;
    protected _isStatic: boolean;
    protected _bounce: number;
    protected _friction: number;
    protected _density: number;
    protected _noRotation: boolean;
    protected _frictionAir: number;
    _pixi: any;
    _body: any;
    _game: any;
    _physics: Physics | null;
    protected _collisionCallbacks: Map<GKSprite, Function>;
    protected _overlapCallbacks: Map<GKSprite, Function>;
    protected _isOwned: boolean;
    protected _syncId: string;
    constructor(options?: BaseSpriteOptions);
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
    get x(): number;
    set x(v: number);
    get y(): number;
    set y(v: number);
    get angle(): number;
    set angle(degrees: number);
    get velocityX(): number;
    get velocityY(): number;
    setVelocity(x: number, y: number): void;
    applyForce(forceX: number, forceY: number): void;
    moveLeft(speed?: number): void;
    moveRight(speed?: number): void;
    moveUp(speed?: number): void;
    moveDown(speed?: number): void;
    onCollide(other: GKSprite, callback: Function): void;
    onOverlap(other: GKSprite, callback: Function): void;
    _handleCollision(other: GKSprite): void;
    _handleOverlap(other: GKSprite): void;
    setOwner(owned: boolean): void;
    get isOwned(): boolean;
    get syncId(): string;
    /**
     * Internal: Link to game systems
     * Called by Game.add()
     */
    _linkToGame(game: any, physics: Physics): void;
    /**
     * Internal: Sync physics to rendering
     * Called every frame by Game loop
     */
    _syncPhysicsToRender(): void;
    /**
     * Clean up and remove sprite
     */
    destroy(): void;
}
