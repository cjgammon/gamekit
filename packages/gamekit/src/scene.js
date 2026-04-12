// ============================================================
//  scene.js — manages everything visible in the game
// ============================================================

import * as PIXI from "pixi.js";
import { Sprite } from "./sprite.js";

let _nextSyncId = 1;

export class Scene {
  constructor(stage, physics, network, camera) {
    this._stage = stage;
    this._physics = physics;
    this._network = network;
    this._camera = camera;

    this._sprites = [];

    // syncId → template (for recreating shapes on remote clients)
    this._spriteTemplates = {};

    // syncId → local Sprite (for updating in place instead of ghost creation)
    this._localSyncedById = {};
  }

  // ------------------------------------------------------------------
  //  addSprite(imagePath, options) → Sprite
  // ------------------------------------------------------------------
  addSprite(imagePath, options = {}) {
    const texture = PIXI.Texture.from(imagePath);
    const pixi = new PIXI.Sprite(texture);

    pixi.x = options.x ?? 0;
    pixi.y = options.y ?? 0;
    if (options.width) pixi.width = options.width;
    if (options.height) pixi.height = options.height;
    pixi.anchor.set(options.anchor ?? 0.5);

    this._stage.addChild(pixi);

    const syncId = String(_nextSyncId++);
    const sprite = new Sprite(pixi, { owned: true, syncId });
    this._spriteTemplates[syncId] = { type: "image", imagePath, options };

    this._sprites.push(sprite);
    return sprite;
  }

  // ------------------------------------------------------------------
  //  addBox(options) → Sprite
  //  x/y = top-left corner of the box
  // ------------------------------------------------------------------
  addBox(options = {}) {
    const w = options.width ?? 100;
    const h = options.height ?? 100;
    const color = options.color ?? 0x888888;

    const gfx = new PIXI.Graphics();
    gfx.beginFill(color);
    gfx.drawRect(0, 0, w, h); // drawn from (0,0) so gfx.x/y = top-left
    gfx.endFill();
    gfx.x = options.x ?? 0;
    gfx.y = options.y ?? 0;

    this._stage.addChild(gfx);

    // pass width/height to Sprite so its x/y setters can offset for physics center
    const sprite = new Sprite(gfx, {
      owned: false,
      syncId: null,
      width: w,
      height: h,
    });
    sprite._template = { type: "box", color, width: w, height: h };

    this._physics.add(sprite, {
      isStatic: options.isStatic ?? true,
      bounce: options.bounce ?? 0,
      friction: options.friction ?? 0.8,
    });

    this._sprites.push(sprite);
    return sprite;
  }

  // ------------------------------------------------------------------
  //  addCircle(options) → Sprite
  // ------------------------------------------------------------------
  addCircle(options = {}) {
    const radius = options.radius ?? 30;
    const color = options.color ?? 0xff4444;

    const gfx = new PIXI.Graphics();
    gfx.beginFill(color);
    gfx.drawCircle(0, 0, radius);
    gfx.endFill();
    gfx.x = options.x ?? 0;
    gfx.y = options.y ?? 0;

    this._stage.addChild(gfx);

    const sprite = new Sprite(gfx, {
      owned: true,
      syncId: String(_nextSyncId++),
    });
    sprite._template = { type: "circle", color, radius };
    this._sprites.push(sprite);
    return sprite;
  }

  // ------------------------------------------------------------------
  //  loadTilemap(path) — Tiled JSON format
  // ------------------------------------------------------------------
  async loadTilemap(path, options = {}) {
    const response = await fetch(path);
    const map = await response.json();

    const tileW = map.tilewidth;
    const tileH = map.tileheight;
    const cols = map.width;
    const tileset = map.tilesets[0];
    const tilesetTex = PIXI.Texture.from(tileset.image);
    const tilesetCols = Math.floor(tileset.imagewidth / tileW);
    const solidRects = [];

    for (const layer of map.layers) {
      if (layer.type !== "tilelayer") continue;
      const isSolid = layer.name.toLowerCase() === "solid";
      const container = new PIXI.Container();

      layer.data.forEach((tileId, i) => {
        if (tileId === 0) return;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const tileCol = (tileId - 1) % tilesetCols;
        const tileRow = Math.floor((tileId - 1) / tilesetCols);
        const frame = new PIXI.Rectangle(
          tileCol * tileW,
          tileRow * tileH,
          tileW,
          tileH,
        );
        const spr = new PIXI.Sprite(
          new PIXI.Texture(tilesetTex.baseTexture, frame),
        );
        spr.x = col * tileW;
        spr.y = row * tileH;
        container.addChild(spr);
        if (isSolid)
          solidRects.push({
            x: col * tileW,
            y: row * tileH,
            width: tileW,
            height: tileH,
          });
      });

      this._stage.addChild(container);
    }

    if (solidRects.length > 0)
      this._physics.buildTilemapBodies(solidRects, tileW);
    return map;
  }

  // ------------------------------------------------------------------
  //  syncPhysics() — copy physics body positions onto pixi sprites
  //
  //  Skips isStatic bodies — those are moved by game code directly
  //  and synced over the network. Running physics on them would
  //  override the position the game code just set.
  // ------------------------------------------------------------------
  syncPhysics() {
    for (const sprite of this._sprites) {
      if (sprite.destroyed) continue;
      if (!sprite._body) continue;
      if (sprite._body.isStatic) continue; // moved by game code, not physics

      // body position is CENTER; box sprites use TOP-LEFT for x/y
      if (sprite._width) {
        sprite._pixi.x = sprite._body.position.x - sprite._width / 2;
        sprite._pixi.y = sprite._body.position.y - sprite._height / 2;
      } else {
        sprite._pixi.x = sprite._body.position.x;
        sprite._pixi.y = sprite._body.position.y;
      }
      sprite._pixi.rotation = sprite._body.angle;
    }

    this._sprites = this._sprites.filter((s) => !s.destroyed);
  }

  // ------------------------------------------------------------------
  //  syncSprite(sprite) — mark a sprite as owned + register for sync
  //
  //  After calling this, the engine will:
  //    - broadcast this sprite's position to other players every tick
  //    - let the receiving client update the matching local sprite
  //      in place (no ghost created if the syncId is already known)
  // ------------------------------------------------------------------
  syncSprite(sprite) {
    if (!sprite._syncId) {
      sprite._syncId = String(_nextSyncId++);
    }
    sprite._owned = true;
    sprite._synced = true;

    // register template so remote clients can draw the right shape
    if (sprite._template) {
      this._spriteTemplates[sprite._syncId] = sprite._template;
    }

    // register in the local lookup so incoming updates go to this sprite
    this._localSyncedById[sprite._syncId] = sprite;
  }

  // ------------------------------------------------------------------
  //  getSyncedSprites() — sprites to broadcast each tick
  // ------------------------------------------------------------------
  getSyncedSprites() {
    return this._sprites.filter(
      (s) => !s.destroyed && s._owned && s._syncId && (s._body || s._synced),
    );
  }

  // ------------------------------------------------------------------
  //  _createGhostSprite(snap)
  //
  //  Called by Network when it receives a sprite from another player.
  //
  //  KEY BEHAVIOUR: if both clients run the same game.js, they both
  //  create the same sprites with the same syncIds. In that case we
  //  return the existing local sprite so Network updates it in place
  //  instead of creating a duplicate ghost on top.
  //
  //  Only creates a true ghost for sprites that don't exist locally
  //  (e.g. a remote player character that only lives on their client).
  // ------------------------------------------------------------------
  _createGhostSprite(snap) {
    // if we already have this sprite locally, just return it
    if (this._localSyncedById[snap.id]) {
      return this._localSyncedById[snap.id];
    }

    // otherwise build a ghost from the template
    const template = this._spriteTemplates[snap.id];
    let pixi;

    if (template?.type === "box") {
      pixi = new PIXI.Graphics();
      pixi.beginFill(template.color);
      pixi.drawRect(0, 0, template.width, template.height); // top-left origin matches snapshot coords
      pixi.endFill();
    } else if (template?.type === "circle") {
      pixi = new PIXI.Graphics();
      pixi.beginFill(template.color);
      pixi.drawCircle(0, 0, template.radius);
      pixi.endFill();
    } else if (template?.type === "image") {
      const texture = PIXI.Texture.from(template.imagePath);
      pixi = new PIXI.Sprite(texture);
      if (template.options.width) pixi.width = template.options.width;
      if (template.options.height) pixi.height = template.options.height;
      pixi.anchor.set(template.options.anchor ?? 0.5);
    } else {
      // fallback — magenta means a template is missing
      pixi = new PIXI.Graphics();
      pixi.beginFill(0xff00ff, 0.8);
      pixi.drawRect(0, 0, 40, 40);
      pixi.endFill();
    }

    pixi.x = snap.x;
    pixi.y = snap.y;
    this._stage.addChild(pixi);

    const ghost = new Sprite(pixi, {
      owned: false,
      syncId: snap.id,
      width: template?.width ?? 0,
      height: template?.height ?? 0,
    });
    this._sprites.push(ghost);
    return ghost;
  }
}
