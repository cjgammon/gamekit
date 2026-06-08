/** Adapts a {@link WebSocketConnection} to the shared {@link Transport}. */
export class ServerTransport {
    constructor(_conn) {
        this._conn = _conn;
    }
    get onMessage() {
        return this._conn.onMessage;
    }
    get onClose() {
        return this._conn.onClose;
    }
    send(data) {
        this._conn.send(data);
    }
    close() {
        this._conn.close();
    }
}
