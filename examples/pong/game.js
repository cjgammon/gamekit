// ============================================================
//  Multiplayer Pong - Complete Game (Stage 8)
//  Full two-player competitive Pong with scoring and win condition
// ============================================================

import { Game, GKBox, GKCircle } from "gamekit";

console.log('=== GameKit Stage 8: Multiplayer Pong ===\n');

// Game constants
const WINNING_SCORE = 11;
const BALL_SPEED = 12;
const PADDLE_SPEED = 8;

// Game state
let gameState = 'waiting'; // waiting, playing, gameover
let player1Score = 0;
let player2Score = 0;
let isHost = false;
let playerName = '';
let opponentName = '';

// UI elements
const waitingDiv = document.getElementById('waiting');
const waitingMessage = document.getElementById('waiting-message');
const roomCodeDisplay = document.getElementById('room-code-display');
const shareUrl = document.getElementById('share-url');
const roomInfo = document.getElementById('room-info');
const player1NameEl = document.getElementById('player1-name');
const player2NameEl = document.getElementById('player2-name');
const player1ScoreEl = document.getElementById('player1-score');
const player2ScoreEl = document.getElementById('player2-score');
const gameOverDiv = document.getElementById('game-over');
const winnerNameEl = document.getElementById('winner-name');
const finalScoreEl = document.getElementById('final-score');

// Get server URL from URL parameter or use default
const serverUrl = new URLSearchParams(window.location.search).get('server') || 'http://localhost:3000';
console.log(`Server URL: ${serverUrl}`);

// Create game
const game = new Game({
  width: 800,
  height: 600,
  gravity: 0,  // No gravity for Pong
  background: 0x000000,
  server: serverUrl
});

// Expose game to window for E2E testing
window.game = game;
window.myPaddle = null; // Will be set after creation
window.ball = null; // Will be set after creation

// Create game objects
console.log('Creating game objects...');

// Map syncId to local sprites for direct updates during sync
const localSprites = new Map(); // key: syncId, value: sprite

// Top and bottom walls (ball bounces off these)
const topWall = new GKBox({
  x: 400,
  y: 10,
  width: 800,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(topWall);

const bottomWall = new GKBox({
  x: 400,
  y: 590,
  width: 800,
  height: 20,
  color: 0x444444,
  isStatic: true
});
game.add(bottomWall);

// NO left/right walls - ball goes off screen to score!

// Player paddle (will be positioned based on player number)
const myPaddle = new GKBox({
  x: 50, // Will be repositioned
  y: 300,
  width: 15,
  height: 100,
  color: 0xffffff,
  isStatic: true
});
game.add(myPaddle);
localSprites.set(myPaddle.syncId, myPaddle);

// Ball (only host creates and controls it)
const ball = new GKCircle({
  x: 400,
  y: 300,
  radius: 8,
  color: 0xffffff,
  bounce: 1.0,  // Perfect bounce
  friction: 0,
  frictionAir: 0, // No air resistance - ball maintains velocity
  isStatic: false,  // Will be set to true for guest later
  syncId: 'ball'  // Deterministic ID for cross-client syncing
});
game.add(ball);
localSprites.set(ball.syncId, ball);
window.ball = ball; // Expose for E2E testing

// Remote player sprites (tracked by playerId and syncId)
const remoteSprites = new Map(); // key: "playerId:syncId", value: sprite

// Function to set up ball collision (called after isHost is determined)
function setupBallCollision() {
  if (!isHost) return;

  ball.onCollide(myPaddle, () => {
    console.log('Ball hit player 1 paddle');
    // Add some angle variation based on where it hits
    const hitPos = (ball.y - myPaddle.y) / 50; // -1 to 1
    ball.setVelocity(BALL_SPEED, hitPos * BALL_SPEED * 0.7);
  });

  ball.onCollide(topWall, () => {
    console.log('Ball hit top wall');
  });

  ball.onCollide(bottomWall, () => {
    console.log('Ball hit bottom wall');
  });
}

// Paddle controls
game.onUpdate(() => {
  if (gameState !== 'playing') return;

  if (game.isKeyDown('ArrowUp') || game.isKeyDown('w') || game.isKeyDown('W')) {
    myPaddle.moveUp(PADDLE_SPEED);
  }
  if (game.isKeyDown('ArrowDown') || game.isKeyDown('s') || game.isKeyDown('S')) {
    myPaddle.moveDown(PADDLE_SPEED);
  }

  // Keep paddle in bounds
  const paddleHalfHeight = 50;
  if (myPaddle.y < 30 + paddleHalfHeight) myPaddle.y = 30 + paddleHalfHeight;
  if (myPaddle.y > 570 - paddleHalfHeight) myPaddle.y = 570 - paddleHalfHeight;
});

// Ball collision will be set up after we know if we're host or guest

// Score tracking (only host)
let lastBallX = 400;
let scoreCheckCount = 0;
function checkScoring() {
  if (!isHost || gameState !== 'playing') return;

  // Debug: confirm function is running
  scoreCheckCount++;
  if (scoreCheckCount === 60) {
    console.log('✓ Score checking is running (60 frames)');
    console.log(`  Ball at: (${Math.round(ball.x)}, ${Math.round(ball.y)})`);
    console.log(`  Game state: ${gameState}, isHost: ${isHost}`);
  }

  // Debug: log ball position when it moves significantly
  if (Math.abs(ball.x - lastBallX) > 50) {
    console.log(`📍 Ball position: (${Math.round(ball.x)}, ${Math.round(ball.y)}) velocity: (${Math.round(ball.velocityX)}, ${Math.round(ball.velocityY)})`);
    lastBallX = ball.x;
  }

  // Ball went off left side (player 2 scores)
  if (ball.x < 0) {
    console.log(`\n⚽ GOAL! Player 2 scores! Ball x: ${ball.x.toFixed(2)}`);
    console.log(`   Score was: ${player1Score}-${player2Score}`);
    player2Score++;
    console.log(`   Score now: ${player1Score}-${player2Score}\n`);
    updateScores();
    game.send('scoreUpdate', { player1: player1Score, player2: player2Score });

    if (player2Score >= WINNING_SCORE) {
      endGame(opponentName);
    } else {
      resetBall();
    }
    return;
  }
  // Ball went off right side (player 1 scores)
  if (ball.x > 800) {
    console.log(`\n⚽ GOAL! Player 1 scores! Ball x: ${ball.x.toFixed(2)}`);
    console.log(`   Score was: ${player1Score}-${player2Score}`);
    player1Score++;
    console.log(`   Score now: ${player1Score}-${player2Score}\n`);
    updateScores();
    game.send('scoreUpdate', { player1: player1Score, player2: player2Score });

    if (player1Score >= WINNING_SCORE) {
      endGame(playerName);
    } else {
      resetBall();
    }
    return;
  }
}

game.onUpdate(() => {
  checkScoring();
});

function resetBall() {
  console.log('🔄 Resetting ball to center');

  // Stop the ball first
  ball.setVelocity(0, 0);
  ball.x = 400;
  ball.y = 300;

  // Wait a moment then launch
  setTimeout(() => {
    // Random direction
    const direction = Math.random() > 0.5 ? 1 : -1;
    const angle = (Math.random() - 0.5) * 0.5; // -0.25 to 0.25
    ball.setVelocity(BALL_SPEED * direction, BALL_SPEED * angle);
    console.log(`🚀 Ball launched: velocity (${BALL_SPEED * direction}, ${BALL_SPEED * angle})`);
  }, 1000);
}

function updateScores() {
  player1ScoreEl.textContent = player1Score;
  player2ScoreEl.textContent = player2Score;
}

function startGame() {
  gameState = 'playing';
  waitingDiv.style.display = 'none';

  console.log('🎮 Game starting!');
  console.log(`   You are: ${isHost ? 'HOST (controls ball & scoring)' : 'GUEST (receives ball sync)'}`);

  // Host launches the ball
  if (isHost) {
    console.log('   Ball will launch in 2 seconds...');
    console.log('   Score detection active - checking every frame');
    setTimeout(() => {
      console.log('   Launching ball now!');
      resetBall();
    }, 2000);
  } else {
    console.log('   Waiting for host to launch ball...');
  }
}

function endGame(winner) {
  gameState = 'gameover';

  gameOverDiv.style.display = 'block';
  winnerNameEl.textContent = `${winner} Wins!`;
  finalScoreEl.textContent = `Final Score: ${player1Score} - ${player2Score}`;

  game.send('gameOver', { winner });

  console.log(`🏆 Game Over! ${winner} wins ${player1Score}-${player2Score}`);
}

// Multiplayer setup
const urlParams = new URLSearchParams(window.location.search);
let roomCodeParam = urlParams.get('room');

// EASY TESTING MODE - use localStorage to share room across tabs
if (!roomCodeParam) {
  // Check if we already have a room stored
  const storedRoom = localStorage.getItem('gamekit-test-room');

  if (storedRoom) {
    console.log(`⚙️ Found existing test room in localStorage: ${storedRoom}`);
    roomCodeParam = storedRoom;
  } else {
    console.log('⚙️ No test room found - will create one');
    roomCodeParam = null; // Will create a new room
  }
}

if (roomCodeParam && roomCodeParam !== 'new') {
  // Try to join existing room
  // Auto-assign name based on player number
  const attemptedPlayerName = 'Player 2';
  console.log(`Attempting to join room: ${roomCodeParam}`);

  game.joinRoom(roomCodeParam, attemptedPlayerName)
    .then(() => {
      console.log('✅ Joined successfully as Player 2!');
      playerName = attemptedPlayerName;
      isHost = false;

      // Position paddle on right side
      myPaddle.x = 750;

      // Expose to window for E2E testing
      window.myPaddle = myPaddle;

      // Mark paddle as owned (will be synced)
      game.setOwner(myPaddle);

      // Guest's ball is not owned - position will be synced from host
      // Make ball static to prevent double physics simulation
      if (ball._body) {
        ball._body.isStatic = true;
      }
      console.log('✓ Guest: Ball created as static (will receive sync from host)');

      // Update UI
      roomInfo.style.display = 'block';
      roomInfo.textContent = `Room: ${roomCodeParam}`;
      player2NameEl.textContent = playerName;

      waitingMessage.textContent = 'Waiting for host to start...';
    })
    .catch(err => {
      console.error('Failed to join:', err);

      // If we were trying to join from localStorage and it failed, clear it and create a new room
      const storedRoom = localStorage.getItem('gamekit-test-room');
      if (storedRoom === roomCodeParam) {
        console.log('⚙️ Stored room no longer exists - clearing localStorage and creating new room...');
        localStorage.removeItem('gamekit-test-room');

        // Create a new room as Player 1
        playerName = 'Player 1';
        createTestRoom();
      } else {
        alert('Failed to join room. Make sure the code is correct and server is running!');
      }
    });
} else {
  // No room parameter - create a new room as Player 1
  console.log('⚙️ Creating new test room...');
  playerName = 'Player 1';
  createTestRoom();
}

// Function to create TEST room or new room
function createTestRoom() {
  game.createRoom(playerName)
    .then(({ code }) => {
      console.log(`✅ Room created: ${code}`);

      // Save to localStorage so other tabs can join this room
      localStorage.setItem('gamekit-test-room', code);
      console.log(`💾 Saved room code to localStorage for easy testing`);

      isHost = true;

      // Position paddle on left side
      myPaddle.x = 50;

      // Expose to window for E2E testing
      window.myPaddle = myPaddle;

      // Mark paddle and ball as owned (will be synced)
      game.setOwner(myPaddle);
      game.setOwner(ball);

      // Set up ball collision handlers (only host)
      setupBallCollision();

      // Update UI
      roomInfo.style.display = 'block';
      roomInfo.textContent = `Room: ${code}`;
      player1NameEl.textContent = playerName;

      roomCodeDisplay.style.display = 'block';
      roomCodeDisplay.textContent = code;
      shareUrl.style.display = 'block';
      shareUrl.textContent = `Share: ${window.location.href}?room=${code}`;
      waitingMessage.textContent = 'Waiting for opponent to join...';

      console.log(`\n💡 Testing tip: Open another tab at ${window.location.origin} to auto-join this room!`);
      console.log(`   To reset: localStorage.clear() and refresh\n`);
    })
    .catch(err => {
      console.error('Failed to create room:', err);
      alert('Failed to create room. Make sure the server is running on port 3000!');
    });
}

// Player join/leave events
game.onPlayerJoin((player) => {
  console.log(`👋 ${player.name} joined!`);
  opponentName = player.name;

  if (isHost) {
    player2NameEl.textContent = player.name;

    // Host starts game when player 2 joins
    setTimeout(() => {
      game.send('gameStart', {});
      startGame();
    }, 2000);
  } else {
    player1NameEl.textContent = player.name;
  }
});

game.onPlayerLeave((player) => {
  console.log(`👋 Player left`);
  if (gameState === 'playing') {
    gameState = 'waiting';
    waitingDiv.style.display = 'block';
    waitingMessage.textContent = 'Opponent disconnected';
  }
});

// Custom messages
game.onMessage('gameStart', () => {
  console.log('🎮 Received game start signal');
  startGame();
});

game.onMessage('scoreUpdate', (data) => {
  console.log('📊 Score update received:', data);
  player1Score = data.player1;
  player2Score = data.player2;
  updateScores();
});

game.onMessage('gameOver', (data) => {
  console.log('🏆 Game over:', data.winner);
  if (gameState !== 'gameover') {
    endGame(data.winner);
  }
});

// Remote sprite sync (Stage 8 - Single Source of Truth)
game.onSpriteSync((data) => {
  const { playerId, sprites } = data;

  console.log(`📡 Received sprite sync from ${playerId}:`, sprites.length, 'sprite(s)');

  for (const spriteData of sprites) {
    const syncId = spriteData.id;

    // PHASE 1: Check if this is one of our LOCAL sprites
    if (localSprites.has(syncId)) {
      const localSprite = localSprites.get(syncId);

      // Skip if we own this sprite (it's being echoed back from server)
      if (localSprite.isOwned) {
        continue;
      }

      // Update our non-owned local sprite (guest's ball receiving host's position)
      console.log(`📡 Updating local sprite ${syncId}: (${Math.round(spriteData.x)}, ${Math.round(spriteData.y)})`);
      localSprite.x = spriteData.x;
      localSprite.y = spriteData.y;
      continue;
    }

    // PHASE 2: Check if this is an already-known remote sprite
    const key = `${playerId}:${syncId}`;
    let remoteSprite = remoteSprites.get(key);

    if (remoteSprite) {
      // Update existing remote sprite position
      remoteSprite.x = spriteData.x;
      remoteSprite.y = spriteData.y;
      continue;
    }

    // PHASE 3: Create new remote sprite (first time seeing this sprite)
    // This should ONLY happen for other player's paddles, never for the ball
    console.log(`📡 Creating remote sprite: ${key}`);
    console.log(`   Position: (${Math.round(spriteData.x)}, ${Math.round(spriteData.y)})`);
    console.log('  → Type: PADDLE (remote, from other player)');

    remoteSprite = new GKBox({
      x: spriteData.x,
      y: spriteData.y,
      width: 15,
      height: 100,
      color: 0xffaa00,  // Orange
      isStatic: true
    });

    game.add(remoteSprite);
    remoteSprites.set(key, remoteSprite);

    // Host: add collision between ball and remote paddle (Player 2's paddle)
    // Defer to next frame to ensure physics body is fully initialized
    if (isHost) {
      requestAnimationFrame(() => {
        ball.onCollide(remoteSprite, () => {
          console.log('Ball hit player 2 paddle (remote)');
          const hitPos = (ball.y - remoteSprite.y) / 50;
          ball.setVelocity(-BALL_SPEED, hitPos * BALL_SPEED * 0.7);
        });
      });
    }
  }
});

console.log('\n=== Multiplayer Pong Ready ===');
console.log('✓ Two-player competitive gameplay');
console.log('✓ Real-time sprite synchronization');
console.log('✓ Score tracking and win condition');
console.log('✓ First to 11 points wins!');
