import { useEffect, useState } from "preact/hooks";
import { Preview } from "./components/Preview";
import { tsToJs } from "./runner/transpile";
import { liveDemoSrc } from "./demo/liveDemo";

const GET_STARTED_URL = `${import.meta.env.BASE_URL}get-started.html`;
const GITHUB_URL = "https://github.com/cjgammon/gamekit";

const FEATURES = [
  { icon: "🚀", title: "No setup", body: "One command. No art, no assets required to start." },
  { icon: "📦", title: "Zero dependencies", body: "Nothing else to install. It's just gamekit." },
  { icon: "🎮", title: "Simple API", body: "Scenes, sprites, and entities — a few ideas to learn." },
  { icon: "🌐", title: "Multiplayer, when you're ready", body: "Turn a single-player game into a networked one." },
];

const CREATE_CMD = `npm create gamekit@latest my-game
cd my-game && npm install && npm run dev`;

const SNIPPET = `const game = await createGame(canvas);

class PlayScene extends Scene {
  create() {
    const hero = new Sprite();
    hero.setPosition(240, 180);
    this.add(hero);
  }
}

game.switchScene(new PlayScene());
game.start();`;

export function Landing() {
  const [js, setJs] = useState("");
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    setJs(tsToJs(liveDemoSrc));
    setRunKey(1);
  }, []);

  return (
    <div class="landing">
      <header class="topbar">
        <a class="brand" href="./">🎮 gamekit</a>
        <nav class="toplinks">
          <a href={GET_STARTED_URL}>Get Started</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <section class="hero">
        <div class="hero-copy">
          <h1>Make a 2D game. In your browser. Today.</h1>
          <p class="hero-sub">
            gamekit is a beginner-friendly game engine for the web. No install to try it,
            no dependencies to fight — just code and play.
          </p>
          <div class="hero-cta">
            <a class="btn primary btn-lg" href={GET_STARTED_URL}>
              Get Started →
            </a>
            <a class="btn btn-lg" href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
          <p class="hero-hint">👉 Click the game, then use WASD or arrow keys to grab the coins.</p>
        </div>

        <div class="hero-demo">
          <div class="hero-demo-frame">
            <Preview js={js} runKey={runKey} />
          </div>
        </div>
      </section>

      <section class="quickstart">
        <h2>Start in one command</h2>
        <div class="quickstart-grid">
          <div class="code-block">
            <div class="code-block-bar">Terminal</div>
            <pre>{CREATE_CMD}</pre>
          </div>
          <div class="code-block">
            <div class="code-block-bar">Your first scene</div>
            <pre>{SNIPPET}</pre>
          </div>
        </div>
      </section>

      <section class="features">
        <div class="feature-grid">
          {FEATURES.map((f) => (
            <div class="feature-card" key={f.title}>
              <div class="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="cta-band">
        <h2>Never made a game before? Perfect.</h2>
        <p>The interactive tutorial teaches you as you build — right in your browser.</p>
        <a class="btn primary btn-lg" href={GET_STARTED_URL}>
          Start the tutorial →
        </a>
      </section>

      <footer class="landing-footer">
        <span>gamekit</span>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
        <a href={GET_STARTED_URL}>Get Started</a>
      </footer>
    </div>
  );
}
