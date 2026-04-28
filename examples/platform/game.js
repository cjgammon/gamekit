// ============================================================
//  Multiplayer Platform Game
//  Fixed-screen platformer with jumping mechanics
// ============================================================

import { Game, GKBox, GKCircle } from '../../packages/gamekit/dist/index.js';

console.log('╔════════════════════════════════════════╗');
console.log('║   MULTIPLAYER PLATFORM GAME - GAMEKIT  ║');
console.log('╚════════════════════════════════════════╝\n');
console.log('Controls:');
console.log('  ← → or A/D : Move left/right');
console.log('  Space      : Jump');
console.log('\nMultiplayer:');
console.log('  Host creates room, guests join with ?room=CODE');
console.log('');

// Game constants
const PLAYER_WIDTH = 20;
const PLAYER_HEIGHT = 40;
const PLAYER_SPEED = 5;
const JUMP_VELOCITY = -12;
const COLLECTIBLE_RADIUS = 10;

// Game state
let localPlayer = null;
let remotePlayers = new Map(); // Map of playerId -> sprite
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
// PLAYER CREATION
// ============================================================

const playerColors = [0xFF0000, 0x0000FF, 0x00FF00, 0xFFFF00, 0xFF00FF, 0xFFA500];

// Get spawn position for new player
function getSpawnPosition(playerIndex) {
  const spawnPositions = [
    { x: 100, y: 500 },   // Ground left
    { x: 400, y: 500 },   // Ground center
    { x: 700, y: 500 },   // Ground right
    { x: 150, y: 400 },   // Platform 1
    { x: 500, y: 300 },   // Platform 2
    { x: 300, y: 200 },   // Platform 3
  ];

  return spawnPositions[playerIndex % spawnPositions.length];
}

function createPlayer(playerIndex, playerName) {
  console.log(`Creating player ${playerIndex}: ${playerName}`);

  const color = playerColors[playerIndex % playerColors.length];
  const spawnPos = getSpawnPosition(playerIndex);

  const player = new GKBox({
    x: spawnPos.x,
    y: spawnPos.y,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    color: color,
    isStatic: false,
    bounce: 0,
    friction: 0.01
  });

  game.add(player);

  player.playerName = playerName;
  player.score = 0;
  player.color = color;

  return player;
}

// Create local player (temporary - will be replaced in multiplayer setup)
console.log('Creating local player...');
localPlayer = createPlayer(0, 'Player 1');
localPlayerId = 'temp-id';
playerScores[localPlayerId] = 0;

console.log('Player created');

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
// COLLECTIBLES
// ============================================================

function createCollectibles() {
  console.log('Creating collectibles...');

  // Clear existing collectibles
  collectibles.forEach(c => game.remove(c));
  collectibles = [];

  // Collectible positions (on platforms)
  const positions = [
    { x: 200, y: 560 },  // Ground left (moved away from spawn)
    { x: 350, y: 560 },  // Ground center
    { x: 550, y: 560 },  // Ground right
    { x: 150, y: 430 },  // Platform 1
    { x: 500, y: 330 },  // Platform 2 left
    { x: 520, y: 330 },  // Platform 2 right
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
    game.add(collectible);

    // Make collectible a sensor (no physical collision, only triggers events)
    collectible._body.isSensor = true;

    collectible._pixi.visible = true;  // Set visibility after adding to game
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
      if (collectible._pixi.visible) {
        console.log(`Collected ${collectible.id}!`);

        // Hide collectible visually and remove physics body
        collectible._pixi.visible = false;
        game.physics.removeBody(collectible._body);

        // Increment score
        playerScores[localPlayerId]++;
        updateScoreDisplay();

        // Send network message
        game.send('collectItem', {
          id: collectible.id,
          playerId: localPlayerId
        });
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

function setupInputHandlers() {
  console.log('Setting up input handlers...');

  // Horizontal movement (runs every frame)
  game.onUpdate(() => {
    if (!localPlayer || !localPlayer._body) return;

    // Left movement
    if (game.isKeyDown('ArrowLeft') || game.isKeyDown('a') || game.isKeyDown('A')) {
      localPlayer.setVelocity(-PLAYER_SPEED, localPlayer._body.velocity.y);
    }

    // Right movement
    if (game.isKeyDown('ArrowRight') || game.isKeyDown('d') || game.isKeyDown('D')) {
      localPlayer.setVelocity(PLAYER_SPEED, localPlayer._body.velocity.y);
    }

    // Check if player is falling (not on any platform)
    const isFalling = localPlayer._body.velocity.y > 0.5;
    if (isFalling && isGrounded) {
      // Player left platform, allow jump again when landing
      isGrounded = false;
    }
  });

  // Jump (only when grounded)
  game.onKey(' ', () => {
    if (isGrounded && localPlayer && localPlayer._body) {
      localPlayer.setVelocity(localPlayer._body.velocity.x, JUMP_VELOCITY);
      isGrounded = false; // Prevent double jump
    }
  });

  console.log('Input handlers ready');
}

// ============================================================
// NETWORK MESSAGES
// ============================================================

function setupNetworkMessageHandlers() {
  console.log('Setting up network message handlers...');

  // Handle collectible collection
  game.onMessage('collectItem', (data) => {
    console.log(`Player ${data.playerId} collected ${data.id}`);

    const collectible = collectibles.find(c => c.id === data.id);
    if (collectible && collectible._pixi.visible) {
      // Hide collectible visually and remove physics body
      collectible._pixi.visible = false;
      game.physics.removeBody(collectible._body);
    }

    // Update scores
    if (!playerScores[data.playerId]) {
      playerScores[data.playerId] = 0;
    }
    playerScores[data.playerId]++;
    updateScoreDisplay();
  });

  // Handle score updates
  game.onMessage('scoreUpdate', (data) => {
    console.log(`Score update: ${data.playerId} = ${data.score}`);
    playerScores[data.playerId] = data.score;
    updateScoreDisplay();
  });

  // Handle player sprite ID mapping
  game.onMessage('playerSprite', (data) => {
    console.log(`📨 Received playerSprite: player ${data.playerId} has sprite ${data.syncId}`);

    // Skip if this is our own player
    if (data.playerId === localPlayerId) {
      console.log('  ↳ Skipping (our own player)');
      return;
    }

    // Find or create the remote player sprite
    let remotePlayer = remotePlayers.get(data.playerId);
    if (remotePlayer) {
      // Update existing sprite's syncId
      console.log(`  ↳ Updating existing remote player`);
      remotePlayer._syncId = data.syncId;
    } else {
      // Player sprite message arrived - create sprite now
      console.log(`  ↳ Creating NEW remote player sprite`);
      const playerIndex = remotePlayers.size + 1;
      remotePlayer = createPlayer(playerIndex, 'Player ' + playerIndex);
      remotePlayer.playerId = data.playerId;
      remotePlayer._syncId = data.syncId;
      remotePlayers.set(data.playerId, remotePlayer);
      playerScores[data.playerId] = 0;
      updateScoreDisplay();
      console.log(`  ↳ Remote player created with syncId ${data.syncId}`);
    }
  });

  // Handle player join
  game.onPlayerJoin((player) => {
    console.log(`${player.name} joined!`);

    // Initialize their score
    playerScores[player.id] = 0;
    updateScoreDisplay();

    // Don't create sprite yet - wait for their playerSprite message with syncId

    // Re-broadcast our sprite ID so the new player knows about us
    if (localPlayer && localPlayerId) {
      console.log(`📤 Re-broadcasting playerSprite: playerId=${localPlayerId}, syncId=${localPlayer.syncId}`);
      game.send('playerSprite', {
        playerId: localPlayerId,
        syncId: localPlayer.syncId
      });
    }

    // Show notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 150, 50, 0.95);
      color: #fff;
      padding: 20px 40px;
      border-radius: 8px;
      font-size: 18px;
      z-index: 1000;
    `;
    notification.textContent = `${player.name} joined!`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  });

  // Handle player leave
  game.onPlayerLeave((player) => {
    console.log(`${player.name} left`);

    // Remove their sprite
    const remotePlayer = remotePlayers.get(player.id);
    if (remotePlayer) {
      game.remove(remotePlayer);
      remotePlayers.delete(player.id);
    }

    delete playerScores[player.id];
    updateScoreDisplay();
  });

  // Handle sprite sync updates for remote players
  let syncUpdateCount = 0;
  game.network.spriteSyncCallbacks.push((data) => {
    // data.sprites is an array of { id, x, y, angle, velocityX, velocityY }
    if (!data.sprites) return;

    // Log every 60th update (once per ~3 seconds at 20Hz)
    if (++syncUpdateCount % 60 === 0) {
      console.log(`📡 Sprite sync update #${syncUpdateCount}: ${data.sprites.length} sprite(s), ${remotePlayers.size} remote player(s)`);
    }

    data.sprites.forEach(spriteData => {
      // Find which remote player owns this sprite
      for (const [playerId, playerSprite] of remotePlayers.entries()) {
        if (playerSprite.syncId === spriteData.id) {
          // Update remote player position (sprite will sync to physics automatically)
          playerSprite._x = spriteData.x;
          playerSprite._y = spriteData.y;

          // Update PixiJS display
          if (playerSprite._pixi) {
            playerSprite._pixi.x = spriteData.x;
            playerSprite._pixi.y = spriteData.y;
          }
          break;
        }
      }
    });
  });

  console.log('Network message handlers ready');
}

// ============================================================
// MULTIPLAYER SETUP
// ============================================================

console.log('Setting up multiplayer...');

const urlParams = new URLSearchParams(window.location.search);
const roomCode = urlParams.get('room') || 'PLATFORM-DEMO';

// Always join room (using default or custom code)
console.log(`Joining room: ${roomCode}`);
waitingMessage.textContent = `Joining room ${roomCode}...`;
waiting.style.display = 'block';

const playerName = prompt('Enter your name:', 'Player') || 'Player';

// Try to join, if room doesn't exist, create it
// Setup function for both join and create scenarios
function setupMultiplayerGame() {
  waiting.style.display = 'none';
  roomCodeEl.textContent = roomCode;
  roomInfo.style.display = 'block';

  // Recreate local player with network sync
  game.remove(localPlayer);
  delete playerScores['temp-id']; // Remove temporary score entry
  const playerIndex = game.players.length - 1;
  localPlayer = createPlayer(playerIndex, playerName);
  localPlayerId = game.network.socket.id; // Use socket ID as player ID
  playerScores[localPlayerId] = 0;

  // Enable network sync for local player
  game.setOwner(localPlayer);

  // Setup network message handlers (after connection established)
  setupNetworkMessageHandlers();

  // Broadcast our sprite ID to other players
  console.log(`📤 Broadcasting playerSprite: playerId=${localPlayerId}, syncId=${localPlayer.syncId}`);
  game.send('playerSprite', {
    playerId: localPlayerId,
    syncId: localPlayer.syncId
  });

  // Re-setup collision detection
  platforms.forEach(platform => {
    platform.onCollide(localPlayer, () => {
      isGrounded = true;
    });
  });
  setupCollectibleCollisions();

  // Setup input handlers
  setupInputHandlers();

  updateScoreDisplay();
  console.log('Player synced');
}

game.joinRoom(roomCode, playerName)
    .then(() => {
      console.log('✅ Joined existing room');
      setupMultiplayerGame();
    })
    .catch(err => {
      console.log(`❌ Room not found: ${err.message}`);
      console.log(`🔨 Creating room: ${roomCode}`);

      return game.createRoom(playerName, roomCode)
        .then(() => {
          console.log('✅ Room created successfully');
          setupMultiplayerGame();
        });
    })
    .catch(err => {
      console.error('❌ Failed to connect:', err);
      waitingMessage.textContent = 'Failed to connect. Is server running on :3000?';
      setTimeout(() => {
        waiting.style.display = 'none';
      }, 3000);
    });

console.log('Multiplayer setup complete');
