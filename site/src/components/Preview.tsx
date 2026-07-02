import { useEffect, useRef, useState } from "preact/hooks";
import type {
  ChildToParentMessage,
  ParentToChildMessage,
} from "../preview-protocol.js";

const PREVIEW_URL = `${import.meta.env.BASE_URL}preview.html`;

/** Every {@link ChildToParentMessage} except "ready", which Preview handles
 *  internally (it's what triggers sending "run") and never surfaces here. */
export type PreviewSignal = Exclude<ChildToParentMessage, { type: "ready" }>;

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
      const data = e.data as ChildToParentMessage | null;
      if (!data) return;
      switch (data.type) {
        case "ready": {
          setError(null);
          const run: ParentToChildMessage = { type: "run", code: jsRef.current };
          frame.current?.contentWindow?.postMessage(run, "*");
          break;
        }
        case "ok":
          setError(null);
          signalRef.current?.(data);
          break;
        case "error":
          setError(data.message);
          signalRef.current?.(data);
          break;
        case "hud":
          signalRef.current?.(data);
          break;
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
