import { useEffect, useRef, useState } from "preact/hooks";

const PREVIEW_URL = `${import.meta.env.BASE_URL}preview.html`;

export type PreviewSignal =
  | { kind: "ok" }
  | { kind: "hud"; text: string }
  | { kind: "error"; message: string };

interface Props {
  /** Transpiled JS to run. */
  js: string;
  /** Bump to force a fresh run (reloads the iframe → tears down the old loop). */
  runKey: number;
  /** Notified of run results + hud text (used to detect mission completion). */
  onSignal?: (signal: PreviewSignal) => void;
}

/**
 * Runs the tutorial code in a same-origin `<iframe>`. Each run reloads the iframe
 * (via the `runKey` query), so the previous game loop / WebGPU device / input
 * listeners are torn down for free, and a runtime error stays contained here.
 */
export function Preview({ js, runKey, onSignal }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const jsRef = useRef(js);
  jsRef.current = js;
  const signalRef = useRef(onSignal);
  signalRef.current = onSignal;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string; message?: string; text?: string };
      if (data?.type === "ready") {
        setError(null);
        frame.current?.contentWindow?.postMessage(
          { type: "run", code: jsRef.current },
          "*",
        );
      } else if (data?.type === "ok") {
        setError(null);
        signalRef.current?.({ kind: "ok" });
      } else if (data?.type === "hud") {
        signalRef.current?.({ kind: "hud", text: data.text ?? "" });
      } else if (data?.type === "error") {
        setError(data.message ?? "Error");
        signalRef.current?.({ kind: "error", message: data.message ?? "Error" });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div class="preview">
      <iframe
        ref={frame}
        class="preview-frame"
        title="Game preview"
        src={`${PREVIEW_URL}?r=${runKey}`}
      />
      {error && <pre class="preview-error">{error}</pre>}
    </div>
  );
}
