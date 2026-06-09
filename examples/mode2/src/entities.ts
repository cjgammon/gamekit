import { Sprite, type Tilemap } from "gamekit";
import type { InputManager } from "gamekit/input";
import {
  BULLET_LIFE,
  BULLET_SPEED,
  DRAG_X,
  ENEMY_BULLET_SPEED,
  ENEMY_FIRE,
  ENEMY_SPEED,
  FIRE_RATE,
  GRAVITY,
  JUMP,
  MAXVEL_X,
  MAXVEL_Y,
  RECOIL,
  RUN_ACCEL,
  SPAWNER_HEALTH,
  SPAWN_INTERVAL,
} from "./config";

/** What the entities need back from the play scene. */
export interface Arena {
  readonly player: Player;
  readonly tilemap: Tilemap;
  firePlayerBullet(x: number, y: number, vx: number, vy: number): void;
  fireEnemyBullet(x: number, y: number, vx: number, vy: number): void;
  spawnEnemy(x: number, y: number): void;
  playSound(name: string, volume?: number): void;
}

/** A straight-flying projectile (pooled). Dies on timeout or impact. */
export class Bullet extends Sprite {
  age = 0;

  constructor(textureId = "bullet") {
    super();
    this.setTexture(textureId, 8, 8);
    this.originX = 0.5;
    this.originY = 0.5;
  }

  spawn(x: number, y: number, vx: number, vy: number): void {
    this.setPosition(x - this.width / 2, y - this.height / 2, true);
    this.velocity.set(vx, vy);
    this.age = 0;
  }

  override fixedUpdate(dt: number): void {
    super.fixedUpdate(dt);
    this.age += dt;
    if (this.age >= BULLET_LIFE) this.kill();
  }
}

/**
 * The player: a Flixel-style platformer character. Arrow keys walk; X jumps
 * (when grounded); C shoots in the aim direction (up / down-while-airborne /
 * facing). Gravity, run acceleration + drag, and the velocity clamp all use the
 * engine's built-in motion model with Mode's constants.
 */
export class Player extends Sprite {
  facing: 1 | -1 = 1;
  grounded = false;

  private _cooldown = 0;
  private _prevJump = false;

  constructor(
    private readonly input: InputManager,
    private readonly arena: Arena,
    x: number,
    y: number,
  ) {
    super(x, y);
    this.setTexture("player", 8, 8);
    this.addAnim("idle", { frames: [0], fps: 1 });
    this.addAnim("run", { frames: [1, 2, 3, 0], fps: 12 });
    this.addAnim("jump", { frames: [4], fps: 1 });
    this.addAnim("idle_up", { frames: [5], fps: 1 });
    this.addAnim("run_up", { frames: [6, 7, 8, 5], fps: 12 });
    this.addAnim("jump_up", { frames: [9], fps: 1 });
    this.drag.set(DRAG_X, 0);
    this.maxVelocity.set(MAXVEL_X, MAXVEL_Y);
  }

  override fixedUpdate(dt: number): void {
    const i = this.input;
    const left = i.isDown("moveLeft");
    const right = i.isDown("moveRight");
    const up = i.isDown("aimUp");
    const down = i.isDown("aimDown");

    // Horizontal: accelerate while held; drag decelerates when released.
    this.acceleration.x = 0;
    if (left && !right) {
      this.acceleration.x = -RUN_ACCEL;
      this.facing = -1;
      this.flipX = true;
    } else if (right && !left) {
      this.acceleration.x = RUN_ACCEL;
      this.facing = 1;
      this.flipX = false;
    }
    this.acceleration.y = GRAVITY;

    // Jump (rising edge, only when grounded).
    const jump = i.isDown("jump");
    if (jump && !this._prevJump && this.grounded) {
      this.velocity.y = -JUMP;
      this.arena.playSound("jump", 0.5);
    }
    this._prevJump = jump;

    super.fixedUpdate(dt); // integrate accel → drag → clamp → position

    // Shoot in the aim direction.
    this._cooldown -= dt;
    if (i.isDown("shoot") && this._cooldown <= 0) {
      let ax = 0;
      let ay = 0;
      if (up) ay = -1;
      else if (down && !this.grounded) ay = 1;
      else ax = this.facing;
      if (ax === 0 && ay === 0) ax = this.facing;

      this.arena.firePlayerBullet(
        this.centerX,
        this.centerY,
        ax * BULLET_SPEED,
        ay * BULLET_SPEED,
      );
      if (ay > 0) this.velocity.y -= RECOIL; // downward shot kicks you up
      this.arena.playSound("shoot", 0.5);
      this._cooldown = FIRE_RATE;
    }

    this._animate(up);
  }

  /** Probe the tiles just below the feet to decide if we can jump. */
  updateGround(): void {
    const t = this.arena.tilemap;
    const footY = this.y + this.height + 1;
    this.grounded =
      t.isSolid(t.getTileAtWorld(this.x + 1, footY)) ||
      t.isSolid(t.getTileAtWorld(this.x + this.width - 1, footY));
  }

  private _animate(up: boolean): void {
    if (!this.grounded) this.play(up ? "jump_up" : "jump");
    else if (this.velocity.x === 0) this.play(up ? "idle_up" : "idle");
    else this.play(up ? "run_up" : "run");
  }
}

/** A flying enemy (pooled): homes on the player, ignores gravity, shoots. */
export class Enemy extends Sprite {
  private _shoot = 0;

  constructor(private readonly arena: Arena) {
    super();
    this.setTexture("enemy", 16, 16);
    this.originX = 0.5;
    this.originY = 0.5;
  }

  spawn(x: number, y: number): void {
    this.setPosition(x, y, true);
    this.velocity.set(0, 0);
    this._shoot = 0.5 + Math.random() * ENEMY_FIRE;
  }

  override fixedUpdate(dt: number): void {
    const p = this.arena.player;
    const dx = p.centerX - this.centerX;
    const dy = p.centerY - this.centerY;
    const d = Math.hypot(dx, dy) || 1;
    this.velocity.set((dx / d) * ENEMY_SPEED, (dy / d) * ENEMY_SPEED);
    super.fixedUpdate(dt);
    this.rotation = Math.atan2(dy, dx);

    this._shoot -= dt;
    if (this._shoot <= 0) {
      this.arena.fireEnemyBullet(
        this.centerX,
        this.centerY,
        (dx / d) * ENEMY_BULLET_SPEED,
        (dy / d) * ENEMY_BULLET_SPEED,
      );
      this.arena.playSound("enemyShoot", 0.35);
      this._shoot = ENEMY_FIRE;
    }
  }
}

/** A spawner: emits enemies on a timer until shot enough times. */
export class Spawner extends Sprite {
  health = SPAWNER_HEALTH;
  private _timer: number;

  constructor(private readonly arena: Arena, x: number, y: number) {
    super(x, y);
    this.setTexture("spawner", 24, 24);
    this.addAnim("open", { frames: [1, 2, 3, 4, 5], fps: 40, loop: false });
    this.originX = 0.5;
    this.originY = 0.5;
    this._timer = 1 + Math.random() * SPAWN_INTERVAL;
  }

  override fixedUpdate(dt: number): void {
    this._timer -= dt;
    if (this._timer <= 0) {
      this.play("open", true);
      this.arena.spawnEnemy(this.centerX, this.centerY);
      this._timer = SPAWN_INTERVAL;
    }
  }

  /** Take a hit; returns true if destroyed. */
  damage(): boolean {
    if (--this.health <= 0) {
      this.kill();
      return true;
    }
    return false;
  }
}
