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

import { createGame } from "gamekit";

// ── Game settings ────────────────────────────────────────────
const WIDTH = 800;
const HEIGHT = 500;
const PADDLE_H = 80;
const PADDLE_SPEED = 6;
const BALL_SIZE = 14;
const BALL_SPEED = 7;

const game = createGame({
  width: WIDTH,
  height: HEIGHT,
  gravity: 0,
  background: 0x111111,
  title: "PONG",
  lobby: true,
  maxPlayers: 2,
  scores: true,
  winScore: 7,
});
