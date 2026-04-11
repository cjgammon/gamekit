// ============================================================
//  scene.js — manages everything visible in the game
//
//  Keeps track of all sprites, handles adding and removing
//  them, loads tilemaps, and creates ghost sprites for
//  remote players over the network.
// ============================================================

import * as PIXI from 'pixi.js';
import { Sprite } from './sprite.js';

let _nextSyncId = 1;

export class Scene {

  constructor(stage, physics, network, camera) {
    this._stage   = stage;
    this._physics = physics;
    this._network = network;
    this._camera  = camera;

    // all sprites currently in the scene
    this._sprites = [];

    // template for recreating ghost sprites (imagePath per syncId)
    this._spriteTemplates = {};
  }

  // ------------------------------------------------------------------
  //  addSprite(imagePath, options) → Sprite
  //
  //  Creates a sprite from an image file.
  //
  //  options = {
  //    x: 100, y: 200,
  //    width: 64, height: 64,    // optional — uses image size by default
  //    anchor: 0.5,              // 0.5 = centered (default)
  //  }
  // ------------------------------------------------------------------
  addSprite(imagePath, options = {}) {
    const texture = PIXI.Texture.from(imagePath);
    const pixi    = new PIXI.Sprite(texture);

    pixi.x = options.x ?? 0;
    pixi.y = options.y ?? 0;

    if (options.width)  pixi.width  = options.width;
    if (options.height) pixi.height = options.height;

    pixi.anchor.set(options.anchor ?? 0.5);

    this._stage.addChild(pixi);

    const syncId = String(_nextSyncId++);
    const sprite = new Sprite(pixi, { owned: true, syncId });

    // remember the template so we can recreate a ghost for remote players
    this._spriteTemplates[syncId] = { imagePath, options };

    this._sprites.push(sprite);
    return sprite;
  }

  // ------------------------------------------------------------------
  //  addBox(options) → Sprite
  //
  //  Creates a solid colored rectangle — great for platforms, walls.
  //
  //  options = {
  //    x, y, width, height,
  //    color: 0x228B22,   // fill color as hex
  //    isStatic: true,    // immovable by default
  //  }
  // ------------------------------------------------------------------
  addBox(options = {}) {
    const w     = options.width  ?? 100;
    const h     = options.height ?? 100;
    const color = options.color  ?? 0x888888;

    const gfx = new PIXI.Graphics();
    gfx.beginFill(color);
    gfx.drawRect(-w / 2, -h / 2, w, h);
    gfx.endFill();

    gfx.x = (options.x ?? 0) + w / 2;
    gfx.y = (options.y ?? 0) + h / 2;

    this._stage.addChild(gfx);

    const sprite = new Sprite(gfx, { owned: false, syncId: null });

    // boxes are static by default — add physics automatically
    this._physics.add(sprite, {
      isStatic:  options.isStatic ?? true,
      bounce:    options.bounce   ?? 0,
      friction:  options.friction ?? 0.8,
    });

    this._sprites.push(sprite);
    return sprite;
  }

  // ------------------------------------------------------------------
  //  addCircle(options) → Sprite
  // ------------------------------------------------------------------
  addCircle(options = {}) {
    const radius = options.radius ?? 30;
    const color  = options.color  ?? 0xff4444;

    const gfx = new PIXI.Graphics();
    gfx.beginFill(color);
    gfx.drawCircle(0, 0, radius);
    gfx.endFill();

    gfx.x = options.x ?? 0;
    gfx.y = options.y ?? 0;

    this._stage.addChild(gfx);

    const sprite = new Sprite(gfx, { owned: true, syncId: String(_nextSyncId++) });
    this._sprites.push(sprite);
    return sprite;
  }

  // ------------------------------------------------------------------
  //  loadTilemap(path, options) — loads a Tiled JSON tilemap
  //
  //  Renders the tiles visually and builds physics bodies for solid tiles.
  //  The tilemap JSON should have a layer named "Solid" for collision.
  // ------------------------------------------------------------------
  async loadTilemap(path, options = {}) {
    const response = await fetch(path);
    const map      = await response.json();

    const tileW    = map.tilewidth;
    const tileH    = map.tileheight;
    const cols     = map.width;

    // load the tileset image
    const tileset    = map.tilesets[0];
    const tilesetImg = tileset.image;
    const tilesetTex = PIXI.Texture.from(tilesetImg);
    const tilesetCols = Math.floor(tileset.imagewidth / tileW);

    const solidRects = [];

    for (const layer of map.layers) {
      if (layer.type !== 'tilelayer') continue;

      const isSolid = layer.name.toLowerCase() === 'solid';
      const container = new PIXI.Container();

      layer.data.forEach((tileId, i) => {
        if (tileId === 0) return; // empty tile

        const col = i % cols;
        const row = Math.floor(i / cols);

        // calculate which part of the tileset texture this tile uses
        const tileCol = (tileId - 1) % tilesetCols;
        const tileRow = Math.floor((tileId - 1) / tilesetCols);

        const frame = new PIXI.Rectangle(
          tileCol * tileW,
          tileRow * tileH,
          tileW,
          tileH,
        );

        const tex    = new PIXI.Texture(tilesetTex.baseTexture, frame);
        const sprite = new PIXI.Sprite(tex);

        sprite.x = col * tileW;
        sprite.y = row * tileH;

        container.addChild(sprite);

        if (isSolid) {
          solidRects.push({ x: col * tileW, y: row * tileH, width: tileW, height: tileH });
        }
      });

      this._stage.addChild(container);
    }

    // build physics bodies for solid tiles
    if (solidRects.length > 0) {
      this._physics.buildTilemapBodies(solidRects, tileW);
    }

    return map;
  }

  // ------------------------------------------------------------------
  //  syncPhysics() — called every frame to copy physics positions
  //  onto pixi sprites so they move on screen
  // ------------------------------------------------------------------
  syncPhysics() {
    for (const sprite of this._sprites) {
      if (sprite.destroyed) continue;
      if (!sprite._body)    continue;

      sprite._pixi.x        = sprite._body.position.x;
      sprite._pixi.y        = sprite._body.position.y;
      sprite._pixi.rotation = sprite._body.angle;
    }

    // clean up destroyed sprites
    this._sprites = this._sprites.filter(s => !s.destroyed);
  }

  // ------------------------------------------------------------------
  //  getOwnedSprites() — returns sprites that belong to this player
  //  (these are the ones that get auto-broadcast to the network)
  // ------------------------------------------------------------------
  getOwnedSprites() {
    return this._sprites.filter(s => s._owned && s._syncId && !s.destroyed);
  }

  // ------------------------------------------------------------------
  //  _createGhostSprite(snap) — creates a remote player's sprite
  //
  //  Called by Network when it receives a new sprite from another player.
  //  Uses the same image as the original sprite (matched by syncId).
  // ------------------------------------------------------------------
  _createGhostSprite(snap) {
    const template = this._spriteTemplates[snap.id];

    let pixi;

    if (template) {
      const texture = PIXI.Texture.from(template.imagePath);
      pixi          = new PIXI.Sprite(texture);

      if (template.options.width)  pixi.width  = template.options.width;
      if (template.options.height) pixi.height = template.options.height;
      pixi.anchor.set(template.options.anchor ?? 0.5);
    } else {
      // fallback: a semi-transparent rectangle
      pixi = new PIXI.Graphics();
      pixi.beginFill(0xff00ff, 0.5);
      pixi.drawRect(-20, -20, 40, 40);
      pixi.endFill();
    }

    pixi.x = snap.x;
    pixi.y = snap.y;
    pixi.alpha = 0.8; // slightly transparent so you can tell it's a ghost

    this._stage.addChild(pixi);

    const ghost = new Sprite(pixi, { owned: false, syncId: snap.id });
    this._sprites.push(ghost);
    return ghost;
  }
}
