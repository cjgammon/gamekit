import { Signal } from "../core/Signal.js";
/**
 * Browser {@link Transport} over the native `WebSocket`. References the
 * `WebSocket` global, so it is exported only from `gamekit/net` — never from
 * the package root — keeping the headless server's `import "gamekit"` free of
 * any DOM dependency.
 */
export class WebSocketTransport {
    constructor(url) {
        this.onMessage = new Signal();
        this.onClose = new Signal();
        /** Fires when the socket opens. */
        this.onOpen = new Signal();
        this._ws = new WebSocket(url);
        this._ws.binaryType = "arraybuffer";
        this._ws.onopen = () => this.onOpen.emit();
        this._ws.onmessage = (e) => this.onMessage.emit(e.data);
        this._ws.onclose = () => this.onClose.emit();
    }
    send(data) {
        if (this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(data);
        }
    }
    close() {
        this._ws.close();
    }
}
