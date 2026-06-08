import { Signal } from "../core/Signal.js";
/**
 * In-process {@link Transport} for tests. Delivery is synchronous: `send`
 * immediately emits on the peer's `onMessage`, so a fake-clock test can drive
 * server ticks and client frames deterministically with no async flushing.
 *
 * Safe against reentrancy here because neither NetClient nor NetServer sends in
 * direct response to a received message — the server queues input and emits
 * snapshots from its tick loop.
 */
class MemoryTransport {
    constructor() {
        this.onMessage = new Signal();
        this.onClose = new Signal();
        this.peer = null;
        this._closed = false;
    }
    send(data) {
        if (this._closed)
            return;
        const peer = this.peer;
        if (!peer || peer._closed)
            return;
        peer.onMessage.emit(data);
    }
    close() {
        if (this._closed)
            return;
        this._closed = true;
        this.onClose.emit();
        const peer = this.peer;
        if (peer && !peer._closed)
            peer.close();
    }
}
/** Create two linked transports: one for the client, one for the server. */
export function createMemoryTransportPair() {
    const a = new MemoryTransport();
    const b = new MemoryTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
}
