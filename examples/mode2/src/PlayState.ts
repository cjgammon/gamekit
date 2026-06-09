import { Emitter, Group, Scene, Text, Tilemap, type BitmapFont } from "gamekit";
import type { InputManager } from "gamekit/input";
import type { AudioManager } from "gamekit/audio";
import { Bullet, Enemy, Player, Spawner, type Arena } from "./entities";
import {
  ARENA_H,
  ARENA_W,
  COLS,
  HIT_BY_BULLET,
  HIT_BY_ENEMY,
  PLAYER_MAX_HP,
  ROWS,
  SCORE_DECAY,
  SCORE_ENEMY,
  SCORE_SPAWNER,
  TILE,
} from "./config";

/** Border walls plus a regular grid of 2×2 pillars for cover. */
function buildArena(): Tilemap {
  const data = new Uint16Array(COLS * ROWS);
  const set = (c: number, r: number) => (data[r * COLS + c] = 1);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c === 0 || r === 0 || c === COLS - 1 || r === ROWS - 1) set(c, r);
    }
  }
  for (let r = 4; r < ROWS - 4; r += 6) {
    for (let c = 4; c < COLS - 4; c += 6) {
      set(c, r);
      set(c + 1, r);
      set(c, r + 1);
      set(c + 1, r + 1);
    }
  }
  return new Tilemap(COLS, ROWS, TILE, TILE, data);
}

type GameState = "playing" | "won" | "lost";

/** The Mode play scene: owns the level, entity groups, and game rules. */
export class PlayState extends Scene implements Arena {
  player!: Player;
  tilemap!: Tilemap;
  score = 0;
  state: GameState = "playing";

  private readonly enemies = new Group<Enemy>();
  private readonly spawners = new Group<Spawner>();
  private readonly pBullets = new Group<Bullet>();
  private readonly eBullets = new Group<Bullet>();
  private explosions!: Emitter;
  private sparks!: Emitter;
  private hud!: Text;
  private banner!: Text;

  constructor(
    private readonly input: InputManager,
    private readonly audio: AudioManager,
    private readonly font: BitmapFont,
    private readonly zoom: number,
    private readonly onRestart: () => void,
  ) {
    super();
  }

  override create(): void {
    this.enemies.recycling = true;
    this.pBullets.recycling = true;
    this.eBullets.recycling = true;

    this.tilemap = buildArena();
    this.add(this.tilemap);
    // Draw order: tiles, enemies/spawners, bullets, player, particles, HUD.
    this.add(this.enemies);
    this.add(this.spawners);
    this.add(this.pBullets);
    this.add(this.eBullets);

    this.explosions = new Emitter(0, 0);
    Object.assign(this.explosions, {
      speed: { min: 40, max: 170 },
      life: { min: 0.3, max: 0.7 },
      particleWidth: 3,
      particleHeight: 3,
      scaleStart: 1.5,
      scaleEnd: 0,
      tints: [0xffcc44, 0xff6622, 0xffee99],
      maxParticles: 400,
    });
    this.add(this.explosions);

    this.sparks = new Emitter(0, 0);
    Object.assign(this.sparks, {
      speed: { min: 30, max: 90 },
      life: { min: 0.12, max: 0.28 },
      particleWidth: 2,
      particleHeight: 2,
      tints: [0xffee88],
      maxParticles: 200,
    });
    this.add(this.sparks);

    this.player = new Player(this.input, this, ARENA_W / 2, ARENA_H / 2, PLAYER_MAX_HP);
    this.add(this.player);

    const m = 3 * TILE;
    const corners: Array<[number, number]> = [
      [m, m],
      [ARENA_W - m - TILE, m],
      [m, ARENA_H - m - TILE],
      [ARENA_W - m - TILE, ARENA_H - m - TILE],
    ];
    for (const [sx, sy] of corners) this.spawners.add(new Spawner(this, sx, sy));

    this.camera.zoom = this.zoom;
    this.camera.bounds = { minX: 0, minY: 0, maxX: ARENA_W, maxY: ARENA_H };
    this.camera.follow(this.player, 0.18);
    this.camera.snapToTarget();

    this.hud = new Text(this.font, "", 0, 0);
    this.hud.scale = 0.6;
    this.add(this.hud);

    this.banner = new Text(this.font, "", 0, 0);
    this.banner.align = "center";
    this.banner.scale = 1.5;
    this.add(this.banner);
  }

  // ---- Arena interface ----

  firePlayerBullet(x: number, y: number, vx: number, vy: number): void {
    this.pBullets.recycle(() => new Bullet())!.spawn(x, y, vx, vy);
    this.audio.play("shoot", { volume: 0.6 });
  }

  fireEnemyBullet(x: number, y: number, vx: number, vy: number): void {
    this.eBullets.recycle(() => new Bullet("ebullet"))!.spawn(x, y, vx, vy);
    this.audio.play("enemyShoot", { volume: 0.5 });
  }

  spawnEnemy(x: number, y: number): void {
    this.enemies.recycle(() => new Enemy(this))!.spawn(x, y);
  }

  // ---- Loop ----

  override fixedUpdate(dt: number): void {
    super.fixedUpdate(dt); // entities + camera + particles
    if (this.state !== "playing") return;

    // Tilemap collisions.
    this.tilemap.collide(this.player);
    this.enemies.forEach((e) => e.alive && this.tilemap.collide(e));
    this.pBullets.forEach((b) => {
      if (b.alive && this.tilemap.collide(b)) {
        this._spark(b.centerX, b.centerY);
        b.kill();
      }
    });
    this.eBullets.forEach((b) => {
      if (b.alive && this.tilemap.collide(b)) b.kill();
    });

    // Player bullets → enemies / spawners.
    this.overlap(this.pBullets, this.enemies, (b, e) => {
      if (!b.alive || !e.alive) return;
      b.kill();
      e.kill();
      this._explode(e.centerX, e.centerY, false);
      this.score += SCORE_ENEMY;
    });
    this.overlap(this.pBullets, this.spawners, (b, s) => {
      const sp = s as Spawner;
      if (!b.alive || !sp.alive) return;
      b.kill();
      this._spark(b.centerX, b.centerY);
      if (sp.damage()) {
        this._explode(sp.centerX, sp.centerY, true);
        this.score += SCORE_SPAWNER;
      }
    });

    // Enemy fire / contact → player.
    this.overlap(this.eBullets, this.player, (b) => {
      if (!b.alive) return;
      b.kill();
      this._hurt(HIT_BY_BULLET);
    });
    this.overlap(this.enemies, this.player, (e) => {
      if (e.alive) this._hurt(HIT_BY_ENEMY);
    });

    this.score = Math.max(0, this.score - dt * SCORE_DECAY);

    if (this.player.hp <= 0) this._end("lost");
    else if (this._liveSpawners() === 0) this._end("won");
  }

  override update(dt: number): void {
    super.update(dt);
    this.input.poll();
    this._updateHud();
    if (this.state !== "playing" && this.input.justPressed("restart")) {
      this.onRestart();
    }
    this.input.update();
  }

  // ---- Internal ----

  private _explode(x: number, y: number, big: boolean): void {
    this.explosions.x = x;
    this.explosions.y = y;
    this.explosions.explode(big ? 24 : 10);
    this.audio.play("explode", { volume: big ? 0.8 : 0.5 });
  }

  private _spark(x: number, y: number): void {
    this.sparks.x = x;
    this.sparks.y = y;
    this.sparks.explode(5);
  }

  private _hurt(amount: number): void {
    this.player.hp -= amount;
    this.player.tint = 0xff8866; // brief tint until next hit/heal
  }

  private _liveSpawners(): number {
    return this.spawners.children.filter((s) => s.alive).length;
  }

  private _end(state: GameState): void {
    this.state = state;
    this.player.active = false;
    this.enemies.active = false;
    this.spawners.active = false;
    this.eBullets.active = false;
    this.banner.setText(
      state === "won" ? "YOU WIN!\npress R" : "GAME OVER\npress R",
    );
  }

  private _updateHud(): void {
    const cam = this.camera;
    const vw = cam.viewportWidth / cam.zoom;
    const vh = cam.viewportHeight / cam.zoom;
    const left = cam.x - vw / 2;
    const top = cam.y - vh / 2;

    this.hud.x = left + 4;
    this.hud.y = top + 3;
    this.hud.setText(
      `SCORE ${Math.floor(this.score)}   HP ${Math.max(0, Math.ceil(this.player.hp))}   SPAWNERS ${this._liveSpawners()}`,
    );

    // Center the banner (if any) in the view.
    this.banner.x = cam.x - this.banner.width / 2;
    this.banner.y = cam.y - this.banner.height / 2;
  }
}
