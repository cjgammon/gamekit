import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { marked } from "marked";
import { CodeEditor } from "./components/CodeEditor";
import { Preview } from "./components/Preview";
import { SidebarToggle, useSidebarCollapsed } from "./components/SidebarToggle";
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
  // The two collapsible panels below the editor (controlled so they stay where
  // the user puts them; "Type this" reopens for each new piece).
  const [targetOpen, setTargetOpen] = useState(true);
  const [programOpen, setProgramOpen] = useState(true);

  const [runKey, setRunKey] = useState(0);
  const [js, setJs] = useState("");

  // Finished state: an editable copy of the whole program + its transpile error.
  const [finalCode, setFinalCode] = useState("");
  const [finalErr, setFinalErr] = useState<string | null>(null);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Run the latest milestone while building. The finished state is driven by the
  // editable final program instead (see the effect below), so skip it here.
  useEffect(() => {
    if (done) return;
    if (built >= RUNNABLE_FROM) {
      try {
        setJs(tsToJs(programThrough(built)));
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
    setTargetOpen(true);
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

  // ---- Finished state: edit the whole program and see it live ----

  function runFinal(src: string) {
    try {
      setJs(tsToJs(src));
      setFinalErr(null);
      setRunKey((k) => k + 1);
    } catch (e) {
      // Keep the last good preview running; just surface the syntax error.
      setFinalErr(e instanceof Error ? e.message : String(e));
    }
  }

  // When the build finishes, seed the editor with the whole program and run it
  // instantly. Clears any pending live-run when leaving the finished state.
  useEffect(() => {
    if (!done) return;
    const src = programThrough(pieces.length - 1);
    setFinalCode(src);
    runFinal(src);
    return () => {
      if (liveTimer.current) clearTimeout(liveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // Live-refresh the preview ~350ms after the last edit (debounced so we don't
  // reload the iframe on every keystroke).
  function onFinalChange(v: string) {
    setFinalCode(v);
    if (liveTimer.current) clearTimeout(liveTimer.current);
    liveTimer.current = setTimeout(() => runFinal(v), 350);
  }
  function resetFinal() {
    if (liveTimer.current) clearTimeout(liveTimer.current);
    const src = programThrough(pieces.length - 1);
    setFinalCode(src);
    runFinal(src);
  }

  const runnableNow = built >= RUNNABLE_FROM || done;
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <div class="body">
      <aside class={`sidebar${collapsed ? " collapsed" : ""}`}>
        <h2>Type it out</h2>
        <ol class="steplist">
          {pieces.map((p, i) => (
            <li key={p.id}>
              <button
                class={`step${i === idx ? " active" : ""}${i < idx ? " done" : ""}`}
                onClick={() => setIdx(i)}
                title={p.label}
              >
                <span class="num">{i < idx ? "✓" : i + 1}</span>
                <span class="step-label">{p.label}</span>
              </button>
            </li>
          ))}
        </ol>
        <p class="sidebar-foot">{Math.min(idx, pieces.length)} / {pieces.length} typed</p>
        <SidebarToggle collapsed={collapsed} onToggle={toggleCollapsed} />
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
            <p>
              Play it below with WASD or the arrow keys. 🎮 Want to change
              something? <strong>Edit the code</strong> on the left — your game
              updates as you type. Try a new color, a faster hero, or a bigger coin!
            </p>
          </article>
        ) : (
          <article class="prose" dangerouslySetInnerHTML={{ __html: explainHtml }} />
        )}

        {!done && (
          <div class="workbench">
            <section class="editor-pane">
              <div class="pane-bar">
                <span>Your turn — type it here</span>
                <span class="spacer" />
                <button class="btn" onClick={fillIn}>Fill it in</button>
                <button class="btn primary" onClick={check}>Check ✓</button>
              </div>
              <CodeEditor value={typed} onChange={(v) => { setTyped(v); setWrong(false); }} />
              {wrong && (
                <p class="learn-hint">
                  Not quite — match the “Type this” example below letter for letter
                  (don't worry about spaces). Or just tap <em>Fill it in</em>.
                </p>
              )}
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
              <div class="pane-bar">
                <span>Your whole program — edit it live!</span>
                <span class="spacer" />
                <button class="btn" onClick={resetFinal}>Reset</button>
              </div>
              <CodeEditor value={finalCode} onChange={onFinalChange} />
              {finalErr && <pre class="preview-error">{finalErr}</pre>}
            </section>
            <section class="preview-pane">
              <div class="pane-bar"><span>Your game</span></div>
              <Preview js={js} runKey={runKey} />
            </section>
          </div>
        )}

        {!done && (
          <div class="learn-aux">
            <details
              class="learn-collapse target"
              open={targetOpen}
              onToggle={(e) => setTargetOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary>✍️ Type this</summary>
              <pre>{pieceAdd(idx)}</pre>
            </details>

            {programSoFar && (
              <details
                class="learn-collapse"
                open={programOpen}
                onToggle={(e) => setProgramOpen((e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary>📜 Your program so far — {lineCount} {lineCount === 1 ? "line" : "lines"}</summary>
                <pre>{programSoFar}</pre>
              </details>
            )}
          </div>
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
