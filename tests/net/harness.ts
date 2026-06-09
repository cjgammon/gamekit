import { ServerGame } from "../../packages/gamekit-server/src/index.js";
import {
  Entity,
  NetClient,
  PLAYER_SIZE,
  PLAYER_SPEED,
  createMemoryTransportPair,
  simulatePlayer,
  type SimulateFn,
  type Transport,
} from "gamekit";

/** Matches the server's PlayerEntity simulation — for client prediction tests. */
export const playerSim: SimulateFn = (e, input, dt, ctx) => {
  simulatePlayer(e, input, dt, {
    speed: PLAYER_SPEED,
    worldW: ctx.worldW,
    worldH: ctx.worldH,
  });
};

/** A test player: holds the latest input the test asked it to send. */
export interface TestClient {
  client: NetClient;
  /** Entities the client currently believes exist, by NetId. */
  spawned: Map<number, Entity>;
  transport: Transport;
}

/**
 * In-process server + clients over the in-memory transport, driven by a shared
 * fake clock so interpolation timing is deterministic. tickRate 20 → 50ms/tick.
 */
export function createHarness(opts?: {
  width?: number;
  height?: number;
  tickRate?: number;
}) {
  let clock = 0;
  const now = () => clock;

  const server = new ServerGame(
    {
      width: opts?.width ?? 800,
      height: opts?.height ?? 600,
      tickRate: opts?.tickRate ?? 20,
    },
    { now },
  );

  return {
    server,
    now,
    get clock() {
      return clock;
    },
    advance(ms: number) {
      clock += ms;
    },
    tick() {
      server.tick();
    },
    /** Connect a new client. NetClient is created BEFORE accept so the
     *  synchronously-delivered welcome isn't missed. Pass `predict: true` to
     *  enable local-player prediction (2b). */
    addClient(clientOpts?: { predict?: boolean }): TestClient {
      const [clientT, serverT] = createMemoryTransportPair();
      const spawned = new Map<number, Entity>();
      const client = new NetClient({
        transport: clientT,
        factory: () => {
          const e = new Entity();
          e.width = PLAYER_SIZE;
          e.height = PLAYER_SIZE;
          return e;
        },
        onSpawn: (id, e) => spawned.set(id, e),
        onDespawn: (id) => spawned.delete(id),
        now,
        simulate: clientOpts?.predict ? playerSim : undefined,
      });
      server.accept(serverT);
      return { client, spawned, transport: clientT };
    },
  };
}
