// Downloads the original Mode media into public/data/ for local use.
//
// These assets are © Adam Saltsman (Adam Atomic), from the original Mode source
// (https://github.com/AdamAtomic/Mode). They are NOT redistributed in this repo
// — this script fetches them from the canonical source on demand. Respect the
// original project's terms; this demo is for learning/showcase use.
import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://raw.githubusercontent.com/AdamAtomic/Mode/master/src/data/";
const OUT = new URL("../public/data/", import.meta.url);

const FILES = [
  // graphics
  "spaceman.png",
  "bot.png",
  "bullet.png",
  "bot_bullet.png",
  "spawner.png",
  "dirt.png",
  "dirt_top.png",
  "tech_tiles.png",
  "gibs.png",
  "spawner_gibs.png",
  // sounds
  "shoot.mp3",
  "enemy.mp3",
  "asplode.mp3",
  "hurt.mp3",
  "jump.mp3",
  "jam.mp3",
];

await mkdir(OUT, { recursive: true });

let ok = 0;
for (const file of FILES) {
  const res = await fetch(BASE + file);
  if (!res.ok) {
    console.error(`✗ ${file} — HTTP ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(new URL(file, OUT), buf);
  console.log(`✓ ${file} (${buf.length} bytes)`);
  ok++;
}

console.log(`\nFetched ${ok}/${FILES.length} assets into public/data/`);
if (ok < FILES.length) process.exitCode = 1;
