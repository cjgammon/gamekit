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

// Center line (visual only)
const centerLine = new GKBox({
  x: 400,
  y: 300,
  width: 4,
  height: 600,
  color: 0x333333,
  isStatic: true
});
game.add(centerLine);

// Top and bottom walls
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
  isStatic: false
});
game.add(ball);

// Remote player sprites (tracked by playerId and syncId)
const remoteSprites = new Map(); // key: "playerId:syncId", value: sprite

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

// Ball collision with paddles (only host handles scoring)
if (isHost) {
  ball.onCollide(myPaddle, () => {
    console.log('Ball hit player 1 paddle');
    // Add some angle variation based on where it hits
    const hitPos = (ball.y - myPaddle.y) / 50; // -1 to 1
    ball.setVelocity(BALL_SPEED, hitPos * BALL_SPEED * 0.7);
  });
}

// Score tracking (only host)
function checkScoring() {
  if (!isHost || gameState !== 'playing') return;

  // Ball went off left side (player 2 scores)
  if (ball.x < -10) {
    player2Score++;
    updateScores();
    game.send('scoreUpdate', { player1: player1Score, player2: player2Score });

    if (player2Score >= WINNING_SCORE) {
      endGame(opponentName);
    } else {
      resetBall();
    }
  }
  // Ball went off right side (player 1 scores)
  else if (ball.x > 810) {
    player1Score++;
    updateScores();
    game.send('scoreUpdate', { player1: player1Score, player2: player2Score });

    if (player1Score >= WINNING_SCORE) {
      endGame(playerName);
    } else {
      resetBall();
    }
  }
}

game.onUpdate(() => {
  checkScoring();
});

function resetBall() {
  ball.x = 400;
  ball.y = 300;

  // Random direction
  const direction = Math.random() > 0.5 ? 1 : -1;
  const angle = (Math.random() - 0.5) * 0.5; // -0.25 to 0.25
  ball.setVelocity(BALL_SPEED * direction, BALL_SPEED * angle);
}

function updateScores() {
  player1ScoreEl.textContent = player1Score;
  player2ScoreEl.textContent = player2Score;
}

function startGame() {
  gameState = 'playing';
  waitingDiv.style.display = 'none';

  console.log('🎮 Game starting!');

  // Host launches the ball
  if (isHost) {
    setTimeout(() => {
      resetBall();
    }, 1000);
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
const roomCodeParam = urlParams.get('room');

if (roomCodeParam) {
  // Join existing room as Player 2
  console.log(`Joining room: ${roomCodeParam}`);
  playerName = prompt('Enter your name:', 'Player 2') || 'Player 2';

  game.joinRoom(roomCodeParam, playerName)
    .then(() => {
      console.log('✅ Joined successfully!');
      isHost = false;

      // Position paddle on right side
      myPaddle.x = 750;

      // Mark paddle as owned (will be synced)
      game.setOwner(myPaddle);

      // Update UI
      roomInfo.style.display = 'block';
      roomInfo.textContent = `Room: ${roomCodeParam}`;
      player2NameEl.textContent = playerName;

      waitingMessage.textContent = 'Waiting for host to start...';
    })
    .catch(err => {
      console.error('Failed to join:', err);
      alert('Failed to join room. Make sure the code is correct and server is running!');
    });
} else {
  // Create new room as Player 1 (Host)
  console.log('Creating new room...');
  playerName = prompt('Enter your name:', 'Player 1') || 'Player 1';

  game.createRoom(playerName)
    .then(({ code }) => {
      console.log(`✅ Room created: ${code}`);
      isHost = true;

      // Position paddle on left side
      myPaddle.x = 50;

      // Mark paddle and ball as owned (will be synced)
      game.setOwner(myPaddle);
      game.setOwner(ball);

      // Update UI
      roomInfo.style.display = 'block';
      roomInfo.textContent = `Room: ${code}`;
      player1NameEl.textContent = playerName;

      roomCodeDisplay.style.display = 'block';
      roomCodeDisplay.textContent = code;
      shareUrl.style.display = 'block';
      shareUrl.textContent = `Share: ${window.location.href}?room=${code}`;
      waitingMessage.textContent = 'Waiting for opponent to join...';
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

// Remote sprite sync (NEW in Stage 8!)
game.onSpriteSync((data) => {
  const { playerId, sprites } = data;

  console.log(`📡 Received sprite sync from ${playerId}:`, sprites.length, 'sprites');

  for (const spriteData of sprites) {
    const key = `${playerId}:${spriteData.id}`;

    let remoteSprite = remoteSprites.get(key);

    if (!remoteSprite) {
      // Create new sprite for remote player
      console.log(`📡 Creating remote sprite: ${key} at (${spriteData.x}, ${spriteData.y})`);

      // Detect type by position (ball is usually center, paddles are left/right)
      const isBall = spriteData.x > 200 && spriteData.x < 600;

      if (isBall) {
        // This is likely the ball
        console.log('  → Creating remote ball');
        remoteSprite = new GKCircle({
          x: spriteData.x,
          y: spriteData.y,
          radius: 8,
          color: 0xaaaaaa,
          isStatic: true  // Remote sprites don't need physics
        });
      } else {
        // This is a paddle
        console.log('  → Creating remote paddle');
        remoteSprite = new GKBox({
          x: spriteData.x,
          y: spriteData.y,
          width: 15,
          height: 100,
          color: 0xffaa00,  // Orange color so you can see it clearly
          isStatic: true
        });

        // Add collision for non-host
        if (!isHost) {
          ball.onCollide(remoteSprite, () => {
            console.log('Ball hit remote paddle');
          });
        }
      }

      game.add(remoteSprite);
      remoteSprites.set(key, remoteSprite);
    }

    // Update position
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
