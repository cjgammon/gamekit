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
  HUD_COLOR,
  HURT_SCORE,
  PLAYER_START_X,
  PLAYER_START_Y,
  ROOM_TILES,
  ROWS,
  SCORE_DECAY_GRACE,
  SCORE_DECAY_INTERVAL,
  SCORE_DECAY_STEP,
  SCORE_ENEMY_HIT,
  SCORE_ENEMY_KILL,
  SCORE_SPAWNER_HIT,
  SCORE_SPAWNER_KILL,
  TILE,
  WORLD,
} from "./config";

type GameState = "playing" | "won" | "lost";

/** The four visual/collision tile layers built by {@link buildLevel}. */
interface Level {
  /** All solid cells (collision only — not drawn). */
  solid: Tilemap;
  /** tech_tiles geometry: walls, ceiling, platform blocks. */
  tech: Tilemap;
  /** dirt body: floor + large-block decoration. */
  dirt: Tilemap;
  /** dirt_top lit surface: floor top + large-block caps. */
  dirtTop: Tilemap;
  /** Spawner anchor positions (world px). */
  spawners: Array<[number, number]>;
}

/**
 * Builds Mode's level: tech-tile walls/ceiling/blocks (solid), a dirt floor, and
 * non-colliding dirt decoration on large blocks — mirroring generateLevel() /
 * buildRoom(). Solid cells go into a dedicated collision map; the visuals are
 * separate layers. Spawners live in rooms (0,0)(3,0)(0,1)(3,1)(0,3)(3,3).
 */
function buildLevel(rng: Rng): Level {
  const solidD = new Uint16Array(COLS * ROWS);
  const techD = new Uint16Array(COLS * ROWS);
  const dirtD = new Uint16Array(COLS * ROWS);
  const topD = new Uint16Array(COLS * ROWS);
  const spawners: Array<[number, number]> = [];

  const put = (arr: Uint16Array, c: number, r: number, v: number) => {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) arr[r * COLS + c] = v;
  };
  const fill = (
    arr: Uint16Array,
    c0: number,
    r0: number,
    w: number,
    h: number,
    frame: () => number,
  ) => {
    for (let r = r0; r < r0 + h; r++)
      for (let c = c0; c < c0 + w; c++) put(arr, c, r, frame());
  };
  const tech = () => 1 + rng.int(6);
  const dirt = () => 1 + rng.int(16);
  const top = () => 1 + rng.int(2);
  const one = () => 1;

  // tech rect = solid + tech visual; dirt rect = solid + dirt visual (floor); etc.
  const techBlock = (c0: number, r0: number, w: number, h: number) => {
    fill(solidD, c0, r0, w, h, one);
    fill(techD, c0, r0, w, h, tech);
  };

  // Border (tiles): top wall 2 rows, side walls 2 cols, then the dirt floor.
  techBlock(0, 0, COLS, 2);
  techBlock(0, 2, 2, ROWS - 2);
  techBlock(COLS - 2, 2, 2, ROWS - 2);
  // Floor: dirt_top surface row + dirt body (both solid). (16px..624 → tiles 2..78)
  fill(solidD, 2, ROWS - 3, COLS - 4, 1, one);
  fill(topD, 2, ROWS - 3, COLS - 4, 1, top);
  fill(solidD, 2, ROWS - 2, COLS - 4, 2, one);
  fill(dirtD, 2, ROWS - 2, COLS - 4, 2, dirt);

  // 4×4 rooms (20 tiles each). Spawner rooms per the original.
  const spawnerRooms = new Set(["0,0", "3,0", "0,1", "3,1", "0,3", "3,3"]);
  for (let ry = 0; ry < 4; ry++) {
    for (let rx = 0; rx < 4; rx++) {
      const isSpawner = spawnerRooms.has(`${rx},${ry}`);
      const baseC = rx * ROOM_TILES;
      const baseR = ry * ROOM_TILES;

      // Spawner position within the room.
      let sx = 0;
      let sy = 0;
      if (isSpawner) {
        sx = 2 + rng.int(ROOM_TILES - 7);
        sy = 2 + rng.int(ROOM_TILES - 7);
        spawners.push([(baseC + sx) * TILE, (baseR + sy) * TILE]);
      }

      let numBlocks = 3 + rng.int(4);
      if (!isSpawner) numBlocks++;
      for (let i = 0; i < numBlocks; i++) {
        let bw = 0;
        let bh = 0;
        let bx = 0;
        let by = 0;
        // Re-roll until the block doesn't cover the spawner.
        do {
          bw = 2 + rng.int(9); // 2..10
          bh = 1 + rng.int(8); // 1..8
          bx = -1 + rng.int(ROOM_TILES + 1 - bw);
          by = -1 + rng.int(ROOM_TILES + 1 - bh);
        } while (
          isSpawner &&
          !(sx > bx + bw || sx + 3 < bx || sy > by + bh || sy + 3 < by)
        );

        techBlock(baseC + bx, baseR + by, bw, bh);

        // Large blocks get a non-colliding dirt cap + body (decoration only).
        if (bw >= 4 && bh >= 5) {
          fill(topD, baseC + bx + 1, baseR + by, bw - 2, 1, top);
          fill(dirtD, baseC + bx + 1, baseR + by + 1, bw - 2, bh - 3, dirt);
        }
      }
    }
  }

  const make = (data: Uint16Array, tileset: string): Tilemap => {
    const m = new Tilemap(COLS, ROWS, TILE, TILE, data);
    m.tilesetId = tileset;
    return m;
  };
  return {
    solid: make(solidD, ""), // collision only
    tech: make(techD, "tech"),
    dirt: make(dirtD, "dirt"),
    dirtTop: make(topD, "dirt_top"),
    spawners,
  };
}

/** The Mode play scene: platformer arena, spawners, score-as-life. */
export class PlayState extends Scene implements Arena {
  player!: Player;
  tilemap!: Tilemap; // the solid collision map
  score = 0;
  state: GameState = "playing";

  private readonly rng = new Rng(0xb0a7);
  private readonly enemies = new Group<Enemy>();
  private readonly spawners = new Group<Spawner>();
  private readonly pBullets = new Group<Bullet>();
  private readonly eBullets = new Group<Bullet>();
  private littleGibs!: Emitter;
  private bigGibs!: Emitter;
  private hud!: Text;
  private banner!: Text;
  private jam!: Text;
  private _scoreTimer = 0;
  private _jamTimer = 0;

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

    const level = buildLevel(this.rng);
    this.tilemap = level.solid;
    // Visual geometry layers (collision is the separate `solid` map).
    this.add(level.tech);
    this.add(level.dirt);
    this.add(level.dirtTop);

    this.littleGibs = this._gibs("gibs", 6, 6, 5);
    this.bigGibs = this._gibs("spawner_gibs", 12, 12, 4);
    this.add(this.spawners);
    this.add(this.littleGibs);
    this.add(this.bigGibs);
    this.add(this.enemies);

    this.player = new Player(this.input, this, PLAYER_START_X, PLAYER_START_Y);
    this.add(this.player);
    this.add(this.eBullets);
    this.add(this.pBullets);

    for (const [sx, sy] of level.spawners) {
      this.spawners.add(new Spawner(this, sx, sy));
    }

    this.camera.zoom = this.zoom;
    this.camera.bounds = { minX: 0, minY: 0, maxX: WORLD, maxY: WORLD };
    this.camera.deadzone = { x: 24, y: 20 };
    this.camera.follow(this.player, 0.2);
    this.camera.snapToTarget();

    this.hud = new Text(this.font, "0", 0, 0);
    this.hud.align = "center";
    this.hud.scale = 0.85;
    this.hud.tint = HUD_COLOR;
    this.add(this.hud);

    this.jam = new Text(this.font, "GUN IS JAMMED", 0, 0);
    this.jam.align = "center";
    this.jam.scale = 0.85;
    this.jam.tint = HUD_COLOR;
    this.jam.visible = false;
    this.add(this.jam);

    this.banner = new Text(this.font, "", 0, 0);
    this.banner.align = "center";
    this.banner.scale = 1.2;
    this.banner.tint = HUD_COLOR;
    this.add(this.banner);

    this.audio.playMusic("mode"); // no-op until the audio context is unlocked
  }

  // ---- Arena interface ----

  firePlayerBullet(x: number, y: number, dx: number, dy: number): void {
    this.pBullets.recycle(() => new Bullet())!.spawn(x, y, dx * 360, dy * 360);
    this.audio.play("shoot", { volume: 0.5 });
  }

  fireEnemyBullet(x: number, y: number, vx: number, vy: number): void {
    this.eBullets.recycle(() => new Bullet("ebullet"))!.spawn(x, y, vx, vy);
    this.audio.play("enemyShoot", { volume: 0.4 });
  }

  spawnEnemy(x: number, y: number): void {
    this.enemies.recycle(() => new Enemy(this))!.spawn(x, y);
  }

  playSound(name: string, volume = 1): void {
    this.audio.play(name, { volume });
  }

  gunJam(): void {
    this.audio.play("jam", { volume: 0.6 });
    this._jamTimer = 1;
    this.jam.visible = true;
  }

  onScreen(x: number, y: number): boolean {
    const cam = this.camera;
    const hw = cam.viewportWidth / cam.zoom / 2 + 24;
    const hh = cam.viewportHeight / cam.zoom / 2 + 24;
    return Math.abs(x - cam.x) < hw && Math.abs(y - cam.y) < hh;
  }

  // ---- Loop ----

  override fixedUpdate(dt: number): void {
    const oldScore = this.score;
    super.fixedUpdate(dt);
    if (this.state !== "playing") return;

    // Terrain: player collides with the solid map; flying enemies don't.
    this.tilemap.collide(this.player);
    this.player.updateGround();
    const inWall = (b: Bullet) =>
      this.tilemap.isSolid(this.tilemap.getTileAtWorld(b.centerX, b.centerY));
    this.pBullets.forEach((b) => b.alive && inWall(b) && b.kill());
    this.eBullets.forEach((b) => b.alive && inWall(b) && b.kill());

    // Player bullets vs enemies / spawners.
    this.overlap(this.pBullets, this.enemies, (b, e) => {
      const en = e as Enemy;
      if (!b.alive || !en.alive) return;
      b.kill();
      this.playSound("explode", 0.3);
      if (en.damage()) {
        this._burst(this.littleGibs, en.centerX, en.centerY, 3);
        this.score += SCORE_ENEMY_KILL;
      } else {
        this.score += SCORE_ENEMY_HIT;
      }
    });
    this.overlap(this.pBullets, this.spawners, (b, s) => {
      const sp = s as Spawner;
      if (!b.alive || !sp.alive) return;
      b.kill();
      if (sp.damage()) {
        this._burst(this.bigGibs, sp.centerX, sp.centerY, 3);
        this.playSound("explode", 0.9);
        this.score += SCORE_SPAWNER_KILL;
      } else {
        this.score += SCORE_SPAWNER_HIT;
      }
    });

    // Hazards vs player.
    this.overlap(this.eBullets, this.player, (b) => {
      if (b.alive && this._hurt()) b.kill();
    });
    this.overlap(this.enemies, this.player, (e) => e.alive && this._hurt());

    // Score decay (Mode: 2s grace after any gain, then −100 every 1s; die at 0).
    if (this.score !== oldScore) this._scoreTimer = SCORE_DECAY_GRACE;
    this._scoreTimer -= dt;
    if (this._scoreTimer < 0 && this.score > 0) {
      if (this.score > SCORE_DECAY_STEP) this.score -= SCORE_DECAY_STEP;
      else this._die();
      this._scoreTimer = SCORE_DECAY_INTERVAL;
      this.playSound("count", this.score < 600 ? 1 : 0.35);
    }

    if (this.state === "playing" && this._live(this.spawners) === 0) {
      this._end("won");
    }
  }

  override update(dt: number): void {
    super.update(dt);
    this.input.poll();

    if (this._jamTimer > 0) {
      if (!this.player.flickering) this._jamTimer = 0;
      this._jamTimer -= dt;
      if (this._jamTimer <= 0) this.jam.visible = false;
    }

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
    e.angle = { min: -Math.PI, max: 0 }; // burst upward, then fall
    e.speed = { min: 60, max: 220 };
    e.life = { min: 0.6, max: 1.3 };
    e.spin = { min: -10, max: 10 };
    e.alphaStart = 1;
    e.alphaEnd = 1;
    e.maxParticles = 300;
    return e;
  }

  private _burst(emitter: Emitter, x: number, y: number, n: number): void {
    emitter.x = x;
    emitter.y = y;
    emitter.explode(n * 4);
  }

  private _hurt(): boolean {
    if (!this.player.hurt()) return false;
    // Mode only docks score on a hit if you have a cushion (>1000); death comes
    // from the decay, not directly from hits.
    if (this.score > HURT_SCORE) this.score -= HURT_SCORE;
    this.playSound("hurt", 0.7);
    return true;
  }

  private _die(): void {
    this.score = 0;
    this._burst(this.littleGibs, this.player.centerX, this.player.centerY, 5);
    this.playSound("explode", 0.9);
    this._end("lost");
  }

  private _live(group: Group): number {
    return group.children.filter((c) => c.alive).length;
  }

  private _end(state: GameState): void {
    this.state = state;
    this.player.active = false;
    this.player.visible = state === "won";
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

    this.hud.setText(`${Math.floor(this.score)}`);
    this.hud.x = cam.x - this.hud.width / 2;
    this.hud.y = top + 3;

    this.jam.x = cam.x - this.jam.width / 2;
    this.jam.y = top + vh - 12;

    this.banner.x = cam.x - this.banner.width / 2;
    this.banner.y = cam.y - this.banner.height / 2;
  }
}
