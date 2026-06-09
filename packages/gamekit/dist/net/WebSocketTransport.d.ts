import { Signal } from "../core/Signal.js";
import type { Transport } from "./Transport.js";
/**
 * Browser {@link Transport} over the native `WebSocket`. References the
 * `WebSocket` global, so it is exported only from `gamekit/net` — never from
 * the package root — keeping the headless server's `import "gamekit"` free of
 * any DOM dependency.
 */
export declare class WebSocketTransport implements Transport {
    readonly onMessage: Signal<string | ArrayBuffer>;
    readonly onClose: Signal<void>;
    /** Fires when the socket opens. */
    readonly onOpen: Signal<void>;
    private readonly _ws;
    constructor(url: string);
    send(data: string | ArrayBufferLike): void;
    close(): void;
}
