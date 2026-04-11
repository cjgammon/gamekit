// ============================================================
//  sprite.js — the Sprite class
//
//  A Sprite is anything you can see in the game — a player,
//  an enemy, a coin, a platform. It wraps a PixiJS display
//  object and optionally a Matter.js physics body.
// ============================================================

import Matter from 'matter-js';

export class Sprite {

  constructor(pixiObject, options = {}) {
    // the underlying pixi display object (sprite, graphics, etc.)
    this._pixi = pixiObject;

    // physics body — set later by Physics.add()
    this._body = null;

    // network — is this sprite owned by the local player?
    this._owned  = options.owned ?? true;
    this._syncId = options.syncId ?? null;

    // extra data your game can attach to sprites
    this.data = {};
  }

  // --- position ---

  get x() { return this._pixi.x; }
  set x(v) {
    this._pixi.x = v;
    if (this._body) Matter.Body.setPosition(this._body, { x: v, y: this._body.position.y });
  }

  get y() { return this._pixi.y; }
  set y(v) {
    this._pixi.y = v;
    if (this._body) Matter.Body.setPosition(this._body, { x: this._body.position.x, y: v });
  }

  // --- size ---

  get width()  { return this._pixi.width; }
  get height() { return this._pixi.height; }

  // --- rotation (in degrees, because degrees are friendlier) ---

  get angle() { return this._pixi.angle; }
  set angle(v) {
    this._pixi.angle = v;
    if (this._body) Matter.Body.setAngle(this._body, v * (Math.PI / 180));
  }

  // --- visibility ---

  get visible() { return this._pixi.visible; }
  set visible(v) { this._pixi.visible = v; }

  // --- alpha (0 = invisible, 1 = fully visible) ---

  get alpha() { return this._pixi.alpha; }
  set alpha(v) { this._pixi.alpha = v; }

  // --- velocity (only works if physics is enabled) ---

  get velocityX() { return this._body?.velocity.x ?? 0; }
  get velocityY() { return this._body?.velocity.y ?? 0; }

  setVelocity(x, y) {
    if (this._body) {
      Matter.Body.setVelocity(this._body, { x, y });
    }
  }

  // --- handy movement helpers ---

  moveLeft(speed = 5)  { if (this._body) Matter.Body.setVelocity(this._body, { x: -speed, y: this._body.velocity.y }); else this._pixi.x -= speed; }
  moveRight(speed = 5) { if (this._body) Matter.Body.setVelocity(this._body, { x:  speed, y: this._body.velocity.y }); else this._pixi.x += speed; }
  moveUp(speed = 5)    { if (this._body) Matter.Body.setVelocity(this._body, { x: this._body.velocity.x, y: -speed }); else this._pixi.y -= speed; }
  moveDown(speed = 5)  { if (this._body) Matter.Body.setVelocity(this._body, { x: this._body.velocity.x, y:  speed }); else this._pixi.y += speed; }

  // jump — applies an upward velocity (only if physics enabled)
  jump(power = 10) {
    if (this._body) {
      Matter.Body.setVelocity(this._body, { x: this._body.velocity.x, y: -power });
    }
  }

  // move to an x,y position smoothly over time (no physics)
  moveTo(x, y) {
    this._pixi.x = x;
    this._pixi.y = y;
  }

  // --- tinting (colorize the sprite) ---

  setColor(hex) { this._pixi.tint = hex; }

  // --- remove from game ---

  destroy() {
    this._pixi.destroy();
    // physics body cleanup is handled by Physics when it detects a destroyed sprite
    this._destroyed = true;
  }

  get destroyed() { return !!this._destroyed; }

  // --- snapshot for network sync ---
  // returns a small object with just the data that needs to travel over the network

  _snapshot() {
    return {
      id: this._syncId,
      x:  this._body ? this._body.position.x : this._pixi.x,
      y:  this._body ? this._body.position.y : this._pixi.y,
      vx: this._body?.velocity.x ?? 0,
      vy: this._body?.velocity.y ?? 0,
      a:  this._body ? this._body.angle : (this._pixi.rotation ?? 0),
    };
  }

  // apply a snapshot received from the network (remote/ghost sprites)
  _applySnapshot(snap) {
    // for remote sprites we move the pixi object directly
    // (interpolation happens in Network)
    this._pixi.x        = snap.x;
    this._pixi.y        = snap.y;
    this._pixi.rotation = snap.a;
  }
}


