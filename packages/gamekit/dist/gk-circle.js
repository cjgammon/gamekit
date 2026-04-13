/**
 * GKCircle - Circle sprite
 * Automatically creates PixiJS Graphics and Matter.js circle body
 */
import * as PIXI from 'pixi.js';
import { GKSprite } from './gk-sprite.js';
export class GKCircle extends GKSprite {
    constructor(options = {}) {
        super(options);
        this._radius = options.radius ?? 50;
        console.log(`[GKCircle] Radius: ${this._radius}, Color: 0x${this._color.toString(16)}`);
    }
    get radius() {
        return this._radius;
    }
    /**
     * Create PixiJS Graphics circle
     * Called by Game when sprite is added
     */
    _createPixiObject() {
        console.log('[GKCircle] Creating PixiJS Graphics circle');
        const graphics = new PIXI.Graphics();
        // Draw filled circle (centered at origin)
        graphics.beginFill(this._color);
        graphics.drawCircle(0, 0, this._radius);
        graphics.endFill();
        // Set position
        graphics.x = this._x;
        graphics.y = this._y;
        console.log(`[GKCircle] PixiJS Graphics created at (${this._x}, ${this._y})`);
        return graphics;
    }
    /**
     * Create Matter.js circle body
     * Called by Game when sprite is added
     */
    _createPhysicsBody() {
        if (!this._physics) {
            console.log('[GKCircle] No physics engine available, skipping body creation');
            return null;
        }
        console.log('[GKCircle] Creating Matter.js circle body');
        const body = this._physics.createCircleBody(this._x, this._y, this._radius, {
            isStatic: this._isStatic,
            bounce: this._bounce,
            friction: this._friction,
            density: this._density,
            noRotation: this._noRotation,
        });
        console.log(`[GKCircle] Physics body created (static: ${this._isStatic})`);
        return body;
    }
}
