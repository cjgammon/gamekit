/**
 * GKBox - Rectangle sprite
 * Automatically creates PixiJS Graphics and Matter.js rectangle body
 */
import * as PIXI from 'pixi.js';
import { GKSprite } from './gk-sprite.js';
import type { GKBoxOptions } from './types.js';
export declare class GKBox extends GKSprite {
    private _width;
    private _height;
    constructor(options?: GKBoxOptions);
    get width(): number;
    get height(): number;
    /**
     * Create PixiJS Graphics rectangle
     * Called by Game when sprite is added
     */
    _createPixiObject(): PIXI.Graphics;
    /**
     * Create Matter.js rectangle body
     * Called by Game when sprite is added
     */
    _createPhysicsBody(): any;
}
