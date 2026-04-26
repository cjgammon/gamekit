// ============================================================
//  Multiplayer Platform Game
//  Fixed-screen platformer with jumping mechanics
// ============================================================

import { Game, GKBox, GKCircle } from '../../packages/gamekit/dist/index.js';

console.log('=== Multiplayer Platform Game ===\n');

// Game constants
const PLAYER_WIDTH = 20;
const PLAYER_HEIGHT = 40;
const PLAYER_SPEED = 5;
const JUMP_VELOCITY = -15;
const COLLECTIBLE_RADIUS = 10;

// Game state
let localPlayer = null;
let isGrounded = false;
let collectibles = [];
let playerScores = {};
let isHost = false;
let localPlayerId = null;

// UI elements
const roomInfo = document.getElementById('room-info');
const roomCodeEl = document.getElementById('room-code');
const scoreList = document.getElementById('score-list');
const waiting = document.getElementById('waiting');
const waitingMessage = document.getElementById('waiting-message');

// Get server URL from URL parameter or use default
const serverUrl = new URLSearchParams(window.location.search).get('server') || 'http://localhost:3000';
console.log(`Server URL: ${serverUrl}`);

// Create game with gravity
console.log('Creating game instance...');
const game = new Game({
  width: 800,
  height: 600,
  gravity: 1,  // Normal gravity for platformer
  background: 0x111111,
  server: serverUrl
});

console.log('Game instance created');

// ============================================================
// PLATFORMS AND WALLS
// ============================================================

console.log('Creating platforms...');

// Ground floor (full width)
const ground = new GKBox({
  x: 400,
  y: 580,
  width: 800,
  height: 40,
  color: 0x444444,
  isStatic: true
});
game.add(ground);

// Platform 1 (low left)
const platform1 = new GKBox({
  x: 150,
  y: 450,
  width: 200,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(platform1);

// Platform 2 (mid right)
const platform2 = new GKBox({
  x: 500,
  y: 350,
  width: 150,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(platform2);

// Platform 3 (mid left)
const platform3 = new GKBox({
  x: 300,
  y: 250,
  width: 180,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(platform3);

// Platform 4 (high right)
const platform4 = new GKBox({
  x: 600,
  y: 150,
  width: 120,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(platform4);

// Left wall
const leftWall = new GKBox({
  x: 10,
  y: 300,
  width: 20,
  height: 600,
  color: 0x444444,
  isStatic: true
});
game.add(leftWall);

// Right wall
const rightWall = new GKBox({
  x: 790,
  y: 300,
  width: 20,
  height: 600,
  color: 0x444444,
  isStatic: true
});
game.add(rightWall);

// Store platforms for collision detection
const platforms = [ground, platform1, platform2, platform3, platform4];

console.log('Platforms created');
