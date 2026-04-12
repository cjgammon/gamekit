// ============================================================
//  physics.js — wraps Matter.js
//
//  Handles adding physics bodies to sprites, detecting
//  collisions and overlaps, and building tilemap collision shapes.
// ============================================================

import Matter from "matter-js";

export class Physics {
  constructor(engine, world) {
    this._engine = engine;
    this._world = world;

    // map from Matter body id → { spriteA, spriteB, callback, type }
    this._colliders = [];

    // listen for Matter collision events
    Matter.Events.on(engine, "collisionStart", (e) =>
      this._handleCollision(e, "start"),
    );
    Matter.Events.on(engine, "collisionActive", (e) =>
      this._handleCollision(e, "active"),
    );
  }

  // ------------------------------------------------------------------
  //  add(sprite, options)
  //
  //  Gives a sprite a physics body so it reacts to gravity and bumps.
  //
  //  options = {
  //    isStatic:  false,   // true = immovable (floors, walls)
  //    bounce:    0.2,     // how bouncy (0 = no bounce, 1 = super bouncy)
  //    friction:  0.8,     // surface friction
  //    density:   0.001,   // mass (higher = heavier)
  //    shape:     'rect',  // 'rect' or 'circle'
  //    noRotation: false,  // true = sprite won't tip over (great for players)
  //  }
  // ------------------------------------------------------------------
  add(sprite, options = {}) {
    const x = sprite.x;
    const y = sprite.y;
    const w = sprite.width;
    const h = sprite.height;

    const bodyOptions = {
      isStatic: options.isStatic ?? false,
      restitution: options.bounce ?? 0.2,
      friction: options.friction ?? 0.8,
      density: options.density ?? 0.001,
      frictionAir: options.airFriction ?? 0.01,
    };

    let body;

    if (options.shape === "circle") {
      const radius = options.radius ?? Math.min(w, h) / 2;
      body = Matter.Bodies.circle(x, y, radius, bodyOptions);
    } else {
      // addBox uses top-left x/y; Matter needs center coords
      const cx = sprite._width ? x + w / 2 : x;
      const cy = sprite._height ? y + h / 2 : y;
      body = Matter.Bodies.rectangle(cx, cy, w, h, bodyOptions);
    }

    // prevent the sprite from rotating (great for player characters)
    if (options.noRotation ?? true) {
      body.inertia = Infinity;
      body.inverseInertia = 0;
    }

    // link the body back to the sprite so collision handlers can find it
    body._sprite = sprite;

    Matter.Composite.add(this._world, body);
    sprite._body = body;

    return sprite;
  }

  // ------------------------------------------------------------------
  //  applyForce(sprite, { x, y })
  //
  //  Pushes a sprite — good for jumping, explosions, knockback.
  //  Force values are small: { x: 0, y: -0.05 } is a gentle jump.
  // ------------------------------------------------------------------
  applyForce(sprite, force) {
    if (!sprite._body) return;
    Matter.Body.applyForce(sprite._body, sprite._body.position, force);
  }

  // ------------------------------------------------------------------
  //  onCollide(spriteA, spriteB, callback)
  //
  //  Fires once when spriteA and spriteB first touch.
  // ------------------------------------------------------------------
  onCollide(spriteA, spriteB, callback) {
    this._colliders.push({ spriteA, spriteB, callback, type: "start" });
  }

  // ------------------------------------------------------------------
  //  onOverlap(spriteA, spriteB, callback)
  //
  //  Fires every frame while spriteA and spriteB are touching.
  //  (Used for overlap checks — no physics bounce.)
  // ------------------------------------------------------------------
  onOverlap(spriteA, spriteB, callback) {
    this._colliders.push({ spriteA, spriteB, callback, type: "active" });
  }

  // ------------------------------------------------------------------
  //  buildTilemapBodies(tilemapData, tileSize)
  //
  //  Creates static physics bodies for solid tiles in a tilemap.
  //  Merges adjacent tiles into larger rectangles to reduce body count.
  // ------------------------------------------------------------------
  buildTilemapBodies(solidRects, tileSize) {
    for (const rect of solidRects) {
      const body = Matter.Bodies.rectangle(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width,
        rect.height,
        { isStatic: true, friction: 0.8, restitution: 0 },
      );
      Matter.Composite.add(this._world, body);
    }
  }

  // ------------------------------------------------------------------
  //  removeBody(sprite) — called when a sprite is destroyed
  // ------------------------------------------------------------------
  removeBody(sprite) {
    if (sprite._body) {
      Matter.Composite.remove(this._world, sprite._body);
      sprite._body = null;
    }
  }

  // ------------------------------------------------------------------
  //  internal: handle Matter collision events
  // ------------------------------------------------------------------
  _handleCollision(event, type) {
    for (const pair of event.pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      const spriteA = bodyA._sprite;
      const spriteB = bodyB._sprite;

      if (!spriteA || !spriteB) continue;

      for (const col of this._colliders) {
        if (col.type !== type) continue;

        const match =
          (col.spriteA === spriteA && col.spriteB === spriteB) ||
          (col.spriteA === spriteB && col.spriteB === spriteA);

        if (match) col.callback(spriteA, spriteB);
      }
    }
  }
}
