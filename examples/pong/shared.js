// shared.js
export const WIDTH = 480;
export const HEIGHT = 320;
export const PADDLE_W = 8;
export const PADDLE_H = 56;
export const PADDLE_SPEED = 260; // px per second
export const PADDLE_INSET = 16; // gap between paddle and wall
export const BALL_SIZE = 8;
export const TICK_RATE = 60; // server + client run at this rate

// The single source of truth for paddle movement. The server calls this to
// move a paddle for real; each client calls the SAME function to predict its
// own paddle. `input` is { up, down }.
export function movePaddle(y, input, dt) {
  const dir = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  let next = y + dir * PADDLE_SPEED * dt;
  if (next < 0) next = 0;
  if (next > HEIGHT - PADDLE_H) next = HEIGHT - PADDLE_H;
  return next;
}