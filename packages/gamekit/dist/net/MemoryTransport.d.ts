import type { Transport } from "./Transport.js";
/** Create two linked transports: one for the client, one for the server. */
export declare function createMemoryTransportPair(): [Transport, Transport];
