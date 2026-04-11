// ============================================================
//  game.js — createGame() ties everything together
//
//  This is the main entry point. It creates the renderer,
//  physics world, input handler, and network connection,
//  then hands back a simple object your game code uses.
// ============================================================

import * as PIXI       from 'pixi.js';
import Matter          from 'matter-js';

import { Scene }       from './scene.js';
import { Sprite }      from './sprite.js';
import { Physics }     from './physics.js';
import { Input }       from './input.js';
import { Network }     from './network.js';
import { Camera }      from './camera.js';

// ------------------------------------------------------------------
//  createGame(options)
//
//  options = {
//    width:      800,          // canvas width  (default 800)
//    height:     600,          // canvas height (default 600)
//    gravity:    1,            // how strong gravity is (default 1, 0 = no gravity)
//    background: 0x87ceeb,     // background color as hex number
//    server:     'http://localhost:3000',  // multiplayer server URL
//  }
// ------------------------------------------------------------------
export function createGame(options = {}) {

  // --- settings with sensible defaults ---
  const config = {
    width:      options.width      ?? 800,
    height:     options.height     ?? 600,
    gravity:    options.gravity    ?? 1,
    background: options.background ?? 0x87ceeb,
    server:     options.server     ?? 'http://localhost:3000',
  };

  // --- pixi renderer ---
  const app = new PIXI.Application({
    width:           config.width,
    height:          config.height,
    backgroundColor: config.background,
    resolution:      window.devicePixelRatio || 1,
    autoDensity:     true,
    antialias:       true,
  });

  // make the canvas fill the screen on mobile too
  app.renderer.view.style.display = 'block';
  fitToScreen(app, config.width, config.height);
  window.addEventListener('resize', () => fitToScreen(app, config.width, config.height));
  document.body.appendChild(app.view);
  document.body.style.margin  = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#000';

  // --- matter.js physics world ---
  const engine  = Matter.Engine.create({ gravity: { y: config.gravity } });
  const world   = engine.world;

  // --- sub-systems ---
  const physics  = new Physics(engine, world);
  const input    = new Input(app.view);
  const camera   = new Camera(app.stage, config.width, config.height);
  const network  = new Network(config.server);
  const scene    = new Scene(app.stage, physics, network, camera);

  // --- game loop ---
  let lastTime = performance.now();

  app.ticker.add(() => {
    const now        = performance.now();
    const delta      = (now - lastTime) / 1000; // seconds
    lastTime         = now;
    const deltaMs    = Math.min(delta, 0.05) * 1000;

    // step physics (capped so it doesn't explode after a tab switch)
    Matter.Engine.update(engine, deltaMs);

    // sync physics bodies → pixi sprites
    scene.syncPhysics();

    // auto-broadcast owned sprites to other players
    network.tick(scene.getOwnedSprites(), deltaMs);

    // update camera
    camera.update();
  });

  // ------------------------------------------------------------------
  //  The public API — these are the functions your game.js will use
  // ------------------------------------------------------------------
  const game = {

    // --- scene helpers (returns a Sprite you can use) ---

    // Add a sprite to the game
    // game.sprite('hero.png', { x: 100, y: 200, width: 64, height: 64 })
    sprite(imagePath, options = {}) {
      return scene.addSprite(imagePath, options);
    },

    // Add a solid rectangle (good for floors, walls, platforms)
    // game.box({ x: 0, y: 580, width: 800, height: 20, color: 0x228B22 })
    box(options = {}) {
      return scene.addBox(options);
    },

    // Add a circle sprite
    // game.circle({ x: 400, y: 100, radius: 30, color: 0xff4444 })
    circle(options = {}) {
      return scene.addCircle(options);
    },

    // Load a tilemap (Tiled JSON format)
    // game.tilemap('assets/maps/level1.json')
    tilemap(path, options = {}) {
      return scene.loadTilemap(path, options);
    },

    // --- physics ---

    // Give a sprite gravity, collisions, and physics
    // game.addPhysics(player, { bounce: 0.2, friction: 0.8, isStatic: false })
    addPhysics(sprite, options = {}) {
      physics.add(sprite, options);
    },

    // Apply a force to a sprite (good for jumping or knockback)
    // game.applyForce(player, { x: 0, y: -0.05 })
    applyForce(sprite, force) {
      physics.applyForce(sprite, force);
    },

    // --- collision / overlap ---

    // Run a function when two sprites touch
    // game.onCollide(player, enemy, () => { player.die() })
    onCollide(spriteA, spriteB, callback) {
      physics.onCollide(spriteA, spriteB, callback);
    },

    // Run a function every frame two sprites overlap (no physics bounce)
    // game.onOverlap(player, coin, () => { coin.destroy() })
    onOverlap(spriteA, spriteB, callback) {
      physics.onOverlap(spriteA, spriteB, callback);
    },

    // --- input ---

    // Run when a key is pressed
    // game.onKey('ArrowRight', () => player.x += 5)
    onKey(key, callback) {
      input.onKey(key, callback);
    },

    // Check if a key is currently held (good inside the game loop)
    // if (game.isKeyDown('ArrowRight')) { ... }
    isKeyDown(key) {
      return input.isKeyDown(key);
    },

    // Run when the screen is tapped or clicked
    // game.onTap((x, y) => { player.moveTo(x, y) })
    onTap(callback) {
      input.onTap(callback);
    },

    // --- game loop ---

    // Run your own code every frame
    // game.onUpdate((delta) => { ... })
    onUpdate(callback) {
      app.ticker.add(delta => callback(delta / 60));
    },

    // --- multiplayer ---

    // Create a new room — you get back a 4-letter code to share with friends
    // game.createRoom('YourName').then(({ code }) => console.log('Share this code:', code))
    createRoom(playerName) {
      return network.createRoom(playerName, scene);
    },

    // Join a friend's room using their 4-letter code
    // game.joinRoom('ABCD', 'YourName')
    joinRoom(code, playerName) {
      return network.joinRoom(code, playerName, scene);
    },

    // Listen for custom messages from other players
    // game.onMessage('enemyDied', (data) => { ... })
    onMessage(event, callback) {
      network.on(event, callback);
    },

    // Send a custom message to all players in your room
    // game.send('bombExploded', { x: 100, y: 200 })
    send(event, data) {
      network.send(event, data);
    },

    // Update your score (server keeps it safe from cheating)
    // game.setScore(42)
    setScore(score) {
      network.setScore(score);
    },

    // Ask for the current leaderboard
    // game.onMessage('leaderboard', (data) => console.log(data.players))
    requestLeaderboard() {
      network.requestLeaderboard();
    },

    // --- camera ---

    // Make the camera follow a sprite
    // game.follow(player)
    follow(sprite) {
      camera.follow(sprite);
    },

    // --- utils ---

    // Pause or unpause the game
    pause()  { app.ticker.stop();  },
    resume() { app.ticker.start(); },

    // Access internals if you need them (advanced)
    _app:     app,
    _physics: physics,
    _scene:   scene,
    _network: network,
    _camera:  camera,
    _input:   input,
  };

  return game;
}

// ------------------------------------------------------------------
//  fitToScreen — makes the canvas scale to fill the window,
//  keeping the game's aspect ratio (letterboxed if needed)
// ------------------------------------------------------------------
function fitToScreen(app, gameWidth, gameHeight) {
  const scaleX = window.innerWidth  / gameWidth;
  const scaleY = window.innerHeight / gameHeight;
  const scale  = Math.min(scaleX, scaleY);

  app.renderer.view.style.width  = Math.floor(gameWidth  * scale) + 'px';
  app.renderer.view.style.height = Math.floor(gameHeight * scale) + 'px';
  app.renderer.view.style.marginLeft = 'auto';
  app.renderer.view.style.marginRight = 'auto';
}
