// The "Type It Out" track: build the whole game one small piece at a time,
// explaining every word (const, function, class, new, …) for someone who has
// never coded before. The user types each piece themselves and checks it.
//
// HOW THE PROGRAM IS ASSEMBLED
// The finished program is stored as an ordered list of SEGMENTS, each tagged
// with the milestone (piece index) at which it appears. Closing braces are
// tagged with their *opening* milestone, and later additions sit physically
// inside the block they belong to — so the program "through milestone m"
// (every segment with `m <= current`) is always syntactically complete and
// runnable. That lets the preview run at every step while staying append-only
// from the learner's point of view.

export interface Piece {
  id: string;
  /** Short label for the progress rail. */
  label: string;
  /** Kid-friendly markdown explaining the concept + this piece. */
  explain: string;
}

interface Seg {
  /** Milestone (piece index) this segment belongs to. */
  m: number;
  /** Source text; leading "\n"s control blank lines in the assembled program. */
  text: string;
}

export const pieces: Piece[] = [
  {
    id: "game",
    label: "Make the game",
    explain: `# Let's make a game! 🎮

A program is just **instructions** you write for the computer. We'll write ours
one line at a time — type each piece, press **Check ✓**, and watch your game grow.

Here's the very first line:

- \`const game\` means **"remember this and call it \`game\`."** \`const\` makes a
  named box to keep something in.
- \`createGame(...)\` is a **function** — a ready-made machine. You hand it the
  \`canvas\` (the screen) and some settings, and it gives you back a game.
- \`await\` means **"wait for it to be ready"** before moving on.

Type it exactly as shown, then press **Check ✓**.`,
  },
  {
    id: "scene",
    label: "Make a scene",
    explain: `# A world to play in 🎬

Every game needs a **scene** — the little world it lives in. We make our own kind
of scene using a **class**.

Think of a **class** as a **blueprint** (like LEGO instructions).
\`class PlayScene extends Scene\` means *"make a new blueprint called PlayScene
that's a Scene, with our own extra stuff."*

Inside, \`create()\` is a **function that runs once at the start** — perfect for
setting things up. \`this\` means *"this scene,"* and
\`this.camera.centerOn(240, 180)\` aims the camera at the middle of our play area.

The curly braces \`{ }\` hold everything that belongs inside.`,
  },
  {
    id: "play",
    label: "Press play",
    explain: `# Press play ▶

We drew the blueprint — now let's actually **use** it.

- \`new PlayScene()\` builds one real scene from the blueprint. \`new\` means
  *"make me one of these."*
- \`game.switchScene(...)\` puts that scene on the screen.
- \`game.start()\` starts the **game loop** — the heartbeat that runs your game
  about 60 times every second.

Type it, Check, then press **Run ▶**. You'll see an empty game… it works! Empty,
but real. We'll fill it up next.`,
  },
  {
    id: "hero",
    label: "Add a hero",
    explain: `# Add a hero 🦸

Time for a player! A **Sprite** is a picture (or a colored box) you can put in
the scene.

We make one, give it a **size** (\`width\` / \`height\`), a **color**
(\`tint\` — \`0x66ccff\` is sky blue), and a **spot** (\`setPosition(x, y)\`).
Then \`this.add(...)\` drops it into the scene.

This all goes **inside \`create()\`**, right after the camera line — so it happens
the moment the game starts. Run it to meet your hero!`,
  },
  {
    id: "coin",
    label: "Add a coin",
    explain: `# Add some treasure 🪙

A game needs a **goal**. Let's add a coin — another Sprite, gold this time
(\`0xffcc44\`). Same recipe as the hero: make it, size it, color it, place it,
add it.

Put this **right after the hero**, still inside \`create()\`.`,
  },
  {
    id: "score",
    label: "Keep score",
    explain: `# Keep score 🔢

Let's count the coins you grab. \`this.score = 0\` makes a number that belongs to
the scene, starting at zero.

\`hud("Score: 0")\` writes text on top of the screen. (\`hud\` is a little helper
we gave you for showing words.)

These are the **last lines inside \`create()\`**.`,
  },
  {
    id: "keys",
    label: "Listen for keys",
    explain: `# Listen for the keyboard ⌨️

To move, the game has to **listen** for key presses. \`InputManager\` does that.
We give it names — \`up\`, \`down\`, \`left\`, \`right\` — and which keys count for
each. We list **both** WASD **and** the arrow keys, so either works.

\`input.attach(window)\` switches the listening on.

This is its own block, **above the class** (at the top level). Nothing looks
different yet — but the game is now listening.`,
  },
  {
    id: "move",
    label: "Move the hero",
    explain: `# Make it move 🏃

Moving needs code that runs **every frame**, not just once. So we add a second
function to our scene: \`fixedUpdate(dt)\`. The game loop calls it ~60 times a
second. \`super.fixedUpdate(dt)\` lets the normal scene work happen too.

We check which keys are held to get a direction (\`dx\`, \`dy\`), then
\`velocity.set(...)\` tells the hero how fast to go. Bigger number = faster!

Add this **inside the class, just after \`create()\`**. Run it and use WASD or the
arrow keys!`,
  },
  {
    id: "grab",
    label: "Grab the coin",
    explain: `# Grab the coin! 🎯

Now make grabbing work. \`this.overlap(a, b, () => { ... })\` checks every frame
whether the hero is **touching** the coin — and runs the code in \`{ ... }\` when
they do.

When they touch: add \`1\` to the score, **move the coin** to a new random spot,
and update the text. \`Math.random()\` gives a surprise number each time.

This goes **inside \`fixedUpdate\`**, after the movement lines.`,
  },
  {
    id: "juice",
    label: "Add juice",
    explain: `# Add some juice ✨

Great games *feel* good. \`this.camera.shake(6, 0.2)\` gives a quick rumble when
you score — 6 pixels of shake for 0.2 seconds.

Add it **inside the overlap's \`{ }\`**. Run it, grab a coin, and feel the
difference. 🎉

That's a whole game — **and you wrote every single line!**`,
  },
];

/** Milestone at/after which the assembled program is a complete, runnable game. */
export const RUNNABLE_FROM = 2;

// The finished program, in physical order. Tags: 0 game · 1 scene/class ·
// 2 switchScene+start · 3 hero · 4 coin · 5 score · 6 input · 7 fixedUpdate ·
// 8 overlap · 9 shake. Closing braces carry their opening milestone's tag.
const SEGMENTS: Seg[] = [
  { m: 0, text: `const game = await createGame(canvas, { fov: 480, autoResize: true });` },
  {
    m: 6,
    text: `\n\nconst input = new InputManager({\n  up: ["KeyW", "ArrowUp"],\n  down: ["KeyS", "ArrowDown"],\n  left: ["KeyA", "ArrowLeft"],\n  right: ["KeyD", "ArrowRight"],\n});\ninput.attach(window);`,
  },
  {
    m: 1,
    text: `\n\nclass PlayScene extends Scene {\n  create() {\n    this.camera.centerOn(240, 180);`,
  },
  {
    m: 3,
    text: `\n\n    this.player = new Sprite();\n    this.player.width = 40;\n    this.player.height = 40;\n    this.player.tint = 0x66ccff;\n    this.player.setPosition(220, 200);\n    this.add(this.player);`,
  },
  {
    m: 4,
    text: `\n\n    this.coin = new Sprite();\n    this.coin.width = 30;\n    this.coin.height = 30;\n    this.coin.tint = 0xffcc44;\n    this.coin.setPosition(360, 120);\n    this.add(this.coin);`,
  },
  { m: 5, text: `\n\n    this.score = 0;\n    hud("Score: 0");` },
  { m: 1, text: `\n  }` }, // close create()
  {
    m: 7,
    text: `\n\n  fixedUpdate(dt: number) {\n    super.fixedUpdate(dt);\n    const dx = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);\n    const dy = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);\n    this.player.velocity.set(dx * 220, dy * 220);`,
  },
  {
    m: 8,
    text: `\n\n    this.overlap(this.player, this.coin, () => {\n      this.score++;\n      this.coin.setPosition(40 + Math.random() * 400, 40 + Math.random() * 280);\n      hud("Score: " + this.score);`,
  },
  { m: 9, text: `\n      this.camera.shake(6, 0.2);` },
  { m: 8, text: `\n    });` }, // close overlap callback
  { m: 7, text: `\n  }` }, // close fixedUpdate()
  { m: 1, text: `\n}` }, // close class
  { m: 2, text: `\n\ngame.switchScene(new PlayScene());\ngame.start();` },
];

/** The full program with every segment whose milestone is `<= m`. Runnable. */
export function programThrough(m: number): string {
  return SEGMENTS.filter((s) => s.m <= m)
    .map((s) => s.text)
    .join("")
    .replace(/^\n+/, "");
}

/** Strip a shared leading indent so a snippet reads cleanly on its own. */
function dedent(lines: string[]): string {
  const indents = lines
    .filter((l) => l.trim().length > 0)
    .map((l) => l.match(/^ */)![0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min)).join("\n");
}

/** Just the new code the learner types for milestone `m` (clean & dedented). */
export function pieceAdd(m: number): string {
  const raw = SEGMENTS.filter((s) => s.m === m)
    .map((s) => s.text)
    .join("");
  const lines = raw.split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return dedent(lines);
}

/**
 * Forgiving comparison: ignores comments, indentation, spacing around
 * punctuation, quote style, and optional semicolons — so a 10-year-old only has
 * to get the actual words right.
 */
export function matchesPiece(typed: string, m: number): boolean {
  const norm = (s: string) =>
    s
      .replace(/\/\/.*$/gm, "") // line comments
      .replace(/['`]/g, '"') // unify quote style
      .replace(/\s+/g, " ") // collapse whitespace
      .replace(/\s*([(){}\[\],;:=<>+\-*/?.])\s*/g, "$1") // drop spaces around punctuation
      .replace(/:(number|string|boolean|any|void)\b/g, "") // type annotations optional
      .replace(/;/g, "") // semicolons optional
      .replace(/,(?=[}\])])/g, "") // trailing commas optional
      .trim();
  return norm(typed) === norm(pieceAdd(m));
}
