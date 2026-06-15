import { useEffect, useMemo, useState } from "preact/hooks";
import { marked } from "marked";
import { CodeEditor } from "./components/CodeEditor";
import { Preview } from "./components/Preview";
import { tsToJs } from "./runner/transpile";
import {
  pieces,
  pieceAdd,
  programThrough,
  matchesPiece,
  RUNNABLE_FROM,
} from "./tutorial/codealong";

const IDX_KEY = "gamekit-learn-idx";

/**
 * The "Type it out" track: build the whole game from nothing, one small piece at
 * a time. For each piece the learner reads an explanation, types the new code
 * themselves, and presses Check (a forgiving comparison). Accepted pieces grow a
 * read-only "program so far" that the preview runs at every runnable milestone.
 */
export function LearnTrack() {
  // `idx` = the piece they're currently typing (0..pieces.length). At
  // pieces.length the whole game is finished.
  const [idx, setIdx] = useState(() => {
    const n = Number(localStorage.getItem(IDX_KEY));
    return Number.isFinite(n) && n >= 0 && n <= pieces.length ? n : 0;
  });
  const [typed, setTyped] = useState("");
  const [wrong, setWrong] = useState(false);
  const [peek, setPeek] = useState(false);

  const [runKey, setRunKey] = useState(0);
  const [js, setJs] = useState("");

  const done = idx >= pieces.length;
  const piece = done ? null : pieces[idx];
  const built = idx - 1; // highest milestone already accepted
  const programSoFar = built >= 0 ? programThrough(built) : "";
  const lineCount = programSoFar ? programSoFar.split("\n").length : 0;
  const explainHtml = useMemo(
    () => (piece ? (marked.parse(piece.explain) as string) : ""),
    [idx],
  );

  useEffect(() => {
    localStorage.setItem(IDX_KEY, String(idx));
  }, [idx]);

  // Run the latest finished program whenever the build advances.
  useEffect(() => {
    const m = done ? pieces.length - 1 : built;
    if (m >= RUNNABLE_FROM) {
      try {
        setJs(tsToJs(programThrough(m)));
        setRunKey((k) => k + 1);
      } catch {
        /* assembled program is always valid; ignore */
      }
    } else {
      setJs("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Reset the typing box when the piece changes.
  useEffect(() => {
    setTyped("");
    setWrong(false);
    setPeek(false);
  }, [idx]);

  function check() {
    if (piece && matchesPiece(typed, idx)) {
      setIdx((i) => i + 1);
    } else {
      setWrong(true);
    }
  }
  function fillIn() {
    setTyped(pieceAdd(idx));
    setWrong(false);
  }
  function back() {
    setIdx((i) => Math.max(0, i - 1));
  }
  function restart() {
    setIdx(0);
  }

  const runnableNow = built >= RUNNABLE_FROM || done;

  return (
    <div class="body">
      <aside class="sidebar">
        <h2>Type it out</h2>
        <ol class="steplist">
          {pieces.map((p, i) => (
            <li key={p.id}>
              <button
                class={`step${i === idx ? " active" : ""}${i < idx ? " done" : ""}`}
                onClick={() => setIdx(i)}
              >
                <span class="num">{i < idx ? "✓" : i + 1}</span>
                {p.label}
              </button>
            </li>
          ))}
        </ol>
        <p class="sidebar-foot">{Math.min(idx, pieces.length)} / {pieces.length} typed</p>
      </aside>

      <main class="main">
        {done ? (
          <article class="prose">
            <h1>You built a game! 🏆</h1>
            <p>
              You typed <strong>every single line</strong> — a real game with a hero,
              a coin to chase, a score, and a little screen shake. That's exactly how
              games get made: one small piece at a time.
            </p>
            <p>Play it below with WASD or the arrow keys. 🎮</p>
          </article>
        ) : (
          <article class="prose" dangerouslySetInnerHTML={{ __html: explainHtml }} />
        )}

        {!done && (
          <div class="workbench">
            <section class="editor-pane">
              <div class="pane-bar">
                <span>Type this piece</span>
                <span class="spacer" />
                <button class="btn" onClick={() => setPeek((p) => !p)}>
                  {peek ? "Hide 👀" : "Peek 👀"}
                </button>
                <button class="btn" onClick={fillIn}>Fill it in</button>
                <button class="btn primary" onClick={check}>Check ✓</button>
              </div>
              <CodeEditor value={typed} onChange={(v) => { setTyped(v); setWrong(false); }} />
              {wrong && (
                <p class="learn-hint">
                  Not quite — check the spelling and symbols, or tap <em>Peek 👀</em> to
                  see it. You can always <em>Fill it in</em>.
                </p>
              )}
              {peek && <pre class="learn-answer">{pieceAdd(idx)}</pre>}
            </section>

            <section class="preview-pane">
              <div class="pane-bar">
                <span>Your game</span>
              </div>
              {runnableNow ? (
                <Preview js={js} runKey={runKey} />
              ) : (
                <div class="preview learn-waiting">
                  <p>⌨️ Keep typing — your game starts running once you press play!</p>
                </div>
              )}
            </section>
          </div>
        )}

        {done && (
          <div class="workbench">
            <section class="editor-pane">
              <div class="pane-bar"><span>Your whole program</span></div>
              <pre class="learn-final">{programThrough(pieces.length - 1)}</pre>
            </section>
            <section class="preview-pane">
              <div class="pane-bar"><span>Your game</span></div>
              <Preview js={js} runKey={runKey} />
            </section>
          </div>
        )}

        {programSoFar && !done && (
          <details class="program-so-far" open>
            <summary>📜 Your program so far — {lineCount} {lineCount === 1 ? "line" : "lines"}</summary>
            <pre>{programSoFar}</pre>
          </details>
        )}

        <nav class="stepnav">
          <button class="btn" disabled={idx === 0} onClick={back}>← Back</button>
          <span class="progress">
            {done ? "Done!" : `${idx + 1} / ${pieces.length}`}
          </span>
          {done ? (
            <button class="btn" onClick={restart}>Start over</button>
          ) : (
            <button class="btn primary" onClick={check}>Check ✓</button>
          )}
        </nav>
      </main>
    </div>
  );
}
