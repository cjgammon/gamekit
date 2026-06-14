#!/usr/bin/env node
// create-gamekit — scaffold a new gamekit game.
//
// Usage:  npm create gamekit@latest [my-game]
//
// Zero runtime dependencies (Node built-ins only), matching gamekit's ethos.
// Copies one of the bundled templates into a new directory, substituting the
// project name and renaming `_gitignore` → `.gitignore`.

import { existsSync, readdirSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, exit } from "node:process";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(HERE, "templates");

const VARIANTS = [
  { key: "single-player", label: "Single-player (WebGPU sprite + input)" },
  { key: "multiplayer", label: "Multiplayer (authoritative server + prediction)" },
];

// ---- tiny ANSI helpers (no dependency) ----
const c = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

/** Parse `--template <name>` / `-t <name>` (and `--template=<name>`). */
function parseTemplateFlag(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--template" || a === "-t") return args[i + 1];
    if (a.startsWith("--template=")) return a.slice("--template=".length);
  }
  return undefined;
}

async function main() {
  console.log(c.bold(`\n  🎮 create-gamekit\n`));

  const rest = argv.slice(2);
  const argDir = rest[0] && !rest[0].startsWith("-") ? rest[0] : undefined;
  const flagVariant = parseTemplateFlag(rest);
  if (flagVariant && !VARIANTS.some((v) => v.key === flagVariant)) {
    console.error(
      `\n  ✗ Unknown template "${flagVariant}". Options: ${VARIANTS.map((v) => v.key).join(", ")}.\n`,
    );
    exit(1);
  }
  const interactive = stdin.isTTY && stdout.isTTY;

  let dir = argDir;
  let variant = flagVariant ?? VARIANTS[0].key;

  if (interactive) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      if (!dir) {
        const answer = await rl.question(`  Project directory ${c.dim("(my-gamekit-game)")}: `);
        dir = answer.trim() || "my-gamekit-game";
      }
      if (!flagVariant) {
        console.log(`\n  Template:`);
        VARIANTS.forEach((v, i) => console.log(`    ${c.cyan(String(i + 1))}  ${v.label}`));
        const pick = (await rl.question(`  Choose ${c.dim("(1)")}: `)).trim();
        variant = VARIANTS[Number(pick) - 1]?.key ?? VARIANTS[0].key;
      }
    } finally {
      rl.close();
    }
  } else {
    dir = dir ?? "my-gamekit-game";
    console.log(c.dim(`  Non-interactive — using "${dir}" / ${variant}.`));
  }

  const target = resolve(process.cwd(), dir);
  const name = basename(target);

  if (existsSync(target) && readdirSync(target).length > 0) {
    console.error(`\n  ✗ Directory ${c.bold(dir)} already exists and is not empty.\n`);
    exit(1);
  }

  const src = join(TEMPLATES, variant);
  if (!existsSync(src)) {
    console.error(`\n  ✗ Unknown template "${variant}".\n`);
    exit(1);
  }

  copyTemplate(src, target, { name });

  console.log(`\n  ${c.green("✓")} Created ${c.bold(name)} ${c.dim(`(${variant})`)}\n`);
  console.log(`  Next steps:\n`);
  console.log(`    ${c.cyan(`cd ${dir}`)}`);
  console.log(`    ${c.cyan(`npm install`)}`);
  console.log(`    ${c.cyan(`npm run dev`)}   ${c.dim("# open the printed http://localhost URL in a WebGPU browser")}\n`);
  if (variant === "multiplayer") {
    console.log(c.dim(`  (npm run dev starts both the game server and the client.)\n`));
  }
}

/** Recursively copy `src` → `dest`, substituting {{name}} and renaming
 *  `_gitignore` → `.gitignore`. */
function copyTemplate(src, dest, vars) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const from = join(src, entry);
    const renamed = entry === "_gitignore" ? ".gitignore" : entry;
    const to = join(dest, renamed);
    if (statSync(from).isDirectory()) {
      copyTemplate(from, to, vars);
    } else {
      const raw = readFileSync(from, "utf8");
      writeFileSync(to, raw.replaceAll("{{name}}", vars.name));
    }
  }
}

main().catch((err) => {
  console.error(`\n  ✗ ${err?.message ?? err}\n`);
  exit(1);
});
