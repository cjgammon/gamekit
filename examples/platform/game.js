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
console.log('Ready for platform setup');
