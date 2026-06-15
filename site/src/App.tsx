import { useEffect, useState } from "preact/hooks";
import { PlayTrack } from "./PlayTrack";
import { LearnTrack } from "./LearnTrack";

type Track = "learn" | "play";

/** Read the track from the URL hash so links like `#learn` / `#play` deep-link. */
function trackFromHash(): Track {
  return location.hash.replace(/^#\/?/, "").toLowerCase() === "learn" ? "learn" : "play";
}

export function App() {
  const [track, setTrack] = useState<Track>(trackFromHash);

  // Keep the toggle and the URL hash in sync (both directions).
  useEffect(() => {
    const onHash = () => setTrack(trackFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function go(next: Track) {
    if (location.hash.replace(/^#\/?/, "").toLowerCase() !== next) {
      location.hash = next; // triggers hashchange → setTrack
    }
    setTrack(next);
  }

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand">🎮 gamekit</div>
        <div class="tagline">Make your first game!</div>

        <div class="trackswitch" role="tablist" aria-label="Tutorial style">
          <button
            class={`track-tab${track === "learn" ? " active" : ""}`}
            role="tab"
            aria-selected={track === "learn"}
            onClick={() => go("learn")}
          >
            ⌨️ Type it out
          </button>
          <button
            class={`track-tab${track === "play" ? " active" : ""}`}
            role="tab"
            aria-selected={track === "play"}
            onClick={() => go("play")}
          >
            🛠️ Play &amp; tweak
          </button>
        </div>

        <nav class="toplinks">
          <a href="https://github.com/cjgammon/gamekit" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      {track === "learn" ? <LearnTrack /> : <PlayTrack />}
    </div>
  );
}
