// ============================================================
//  sprite.js — the Sprite class
//
//  Coordinate system:
//    - Image sprites: x/y is CENTER (anchor 0.5)
//    - Box/circle sprites: x/y is TOP-LEFT corner
//    - Physics bodies always use CENTER internally
//    - x/y setters and syncPhysics handle the translation
// ============================================================

import Matter from "matter-js";

export class Sprite {
  constructor(pixiObject, options = {}) {
    this._pixi = pixiObject;
    this._body = null;
    this._owned = options.owned ?? true;
    this._syncId = options.syncId ?? null;
    this._synced = false;
    // set by addBox — tells setters how to offset for physics center
    this._width = options.width ?? 0;
    this._height = options.height ?? 0;
    this.data = {};
  }

  // x/y = pixi position (top-left for boxes, center for image sprites)
  get x() {
    return this._pixi.x;
  }
  set x(v) {
    this._pixi.x = v;
    if (this._body) {
      const cx = this._width ? v + this._width / 2 : v;
      Matter.Body.setPosition(this._body, { x: cx, y: this._body.position.y });
    }
  }

  get y() {
    return this._pixi.y;
  }
  set y(v) {
    this._pixi.y = v;
    if (this._body) {
      const cy = this._height ? v + this._height / 2 : v;
      Matter.Body.setPosition(this._body, { x: this._body.position.x, y: cy });
    }
  }

  get width() {
    return this._width || this._pixi.width;
  }
  get height() {
    return this._height || this._pixi.height;
  }

  get angle() {
    return this._pixi.angle;
  }
  set angle(v) {
    this._pixi.angle = v;
    if (this._body) Matter.Body.setAngle(this._body, v * (Math.PI / 180));
  }

  get visible() {
    return this._pixi.visible;
  }
  set visible(v) {
    this._pixi.visible = v;
  }

  get alpha() {
    return this._pixi.alpha;
  }
  set alpha(v) {
    this._pixi.alpha = v;
  }

  get velocityX() {
    return this._body?.velocity.x ?? 0;
  }
  get velocityY() {
    return this._body?.velocity.y ?? 0;
  }

  setVelocity(x, y) {
    if (this._body) Matter.Body.setVelocity(this._body, { x, y });
  }

  moveLeft(speed = 5) {
    if (this._body)
      Matter.Body.setVelocity(this._body, {
        x: -speed,
        y: this._body.velocity.y,
      });
    else this.x -= speed;
  }
  moveRight(speed = 5) {
    if (this._body)
      Matter.Body.setVelocity(this._body, {
        x: speed,
        y: this._body.velocity.y,
      });
    else this.x += speed;
  }
  moveUp(speed = 5) {
    if (this._body)
      Matter.Body.setVelocity(this._body, {
        x: this._body.velocity.x,
        y: -speed,
      });
    else this.y -= speed;
  }
  moveDown(speed = 5) {
    if (this._body)
      Matter.Body.setVelocity(this._body, {
        x: this._body.velocity.x,
        y: speed,
      });
    else this.y += speed;
  }

  jump(power = 10) {
    if (this._body)
      Matter.Body.setVelocity(this._body, {
        x: this._body.velocity.x,
        y: -power,
      });
  }

  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }

  setColor(hex) {
    this._pixi.tint = hex;
  }

  destroy() {
    this._pixi.destroy();
    this._destroyed = true;
  }

  get destroyed() {
    return !!this._destroyed;
  }

  // snapshot uses pixi position — consistent on both clients
  _snapshot() {
    return {
      id: this._syncId,
      x: this._pixi.x,
      y: this._pixi.y,
      vx: this._body?.velocity.x ?? 0,
      vy: this._body?.velocity.y ?? 0,
      a: this._pixi.rotation ?? 0,
    };
  }

  // use x/y setters so physics body stays in sync
  _applySnapshot(snap) {
    this.x = snap.x;
    this.y = snap.y;
    this._pixi.rotation = snap.a;
  }
}
