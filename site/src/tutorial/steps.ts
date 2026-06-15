export interface Step {
  id: string;
  title: string;
  /** Markdown prose shown above the editor. */
  prose: string;
  /** Starter code (TypeScript). Import-free — the preview injects the API
   *  (`createGame`, `Scene`, `Entity`, `InputManager`, `hud`, `canvas`, …). */
  starter: string;
}

export const steps: Step[] = [
  {
    id: "blank",
    title: "An empty game",
    prose: `# Your first game

Welcome! You'll build a tiny game **piece by piece**, editing real code and
seeing it run instantly on the right. Hit **Run ▶** (or just edit) any time.

Every gamekit game is two things:

- a **Game** — runs the loop and draws to a canvas, and
- a **Scene** — holds your game objects. You override \`create()\` to build it.

\`createGame\` picks WebGPU when your browser has it, and falls back to a 2D
canvas otherwise — so this runs anywhere. The \`camera.centerOn(240, 180)\` line
points the camera at the middle of a **480×360** play area, so \`(0, 0)\` is the
top-left of the preview.

> In a real project you'd \`import { Scene } from "@cjgammon/gamekit"\` and
> \`createGame\` from \`@cjgammon/gamekit/renderer\`. Here they're already in scope,
> plus a \`canvas\` to draw on and a \`hud(text)\` helper for on-screen text.`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

class PlayScene extends Scene {
  create() {
    this.camera.centerOn(240, 180); // frame the 480x360 play area (0,0 = top-left)
    // Your game starts here. It's empty for now!
    hud("An empty game. Let's add something.");
  }
}

game.switchScene(new PlayScene());
game.start();
`,
  },

  {
    id: "player",
    title: "Add a player",
    prose: `# Add a player

An **Entity** is a thing in the world: a position (\`x\`, \`y\`) and a size
(\`width\`, \`height\`). Add one to the scene in \`create()\`.

A handy trick: an entity that has a size but **no texture draws as a white box** —
so you can build the whole game before you have any art.

Try changing its position or size and hit **Run**.`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

class PlayScene extends Scene {
  create() {
    this.camera.centerOn(240, 180); // frame the 480x360 play area (0,0 = top-left)
    const player = new Entity(220, 200); // x, y in the world
    player.width = 40;
    player.height = 40;                  // sized + no texture → a white box
    this.add(player);
  }
}

game.switchScene(new PlayScene());
game.start();
`,
  },

  {
    id: "move",
    title: "Move it around",
    prose: `# Move it around

Time for input. An **InputManager** maps named **actions** ("up", "left") to
keys, then you ask \`input.isDown("up")\` each tick.

Game logic goes in **\`fixedUpdate(dt)\`**, which runs at a steady rate. We set the
player's \`velocity\` from the keys; the engine turns velocity into motion for us
(and smoothly interpolates the rendering in between).

👉 **Click the preview first**, then move with **WASD** or the **arrow keys**.
Change \`SPEED\` and re-run to feel the difference.`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

const input = new InputManager({
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
});
input.attach(window);

const SPEED = 200; // pixels per second

class PlayScene extends Scene {
  player!: Entity;

  create() {
    this.camera.centerOn(240, 180); // frame the 480x360 play area (0,0 = top-left)
    this.player = new Entity(220, 200);
    this.player.width = 40;
    this.player.height = 40;
    this.add(this.player);
    hud("Click here, then move with WASD / arrows");
  }

  fixedUpdate(dt: number) {
    super.fixedUpdate(dt); // integrates velocity → position
    const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
    const dy = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1; // so diagonals aren't faster
    this.player.velocity.set((dx / len) * SPEED, (dy / len) * SPEED);
  }
}

game.switchScene(new PlayScene());
game.start();
`,
  },

  {
    id: "coin",
    title: "Add a coin",
    prose: `# Add a coin

A game needs a goal. Add a second entity — a small **coin** — and drop it at a
random spot with a \`placeCoin()\` helper.

\`setPosition(x, y)\` moves an entity (and snaps it so it doesn't smear from its
old place). We'll reuse it in the next step to respawn the coin.`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

const input = new InputManager({
  up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
});
input.attach(window);

const SPEED = 200;

class PlayScene extends Scene {
  player!: Entity;
  coin!: Entity;

  create() {
    this.camera.centerOn(240, 180); // frame the 480x360 play area (0,0 = top-left)
    this.player = new Entity(220, 200);
    this.player.width = 40;
    this.player.height = 40;
    this.add(this.player);

    this.coin = new Entity(0, 0);
    this.coin.width = 20;
    this.coin.height = 20;
    this.placeCoin();
    this.add(this.coin);

    hud("Go grab the coin!");
  }

  placeCoin() {
    this.coin.setPosition(40 + Math.random() * 400, 40 + Math.random() * 280);
  }

  fixedUpdate(dt: number) {
    super.fixedUpdate(dt);
    const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
    const dy = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    this.player.velocity.set((dx / len) * SPEED, (dy / len) * SPEED);
  }
}

game.switchScene(new PlayScene());
game.start();
`,
  },

  {
    id: "collect",
    title: "Collect it & score",
    prose: `# Collect it & score

Now make it a *game*: detect when the player touches the coin and respond.

\`scene.overlap(a, b, callback)\` runs the callback for each overlapping pair. On
a hit we bump the **score**, respawn the coin, and update the on-screen text with
\`hud(...)\`.

That's a complete loop — move, collect, repeat. 🎉 Try tweaking the score, the
coin size, or the speed.`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

const input = new InputManager({
  up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
});
input.attach(window);

const SPEED = 200;

class PlayScene extends Scene {
  player!: Entity;
  coin!: Entity;
  score = 0;

  create() {
    this.camera.centerOn(240, 180); // frame the 480x360 play area (0,0 = top-left)
    this.player = new Entity(220, 200);
    this.player.width = 40;
    this.player.height = 40;
    this.add(this.player);

    this.coin = new Entity(0, 0);
    this.coin.width = 20;
    this.coin.height = 20;
    this.placeCoin();
    this.add(this.coin);

    hud("Score: 0");
  }

  placeCoin() {
    this.coin.setPosition(40 + Math.random() * 400, 40 + Math.random() * 280);
  }

  fixedUpdate(dt: number) {
    super.fixedUpdate(dt);
    const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
    const dy = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    this.player.velocity.set((dx / len) * SPEED, (dy / len) * SPEED);

    // Touch the coin → score and respawn it.
    this.overlap(this.player, this.coin, () => {
      this.score++;
      this.placeCoin();
      hud("Score: " + this.score);
    });
  }
}

game.switchScene(new PlayScene());
game.start();
`,
  },

  {
    id: "juice",
    title: "Add some juice",
    prose: `# Add some juice

Last step: a little polish. We swap the white boxes for **Sprites** so we can
**tint** them (no art needed — \`textureId = ""\` uses the built-in white texture,
which the tint colors). On a pickup we add a quick **screen shake**
(\`camera.shake\`) and flash the player, restoring its color after a moment with a
**timer** (\`addTimer\`).

Small touches like these are what make a game *feel* good. You've built a
complete little game — nice work! From here, check out the
[recipes](https://github.com/cjgammon/gamekit/blob/main/docs/recipes.md).`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

const input = new InputManager({
  up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
});
input.attach(window);

const SPEED = 220;
const PLAYER_COLOR = 0x66ccff;

class PlayScene extends Scene {
  player!: Sprite;
  coin!: Sprite;
  score = 0;

  create() {
    this.camera.centerOn(240, 180); // frame the 480x360 play area (0,0 = top-left)
    this.player = new Sprite();
    this.player.textureId = "";       // white texture, colored by tint
    this.player.width = 40;
    this.player.height = 40;
    this.player.tint = PLAYER_COLOR;
    this.add(this.player);
    this.player.setPosition(220, 200);

    this.coin = new Sprite();
    this.coin.textureId = "";
    this.coin.width = 20;
    this.coin.height = 20;
    this.coin.tint = 0xffcc44;          // gold
    this.placeCoin();
    this.add(this.coin);

    hud("Score: 0");
  }

  placeCoin() {
    this.coin.setPosition(40 + Math.random() * 400, 40 + Math.random() * 280);
  }

  fixedUpdate(dt: number) {
    super.fixedUpdate(dt);
    const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
    const dy = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    this.player.velocity.set((dx / len) * SPEED, (dy / len) * SPEED);

    this.overlap(this.player, this.coin, () => {
      this.score++;
      this.placeCoin();
      hud("Score: " + this.score);

      this.camera.shake(6, 0.2);          // a quick rumble
      this.player.tint = 0xffffff;        // flash white...
      this.addTimer(0.12, () => (this.player.tint = PLAYER_COLOR)); // ...then back
    });
  }
}

game.switchScene(new PlayScene());
game.start();
`,
  },
];
