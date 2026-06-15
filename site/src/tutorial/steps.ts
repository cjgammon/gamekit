export interface GoalContext {
  /** The code of the **last run** (so missions complete on Run, not while typing). */
  code: string;
  /** This step's original starter code (to detect edits). */
  starter: string;
  /** True once the code has run without errors. */
  ranOk: boolean;
  /** Every line of text the game has shown via hud(...). */
  huds: string[];
}

export interface Goal {
  /** The playful "thing to do" shown in the mission bar. */
  hint: string;
  /** Celebration line when it's done. */
  cheer: string;
  /** Returns true once the mission is complete. */
  done: (ctx: GoalContext) => boolean;
}

export interface Step {
  id: string;
  title: string;
  /** Markdown prose shown above the editor. */
  prose: string;
  /** Starter code (TypeScript). Import-free — the preview injects the API
   *  (`createGame`, `Scene`, `Entity`, `InputManager`, `hud`, `canvas`, …). */
  starter: string;
  goal: Goal;
}

/** Highest number assigned to `<thing>.<prop>` in the code (for size missions). */
function maxAssigned(code: string, prop: string, thing = ""): number {
  const re = new RegExp(`${thing}\\.?${prop}\\s*=\\s*(\\d+)`, "g");
  let best = 0;
  for (const m of code.matchAll(re)) best = Math.max(best, Number(m[1]));
  return best;
}

/** True when both width and height are set to at least `min` (on `<thing>`). */
function bigEnough(code: string, min: number, thing = ""): boolean {
  return (
    maxAssigned(code, "width", thing) >= min &&
    maxAssigned(code, "height", thing) >= min
  );
}

export const steps: Step[] = [
  {
    id: "hello",
    title: "Hello, game!",
    prose: `# Hey there, game maker! 👋

You're about to build a **real game** — right here, right now. No installing, no
waiting. 🚀

- The dark box on the right is **your game**.
- The code on the left is the **magic spell** that makes it go. ✨

Two big ideas: a **Game** is your little world (it redraws super fast, over and
over), and a **Scene** is what's *inside* it — you fill it up in \`create()\`.

Press **Run ▶** to start it. Then find the \`hud("...")\` line — that's the text on
the screen — and change it to **your game's name**!`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

class PlayScene extends Scene {
  create() {
    this.camera.centerOn(240, 180); // aim the camera at our play area

    // 👇 Change these words to your game's name, then press Run!
    hud("⭐ press Run!");
  }
}

game.switchScene(new PlayScene());
game.start();
`,
    goal: {
      hint: "Change the words in hud(...) to your game's name, then press Run ▶",
      cheer: "Your game has a name! 🎉",
      // Checked against what the game actually showed — so it only counts after
      // they Run, and the name must be non-empty and changed from the default.
      done: (c) =>
        c.huds.some((h) => {
          const name = h.trim();
          return name.length > 0 && name !== "⭐ press Run!";
        }),
    },
  },

  {
    id: "hero",
    title: "Your hero",
    prose: `# Meet your hero 🦸

Right now your world is empty — boring! Let's add a **hero**.

An **Entity** is a *thing* in your game: it has a spot (\`x\`, \`y\`) and a size.
Give it a size and… ta-da! A white square hero appears — **no drawing needed**. 🎨

Heroes should be big and bold. **Make yours 80 wide and 80 tall!**`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

class PlayScene extends Scene {
  create() {
    this.camera.centerOn(240, 180);

    const player = new Entity(220, 200); // where it starts: x, y
    player.width = 40;  // 👈 make me bigger!
    player.height = 40;
    this.add(player);
  }
}

game.switchScene(new PlayScene());
game.start();
`,
    goal: {
      hint: "Make your hero BIG — set width and height to 80",
      cheer: "Mighty hero! 💪",
      done: (c) => bigEnough(c.code, 60),
    },
  },

  {
    id: "move",
    title: "Make it move",
    prose: `# Make it MOVE 🕹️

A hero that can't move is no fun. Let's wire up the keys!

An **InputManager** listens for key presses. Each tick we check "is left held?"
and push the hero that way by setting its **velocity** (how fast it zooms). The
engine does the moving for you.

👉 First **click the game**, then mash the **arrow keys** or **WASD**. Zoooom!`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

const input = new InputManager({
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
});
input.attach(window);

const SPEED = 200; // try making this bigger for a speedy hero!

class PlayScene extends Scene {
  player!: Entity;

  create() {
    this.camera.centerOn(240, 180);
    this.player = new Entity(220, 200);
    this.player.width = 40;
    this.player.height = 40;
    this.add(this.player);
    hud("Click here, then press the arrow keys!");
  }

  fixedUpdate(dt: number) {
    super.fixedUpdate(dt);
    const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
    const dy = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    this.player.velocity.set((dx / len) * SPEED, (dy / len) * SPEED);

    if (dx || dy) hud("Zoom zoom! 🏎️");
  }
}

game.switchScene(new PlayScene());
game.start();
`,
    goal: {
      hint: "Click the game, then zoom around with the arrow keys!",
      cheer: "VROOM! You can move! 🏎️",
      done: (c) => c.huds.some((h) => h.includes("Zoom")),
    },
  },

  {
    id: "coin",
    title: "Add treasure",
    prose: `# Add some treasure 🪙

Every hero needs something to chase. Let's drop a shiny **coin** into the world
at a random spot.

We make another entity for the coin and use \`setPosition\` to plop it somewhere.

That coin looks tiny — **make it bigger (size 30)** so it's easy to grab!`,
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
    this.camera.centerOn(240, 180);

    this.player = new Entity(220, 200);
    this.player.width = 40;
    this.player.height = 40;
    this.add(this.player);

    this.coin = new Entity(0, 0);
    this.coin.width = 20;  // 👈 make the coin bigger!
    this.coin.height = 20;
    this.placeCoin();
    this.add(this.coin);

    hud("Go find the coin!");
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
    goal: {
      hint: "Make the coin bigger — set the coin's size to 30",
      cheer: "Shiny and easy to grab! ✨",
      done: (c) => bigEnough(c.code, 30, "coin"),
    },
  },

  {
    id: "collect",
    title: "Grab the coins!",
    prose: `# Grab the coins! 🏆

Now it's a real **game**. When your hero touches the coin, we'll add a point and
pop a fresh coin somewhere new.

\`overlap(a, b, …)\` is how we ask *"are these two touching?"* — and run code when
they are.

Your mission: **collect 3 coins!** Click the game, then go go go! 🏃💨`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

const input = new InputManager({
  up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
});
input.attach(window);

const SPEED = 220;

class PlayScene extends Scene {
  player!: Entity;
  coin!: Entity;
  score = 0;

  create() {
    this.camera.centerOn(240, 180);

    this.player = new Entity(220, 200);
    this.player.width = 40;
    this.player.height = 40;
    this.add(this.player);

    this.coin = new Entity(0, 0);
    this.coin.width = 30;
    this.coin.height = 30;
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

    // Touching the coin? Score and move it!
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
    goal: {
      hint: "Collect 3 coins! 🪙🪙🪙",
      cheer: "Three coins — you're a champion! 🏆",
      done: (c) =>
        c.huds.some((h) => {
          const m = h.match(/Score:\s*(\d+)/);
          return !!m && Number(m[1]) >= 3;
        }),
    },
  },

  {
    id: "juice",
    title: "Make it yours",
    prose: `# Make it YOURS 🎨

You built a game! 🎉 Now add some **juice** — the little touches that make games
feel *awesome*.

We turn the boxes into **Sprites** so we can **color** them, **shake** the screen
when you score, and **flash** the hero.

Pick your hero's color! Change \`PLAYER_COLOR\` to anything you like — try
\`0xff3366\` (pink) or \`0x00ff88\` (green) — then grab a coin to see the sparkle. ✨`,
    starter: `const game = await createGame(canvas, { fov: 480, autoResize: true });

const input = new InputManager({
  up: ["KeyW", "ArrowUp"], down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"], right: ["KeyD", "ArrowRight"],
});
input.attach(window);

const SPEED = 220;
const PLAYER_COLOR = 0x66ccff; // 👈 pick your own color!

class PlayScene extends Scene {
  player!: Sprite;
  coin!: Sprite;
  score = 0;

  create() {
    this.camera.centerOn(240, 180);

    this.player = new Sprite();
    this.player.textureId = "";   // white texture, painted by the tint
    this.player.width = 40;
    this.player.height = 40;
    this.player.tint = PLAYER_COLOR;
    this.add(this.player);
    this.player.setPosition(220, 200);

    this.coin = new Sprite();
    this.coin.textureId = "";
    this.coin.width = 30;
    this.coin.height = 30;
    this.coin.tint = 0xffcc44;     // gold
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

      this.camera.shake(6, 0.2);                 // a little rumble!
      this.player.tint = 0xffffff;               // flash white...
      this.addTimer(0.12, () => (this.player.tint = PLAYER_COLOR)); // ...then back
    });
  }
}

game.switchScene(new PlayScene());
game.start();
`,
    goal: {
      hint: "Give your hero a new color — change PLAYER_COLOR",
      cheer: "Your game, your colors! You're a game maker now! 🎨",
      done: (c) => {
        const m = c.code.match(/PLAYER_COLOR\s*=\s*(0x[0-9a-fA-F]+)/);
        return !!m && m[1].toLowerCase() !== "0x66ccff";
      },
    },
  },
];
