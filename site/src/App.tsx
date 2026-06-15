import { useEffect, useMemo, useState } from "preact/hooks";
import { marked } from "marked";
import { steps } from "./tutorial/steps";
import { CodeEditor } from "./components/CodeEditor";
import { Preview, type PreviewSignal } from "./components/Preview";
import { tsToJs } from "./runner/transpile";

const STEP_KEY = "gamekit-tutorial-step";
const DONE_KEY = "gamekit-tutorial-done-v2";

function loadDone(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function App() {
  const [stepIndex, setStepIndex] = useState(() => {
    const n = Number(localStorage.getItem(STEP_KEY));
    return Number.isFinite(n) && n >= 0 && n < steps.length ? n : 0;
  });
  const [codeByStep, setCodeByStep] = useState<Record<string, string>>({});
  const [runKey, setRunKey] = useState(0);
  const [js, setJs] = useState("");
  const [ranSrc, setRanSrc] = useState(""); // source of the last run — goals check this, not live edits
  const [transpileError, setTranspileError] = useState<string | null>(null);

  // Mission tracking.
  const [ran, setRan] = useState(false);
  const [huds, setHuds] = useState<string[]>([]);
  const [done, setDone] = useState<Set<string>>(loadDone);
  const [celebrating, setCelebrating] = useState(false);

  const step = steps[stepIndex];
  const code = codeByStep[step.id] ?? step.starter;
  const prose = useMemo(() => marked.parse(step.prose) as string, [step.id]);

  const goalMet = step.goal.done({ code: ranSrc, starter: step.starter, ranOk: ran, huds });
  const won = goalMet || done.has(step.id);
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    localStorage.setItem(STEP_KEY, String(stepIndex));
  }, [stepIndex]);

  // Mark the step done + show the toast the first time its mission is met.
  useEffect(() => {
    if (!goalMet || done.has(step.id)) return;
    const next = new Set(done).add(step.id);
    setDone(next);
    localStorage.setItem(DONE_KEY, JSON.stringify([...next]));
    setCelebrating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalMet, step.id]);

  // Auto-hide the toast 2.6s after it appears (separate effect so frequent
  // re-renders from gameplay can't strand it on screen).
  useEffect(() => {
    if (!celebrating) return;
    const t = setTimeout(() => setCelebrating(false), 2600);
    return () => clearTimeout(t);
  }, [celebrating]);

  function doRun(src: string) {
    setRan(false);
    setHuds([]);
    setCelebrating(false);
    try {
      setJs(tsToJs(src));
      setRanSrc(src); // only counts as "run" once it transpiles
      setTranspileError(null);
      setRunKey((k) => k + 1);
    } catch (e) {
      setTranspileError(e instanceof Error ? e.message : String(e));
    }
  }

  // Auto-run when the step changes (and on first mount).
  useEffect(() => {
    doRun(codeByStep[step.id] ?? step.starter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  function onSignal(sig: PreviewSignal) {
    if (sig.kind === "ok") setRan(true);
    else if (sig.kind === "hud") setHuds((h) => [...h, sig.text]);
  }

  function setCode(v: string) {
    setCodeByStep((m) => ({ ...m, [step.id]: v }));
  }
  function reset() {
    setCodeByStep((m) => ({ ...m, [step.id]: step.starter }));
    doRun(step.starter);
  }
  const go = (i: number) => setStepIndex(Math.max(0, Math.min(steps.length - 1, i)));

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand">🎮 gamekit</div>
        <div class="tagline">Make your first game!</div>
        <nav class="toplinks">
          <a href="https://github.com/cjgammon/gamekit" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <div class="body">
        <aside class="sidebar">
          <h2>Your quest</h2>
          <ol class="steplist">
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  class={`step${i === stepIndex ? " active" : ""}${done.has(s.id) ? " done" : ""}`}
                  onClick={() => go(i)}
                >
                  <span class="num">{done.has(s.id) ? "✓" : i + 1}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
          <p class="sidebar-foot">{done.size} / {steps.length} done</p>
        </aside>

        <main class="main">
          <article class="prose" dangerouslySetInnerHTML={{ __html: prose }} />

          <div class={`mission${won ? " won" : ""}`}>
            <span class="mission-badge">{won ? "✅" : "🎯"}</span>
            <span class="mission-text">{won ? step.goal.cheer : step.goal.hint}</span>
            {won && !isLast && (
              <button class="btn primary mission-next" onClick={() => go(stepIndex + 1)}>
                Next →
              </button>
            )}
          </div>

          <div class="workbench">
            <section class="editor-pane">
              <div class="pane-bar">
                <span>Code</span>
                <span class="spacer" />
                <button class="btn" onClick={reset}>Reset</button>
                <button class="btn primary" onClick={() => doRun(code)}>Run ▶</button>
              </div>
              <CodeEditor value={code} onChange={setCode} />
              {transpileError && <pre class="preview-error">{transpileError}</pre>}
            </section>

            <section class="preview-pane">
              <div class="pane-bar">
                <span>Your game</span>
              </div>
              <Preview js={js} runKey={runKey} onSignal={onSignal} />
            </section>
          </div>

          <nav class="stepnav">
            <button class="btn" disabled={stepIndex === 0} onClick={() => go(stepIndex - 1)}>
              ← Back
            </button>
            <span class="progress">{stepIndex + 1} / {steps.length}</span>
            <button class={`btn${won ? " primary" : ""}`} disabled={isLast} onClick={() => go(stepIndex + 1)}>
              Next →
            </button>
          </nav>
        </main>
      </div>

      {celebrating && (
        <div class="celebrate" role="status">
          <div class="celebrate-card">
            <div class="celebrate-emoji">🎉</div>
            <div class="celebrate-text">{step.goal.cheer}</div>
          </div>
        </div>
      )}
    </div>
  );
}
