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

A program is just **instructions** for the computer, written one line at a time.
You'll type each piece, press **Check ✓**, and watch your game appear.

Here's your very first line — it builds the game itself. Let's name every part:

- **\`const game\`** — \`const\` makes a labeled box to keep something in, and we're
  calling this one \`game\`. From now on, "\`game\`" means *our game*.
- **\`=\`** — puts whatever is on the right **into** the box on the left.
- **\`await\`** — *"wait here until it's ready."* Building a game takes a moment, so
  we wait for it to finish before moving on.
- **\`createGame(...)\`** — a **function**: a ready-made machine that builds a game
  for us. Whatever we put inside the \`( )\` is what we hand to the machine.
- **\`canvas\`** — the rectangle on the page where the game gets drawn. (We've set
  it up for you — you just hand it over.)

That's all it needs! \`createGame\` picks smart **defaults** (it sizes itself to fit
the canvas), so you don't have to. Later you *could* hand it settings to customize.

Type it into the box below, then press **Check ✓**.`,
  },
  {
    id: "scene",
    label: "Make a scene",
    explain: `# A world to play in 🎬

Every game needs a **scene** — the little world it lives in. We build our own kind
of scene from a ready-made one called \`Scene\`, using a **class**.

- A **class** is a **blueprint** (like LEGO instructions). \`class PlayScene
  extends Scene\` means *"make a new blueprint named \`PlayScene\` that's a \`Scene\`,
  with our own extra stuff."* \`extends\` = *"start with everything a Scene already
  has."*
- Everything between the \`{ }\` belongs **inside** the blueprint.
- \`create()\` is a **function that runs once at the very start** — the perfect spot
  to set things up. (Its own \`{ }\` holds the setup steps.)
- \`this\` means *"this scene right here."* \`this.camera\` is the scene's **camera**
  (what you look through), and \`centerOn(240, 180)\` aims it at the spot **240
  across and 180 down** — the middle of our play area.`,
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

Time for a player! A **Sprite** is something you can see in the scene — a picture,
or just a colored box. We make one and set it up line by line:

- \`this.player = new Sprite()\` — \`new Sprite()\` **makes a brand-new sprite**, and
  \`this.player =\` stores it in a box on the scene named \`player\`, so our other
  functions can find it later.
- \`this.player.width = 40\` and \`.height = 40\` — its **size**, 40 steps each way.
- \`this.player.tint = 0x66ccff\` — its **color**. The \`0x...\` is just how we write
  a color in code; \`0x66ccff\` is sky blue.
- \`this.player.setPosition(220, 200)\` — where it starts: **220 across, 200 down**.
- \`this.add(this.player)\` — **drops it into the scene** so it actually shows up.

This all goes **inside \`create()\`**, right after the camera line. Run it to meet
your hero!`,
  },
  {
    id: "coin",
    label: "Add a coin",
    explain: `# Add some treasure 🪙

A game needs a **goal** — something to chase. Let's add a coin. It's another
\`Sprite\`, built with the **exact same recipe** as the hero: make it, size it,
color it, place it, then \`this.add\` it.

The only differences: it's a bit smaller (\`30\`), it's gold instead of blue
(\`0xffcc44\`), and it starts in a different spot. Put this **right after the
hero**, still inside \`create()\`.`,
  },
  {
    id: "score",
    label: "Keep score",
    explain: `# Keep score 🔢

Let's count the coins you grab.

- \`this.score = 0\` makes a box on the scene named \`score\` and starts it at **0**.
  (Like \`this.player\` and \`this.coin\`, the \`this.\` keeps it on the scene so every
  function can reach it.)
- \`hud("Score: 0")\` shows words on top of the screen. Anything inside \`" "\` quotes
  is **text** — exactly the letters that show up. (\`hud\` is a little helper we gave
  you for putting words on screen.)

These are the **last lines inside \`create()\`**.`,
  },
  {
    id: "keys",
    label: "Listen for keys",
    explain: `# Listen for the keyboard ⌨️

To move, the game has to **listen** for key presses. \`new InputManager({ ... })\`
makes a listener, and the \`{ }\` tells it which keys to watch:

- \`up\`, \`down\`, \`left\`, \`right\` are **names we pick** for the four directions.
- The \`[ ]\` square brackets hold a **list**. \`up: ["KeyW", "ArrowUp"]\` means
  *"either the W key **or** the up-arrow counts as up."* That's why WASD **and**
  the arrow keys both work.
- \`const input =\` keeps the listener in a box named \`input\`.
- \`input.attach(window)\` switches it on. \`window\` is the **whole page**, so now
  it's listening to your keyboard.

This is its own block, **above the class**. Nothing looks different yet — but the
game is now listening.`,
  },
  {
    id: "move",
    label: "Move the hero",
    explain: `# Make it move 🏃

Moving needs code that runs **every frame**, not just once. So we add a second
function to our scene: \`fixedUpdate(dt)\`. The game loop calls it ~60 times a
second, and \`dt\` is how much time has passed since last time.
\`super.fixedUpdate(dt)\` lets the normal scene work happen too.

- \`input.isDown("right")\` asks *"is the right key held down?"* — the answer is
  \`true\` or \`false\`.
- \`... ? 1 : 0\` is a tiny question: *"if yes use 1, if no use 0."* So **right
  minus left** gives \`-1\`, \`0\`, or \`1\` — that's our sideways direction \`dx\`
  (and \`dy\` is up/down the same way).
- \`this.player.velocity.set(dx * 220, dy * 220)\` sets the hero's **speed**.
  \`220\` is how fast — bigger = faster!

Add this **inside the class, just after \`create()\`**. Run it and use WASD or the
arrow keys!`,
  },
  {
    id: "grab",
    label: "Grab the coin",
    explain: `# Grab the coin! 🎯

Now make grabbing work. \`this.overlap(...)\` checks **every frame** whether two
things are **touching**.

- The first two parts, \`this.player\` and \`this.coin\`, are the two things to check.
- \`() => { ... }\` is a **little list of instructions to run** *only when they
  touch* (it's a function too — this one just has no name).

When they touch:
- \`this.score++\` — \`++\` means **add 1**, so the score goes up.
- \`this.coin.setPosition(40 + Math.random() * 400, ...)\` — \`Math.random()\` gives a
  surprise number between 0 and 1, so \`Math.random() * 400\` is somewhere 0–400.
  Adding \`40\` keeps it on screen, so the coin **jumps to a new random spot**.
- \`hud("Score: " + this.score)\` — here the \`+\` **glues** the word \`"Score: "\` onto
  the number, showing things like \`Score: 3\`.

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
  { m: 0, text: `const game = await createGame(canvas);` },
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
