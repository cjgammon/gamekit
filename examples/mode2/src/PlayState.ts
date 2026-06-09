import {
  Emitter,
  Group,
  Particle,
  Rng,
  Scene,
  Text,
  Tilemap,
  type BitmapFont,
} from "gamekit";
import type { InputManager } from "gamekit/input";
import type { AudioManager } from "gamekit/audio";
import { Bullet, Enemy, Player, Spawner, type Arena } from "./entities";
import {
  COLS,
  GIB_GRAVITY,
  MAXVEL_X,
  MAX_ENEMIES,
  ROWS,
  SCORE_DECAY,
  SCORE_ENEMY,
  SCORE_HIT,
  SCORE_SPAWNER,
  SCORE_START,
  TILE,
  WORLD,
} from "./config";

const HURT_IMMUNITY = 0.6; // seconds of i-frames after a hit

/** Spawner anchor positions: four down each side wall. */
function spawnerSpots(): Array<[number, number]> {
  const spots: Array<[number, number]> = [];
  for (let row = 0; row < 4; row++) {
    const y = row * 160 + 60;
    spots.push([2 * TILE, y]);
    spots.push([WORLD - 2 * TILE - 24, y]);
  }
  return spots;
}

/** Border walls + dirt floor + random platform blocks (Mode-style), with dirt
 *  frames randomized for texture variety. Returns a solid-tile map. */
function buildArena(rng: Rng): Tilemap {
  const data = new Uint16Array(COLS * ROWS);
  const dirt = () => 1 + rng.int(16); // tile value → dirt frame 0..15
  const solid = (c: number, r: number) => {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) data[r * COLS + c] = dirt();
  };
  const block = (c0: number, r0: number, w: number, h: number) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) solid(c, r);
  };

  // Border: 16px top + sides, 24px floor.
  block(0, 0, COLS, 2);
  block(0, 0, 2, ROWS);
  block(COLS - 2, 0, 2, ROWS);
  block(0, ROWS - 3, COLS, 3);

  // Platform blocks in the interior rooms (room cols 1–2 of the 4×4 grid),
  // leaving the side walls clear for spawners and movement.
  for (let roomR = 0; roomR < 4; roomR++) {
    for (let roomC = 1; roomC < 3; roomC++) {
      const blocks = 2 + rng.int(3);
      for (let i = 0; i < blocks; i++) {
        const w = 2 + rng.int(9); // 2–10 tiles
        // ≥2 tiles tall: the player falls up to 10px/step, so 1-tile (8px)
        // platforms would tunnel (collision is discrete, not swept).
        const h = 2 + rng.int(3); // 2–4 tiles
        const c0 = roomC * 20 + 2 + rng.int(Math.max(1, 16 - w));
        const r0 = roomR * 20 + 3 + rng.int(Math.max(1, 14 - h));
        block(c0, r0, w, h);
      }
    }
  }

  const map = new Tilemap(COLS, ROWS, TILE, TILE, data);
  map.tilesetId = "tiles"; // resolve dirt frames (else falls back to white)
  return map;
}

/** A full-world background layer (non-colliding) of tech tiles. */
function buildBackground(rng: Rng): Tilemap {
  const data = new Uint16Array(COLS * ROWS);
  for (let i = 0; i < data.length; i++) data[i] = 1 + rng.int(6); // bg frame 0..5
  const map = new Tilemap(COLS, ROWS, TILE, TILE, data);
  map.tilesetId = "bg";
  return map;
}

type GameState = "playing" | "won" | "lost";

/** The Mode play scene: platformer arena, spawners, score-as-life. */
export class PlayState extends Scene implements Arena {
  player!: Player;
  tilemap!: Tilemap;
  score = SCORE_START;
  state: GameState = "playing";

  private readonly rng = new Rng(0xb0a7);
  private readonly enemies = new Group<Enemy>();
  private readonly spawners = new Group<Spawner>();
  private readonly pBullets = new Group<Bullet>();
  private readonly eBullets = new Group<Bullet>();
  private enemyGibs!: Emitter;
  private spawnerGibs!: Emitter;
  private hud!: Text;
  private banner!: Text;
  private _hurtCd = 0;

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

    this.add(buildBackground(this.rng)); // non-colliding backdrop, drawn first
    this.tilemap = buildArena(this.rng);
    this.add(this.tilemap);
    this.add(this.enemies);
    this.add(this.spawners);
    this.add(this.pBullets);
    this.add(this.eBullets);

    this.enemyGibs = this._gibs("gibs", 6, 6, 5);
    this.spawnerGibs = this._gibs("spawner_gibs", 12, 12, 4);
    this.add(this.enemyGibs);
    this.add(this.spawnerGibs);

    this.player = new Player(this.input, this, 312, 280);
    this.add(this.player);

    for (const [sx, sy] of spawnerSpots()) {
      this.spawners.add(new Spawner(this, sx, sy));
    }

    this.camera.zoom = this.zoom;
    this.camera.bounds = { minX: 0, minY: 0, maxX: WORLD, maxY: WORLD };
    this.camera.deadzone = { x: 28, y: 22 };
    this.camera.follow(this.player, 0.22);
    this.camera.snapToTarget();

    this.hud = new Text(this.font, "", 0, 0);
    this.hud.scale = 0.5;
    this.add(this.hud);

    this.banner = new Text(this.font, "", 0, 0);
    this.banner.align = "center";
    this.banner.scale = 1.2;
    this.add(this.banner);
  }

  // ---- Arena interface ----

  firePlayerBullet(x: number, y: number, vx: number, vy: number): void {
    this.pBullets.recycle(() => new Bullet())!.spawn(x, y, vx, vy);
  }

  fireEnemyBullet(x: number, y: number, vx: number, vy: number): void {
    this.eBullets.recycle(() => new Bullet("ebullet"))!.spawn(x, y, vx, vy);
  }

  spawnEnemy(x: number, y: number): void {
    if (this._live(this.enemies) >= MAX_ENEMIES) return;
    this.enemies.recycle(() => new Enemy(this))!.spawn(x, y);
  }

  playSound(name: string, volume = 1): void {
    this.audio.play(name, { volume });
  }

  // ---- Loop ----

  override fixedUpdate(dt: number): void {
    super.fixedUpdate(dt);
    if (this.state !== "playing") return;

    if (this._hurtCd > 0) {
      this._hurtCd = Math.max(0, this._hurtCd - dt);
      if (this._hurtCd === 0) this.player.tint = 0xffffff;
    }

    // Player + bullets collide with terrain; flying enemies don't.
    this.tilemap.collide(this.player);
    this.player.updateGround();
    this.pBullets.forEach((b) => b.alive && this.tilemap.collide(b) && b.kill());
    this.eBullets.forEach((b) => b.alive && this.tilemap.collide(b) && b.kill());

    this.overlap(this.pBullets, this.enemies, (b, e) => {
      if (!b.alive || !e.alive) return;
      b.kill();
      e.kill();
      this._explode(this.enemyGibs, e.centerX, e.centerY, 8, 0.5);
      this.score += SCORE_ENEMY;
    });
    this.overlap(this.pBullets, this.spawners, (b, s) => {
      const sp = s as Spawner;
      if (!b.alive || !sp.alive) return;
      b.kill();
      if (sp.damage()) {
        this._explode(this.spawnerGibs, sp.centerX, sp.centerY, 14, 0.9);
        this.score += SCORE_SPAWNER;
      }
    });
    this.overlap(this.eBullets, this.player, (b) => {
      if (!b.alive) return;
      b.kill();
      this._hit();
    });
    this.overlap(this.enemies, this.player, (e) => e.alive && this._hit());

    this.score -= SCORE_DECAY * dt;
    if (this.score <= 0) {
      this.score = 0;
      this._end("lost");
    } else if (this._live(this.spawners) === 0) {
      this._end("won");
    }
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

  private _gibs(texture: string, fw: number, fh: number, frames: number): Emitter {
    const e = new Emitter(0, 0, () => {
      const p = new Particle();
      p.setTexture(texture, fw, fh);
      p.frame = Math.floor(Math.random() * frames);
      return p;
    });
    e.particleWidth = fw;
    e.particleHeight = fh;
    e.gravityY = GIB_GRAVITY;
    e.speed = { min: 50, max: 210 };
    e.life = { min: 0.5, max: 1.1 };
    e.spin = { min: -8, max: 8 };
    e.alphaStart = 1;
    e.alphaEnd = 1;
    e.scaleStart = 1;
    e.scaleEnd = 1;
    e.maxParticles = 240;
    return e;
  }

  private _explode(emitter: Emitter, x: number, y: number, n: number, vol: number): void {
    emitter.x = x;
    emitter.y = y;
    emitter.explode(n);
    this.audio.play("explode", { volume: vol });
  }

  private _hit(): void {
    if (this._hurtCd > 0) return;
    this.score -= SCORE_HIT;
    this._hurtCd = HURT_IMMUNITY;
    this.player.tint = 0xff6666; // flash
    this.player.velocity.x = -this.player.facing * MAXVEL_X; // knockback
    this.player.velocity.y = -120;
    this.audio.play("hurt", { volume: 0.7 });
  }

  private _live(group: Group): number {
    return group.children.filter((c) => c.alive).length;
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

    this.hud.x = left + 3;
    this.hud.y = top + 2;
    this.hud.setText(
      `SCORE ${Math.floor(this.score)}   SPAWNERS ${this._live(this.spawners)}`,
    );

    this.banner.x = cam.x - this.banner.width / 2;
    this.banner.y = cam.y - this.banner.height / 2;
  }
}
