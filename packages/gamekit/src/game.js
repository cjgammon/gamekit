// ============================================================
//  game.js — createGame() ties everything together
//
//  This is the main entry point. It creates the renderer,
//  physics world, input handler, and network connection,
//  then hands back a simple object your game code uses.
// ============================================================

import * as PIXI   from 'pixi.js';
import Matter      from 'matter-js';

import { Scene }   from './scene.js';
import { Physics } from './physics.js';
import { Input }   from './input.js';
import { Network } from './network.js';
import { Camera }  from './camera.js';
import { Lobby }   from './lobby.js';
import { Scoring } from './scoring.js';

// ------------------------------------------------------------------
//  createGame(options)
//
//  options = {
//    width:         800,
//    height:        600,
//    gravity:       1,          // 0 = no gravity (top-down games)
//    background:    0x87ceeb,   // background color as hex
//    server:        'http://localhost:3000',
//
//    // multiplayer lobby
//    lobby:         false,      // true = show lobby UI before game starts
//    maxPlayers:    2,          // how many players fill the room
//    title:         'GAME',     // title shown in the built-in lobby UI
//    lobbyElements: null,       // override with your own HTML element selectors
//
//    // scoring
//    scores:        false,      // true = engine tracks + displays scores
//    winScore:      7,          // score needed to win
//    resetDelay:    1200,       // ms pause between a point and relaunch
//  }
// ------------------------------------------------------------------
export function createGame(options = {}) {

  // --- settings with sensible defaults ---
  const config = {
    width:         options.width         ?? 800,
    height:        options.height        ?? 600,
    gravity:       options.gravity       ?? 1,
    background:    options.background    ?? 0x87ceeb,
    server:        options.server        ?? 'http://localhost:3000',
    lobby:         options.lobby         ?? false,
    maxPlayers:    options.maxPlayers    ?? 2,
    title:         options.title         ?? 'GAME',
    lobbyElements: options.lobbyElements ?? null,
    scores:        options.scores        ?? false,
    winScore:      options.winScore      ?? 7,
    resetDelay:    options.resetDelay    ?? 1200,
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

  app.renderer.view.style.display = 'block';
  fitToScreen(app, config.width, config.height);
  window.addEventListener('resize', () => fitToScreen(app, config.width, config.height));
  document.body.appendChild(app.view);
  document.body.style.margin     = '0';
  document.body.style.overflow   = 'hidden';
  document.body.style.background = '#000';

  // --- matter.js physics world ---
  const engine = Matter.Engine.create({ gravity: { y: config.gravity } });
  const world  = engine.world;

  // --- sub-systems ---
  const physics = new Physics(engine, world);
  const input   = new Input(app.view);
  const camera  = new Camera(app.stage, config.width, config.height);
  const network = new Network(config.server);
  const scene   = new Scene(app.stage, physics, network, camera);

  // --- lobby (optional) ---
  const lobby = config.lobby
    ? new Lobby(network, app.view, {
        maxPlayers:    config.maxPlayers,
        title:         config.title,
        lobbyElements: config.lobbyElements,
      })
    : null;

  // --- scoring (optional) ---
  const scoring = config.scores
    ? new Scoring(network, {
        winScore:   config.winScore,
        resetDelay: config.resetDelay,
      })
    : null;

  // --- game loop ---
  let lastTime = performance.now();

  app.ticker.add(() => {
    const now     = performance.now();
    const delta   = (now - lastTime) / 1000;
    lastTime      = now;
    const deltaMs = Math.min(delta, 0.05) * 1000;

    Matter.Engine.update(engine, deltaMs);
    scene.syncPhysics();
    network.tick(scene.getSyncedSprites(), deltaMs);
    camera.update();
  });

  // ------------------------------------------------------------------
  //  Public API
  // ------------------------------------------------------------------
  const game = {

    // --- scene ---

    sprite(imagePath, options = {}) {
      return scene.addSprite(imagePath, options);
    },

    box(options = {}) {
      return scene.addBox(options);
    },

    circle(options = {}) {
      return scene.addCircle(options);
    },

    tilemap(path, options = {}) {
      return scene.loadTilemap(path, options);
    },

    // --- physics ---

    addPhysics(sprite, options = {}) {
      physics.add(sprite, options);
    },

    applyForce(sprite, force) {
      physics.applyForce(sprite, force);
    },

    // --- collision ---

    onCollide(spriteA, spriteB, callback) {
      physics.onCollide(spriteA, spriteB, callback);
    },

    onOverlap(spriteA, spriteB, callback) {
      physics.onOverlap(spriteA, spriteB, callback);
    },

    // --- sync ---

    // Register any sprite for automatic position sync to other players.
    // Works for both physics sprites and static ones (like paddles).
    // game.sync(paddle)
    sync(sprite) {
      scene.syncSprite(sprite);
    },

    // --- input ---

    onKey(key, callback) {
      input.onKey(key, callback);
    },

    isKeyDown(key) {
      return input.isKeyDown(key);
    },

    onTap(callback) {
      input.onTap(callback);
    },

    // --- game loop ---

    onUpdate(callback) {
      app.ticker.add(() => callback());
    },

    // --- multiplayer lobby ---

    // Called when all players have joined and the game is ready to start.
    // callback receives { isHost, players, myIndex }
    onReady(callback) {
      if (lobby) {
        lobby.onReady(callback);
      } else {
        // no lobby — fire immediately as single player
        callback({ isHost: true, players: [], myIndex: 0 });
      }
    },

    // Create a room manually (when not using built-in lobby)
    createRoom(playerName) {
      return network.createRoom(playerName, scene);
    },

    // Join a room manually (when not using built-in lobby)
    joinRoom(code, playerName) {
      return network.joinRoom(code, playerName, scene);
    },

    // --- scoring ---

    // Score a point for a side ('left', 'right', or any name you choose).
    // Only the host should call this.
    // game.score('left')
    score(side) {
      if (!scoring) {
        console.warn('[GameKit] score() called but scores option is not enabled.');
        return;
      }
      scoring.score(side);
    },

    // Called after each point (after the reset delay) — use to relaunch ball etc.
    // game.onScore((side, scores) => launchBall())
    onScore(callback) {
      scoring?.onScore(callback);
    },

    // Called when a player reaches winScore.
    // game.onWin((side, scores) => { ... })
    onWin(callback) {
      scoring?.onWin(callback);
    },

    // Show custom text on the win screen.
    // game.setWinnerText('YOU WIN!')
    setWinnerText(text) {
      scoring?.setWinnerText(text);
    },

    // Update your score on the server leaderboard (anti-cheat).
    setScore(score) {
      network.setScore(score);
    },

    requestLeaderboard() {
      network.requestLeaderboard();
    },

    // Listen for custom messages from other players.
    onMessage(event, callback) {
      network.on(event, callback);
    },

    // Send a custom message to all players in the room.
    send(event, data) {
      network.send(event, data);
    },

    // --- camera ---

    follow(sprite, options = {}) {
      camera.follow(sprite, options);
    },

    // --- utils ---

    pause()  { app.ticker.stop();  },
    resume() { app.ticker.start(); },

    // Access internals (advanced)
    _app:     app,
    _physics: physics,
    _scene:   scene,
    _network: network,
    _camera:  camera,
    _input:   input,
    _lobby:   lobby,
    _scoring: scoring,
  };

  return game;
}

// ------------------------------------------------------------------
//  fitToScreen — scales canvas to fill window keeping aspect ratio
// ------------------------------------------------------------------
function fitToScreen(app, gameWidth, gameHeight) {
  const scale = Math.min(
    window.innerWidth  / gameWidth,
    window.innerHeight / gameHeight,
  );
  app.renderer.view.style.width      = Math.floor(gameWidth  * scale) + 'px';
  app.renderer.view.style.height     = Math.floor(gameHeight * scale) + 'px';
  app.renderer.view.style.marginLeft = 'auto';
  app.renderer.view.style.marginRight = 'auto';
}
