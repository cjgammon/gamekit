# Your First Game

A 10-minute walkthrough: scaffold a project, understand the three pieces, and add
a little gameplay. By the end you'll have a player that moves and collects coins.

You need **Node 18+** and a **WebGPU browser** (Chrome, Edge, or Safari 18+).

## 1. Scaffold and run

```bash
npm create gamekit@latest my-game   # choose "Single-player"
cd my-game
npm install
npm run dev                          # opens http://localhost:5173
```

You should see a white box you can move with **WASD** or the arrow keys. That's a
complete gamekit game — now let's understand it and extend it.

## 2. The three pieces

**`main.ts` — wiring.** It creates the game, hooks up input, and starts the loop:

```ts
const game = await RenderGame.create(canvas, { fov: 640, autoResize: true });
```

`fov` is "how many world units fit across the canvas." The engine sizes the
drawing buffer to your canvas and devicePixelRatio for you, so it's crisp on any
screen. `RenderGame` runs the loop and draws whatever scene is active.

**`PlayScene.ts` — your game.** A `Scene` holds your objects. Two methods matter:

- `create()` runs once when the scene starts — build your world here.
- `fixedUpdate(dt)` runs at a fixed rate (20×/sec) — put game logic here. `dt` is
  always the same small number, which keeps physics deterministic (and identical
  on a multiplayer server).

**`Entity` — a thing in the world.** It has a position (`x`, `y`), a size
(`width`, `height`), and `velocity` the engine integrates for you. An entity with
a size but no texture draws as a white box — so you can build the whole game
before you have any art.

## 3. Add a coin to collect

Open `src/PlayScene.ts`. Add a coin in `create()`:

```ts
import { Entity, Scene } from "@cjgammon/gamekit";
import type { InputManager } from "@cjgammon/gamekit/input";

const SPEED = 220;

export class PlayScene extends Scene {
  private player!: Entity;
  private coin!: Entity;
  private score = 0;

  constructor(private readonly input: InputManager) {
    super();
  }

  override create(): void {
    this.player = new Entity(300, 220);
    this.player.width = this.player.height = 40;
    this.add(this.player);

    this.coin = new Entity(0, 0);
    this.coin.width = this.coin.height = 20;
    this.placeCoin();
    this.add(this.coin);
  }

  private placeCoin(): void {
    this.coin.setPosition(40 + Math.random() * 560, 40 + Math.random() * 400);
  }

  override fixedUpdate(dt: number): void {
    super.fixedUpdate(dt);

    // Move the player from input.
    const i = this.input;
    const dx = (i.isDown("right") ? 1 : 0) - (i.isDown("left") ? 1 : 0);
    const dy = (i.isDown("down") ? 1 : 0) - (i.isDown("up") ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    this.player.velocity.set((dx / len) * SPEED, (dy / len) * SPEED);

    // Collect the coin on overlap.
    this.overlap(this.player, this.coin, () => {
      this.score++;
      console.log("score:", this.score);
      this.placeCoin();
    });
  }
}
```

Save — Vite reloads. Drive into the coin and it jumps to a new spot while your
score climbs in the console.

## 4. Where to go next

- **[recipes.md](./recipes.md)** — short snippets: screen shake, sprites + animation,
  sounds, tilemaps, camera follow, pooling, a HUD.
- **Add art:** load an image with `game.assets.load(...)` and use a `Sprite`
  instead of a plain `Entity` (see the `examples/mode-simple` game for a full example).
- **Go multiplayer:** `npm create gamekit my-game --template multiplayer`, then read
  **[tutorial-pong.md](./tutorial-pong.md)** to understand prediction and snapshots.

A few things worth knowing as you grow the game:
- Put anything physics/logic in `fixedUpdate`; put purely visual things (animation,
  tweens) in `update`. The engine smoothly interpolates rendering between fixed
  steps for you.
- Use `entity.kill()` to remove things; the scene sweeps them automatically.
- Forgot why nothing shows? A visible entity with zero width/height won't render —
  gamekit logs a one-time warning to the console when that happens.
