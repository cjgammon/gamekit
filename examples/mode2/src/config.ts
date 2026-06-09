// Constants ported from the original Mode source (Adam Atomic, MIT). It's a
// platformer: gravity + run/drag + jump, 8px tiles, a 640×640 world, 6 spawners,
// and a decaying score that doubles as your life.

export const TILE = 8;
export const COLS = 80;
export const ROWS = 80;
export const WORLD = COLS * TILE; // 640
export const ROOM = 160; // 4×4 grid of 160px rooms
export const ROOM_TILES = 20;

// Player physics (Player.as: runSpeed 80, drag = runSpeed*8, gravity 420, jump 200).
export const RUN_ACCEL = 640;
export const DRAG_X = 640;
export const MAXVEL_X = 80;
export const MAXVEL_Y = 200;
export const GRAVITY = 420;
export const JUMP = 200;
export const RECOIL = 36; // upward kick when firing downward
export const PLAYER_START_X = 316;
export const PLAYER_START_Y = 300;

// Weapons.
export const BULLET_SPEED = 360;
export const BULLET_LIFE = 2.0; // safety despawn (Mode kills on contact)
export const ENEMY_BULLET_SPEED = 120;

// Enemies (Enemy.as).
export const ENEMY_HEALTH = 2;
export const ENEMY_THRUST = 90;
export const ENEMY_DRAG = 35;
export const ENEMY_MAXSPEED = 90;
export const ENEMY_TURN = 3.2; // rad/sec the bot rotates toward the player
export const ENEMY_JET_PERIOD = 8; // jets cycle on 6s / off 2s
export const ENEMY_JET_ON = 6;
export const MAX_ENEMIES = 40;

// Spawners (Spawner.as): 8 hits to kill, spawn every 4s on-screen.
export const SPAWNER_HEALTH = 8;
export const SPAWN_ON = 4;
export const SPAWN_OFF = 20;

// Scoring (PlayState.as + hurt/kill handlers). Score is life.
export const SCORE_ENEMY_HIT = 10;
export const SCORE_ENEMY_KILL = 200;
export const SCORE_SPAWNER_HIT = 50;
export const SCORE_SPAWNER_KILL = 1000;
export const SCORE_DECAY_STEP = 100;
export const SCORE_DECAY_GRACE = 2; // seconds after a gain before decay starts
export const SCORE_DECAY_INTERVAL = 1; // seconds between decay ticks
export const HURT_SCORE = 1000;
export const HURT_FLICKER = 1.3;

// Particles.
export const GIB_GRAVITY = 350;

// HUD palette (Mode's text color).
export const HUD_COLOR = 0xd8eba2;
