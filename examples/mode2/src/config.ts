// Constants ported from the original Mode (Adam Atomic). It's a platformer:
// gravity + run/drag + jump, 8px tiles, a 640×640 world, 8 spawners, and a
// decaying score that doubles as your life.

export const TILE = 8;
export const COLS = 80;
export const ROWS = 80;
export const WORLD = COLS * TILE; // 640

// Player physics (Mode's Player.as).
export const RUN_ACCEL = 640;
export const DRAG_X = 640;
export const MAXVEL_X = 80;
export const MAXVEL_Y = 200;
export const GRAVITY = 420;
export const JUMP = 200; // upward velocity on jump
export const RECOIL = 36; // upward kick when firing downward

// Weapons.
export const BULLET_SPEED = 360;
export const BULLET_LIFE = 1.2;
export const FIRE_RATE = 0.11;
export const ENEMY_BULLET_SPEED = 130;

// Enemies / spawners.
export const ENEMY_SPEED = 60;
export const ENEMY_FIRE = 1.6;
export const SPAWN_INTERVAL = 3.0;
export const SPAWNER_HEALTH = 4;
export const MAX_ENEMIES = 24;

// Scoring (score is life: it decays, and hitting 0 is death).
export const SCORE_START = 600;
export const SCORE_DECAY = 100; // points/sec
export const SCORE_ENEMY = 200;
export const SCORE_SPAWNER = 1000;
export const SCORE_HIT = 200; // lost per hit taken

// Particles.
export const GIB_GRAVITY = 350;
