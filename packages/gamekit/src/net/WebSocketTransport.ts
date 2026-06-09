import { Signal } from "../core/Signal.js";
import type { Transport } from "./Transport.js";

/**
 * Browser {@link Transport} over the native `WebSocket`. References the
 * `WebSocket` global, so it is exported only from `gamekit/net` — never from
 * the package root — keeping the headless server's `import "gamekit"` free of
 * any DOM dependency.
 */
export class WebSocketTransport implements Transport {
  readonly onMessage = new Signal<string | ArrayBuffer>();
  readonly onClose = new Signal<void>();
  /** Fires when the socket opens. */
  readonly onOpen = new Signal<void>();

  private readonly _ws: WebSocket;

  constructor(url: string) {
    this._ws = new WebSocket(url);
    this._ws.binaryType = "arraybuffer";
    this._ws.onopen = () => this.onOpen.emit();
    this._ws.onmessage = (e) => this.onMessage.emit(e.data);
    this._ws.onclose = () => this.onClose.emit();
  }

  send(data: string | ArrayBufferLike): void {
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(data as string | ArrayBuffer);
    }
  }

  close(): void {
    this._ws.close();
  }
}
