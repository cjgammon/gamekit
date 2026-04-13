/**
 * GKBox - Rectangle sprite
 * Automatically creates PixiJS Graphics and Matter.js rectangle body
 */

import * as PIXI from 'pixi.js';
import { GKSprite } from './gk-sprite.js';
import type { GKBoxOptions } from './types.js';

export class GKBox extends GKSprite {
  private _width: number;
  private _height: number;

  constructor(options: GKBoxOptions = {}) {
    super(options);
    this._width = options.width ?? 100;
    this._height = options.height ?? 100;

    console.log(`[GKBox] Size: ${this._width}x${this._height}, Color: 0x${this._color.toString(16)}`);
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  /**
   * Create PixiJS Graphics rectangle
   * Called by Game when sprite is added
   */
  _createPixiObject(): PIXI.Graphics {
    console.log('[GKBox] Creating PixiJS Graphics rectangle');

    const graphics = new PIXI.Graphics();

    // Draw filled rectangle
    graphics.beginFill(this._color);
    graphics.drawRect(-this._width / 2, -this._height / 2, this._width, this._height);
    graphics.endFill();

    // Set position (centered anchor)
    graphics.x = this._x;
    graphics.y = this._y;

    console.log(`[GKBox] PixiJS Graphics created at (${this._x}, ${this._y})`);

    return graphics;
  }

  /**
   * Create Matter.js rectangle body
   * Called by Game when sprite is added
   */
  _createPhysicsBody(): any {
    if (!this._physics) {
      console.log('[GKBox] No physics engine available, skipping body creation');
      return null;
    }

    console.log('[GKBox] Creating Matter.js rectangle body');

    const body = this._physics.createRectangleBody(
      this._x,
      this._y,
      this._width,
      this._height,
      {
        isStatic: this._isStatic,
        bounce: this._bounce,
        friction: this._friction,
        density: this._density,
        noRotation: this._noRotation,
      }
    );

    console.log(`[GKBox] Physics body created (static: ${this._isStatic})`);

    return body;
  }
}
