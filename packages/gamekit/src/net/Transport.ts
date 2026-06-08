import { Signal } from "../core/Signal.js";

/**
 * Bidirectional message channel between one client and the server. Net logic
 * (NetClient / NetServer) depends only on this interface, so it can run over a
 * real WebSocket in production or an in-memory pair in tests
 * ({@link createMemoryTransportPair}) without changing.
 *
 * Payloads are `string` (JSON) for this milestone; `ArrayBuffer` support is
 * built in so a future binary protocol needs no transport changes.
 */
export interface Transport {
  /** Send a message to the peer. No-op once closed. */
  send(data: string | ArrayBufferLike): void;
  /** Fires for each message received from the peer. */
  readonly onMessage: Signal<string | ArrayBuffer>;
  /** Fires once when the channel closes (either side). */
  readonly onClose: Signal<void>;
  /** Close the channel. Idempotent. */
  close(): void;
}
