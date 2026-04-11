// ============================================================
//  Pong — KidEngine multiplayer example
//
//  How it works:
//    - The HOST creates a room and controls the LEFT paddle
//    - The GUEST joins with a code and controls the RIGHT paddle
//    - The HOST owns and simulates the ball — KidEngine syncs
//      it to the guest automatically
//    - First to 7 points wins
// ============================================================

import { createGame } from 'gamekit';

// ── Game settings ────────────────────────────────────────────
const WIDTH        = 800;
const HEIGHT       = 500;
const PADDLE_W     = 16;
const PADDLE_H     = 80;
const BALL_SIZE    = 14;
const PADDLE_SPEED = 6;
const BALL_SPEED   = 7;    // initial launch speed
const WIN_SCORE    = 7;

// ── State ────────────────────────────────────────────────────
let isHost      = false;   // true = I created the room (left paddle + ball owner)
let myScore     = 0;
let theirScore  = 0;
let gameRunning = false;

// ── Create the game (hidden until lobby is done) ─────────────
const game = createGame({
  width:      WIDTH,
  height:     HEIGHT,
  gravity:    0,           // top-down, no gravity
  background: 0x111111,
});

// hide the canvas until we're in a room
game._app.view.style.display = 'none';

// ── Build the court ──────────────────────────────────────────
// Center dashed line (purely visual — drawn once into a sprite via Graphics)
const { Graphics } = await import('pixi.js');
const dashLine = new Graphics();
dashLine.lineStyle(2, 0x333333, 1);
for (let y = 0; y < HEIGHT; y += 24) {
  dashLine.moveTo(WIDTH / 2, y);
  dashLine.lineTo(WIDTH / 2, y + 12);
}
game._app.stage.addChild(dashLine);

// Top and bottom walls (static physics bodies)
const topWall    = game.box({ x: 0, y: -20,        width: WIDTH, height: 20,  isStatic: true });
const bottomWall = game.box({ x: 0, y: HEIGHT,      width: WIDTH, height: 20,  isStatic: true });

// Left and right goal sensors (no physics — just for scoring)
// We'll detect these with onUpdate position checks instead

// ── Paddles ──────────────────────────────────────────────────
const leftPaddle = game.box({
  x:        20,
  y:        HEIGHT / 2 - PADDLE_H / 2,
  width:    PADDLE_W,
  height:   PADDLE_H,
  color:    0xffffff,
  isStatic: true,        // paddles move by us setting position directly
});

const rightPaddle = game.box({
  x:        WIDTH - 20 - PADDLE_W,
  y:        HEIGHT / 2 - PADDLE_H / 2,
  width:    PADDLE_W,
  height:   PADDLE_H,
  color:    0xffffff,
  isStatic: true,
});

// ── Ball ─────────────────────────────────────────────────────
const ball = game.box({
  x:        WIDTH  / 2 - BALL_SIZE / 2,
  y:        HEIGHT / 2 - BALL_SIZE / 2,
  width:    BALL_SIZE,
  height:   BALL_SIZE,
  color:    0xffffff,
  isStatic: false,
  bounce:   1.0,         // perfectly elastic
  friction: 0,
});

// ball velocity — host tracks this and sets it each frame
let ballVX = 0;
let ballVY = 0;

// ── Score display ────────────────────────────────────────────
const scoreLeft  = document.getElementById('score-left');
const scoreRight = document.getElementById('score-right');

function updateScoreDisplay() {
  if (isHost) {
    scoreLeft.textContent  = myScore;
    scoreRight.textContent = theirScore;
  } else {
    scoreLeft.textContent  = theirScore;
    scoreRight.textContent = myScore;
  }
}

// ── Ball launch ──────────────────────────────────────────────
// Only the host launches and controls the ball
function launchBall() {
  if (!isHost) return;

  ball.x = WIDTH  / 2;
  ball.y = HEIGHT / 2;

  // random angle between -30° and 30°, aimed at guest side first
  const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
  const dir   = Math.random() < 0.5 ? 1 : -1;

  ballVX = Math.cos(angle) * BALL_SPEED * dir;
  ballVY = Math.sin(angle) * BALL_SPEED;
}

// ── Scoring ──────────────────────────────────────────────────
function scorePoint(scoringPlayer) {
  if (!isHost) return; // only host scores — it owns the ball

  if (scoringPlayer === 'host') {
    myScore++;
    game.setScore(myScore);
    game.send('theyScored', {}); // tell guest they gave up a point
  } else {
    theirScore++;
    game.send('iScored', {}); // tell guest they scored
  }

  updateScoreDisplay();

  if (myScore >= WIN_SCORE || theirScore >= WIN_SCORE) {
    endGame(scoringPlayer === 'host' ? 'host' : 'guest');
    return;
  }

  // brief pause then relaunch
  gameRunning = false;
  setTimeout(() => {
    launchBall();
    gameRunning = true;
  }, 1200);
}

// ── End game ─────────────────────────────────────────────────
function endGame(winner) {
  gameRunning = false;
  ballVX = 0;
  ballVY = 0;

  const isWinner = (winner === 'host' && isHost) || (winner === 'guest' && !isHost);

  document.getElementById('winner-text').textContent = isWinner ? 'YOU WIN! 🎉' : 'YOU LOSE 😢';
  document.getElementById('winner').classList.add('visible');
}

// ── Game loop ────────────────────────────────────────────────
game.onUpdate(() => {
  if (!gameRunning) return;

  // --- MY paddle input ---
  const myPaddle = isHost ? leftPaddle : rightPaddle;

  if (game.isKeyDown('ArrowUp')   || game.isKeyDown('w')) {
    myPaddle.y = Math.max(0, myPaddle.y - PADDLE_SPEED);
  }
  if (game.isKeyDown('ArrowDown') || game.isKeyDown('s')) {
    myPaddle.y = Math.min(HEIGHT - PADDLE_H, myPaddle.y + PADDLE_SPEED);
  }

  // sync paddle position to the other player
  game.send('paddleMove', { y: myPaddle.y });

  // --- Ball simulation (host only) ---
  if (!isHost) return;

  // move ball
  ball.x += ballVX;
  ball.y += ballVY;

  // bounce off top/bottom walls
  if (ball.y <= 0) {
    ball.y  = 0;
    ballVY  = Math.abs(ballVY);
  }
  if (ball.y + BALL_SIZE >= HEIGHT) {
    ball.y  = HEIGHT - BALL_SIZE;
    ballVY  = -Math.abs(ballVY);
  }

  // bounce off left paddle
  if (
    ball.x <= leftPaddle.x + PADDLE_W &&
    ball.x >= leftPaddle.x - BALL_SIZE &&
    ball.y + BALL_SIZE >= leftPaddle.y &&
    ball.y <= leftPaddle.y + PADDLE_H
  ) {
    ball.x  = leftPaddle.x + PADDLE_W;
    ballVX  = Math.abs(ballVX) * 1.05; // speed up slightly each hit
    ballVY += (ball.y + BALL_SIZE / 2 - (leftPaddle.y + PADDLE_H / 2)) * 0.1;
    ballVX  = Math.min(ballVX, BALL_SPEED * 2.5); // cap max speed
  }

  // bounce off right paddle
  if (
    ball.x + BALL_SIZE >= rightPaddle.x &&
    ball.x <= rightPaddle.x + PADDLE_W + BALL_SIZE &&
    ball.y + BALL_SIZE >= rightPaddle.y &&
    ball.y <= rightPaddle.y + PADDLE_H
  ) {
    ball.x  = rightPaddle.x - BALL_SIZE;
    ballVX  = -Math.abs(ballVX) * 1.05;
    ballVY += (ball.y + BALL_SIZE / 2 - (rightPaddle.y + PADDLE_H / 2)) * 0.1;
    ballVX  = Math.max(ballVX, -BALL_SPEED * 2.5);
  }

  // --- Goal detection ---
  if (ball.x + BALL_SIZE < 0) {
    scorePoint('guest'); // ball went past left side — guest scores
  }
  if (ball.x > WIDTH) {
    scorePoint('host');  // ball went past right side — host scores
  }
});

// ── Network messages ─────────────────────────────────────────

// Other player moved their paddle
game.onMessage('paddleMove', ({ y }) => {
  const theirPaddle = isHost ? rightPaddle : leftPaddle;
  theirPaddle.y = y;
});

// Guest receives scoring events from host
game.onMessage('iScored', () => {
  myScore++;
  updateScoreDisplay();
  if (myScore >= WIN_SCORE) endGame('guest');
});

game.onMessage('theyScored', () => {
  theirScore++;
  updateScoreDisplay();
  if (theirScore >= WIN_SCORE) endGame('host');
});

// Host tells guest the game has started
game.onMessage('gameStart', () => {
  startGame();
});

// ── Start / show game ────────────────────────────────────────
function startGame() {
  document.getElementById('lobby').style.display = 'none';
  document.getElementById('hud').classList.add('visible');
  game._app.view.style.display = 'block';

  gameRunning = true;

  if (isHost) {
    launchBall();
  }
}

// ── Lobby wiring ─────────────────────────────────────────────
const nameInput   = document.getElementById('name-input');
const codeInput   = document.getElementById('code-input');
const btnCreate   = document.getElementById('btn-create');
const btnJoin     = document.getElementById('btn-join');
const statusEl    = document.getElementById('status');
const roomCodeEl  = document.getElementById('room-code');
const codeDisplay = document.getElementById('code-display');

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className   = isError ? 'error' : '';
}

// Create a room
btnCreate.addEventListener('click', async () => {
  const name = nameInput.value.trim() || 'PLAYER';
  btnCreate.disabled = true;
  setStatus('Creating room…');

  try {
    const { code } = await game.createRoom(name);

    // show the code, wait for someone to join
    codeDisplay.textContent       = code;
    roomCodeEl.style.display      = 'flex';
    btnCreate.style.display       = 'none';
    setStatus('');
    isHost = true;

    // when a player joins, start the game
    game.onMessage('playerJoined', () => {
      setStatus('Opponent joined! Starting…');
      setTimeout(() => {
        game.send('gameStart', {});
        startGame();
      }, 800);
    });

  } catch (err) {
    setStatus('Could not connect to server. Is it running?', true);
    btnCreate.disabled = false;
  }
});

// Join a room
btnJoin.addEventListener('click', async () => {
  const code = codeInput.value.trim().toUpperCase();
  const name = nameInput.value.trim() || 'PLAYER';

  if (code.length !== 4) {
    setStatus('Enter a 4-letter code!', true);
    return;
  }

  btnJoin.disabled = true;
  setStatus(`Joining room ${code}…`);

  try {
    await game.joinRoom(code, name);
    isHost = false;
    setStatus('Joined! Waiting for host to start…');

    // host will send 'gameStart' — handled above in onMessage
  } catch (err) {
    setStatus(err.message, true);
    btnJoin.disabled = false;
  }
});

// format code input as uppercase
codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.toUpperCase();
});

// Play again — reload the page (simplest reset)
document.getElementById('btn-restart').addEventListener('click', () => {
  window.location.reload();
});
