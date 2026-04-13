/**
 * GKCircle - Circle sprite
 * Automatically creates PixiJS Graphics and Matter.js circle body
 */
import * as PIXI from 'pixi.js';
import { GKSprite } from './gk-sprite.js';
import type { GKCircleOptions } from './types.js';
export declare class GKCircle extends GKSprite {
    private _radius;
    constructor(options?: GKCircleOptions);
    get radius(): number;
    /**
     * Create PixiJS Graphics circle
     * Called by Game when sprite is added
     */
    _createPixiObject(): PIXI.Graphics;
    /**
     * Create Matter.js circle body
     * Called by Game when sprite is added
     */
    _createPhysicsBody(): any;
}
