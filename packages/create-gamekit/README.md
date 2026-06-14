# create-gamekit

Scaffold a new [gamekit](https://github.com/cjgammon/gamekit) game in one command.

```bash
npm create gamekit@latest my-game
# or: npm create gamekit@latest   (it will ask for a directory)
```

You'll be asked for a project directory and a template:

- **Single-player** — a WebGPU sprite you move with WASD/arrow keys. Runs with
  no art or setup.
- **Multiplayer** — an authoritative server + client-side prediction; open two
  tabs to see two players.

Then:

```bash
cd my-game
npm install
npm run dev        # opens http://localhost:5173 in your browser
```

Requires **Node 18+** and a **WebGPU-capable browser** (Chrome, Edge, or
Safari 18+) for the single-player template. The multiplayer template draws to a
2D canvas, so it runs anywhere.

The initializer itself has **zero dependencies** — it's plain Node.
