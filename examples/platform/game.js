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

// ============================================================
// COLLISION DETECTION
// ============================================================

console.log('Setting up collision detection...');

// Ground detection - set isGrounded when player touches any platform
platforms.forEach(platform => {
  platform.onCollide(localPlayer, () => {
    isGrounded = true;
  });
});

console.log('Collision detection ready');

// ============================================================
// PLAYER CREATION
// ============================================================

const playerColors = [0xFF0000, 0x0000FF, 0x00FF00, 0xFFFF00, 0xFF00FF, 0xFFA500];

function createPlayer(playerIndex, playerName) {
  console.log(`Creating player ${playerIndex}: ${playerName}`);

  const color = playerColors[playerIndex % playerColors.length];

  // Spawn on ground initially
  const player = new GKBox({
    x: 400,
    y: 500,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    color: color,
    isStatic: false,
    bounce: 0,
    friction: 0.01
  });

  game.add(player);

  // Store player data
  player.playerName = playerName;
  player.score = 0;

  return player;
}

// Create local player (temporary - will be replaced in multiplayer setup)
console.log('Creating local player...');
localPlayer = createPlayer(0, 'Player 1');
localPlayerId = 'temp-id';
playerScores[localPlayerId] = 0;

console.log('Player created');

// ============================================================
// COLLECTIBLES
// ============================================================

function createCollectibles() {
  console.log('Creating collectibles...');

  // Clear existing collectibles
  collectibles.forEach(c => game.remove(c));
  collectibles = [];

  // Collectible positions (on platforms)
  const positions = [
    { x: 100, y: 560 },  // Ground left
    { x: 300, y: 560 },  // Ground center
    { x: 500, y: 560 },  // Ground right
    { x: 150, y: 430 },  // Platform 1
    { x: 500, y: 330 },  // Platform 2 left
    { x: 550, y: 330 },  // Platform 2 right
    { x: 300, y: 230 },  // Platform 3
    { x: 600, y: 130 },  // Platform 4
  ];

  positions.forEach((pos, index) => {
    const collectible = new GKCircle({
      x: pos.x,
      y: pos.y,
      radius: COLLECTIBLE_RADIUS,
      color: 0xFFD700,  // Gold
      isStatic: true
    });

    collectible.id = `collectible-${index}`;
    collectible.visible = true;

    game.add(collectible);
    collectibles.push(collectible);
  });

  console.log(`${collectibles.length} collectibles created`);
}

// Create initial collectibles
createCollectibles();

// Collectible collision detection
function setupCollectibleCollisions() {
  collectibles.forEach(collectible => {
    collectible.onCollide(localPlayer, () => {
      if (collectible.visible) {
        console.log(`Collected ${collectible.id}!`);

        // Hide collectible
        collectible.visible = false;

        // Increment score
        playerScores[localPlayerId]++;
        updateScoreDisplay();

        // TODO: Send network message (will be added in multiplayer task)
      }
    });
  });
}

setupCollectibleCollisions();

// Update score display
function updateScoreDisplay() {
  if (!scoreList) return;

  scoreList.innerHTML = '';

  Object.entries(playerScores).forEach(([playerId, score]) => {
    const playerName = playerId === localPlayerId ? localPlayer.playerName : `Player ${playerId}`;
    const playerColor = playerId === localPlayerId ? localPlayer.color : 0xFFFFFF;

    const colorHex = '#' + playerColor.toString(16).padStart(6, '0');

    const scoreItem = document.createElement('div');
    scoreItem.className = 'score-item';
    scoreItem.innerHTML = `
      <span><span class="player-color" style="background: ${colorHex}"></span>${playerName}</span>
      <span>${score}</span>
    `;
    scoreList.appendChild(scoreItem);
  });
}

// Initialize score display
updateScoreDisplay();

// ============================================================
// INPUT HANDLERS
// ============================================================

console.log('Setting up input handlers...');

// Horizontal movement (runs every frame)
game.onUpdate(() => {
  if (!localPlayer) return;

  // Left movement
  if (game.isKeyDown('ArrowLeft') || game.isKeyDown('a') || game.isKeyDown('A')) {
    localPlayer.setVelocity(-PLAYER_SPEED, localPlayer.body.velocity.y);
  }

  // Right movement
  if (game.isKeyDown('ArrowRight') || game.isKeyDown('d') || game.isKeyDown('D')) {
    localPlayer.setVelocity(PLAYER_SPEED, localPlayer.body.velocity.y);
  }

  // Check if player is falling (not on any platform)
  const isFalling = localPlayer.body.velocity.y > 0.5;
  if (isFalling && isGrounded) {
    // Player left platform, allow jump again when landing
    isGrounded = false;
  }
});

// Jump (only when grounded)
game.onKey(' ', () => {
  if (isGrounded && localPlayer) {
    console.log('Jump!');
    localPlayer.setVelocity(localPlayer.body.velocity.x, JUMP_VELOCITY);
    isGrounded = false; // Prevent double jump
  }
});

console.log('Input handlers ready');

// ============================================================
// MULTIPLAYER SETUP
// ============================================================

console.log('Setting up multiplayer...');

const urlParams = new URLSearchParams(window.location.search);
const roomCodeParam = urlParams.get('room');

if (roomCodeParam) {
  // Join existing room
  console.log(`Joining room: ${roomCodeParam}`);
  waitingMessage.textContent = `Joining room ${roomCodeParam}...`;
  waiting.style.display = 'block';

  const playerName = prompt('Enter your name:', 'Player') || 'Player';

  game.joinRoom(roomCodeParam, playerName)
    .then(() => {
      console.log('Joined room successfully');
      waiting.style.display = 'none';

      // Recreate local player with network sync
      game.remove(localPlayer);
      const playerIndex = game.players.length - 1;
      localPlayer = createPlayer(playerIndex, playerName);
      localPlayerId = game.playerId;
      playerScores[localPlayerId] = 0;

      // Enable network sync for local player
      game.setOwner(localPlayer);

      // Re-setup collision detection
      platforms.forEach(platform => {
        platform.onCollide(localPlayer, () => {
          isGrounded = true;
        });
      });
      setupCollectibleCollisions();

      updateScoreDisplay();
      console.log('Local player synced');
    })
    .catch(err => {
      console.error('Failed to join room:', err);
      waitingMessage.textContent = 'Failed to join room. Server running?';
      setTimeout(() => {
        waiting.style.display = 'none';
      }, 3000);
    });
} else {
  // Create new room
  console.log('Creating room...');
  waitingMessage.textContent = 'Creating room...';
  waiting.style.display = 'block';

  const playerName = prompt('Enter your name:', 'Player 1') || 'Player 1';

  game.createRoom(playerName)
    .then(({ code }) => {
      console.log(`Room created: ${code}`);
      console.log(`Share URL: ${window.location.href}?room=${code}`);
      isHost = true;

      waiting.style.display = 'none';

      // Display room code
      roomCodeEl.textContent = code;
      roomInfo.style.display = 'block';

      // Recreate local player with network sync
      game.remove(localPlayer);
      localPlayer = createPlayer(0, playerName);
      localPlayerId = game.playerId;
      playerScores[localPlayerId] = 0;

      // Enable network sync
      game.setOwner(localPlayer);

      // Re-setup collision detection
      platforms.forEach(platform => {
        platform.onCollide(localPlayer, () => {
          isGrounded = true;
        });
      });
      setupCollectibleCollisions();

      updateScoreDisplay();
      console.log('Host player synced');
    })
    .catch(err => {
      console.error('Failed to create room:', err);
      waitingMessage.textContent = 'Failed to create room. Server running on :3000?';
      setTimeout(() => {
        waiting.style.display = 'none';
      }, 3000);
    });
}

console.log('Multiplayer setup complete');
