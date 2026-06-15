import { useEffect, useMemo, useState } from "preact/hooks";
import { marked } from "marked";
import { steps } from "./tutorial/steps";
import { CodeEditor } from "./components/CodeEditor";
import { Preview } from "./components/Preview";
import { tsToJs } from "./runner/transpile";

const STORAGE_KEY = "gamekit-tutorial-step";

export function App() {
  const [stepIndex, setStepIndex] = useState(() => {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(n) && n >= 0 && n < steps.length ? n : 0;
  });
  const [codeByStep, setCodeByStep] = useState<Record<string, string>>({});
  const [runKey, setRunKey] = useState(0);
  const [js, setJs] = useState("");
  const [transpileError, setTranspileError] = useState<string | null>(null);

  const step = steps[stepIndex];
  const code = codeByStep[step.id] ?? step.starter;
  const prose = useMemo(() => marked.parse(step.prose) as string, [step.id]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(stepIndex));
  }, [stepIndex]);

  function doRun(src: string) {
    try {
      setJs(tsToJs(src));
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

  function setCode(v: string) {
    setCodeByStep((m) => ({ ...m, [step.id]: v }));
  }
  function reset() {
    setCodeByStep((m) => ({ ...m, [step.id]: step.starter }));
    doRun(step.starter);
  }

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand">🎮 gamekit</div>
        <nav class="toplinks">
          <a href="https://github.com/cjgammon/gamekit" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <div class="body">
        <aside class="sidebar">
          <h2>Get Started</h2>
          <ol class="steplist">
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  class={i === stepIndex ? "step active" : "step"}
                  onClick={() => setStepIndex(i)}
                >
                  <span class="num">{i + 1}</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main class="main">
          <article class="prose" dangerouslySetInnerHTML={{ __html: prose }} />

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
                <span>Preview</span>
              </div>
              <Preview js={js} runKey={runKey} />
            </section>
          </div>

          <nav class="stepnav">
            <button class="btn" disabled={stepIndex === 0} onClick={() => setStepIndex(stepIndex - 1)}>
              ← Prev
            </button>
            <span class="progress">{stepIndex + 1} / {steps.length}</span>
            <button
              class="btn"
              disabled={stepIndex === steps.length - 1}
              onClick={() => setStepIndex(stepIndex + 1)}
            >
              Next →
            </button>
          </nav>
        </main>
      </div>
    </div>
  );
}
