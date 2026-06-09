import { Sprite, type Tilemap } from "gamekit";
import type { InputManager } from "gamekit/input";
import {
  BULLET_LIFE,
  BULLET_SPEED,
  ENEMY_BULLET_SPEED,
  ENEMY_FIRE,
  ENEMY_SPEED,
  FIRE_RATE,
  PLAYER_SPEED,
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
}

/** A projectile (pooled). Dies on timeout; the scene kills it on impact. */
export class Bullet extends Sprite {
  age = 0;

  constructor(textureId = "bullet") {
    super();
    this.setTexture(textureId, 6, 6);
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

/** The player — WASD to move, arrow keys to shoot (twin-stick). */
export class Player extends Sprite {
  hp: number;
  private _cooldown = 0;

  constructor(
    private readonly input: InputManager,
    private readonly arena: Arena,
    x: number,
    y: number,
    maxHp: number,
  ) {
    super(x, y);
    // spaceman.png has 8×8 frames; draw at 16 and animate idle/run.
    this.setTexture("player", 16, 16);
    this.addAnim("idle", { frames: [0], fps: 1 });
    this.addAnim("run", { frames: [1, 2, 3, 0], fps: 12 });
    this.originX = 0.5;
    this.originY = 0.5;
    this.hp = maxHp;
  }

  override fixedUpdate(dt: number): void {
    // Move (WASD).
    const mx =
      (this.input.isDown("moveRight") ? 1 : 0) -
      (this.input.isDown("moveLeft") ? 1 : 0);
    const my =
      (this.input.isDown("moveDown") ? 1 : 0) -
      (this.input.isDown("moveUp") ? 1 : 0);
    const ml = Math.hypot(mx, my) || 1;
    this.velocity.set((mx / ml) * PLAYER_SPEED, (my / ml) * PLAYER_SPEED);
    super.fixedUpdate(dt); // integrate position

    // Animate + face the way we move.
    if (mx !== 0 || my !== 0) this.play("run");
    else this.play("idle");
    if (mx < 0) this.flipX = true;
    else if (mx > 0) this.flipX = false;

    // Aim + fire (arrow keys).
    const ax =
      (this.input.isDown("aimRight") ? 1 : 0) -
      (this.input.isDown("aimLeft") ? 1 : 0);
    const ay =
      (this.input.isDown("aimDown") ? 1 : 0) -
      (this.input.isDown("aimUp") ? 1 : 0);
    this._cooldown -= dt;
    if ((ax !== 0 || ay !== 0) && this._cooldown <= 0) {
      const al = Math.hypot(ax, ay);
      this.arena.firePlayerBullet(
        this.centerX,
        this.centerY,
        (ax / al) * BULLET_SPEED,
        (ay / al) * BULLET_SPEED,
      );
      this._cooldown = FIRE_RATE;
    }
  }
}

/** An enemy (pooled): homes on the player and shoots at it. */
export class Enemy extends Sprite {
  private _shoot = 0;

  constructor(private readonly arena: Arena) {
    super();
    // bot.png is a single sprite (Mode pre-rotates it); we rotate live instead.
    this.setTexture("enemy", 16, 16);
    this.originX = 0.5;
    this.originY = 0.5;
  }

  spawn(x: number, y: number): void {
    this.setPosition(x, y, true);
    this.velocity.set(0, 0);
    this._shoot = 0.6 + Math.random() * ENEMY_FIRE;
  }

  override fixedUpdate(dt: number): void {
    const p = this.arena.player;
    const dx = p.centerX - this.centerX;
    const dy = p.centerY - this.centerY;
    const d = Math.hypot(dx, dy) || 1;
    this.velocity.set((dx / d) * ENEMY_SPEED, (dy / d) * ENEMY_SPEED);
    super.fixedUpdate(dt);
    this.rotation = Math.atan2(dy, dx); // face the player

    this._shoot -= dt;
    if (this._shoot <= 0) {
      this.arena.fireEnemyBullet(
        this.centerX,
        this.centerY,
        (dx / d) * ENEMY_BULLET_SPEED,
        (dy / d) * ENEMY_BULLET_SPEED,
      );
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
    this.setTexture("spawner", 16, 16);
    this._timer = 1 + Math.random() * SPAWN_INTERVAL;
  }

  override fixedUpdate(dt: number): void {
    this._timer -= dt;
    if (this._timer <= 0) {
      this.arena.spawnEnemy(
        this.centerX - 8 + (Math.random() * 2 - 1) * 6,
        this.centerY - 8 + (Math.random() * 2 - 1) * 6,
      );
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
