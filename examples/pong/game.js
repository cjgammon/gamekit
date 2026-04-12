// ============================================================
//  Pong — GameKit multiplayer example
//
//  How it works:
//    - The HOST creates a room and controls the LEFT paddle
//    - The GUEST joins with a code and controls the RIGHT paddle
//    - The HOST owns and simulates the ball — GameKit syncs
//      it to the guest automatically
//    - First to 7 points wins
// ============================================================

import { createGame } from 'gamekit';

// ── Game settings ────────────────────────────────────────────
const WIDTH        = 800;
const HEIGHT       = 500;
const PADDLE_H     = 80;
const PADDLE_SPEED = 6;
const BALL_SIZE    = 14;
const BALL_SPEED   = 7;

const game = createGame({
  width:      WIDTH,
  height:     HEIGHT,
  gravity:    0,
  background: 0x111111,
  title:      'PONG',
  lobby:      true,
  maxPlayers: 2,
  scores:     true,
  winScore:   7,
});

// ── Build the court ──────────────────────────────────────────
const { Graphics } = await import('pixi.js');
const dashLine = new Graphics();
dashLine.lineStyle(2, 0x333333, 1);
for (let y = 0; y < HEIGHT; y += 24) {
  dashLine.moveTo(WIDTH / 2, y);
  dashLine.lineTo(WIDTH / 2, y + 12);
}
game._app.stage.addChild(dashLine);

game.box({ x: 0, y: -20,    width: WIDTH, height: 20 }); // top wall
game.box({ x: 0, y: HEIGHT, width: WIDTH, height: 20 }); // bottom wall

const leftPaddle  = game.box({ x: 20,          y: HEIGHT/2 - PADDLE_H/2, width: 16, height: PADDLE_H, color: 0xffffff, isStatic: true });
const rightPaddle = game.box({ x: WIDTH - 36,  y: HEIGHT/2 - PADDLE_H/2, width: 16, height: PADDLE_H, color: 0xffffff, isStatic: true });
const ball        = game.box({ x: WIDTH/2 - 7, y: HEIGHT/2 - 7,          width: BALL_SIZE, height: BALL_SIZE, color: 0xffffff, isStatic: false });

// sync paddles and ball to other player automatically
game.sync(leftPaddle);
game.sync(rightPaddle);
game.sync(ball);

let ballVX = 0;
let ballVY = 0;

// ── Game starts when both players are in ─────────────────────
game.onReady(({ isHost }) => {

  if (isHost) launchBall();

  // after each point, relaunch the ball
  game.onScore(() => {
    if (isHost) launchBall();
  });

  // when someone wins, show the right message
  game.onWin((side) => {
    const iWon = (side === 'left' && isHost) || (side === 'right' && !isHost);
    game.setWinnerText(iWon ? 'YOU WIN! 🎉' : 'YOU LOSE 😢');
  });

  game.onUpdate(() => {
    const myPaddle = isHost ? leftPaddle : rightPaddle;

    // move my paddle
    if (game.isKeyDown('ArrowUp')   || game.isKeyDown('w')) myPaddle.y = Math.max(0, myPaddle.y - PADDLE_SPEED);
    if (game.isKeyDown('ArrowDown') || game.isKeyDown('s')) myPaddle.y = Math.min(HEIGHT - PADDLE_H, myPaddle.y + PADDLE_SPEED);

    // only host simulates the ball
    if (!isHost) return;

    ball.x += ballVX;
    ball.y += ballVY;

    // bounce off top/bottom
    if (ball.y <= 0)                  { ball.y = 0;               ballVY =  Math.abs(ballVY); }
    if (ball.y >= HEIGHT - BALL_SIZE) { ball.y = HEIGHT-BALL_SIZE; ballVY = -Math.abs(ballVY); }

    // bounce off paddles
    if (hits(ball, leftPaddle))  { ball.x = leftPaddle.x + 16;  ballVX =  Math.min(Math.abs(ballVX) * 1.05, BALL_SPEED * 2.5); addSpin(leftPaddle);  }
    if (hits(ball, rightPaddle)) { ball.x = rightPaddle.x - BALL_SIZE; ballVX = -Math.min(Math.abs(ballVX) * 1.05, BALL_SPEED * 2.5); addSpin(rightPaddle); }

    // goals — engine handles score display, pause, and win condition
    if (ball.x + BALL_SIZE < 0) game.score('right'); // ball left the left side — right scores
    if (ball.x > WIDTH)         game.score('left');  // ball left the right side — left scores
  });
});

// ── Helpers ──────────────────────────────────────────────────
function launchBall() {
  ball.x = WIDTH / 2;
  ball.y = HEIGHT / 2;
  const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
  ballVX = Math.cos(angle) * BALL_SPEED * (Math.random() < 0.5 ? 1 : -1);
  ballVY = Math.sin(angle) * BALL_SPEED;
}

function hits(b, paddle) {
  return b.x < paddle.x + paddle.width  &&
         b.x + BALL_SIZE > paddle.x     &&
         b.y < paddle.y + paddle.height &&
         b.y + BALL_SIZE > paddle.y;
}

function addSpin(paddle) {
  ballVY += (ball.y + BALL_SIZE/2 - (paddle.y + PADDLE_H/2)) * 0.1;
}
