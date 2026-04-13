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

// Create game
const game = new Game({
  width: 800,
  height: 600,
  gravity: 0,  // No gravity for Pong
  background: 0x000000,
  server: 'http://localhost:3000'
});

// Create game objects
console.log('Creating game objects...');

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

// Ball (only host creates and controls it)
const ball = new GKCircle({
  x: 400,
  y: 300,
  radius: 8,
  color: 0xffffff,
  bounce: 1.0,  // Perfect bounce
  friction: 0,
  isStatic: false  // Will be set to true for guest later
});
game.add(ball);

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

      // Mark paddle as owned (will be synced)
      game.setOwner(myPaddle);

      // Guest doesn't control the ball - hide it and wait for synced version
      // The ball will appear as a gray remote sprite from the host
      ball.x = -1000; // Move offscreen
      ball.y = -1000;
      ball.setVelocity(0, 0); // Stop any physics

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

// Track ball syncId so we can detect it reliably
let ballSyncId = null;
if (isHost) {
  ballSyncId = ball.syncId;
  console.log(`🎯 Ball syncId: ${ballSyncId}`);
}

// Remote sprite sync (NEW in Stage 8!)
game.onSpriteSync((data) => {
  const { playerId, sprites } = data;

  console.log(`📡 Received sprite sync from ${playerId}:`, sprites.length, 'sprite(s)');

  // Debug: show what sprites we received
  sprites.forEach((s, i) => {
    console.log(`  [${i}] id=${s.id}, pos=(${Math.round(s.x)}, ${Math.round(s.y)})`);
  });

  for (const spriteData of sprites) {
    const key = `${playerId}:${spriteData.id}`;

    let remoteSprite = remoteSprites.get(key);

    if (!remoteSprite) {
      // Create new sprite for remote player
      console.log(`📡 Creating remote sprite: ${key}`);
      console.log(`   Position: (${Math.round(spriteData.x)}, ${Math.round(spriteData.y)})`);

      // Detect type: if it's near the center initially, it's probably the ball
      // Paddles are at x=50 (left) or x=750 (right)
      const isNearCenter = spriteData.x > 100 && spriteData.x < 700;
      const isNearSide = spriteData.x < 100 || spriteData.x > 700;

      // Better heuristic: paddles are always at edges, ball starts center
      const isBall = isNearCenter && !isNearSide;

      if (isBall) {
        // This is the ball from host
        console.log('  → Type: BALL (remote, synced from host)');
        remoteSprite = new GKCircle({
          x: spriteData.x,
          y: spriteData.y,
          radius: 8,
          color: 0xaaaaaa,  // Gray
          isStatic: true  // Remote sprites don't need physics
        });
      } else {
        // This is a paddle from other player
        console.log('  → Type: PADDLE (remote, from other player)');
        remoteSprite = new GKBox({
          x: spriteData.x,
          y: spriteData.y,
          width: 15,
          height: 100,
          color: 0xffaa00,  // Orange
          isStatic: true
        });
      }

      game.add(remoteSprite);
      remoteSprites.set(key, remoteSprite);

      // Host: add collision between ball and remote paddle (Player 2's paddle)
      if (isHost && !isBall) {
        ball.onCollide(remoteSprite, () => {
          console.log('Ball hit player 2 paddle (remote)');
          // Add angle variation based on hit position
          const hitPos = (ball.y - remoteSprite.y) / 50; // -1 to 1
          ball.setVelocity(-BALL_SPEED, hitPos * BALL_SPEED * 0.7);
        });
      }
    }

    // Update position for all remote sprites
    if (remoteSprite) {
      remoteSprite.x = spriteData.x;
      remoteSprite.y = spriteData.y;
    }
  }
});

console.log('\n=== Multiplayer Pong Ready ===');
console.log('✓ Two-player competitive gameplay');
console.log('✓ Real-time sprite synchronization');
console.log('✓ Score tracking and win condition');
console.log('✓ First to 11 points wins!');
