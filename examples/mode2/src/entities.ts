import { Sprite, type Tilemap } from "gamekit";
import type { InputManager } from "gamekit/input";
import {
  BULLET_LIFE,
  DRAG_X,
  ENEMY_BULLET_SPEED,
  ENEMY_DRAG,
  ENEMY_HEALTH,
  ENEMY_JET_ON,
  ENEMY_JET_PERIOD,
  ENEMY_MAXSPEED,
  ENEMY_THRUST,
  ENEMY_TURN,
  GRAVITY,
  HURT_FLICKER,
  JUMP,
  MAXVEL_X,
  MAXVEL_Y,
  RECOIL,
  RUN_ACCEL,
  SPAWNER_HEALTH,
  SPAWN_OFF,
  SPAWN_ON,
} from "./config";

/** What the entities call back into on the play scene. */
export interface Arena {
  readonly player: Player;
  readonly tilemap: Tilemap;
  firePlayerBullet(x: number, y: number, vx: number, vy: number): void;
  fireEnemyBullet(x: number, y: number, vx: number, vy: number): void;
  spawnEnemy(x: number, y: number): void;
  playSound(name: string, volume?: number): void;
  gunJam(): void;
  onScreen(x: number, y: number): boolean;
}

/** Ease `angle` toward `target` by at most `step` radians (shortest way). */
function approachAngle(angle: number, target: number, step: number): number {
  let d = target - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (d > step) d = step;
  else if (d < -step) d = -step;
  return angle + d;
}

/** A directional projectile (pooled). Dies on a wall hit or timeout. */
export class Bullet extends Sprite {
  age = 0;

  constructor(textureId = "bullet") {
    super();
    this.setTexture(textureId, 6, 6); // Mode's 6×6 hitbox
    this.originX = 0.5;
    this.originY = 0.5;
  }

  spawn(x: number, y: number, vx: number, vy: number): void {
    this.setPosition(x - this.width / 2, y - this.height / 2, true);
    this.velocity.set(vx, vy);
    this.age = 0;
    // bullet.png frames: up[0] down[1] left[2] right[3]
    if (this.textureId === "bullet") {
      this.frame = vy < 0 ? 0 : vy > 0 ? 1 : vx < 0 ? 2 : 3;
    }
  }

  override fixedUpdate(dt: number): void {
    super.fixedUpdate(dt);
    this.age += dt;
    if (this.age >= BULLET_LIFE) this.kill();
  }
}

/**
 * The player — a platformer character matching Mode's Player.as: arrow keys
 * walk, X jumps (when grounded), C fires a single shot per press in the aim
 * direction (up / down-while-airborne / facing). Hits cause a flicker-immunity
 * window; shooting while flickering jams the gun.
 */
export class Player extends Sprite {
  facing: 1 | -1 = 1;
  grounded = false;
  flickerTimer = 0;

  private _prevJump = false;
  private _prevShoot = false;

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
    this.addAnim("jump_down", { frames: [10], fps: 1 });
    this.drag.set(DRAG_X, 0);
    this.maxVelocity.set(MAXVEL_X, MAXVEL_Y);
    this.originX = 0.5;
    this.originY = 0.5;
  }

  get flickering(): boolean {
    return this.flickerTimer > 0;
  }

  override fixedUpdate(dt: number): void {
    const i = this.input;
    const left = i.isDown("moveLeft");
    const right = i.isDown("moveRight");
    const aimUp = i.isDown("aimUp");
    const aimDown = i.isDown("aimDown");

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

    const jump = i.isDown("jump");
    if (jump && !this._prevJump && this.grounded) {
      this.velocity.y = -JUMP;
      this.arena.playSound("jump", 0.5);
    }
    this._prevJump = jump;

    // Aim: up / down (airborne only) / facing.
    const aim: "up" | "down" | "side" =
      aimUp ? "up" : aimDown && !this.grounded ? "down" : "side";

    super.fixedUpdate(dt); // integrate accel → drag → clamp → position

    // Single shot per press.
    const shoot = i.isDown("shoot");
    if (shoot && !this._prevShoot) {
      if (this.flickering) {
        this.arena.gunJam();
      } else {
        let vx = 0;
        let vy = 0;
        if (aim === "up") vy = -1;
        else if (aim === "down") vy = 1;
        else vx = this.facing;
        this.arena.firePlayerBullet(this.centerX, this.centerY, vx, vy);
        if (aim === "down") this.velocity.y -= RECOIL;
      }
    }
    this._prevShoot = shoot;

    if (this.flickerTimer > 0) {
      this.flickerTimer -= dt;
      this.visible = Math.floor(this.flickerTimer * 20) % 2 === 0;
      if (this.flickerTimer <= 0) this.visible = true;
    }

    this._animate(aim);
  }

  /** Apply a hit. Returns false if currently invulnerable (flickering). */
  hurt(): boolean {
    if (this.flickering) return false;
    this.flickerTimer = HURT_FLICKER;
    this.velocity.x = this.velocity.x > 0 ? -MAXVEL_X : MAXVEL_X; // knockback
    return true;
  }

  /** Probe the tiles just below the feet to decide if we can jump / are landed. */
  updateGround(): void {
    const t = this.arena.tilemap;
    const footY = this.y + this.height + 1;
    this.grounded =
      t.isSolid(t.getTileAtWorld(this.x + 1, footY)) ||
      t.isSolid(t.getTileAtWorld(this.x + this.width - 1, footY));
  }

  private _animate(aim: "up" | "down" | "side"): void {
    if (!this.grounded) {
      this.play(aim === "up" ? "jump_up" : aim === "down" ? "jump_down" : "jump");
    } else if (this.velocity.x === 0) {
      this.play(aim === "up" ? "idle_up" : "idle");
    } else {
      this.play(aim === "up" ? "run_up" : "run");
    }
  }
}

/**
 * A flying enemy (pooled) matching Enemy.as: rotates toward the player and
 * thrusts forward (jets cycle on/off for a floaty wobble), ignores gravity, and
 * fires a 3-shot burst every few seconds while on screen. Takes 2 hits.
 */
export class Enemy extends Sprite {
  hp = ENEMY_HEALTH;

  private _shotClock = 0;
  private _jetTimer = 0;
  private _thrust = 0;

  constructor(private readonly arena: Arena) {
    super();
    this.setTexture("enemy", 16, 16); // single rotated sprite
    this.originX = 0.5;
    this.originY = 0.5;
  }

  spawn(x: number, y: number): void {
    this.setPosition(x - this.width / 2, y - this.height / 2, true);
    this.velocity.set(0, 0);
    this.rotation = this._angleToPlayer();
    this.hp = ENEMY_HEALTH;
    this._shotClock = 0;
    this._jetTimer = 0;
    this._thrust = 0;
  }

  override fixedUpdate(dt: number): void {
    this.rotation = approachAngle(
      this.rotation,
      this._angleToPlayer(),
      ENEMY_TURN * dt,
    );

    this._jetTimer += dt;
    if (this._jetTimer > ENEMY_JET_PERIOD) this._jetTimer = 0;
    const jetsOn = this._jetTimer < ENEMY_JET_ON;
    // computeVelocity: accelerate toward thrust while jets fire, drag down when
    // off, capped at max speed (Mode: accel 90, drag 35, max 60).
    if (jetsOn) {
      this._thrust += ENEMY_THRUST * dt;
    } else {
      this._thrust -= ENEMY_DRAG * dt;
      if (this._thrust < 0) this._thrust = 0;
    }
    if (this._thrust > ENEMY_MAXSPEED) this._thrust = ENEMY_MAXSPEED;
    this.velocity.set(
      Math.cos(this.rotation) * this._thrust,
      Math.sin(this.rotation) * this._thrust,
    );

    super.fixedUpdate(dt);

    // 3-shot burst at 3.0 / 3.5 / 4.0s, only when visible.
    if (this.arena.onScreen(this.centerX, this.centerY)) {
      const os = this._shotClock;
      this._shotClock += dt;
      let shoot = false;
      if (os < 4 && this._shotClock >= 4) {
        this._shotClock = 0;
        shoot = true;
      } else if (os < 3.5 && this._shotClock >= 3.5) shoot = true;
      else if (os < 3 && this._shotClock >= 3) shoot = true;

      if (shoot) {
        this.arena.fireEnemyBullet(
          this.centerX,
          this.centerY,
          Math.cos(this.rotation) * ENEMY_BULLET_SPEED,
          Math.sin(this.rotation) * ENEMY_BULLET_SPEED,
        );
      }
    }
  }

  /** Deal one hit. Returns true if it died. */
  damage(): boolean {
    if (--this.hp <= 0) {
      this.kill();
      return true;
    }
    return false;
  }

  private _angleToPlayer(): number {
    const p = this.arena.player;
    return Math.atan2(p.centerY - this.centerY, p.centerX - this.centerX);
  }
}

/** A spawner (Spawner.as): opens to emit a bot, faster while on screen; 8 hits. */
export class Spawner extends Sprite {
  health = SPAWNER_HEALTH;

  private _timer: number;
  private _open = false;

  constructor(private readonly arena: Arena, x: number, y: number) {
    super(x, y);
    this.setTexture("spawner", 24, 24);
    this.addAnim("open", { frames: [1, 2, 3, 4, 5], fps: 40, loop: false });
    this.addAnim("close", { frames: [4, 3, 2, 1, 0], fps: 40, loop: false });
    this.addAnim("dead", { frames: [6], fps: 1 });
    this.originX = 0.5;
    this.originY = 0.5;
    this._timer = Math.random() * SPAWN_OFF;
  }

  override fixedUpdate(dt: number): void {
    this._timer += dt;
    const limit = this.arena.onScreen(this.centerX, this.centerY)
      ? SPAWN_ON
      : SPAWN_OFF;

    if (this._timer > limit) {
      this._timer = 0;
      this.arena.spawnEnemy(this.centerX, this.centerY);
    } else if (this._timer > limit - 0.35) {
      if (!this._open) {
        this._open = true;
        this.play("open");
      }
    } else if (this._timer > 1 && this._open) {
      this.play("close");
      this._open = false;
    }
  }

  /** Deal one hit. Returns true if it was destroyed. */
  damage(): boolean {
    if (--this.health <= 0) {
      this.play("dead");
      this.kill();
      return true;
    }
    return false;
  }
}
