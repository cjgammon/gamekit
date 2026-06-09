import { TILE } from "./assets";

export { TILE };

// Arena dimensions (in tiles → world pixels).
export const COLS = 40;
export const ROWS = 30;
export const ARENA_W = COLS * TILE; // 640
export const ARENA_H = ROWS * TILE; // 480

// Player.
export const PLAYER_SPEED = 95;
export const FIRE_RATE = 0.16; // seconds between shots
export const BULLET_SPEED = 240;
export const BULLET_LIFE = 1.3;

// Enemies.
export const ENEMY_SPEED = 48;
export const ENEMY_BULLET_SPEED = 140;
export const ENEMY_FIRE = 1.6;

// Spawners.
export const SPAWN_INTERVAL = 2.6;
export const SPAWNER_HEALTH = 4;

// Scoring / survival.
export const SCORE_ENEMY = 50;
export const SCORE_SPAWNER = 200;
export const SCORE_DECAY = 3; // points/sec
export const PLAYER_MAX_HP = 100;
export const HIT_BY_BULLET = 34;
export const HIT_BY_ENEMY = 18; // per fixed tick of contact
